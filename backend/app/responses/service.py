"""Native response-domain validation, persistence, and retrieval helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session, sessionmaker

from app.execution.service import ExecutionTransitionService
from app.responses.models import (
    NormalizedResponsesRequest,
    ResponseObject,
    build_response_object,
    new_response_id,
)
from app.storage.runtime_responses_repository import RuntimeResponseORM

if TYPE_CHECKING:
    from app.api.runtime.schemas import ResponsesRequest


class ResponsesRequestValidationError(ValueError):
    """Raised when a responses request violates native runtime constraints."""

    def __init__(
        self,
        *,
        error_type: str,
        message: str,
        status_code: int,
        param: str | None = None,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.status_code = status_code
        self.param = param
        self.code = code


class ResponseNotFoundError(RuntimeError):
    """Raised when a response record does not exist in the company scope."""


@dataclass(frozen=True)
class QueuedResponseExecutionPayload:
    response_id: str
    instance_id: str
    request_path: str
    created_at: int
    current_body: dict[str, Any]
    request: NormalizedResponsesRequest


class ResponsesService:
    """Owns native responses request validation and persisted response objects."""

    _KNOWN_UNSUPPORTED_FIELDS: dict[str, str] = {
        "conversation": "Conversation state is not implemented on the ForgeFrame responses path.",
        "previous_response_id": "previous_response_id is not implemented on the ForgeFrame responses path.",
        "store": "Response storage toggles are not implemented on the ForgeFrame responses path.",
        "include": "include expansions are not implemented on the ForgeFrame responses path.",
        "max_tool_calls": "max_tool_calls is not implemented on the ForgeFrame responses path.",
        "parallel_tool_calls": "parallel_tool_calls is not implemented on the ForgeFrame responses path.",
        "reasoning": "reasoning controls are not implemented on the ForgeFrame responses path.",
        "text": "text format controls are not implemented on the ForgeFrame responses path.",
    }

    _CONTENT_BLOCK_TYPES = {"input_text", "text", "output_text", "input_image", "image_url"}
    _MESSAGE_ROLES = {"system", "developer", "user", "assistant", "tool"}

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        *,
        execution: ExecutionTransitionService,
    ) -> None:
        self._session_factory = session_factory
        self._execution = execution

    @staticmethod
    def _now(now: datetime | None = None) -> datetime:
        if now is None:
            return datetime.now(tz=UTC)
        if now.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return now.astimezone(UTC)

    @staticmethod
    def _new_message_id() -> str:
        return f"msg_{new_response_id().split('_', 1)[1]}"

    @staticmethod
    def _new_function_item_id(prefix: str) -> str:
        return f"{prefix}_{new_response_id().split('_', 1)[1]}"

    @staticmethod
    def response_controls_for_request(request: NormalizedResponsesRequest) -> dict[str, object]:
        controls: dict[str, object] = {}
        if request.max_output_tokens is not None:
            controls["max_output_tokens"] = request.max_output_tokens
        if request.temperature is not None:
            controls["temperature"] = request.temperature
        if request.metadata:
            controls["metadata"] = dict(request.metadata)
        return controls

    @classmethod
    def _unsupported_parameter(cls, field: str, message: str | None = None) -> ResponsesRequestValidationError:
        return ResponsesRequestValidationError(
            error_type="unsupported_parameter",
            message=message or cls._KNOWN_UNSUPPORTED_FIELDS.get(field, f"Unsupported parameter '{field}'."),
            status_code=422,
            param=field,
            code="unsupported_parameter",
        )

    @classmethod
    def _normalize_content_block(cls, block: Any) -> dict[str, Any]:
        if not isinstance(block, dict):
            return {"type": "input_text", "text": str(block)}

        block_type = str(block.get("type", "") or "")
        if block_type not in cls._CONTENT_BLOCK_TYPES:
            raise ResponsesRequestValidationError(
                error_type="unsupported_input",
                message=f"Unsupported responses content block type '{block_type or 'unknown'}'.",
                status_code=422,
            )

        if block_type in {"input_text", "text", "output_text"}:
            return {"type": "input_text", "text": str(block.get("text", "") or "")}

        if block.get("file_id") is not None:
            raise ResponsesRequestValidationError(
                error_type="unsupported_input",
                message="Responses image inputs on the current runtime path require image_url or data URLs; file_id is not supported.",
                status_code=422,
                param="input.file_id",
            )

        raw_image_url = block.get("image_url", block.get("url"))
        if isinstance(raw_image_url, dict):
            if raw_image_url.get("file_id") is not None:
                raise ResponsesRequestValidationError(
                    error_type="unsupported_input",
                    message="Responses image inputs on the current runtime path require image_url or data URLs; file_id is not supported.",
                    status_code=422,
                    param="input.image_url.file_id",
                )
            image_url = str(raw_image_url.get("url", "") or "").strip()
            detail = raw_image_url.get("detail", block.get("detail"))
        else:
            image_url = str(raw_image_url or "").strip()
            detail = block.get("detail")
        if not image_url:
            raise ResponsesRequestValidationError(
                error_type="unsupported_input",
                message="Responses image input blocks must include a non-empty image_url.",
                status_code=422,
                param="input.image_url",
            )

        normalized: dict[str, Any] = {
            "type": "input_image",
            "image_url": image_url,
        }
        if detail is not None:
            normalized["detail"] = detail
        return normalized

    @classmethod
    def _normalize_message_content(cls, content: Any) -> list[dict[str, Any]]:
        if content is None:
            return [{"type": "input_text", "text": " "}]
        if isinstance(content, str):
            return [{"type": "input_text", "text": content}]
        if isinstance(content, list):
            return [cls._normalize_content_block(block) for block in content]
        return [cls._normalize_content_block(content)]

    @classmethod
    def _normalize_function_call(cls, item: dict[str, Any]) -> dict[str, Any]:
        call_id = str(item.get("call_id") or item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        arguments = item.get("arguments", "")
        if not call_id:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="function_call items require a non-empty call_id or id.",
                status_code=422,
                param="input.call_id",
            )
        if not name:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="function_call items require a non-empty name.",
                status_code=422,
                param="input.name",
            )
        return {
            "id": str(item.get("id") or call_id or cls._new_function_item_id("fc")),
            "type": "function_call",
            "call_id": call_id,
            "name": name,
            "arguments": str(arguments or ""),
            "status": "completed",
        }

    @classmethod
    def _normalize_function_call_output(cls, item: dict[str, Any]) -> dict[str, Any]:
        call_id = str(item.get("call_id") or "").strip()
        if not call_id:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="function_call_output items require a non-empty call_id.",
                status_code=422,
                param="input.call_id",
            )
        output = item.get("output", "")
        if isinstance(output, list):
            normalized_output: str | list[dict[str, Any]] = [cls._normalize_content_block(block) for block in output]
        elif isinstance(output, str):
            normalized_output = output
        else:
            normalized_output = str(output)
        return {
            "id": str(item.get("id") or cls._new_function_item_id("fco")),
            "type": "function_call_output",
            "call_id": call_id,
            "output": normalized_output,
            "status": "completed",
        }

    @classmethod
    def _normalize_message_item(cls, item: dict[str, Any]) -> dict[str, Any]:
        role = str(item.get("role", "user") or "user")
        if role not in cls._MESSAGE_ROLES:
            raise ResponsesRequestValidationError(
                error_type="unsupported_input",
                message=f"Unsupported responses input role '{role}'.",
                status_code=422,
                param="input.role",
            )
        if "content" not in item:
            raise ResponsesRequestValidationError(
                error_type="unsupported_input",
                message="Responses input message objects must contain a 'content' field.",
                status_code=422,
                param="input.content",
            )
        return {
            "id": str(item.get("id") or cls._new_message_id()),
            "type": "message",
            "role": role,
            "status": "completed",
            "content": cls._normalize_message_content(item.get("content")),
        }

    @classmethod
    def _normalize_input_item(cls, item: Any) -> dict[str, Any]:
        if not isinstance(item, dict):
            return {
                "id": cls._new_message_id(),
                "type": "message",
                "role": "user",
                "status": "completed",
                "content": [{"type": "input_text", "text": str(item)}],
            }

        item_type = str(item.get("type", "") or "")
        if item_type == "message":
            return cls._normalize_message_item(item)
        if item_type == "function_call":
            return cls._normalize_function_call(item)
        if item_type == "function_call_output":
            return cls._normalize_function_call_output(item)
        if "role" in item or "content" in item:
            return cls._normalize_message_item(item)
        if item_type in cls._CONTENT_BLOCK_TYPES:
            return {
                "id": cls._new_message_id(),
                "type": "message",
                "role": "user",
                "status": "completed",
                "content": [cls._normalize_content_block(item)],
            }
        raise ResponsesRequestValidationError(
            error_type="unsupported_input",
            message=f"Unsupported responses input item type '{item_type or 'unknown'}'.",
            status_code=422,
        )

    @classmethod
    def _normalize_input(cls, input_value: Any) -> list[dict[str, Any]]:
        if isinstance(input_value, list):
            if input_value and all(isinstance(item, dict) and str(item.get("type", "") or "") in cls._CONTENT_BLOCK_TYPES for item in input_value):
                return [
                    {
                        "id": cls._new_message_id(),
                        "type": "message",
                        "role": "user",
                        "status": "completed",
                        "content": [cls._normalize_content_block(item) for item in input_value],
                    }
                ]
            return [cls._normalize_input_item(item) for item in input_value]
        return [cls._normalize_input_item(input_value)]

    @classmethod
    def _input_items_have_content(cls, input_items: list[dict[str, Any]]) -> bool:
        for item in input_items:
            item_type = str(item.get("type", "") or "")
            if item_type in {"function_call", "function_call_output"}:
                return True
            for block in item.get("content") or []:
                block_type = str(block.get("type", "") or "")
                if block_type == "input_text" and str(block.get("text", "") or "").strip():
                    return True
                if block_type == "input_image" and str(block.get("image_url", "") or "").strip():
                    return True
        return False

    def normalize_request(self, payload: ResponsesRequest) -> NormalizedResponsesRequest:
        extras = dict(getattr(payload, "model_extra", None) or {})
        unknown_fields = [field for field in sorted(extras) if field not in self._KNOWN_UNSUPPORTED_FIELDS]
        if unknown_fields:
            listed = ", ".join(unknown_fields)
            raise ResponsesRequestValidationError(
                error_type="unsupported_parameter",
                message=f"Unsupported /v1/responses fields: {listed}.",
                status_code=422,
                param=unknown_fields[0],
                code="unsupported_parameter",
            )
        if extras:
            fields = sorted(extras)
            if len(fields) == 1:
                raise self._unsupported_parameter(fields[0])
            listed = ", ".join(fields)
            raise ResponsesRequestValidationError(
                error_type="unsupported_parameter",
                message=f"Unsupported /v1/responses fields: {listed}.",
                status_code=422,
                param=fields[0],
                code="unsupported_parameter",
            )
        if payload.background and payload.stream:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="background mode cannot be combined with stream=true on the ForgeFrame responses path.",
                status_code=400,
                param="background",
            )
        if payload.max_output_tokens is not None and payload.max_output_tokens <= 0:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="max_output_tokens must be > 0 when provided.",
                status_code=400,
                param="max_output_tokens",
            )
        if payload.temperature is not None and not 0 <= payload.temperature <= 2:
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="temperature must be between 0 and 2.",
                status_code=400,
                param="temperature",
            )

        input_items = self._normalize_input(payload.input)
        if not self._input_items_have_content(input_items):
            raise ResponsesRequestValidationError(
                error_type="invalid_request",
                message="input must not be empty.",
                status_code=400,
                param="input",
            )

        return NormalizedResponsesRequest(
            model=payload.model,
            instructions=payload.instructions,
            input_items=input_items,
            stream=payload.stream,
            background=payload.background,
            tools=list(payload.tools or []),
            tool_choice=payload.tool_choice,
            metadata=dict(payload.metadata or {}),
            client=dict(payload.client or {}),
            max_output_tokens=payload.max_output_tokens,
            temperature=payload.temperature,
        )

    def create_background_response(
        self,
        *,
        company_id: str,
        instance_id: str,
        account_id: str | None,
        request_path: str,
        request: NormalizedResponsesRequest,
        request_fingerprint_hash: str,
        now: datetime | None = None,
    ) -> tuple[ResponseObject, str]:
        current_time = self._now(now)
        response_id = new_response_id()
        created_at = int(current_time.timestamp())
        execution_result = self._execution.admit_create(
            company_id=company_id,
            actor_type="system",
            actor_id=account_id or "anonymous_runtime",
            idempotency_key=response_id,
            request_fingerprint_hash=request_fingerprint_hash or response_id,
            run_kind="responses_background",
            execution_lane="background_agentic",
            now=current_time,
        )
        response = build_response_object(
            response_id=response_id,
            created_at=created_at,
            status="queued",
            background=True,
            model=request.model,
            metadata=request.metadata,
        )
        self.save_response_snapshot(
            response_id=response_id,
            company_id=company_id,
            instance_id=instance_id,
            account_id=account_id,
            request_path=request_path,
            processing_mode="background",
            stream=False,
            request=request,
            body=response.model_dump(),
            lifecycle_status="queued",
            execution_run_id=execution_result.run_id,
            now=current_time,
        )
        return response, execution_result.run_id

    def save_response_snapshot(
        self,
        *,
        response_id: str,
        company_id: str,
        instance_id: str,
        account_id: str | None,
        request_path: str,
        processing_mode: str,
        stream: bool,
        request: NormalizedResponsesRequest,
        body: dict[str, Any],
        lifecycle_status: str,
        resolved_model: str | None = None,
        provider_key: str | None = None,
        error_json: dict[str, Any] | None = None,
        execution_run_id: str | None = None,
        now: datetime | None = None,
    ) -> None:
        current_time = self._now(now)
        completed_at = current_time if lifecycle_status in {"completed", "failed", "incomplete"} else None
        with self._session_factory() as session, session.begin():
            record = session.get(RuntimeResponseORM, response_id)
            if record is None:
                record = RuntimeResponseORM(
                    id=response_id,
                    company_id=company_id,
                    instance_id=instance_id,
                    account_id=account_id,
                    request_path=request_path,
                    processing_mode=processing_mode,
                    lifecycle_status=lifecycle_status,
                    background=request.background,
                    stream=stream,
                    requested_model=request.model,
                    resolved_model=resolved_model,
                    provider_key=provider_key,
                    instructions=request.instructions,
                    input_items=list(request.input_items),
                    request_tools=list(request.tools),
                    request_tool_choice=request.tool_choice,
                    request_metadata=dict(request.metadata),
                    request_controls=self.response_controls_for_request(request),
                    request_client=dict(request.client),
                    response_body=dict(body),
                    error_json=dict(error_json) if error_json else None,
                    execution_run_id=execution_run_id,
                    created_at=current_time,
                    updated_at=current_time,
                    completed_at=completed_at,
                )
                session.add(record)
                return

            record.instance_id = instance_id
            record.account_id = account_id
            record.lifecycle_status = lifecycle_status
            record.background = request.background
            record.stream = stream
            record.requested_model = request.model
            record.resolved_model = resolved_model
            record.provider_key = provider_key
            record.instructions = request.instructions
            record.input_items = list(request.input_items)
            record.request_tools = list(request.tools)
            record.request_tool_choice = request.tool_choice
            record.request_metadata = dict(request.metadata)
            record.request_controls = self.response_controls_for_request(request)
            record.request_client = dict(request.client)
            record.response_body = dict(body)
            record.error_json = dict(error_json) if error_json else None
            record.execution_run_id = execution_run_id or record.execution_run_id
            record.updated_at = current_time
            record.completed_at = completed_at

    def get_background_execution_payload(
        self,
        *,
        company_id: str,
        execution_run_id: str,
    ) -> QueuedResponseExecutionPayload:
        with self._session_factory() as session:
            record = (
                session.query(RuntimeResponseORM)
                .filter(
                    RuntimeResponseORM.company_id == company_id,
                    RuntimeResponseORM.execution_run_id == execution_run_id,
                )
                .order_by(RuntimeResponseORM.created_at.desc())
                .first()
            )
            if record is None:
                raise ResponseNotFoundError(
                    f"Background response for run '{execution_run_id}' was not found for company '{company_id}'."
                )

            controls = dict(record.request_controls or {})
            metadata = dict(record.request_metadata or {})
            if not metadata:
                controls_metadata = controls.get("metadata")
                if isinstance(controls_metadata, dict):
                    metadata = dict(controls_metadata)
            request = NormalizedResponsesRequest(
                model=record.requested_model,
                instructions=record.instructions,
                input_items=list(record.input_items or []),
                stream=bool(record.stream),
                background=bool(record.background),
                tools=list(record.request_tools or []),
                tool_choice=record.request_tool_choice,
                metadata=metadata,
                client=dict(record.request_client or {}),
                max_output_tokens=(
                    int(controls["max_output_tokens"])
                    if controls.get("max_output_tokens") is not None
                    else None
                ),
                temperature=(
                    float(controls["temperature"])
                    if controls.get("temperature") is not None
                    else None
                ),
            )
            created_at = int(record.response_body.get("created_at") or int(record.created_at.timestamp()))
            return QueuedResponseExecutionPayload(
                response_id=record.id,
                instance_id=record.instance_id or record.company_id,
                request_path=record.request_path,
                created_at=created_at,
                current_body=dict(record.response_body),
                request=request,
            )

    def get_response(self, *, company_id: str, response_id: str) -> dict[str, Any]:
        with self._session_factory() as session:
            record = session.get(RuntimeResponseORM, response_id)
            if record is None or record.company_id != company_id:
                raise ResponseNotFoundError(f"Response '{response_id}' was not found for company '{company_id}'.")
            return dict(record.response_body)

    def get_response_input_items(self, *, company_id: str, response_id: str) -> dict[str, Any]:
        with self._session_factory() as session:
            record = session.get(RuntimeResponseORM, response_id)
            if record is None or record.company_id != company_id:
                raise ResponseNotFoundError(f"Response '{response_id}' was not found for company '{company_id}'.")
            items = list(record.input_items or [])
            first_id = next((str(item.get("id")) for item in items if item.get("id")), None)
            last_id = next((str(item.get("id")) for item in reversed(items) if item.get("id")), None)
            return {
                "object": "list",
                "data": items,
                "first_id": first_id,
                "last_id": last_id,
                "has_more": False,
            }
