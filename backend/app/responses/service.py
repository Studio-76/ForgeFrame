"""Native response-domain validation, persistence, and retrieval helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session, sessionmaker

from app.execution.service import ExecutionTransitionService
from app.product_taxonomy import (
    NativeCommandRecord,
    NativeProductObjectRef,
    RuntimeNativeMapping,
    attach_runtime_native_mapping,
    extract_runtime_native_mapping,
    normalize_runtime_native_mapping,
)
from app.responses.models import (
    NormalizedResponsesRequest,
    ResponseObject,
    build_response_object,
    new_response_id,
)
from app.storage.runtime_responses_repository import (
    NativeResponseEventORM,
    NativeResponseFollowObjectORM,
    NativeResponseItemORM,
    NativeResponseMappingORM,
    NativeResponseORM,
    NativeResponseStreamEventORM,
    NativeResponseToolCallORM,
    NativeResponseToolOutputORM,
    RuntimeResponseORM,
)

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
    native_mapping: dict[str, Any]


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

    @staticmethod
    def build_sync_runtime_native_mapping(
        *,
        request_path: str,
        response_id: str,
        stream: bool,
        requested_model: str | None,
        resolved_model: str | None = None,
        provider_key: str | None = None,
        lifecycle_status: str = "in_progress",
        note: str | None = None,
    ) -> dict[str, Any]:
        notes = [note] if note else []
        if not notes:
            notes.append(
                "This /v1/responses path emits an OpenAI-compatible envelope, but the durable product truth is persisted as native ForgeFrame response objects."
            )
        return RuntimeNativeMapping(
            request_path=request_path,
            response_id=response_id,
            processing_mode="sync",
            stream=stream,
            background=False,
            primary_native_object_kind="response",
            objects=[
                NativeProductObjectRef(
                    kind="response",
                    object_id=response_id,
                    relation="primary_follow_object",
                    lifecycle_state=lifecycle_status,
                    details={
                        "requested_model": requested_model,
                        "resolved_model": resolved_model,
                        "provider_key": provider_key,
                    },
                )
            ],
            route_context={
                "requested_model": requested_model,
                "resolved_model": resolved_model,
                "provider_key": provider_key,
            },
            notes=notes,
        ).model_dump(mode="json")

    @staticmethod
    def build_background_admission_native_mapping(
        *,
        request_path: str,
        response_id: str,
        requested_model: str | None,
        command_id: str,
        run_id: str,
        attempt_id: str | None,
        run_state: str,
        operator_state: str | None,
        execution_lane: str | None,
        outbox_event: str | None,
    ) -> dict[str, Any]:
        objects = [
            NativeProductObjectRef(
                kind="run",
                object_id=run_id,
                relation="primary_follow_object",
                lifecycle_state=run_state,
                details={
                    "operator_state": operator_state,
                    "execution_lane": execution_lane,
                },
            )
        ]
        if attempt_id:
            objects.append(
                NativeProductObjectRef(
                    kind="dispatch_job",
                    object_id=attempt_id,
                    relation="dispatch_attempt",
                    lifecycle_state=run_state,
                    details={
                        "operator_state": operator_state,
                        "outbox_event": outbox_event,
                    },
                )
            )
        return RuntimeNativeMapping(
            request_path=request_path,
            response_id=response_id,
            processing_mode="background",
            stream=False,
            background=True,
            primary_native_object_kind="run",
            objects=objects,
            commands=[
                NativeCommandRecord(
                    command_kind="start_run",
                    command_id=command_id,
                    status="accepted",
                    actor_type="system",
                    details={
                        "run_id": run_id,
                        "attempt_id": attempt_id,
                        "raw_command_type": "create",
                    },
                )
            ],
            route_context={
                "requested_model": requested_model,
                "run_id": run_id,
                "attempt_id": attempt_id,
                "execution_lane": execution_lane,
                "outbox_event": outbox_event,
            },
            notes=[
                "This background /v1/responses path created durable ForgeFrame execution objects instead of completing inline on the OpenAI-compatible surface."
            ],
        ).model_dump(mode="json")

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
            native_mapping=self.build_background_admission_native_mapping(
                request_path=request_path,
                response_id=response_id,
                requested_model=request.model,
                command_id=execution_result.command_id,
                run_id=execution_result.run_id,
                attempt_id=execution_result.attempt_id,
                run_state=execution_result.run_state,
                operator_state=execution_result.operator_state,
                execution_lane=execution_result.execution_lane,
                outbox_event=execution_result.outbox_event,
            ),
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

    @staticmethod
    def _native_item_row_id(response_id: str, phase: str, item_index: int) -> str:
        return f"{response_id}:{phase}:item:{item_index}"

    @staticmethod
    def _native_tool_call_row_id(response_id: str, phase: str, call_id: str) -> str:
        return f"{response_id}:{phase}:tool_call:{call_id}"

    @staticmethod
    def _native_tool_output_row_id(response_id: str, call_id: str, output_index: int) -> str:
        return f"{response_id}:tool_output:{call_id}:{output_index}"

    @staticmethod
    def _native_follow_object_row_id(response_id: str, relation: str, object_id: str, index: int) -> str:
        return f"{response_id}:follow:{relation}:{object_id}:{index}"

    @staticmethod
    def _native_event_id(response_id: str, sequence_no: int) -> str:
        return f"{response_id}:event:{sequence_no}"

    @staticmethod
    def _native_stream_event_id(response_id: str, sequence_no: int) -> str:
        return f"{response_id}:stream:{sequence_no}"

    def _append_native_response_event(
        self,
        session: Session,
        *,
        company_id: str,
        response_id: str,
        lifecycle_status: str,
        payload_json: dict[str, Any],
        current_time: datetime,
    ) -> None:
        last_event = (
            session.query(NativeResponseEventORM)
            .filter(
                NativeResponseEventORM.company_id == company_id,
                NativeResponseEventORM.response_id == response_id,
            )
            .order_by(NativeResponseEventORM.sequence_no.desc())
            .first()
        )
        if last_event is not None and last_event.lifecycle_status == lifecycle_status and dict(last_event.payload_json or {}) == payload_json:
            return
        sequence_no = 1 if last_event is None else int(last_event.sequence_no) + 1
        event_type = "response.created" if last_event is None else f"response.{lifecycle_status}"
        session.add(
            NativeResponseEventORM(
                event_id=self._native_event_id(response_id, sequence_no),
                company_id=company_id,
                response_id=response_id,
                sequence_no=sequence_no,
                event_type=event_type,
                lifecycle_status=lifecycle_status,
                payload_json=payload_json,
                created_at=current_time,
            )
            )

    def _augment_runtime_native_mapping(
        self,
        *,
        response_id: str,
        lifecycle_status: str,
        request: NormalizedResponsesRequest,
        resolved_model: str | None,
        provider_key: str | None,
        body: dict[str, Any],
        normalized_native_mapping: dict[str, Any],
    ) -> dict[str, Any]:
        mapping = normalize_runtime_native_mapping(normalized_native_mapping)
        route_context = dict(mapping.get("route_context") or {})
        objects = list(mapping.get("objects") or [])
        seen = {
            (
                str(item.get("kind") or ""),
                str(item.get("object_id") or ""),
                str(item.get("relation") or ""),
            )
            for item in objects
            if isinstance(item, dict)
        }

        def append_object(ref: NativeProductObjectRef) -> None:
            payload = ref.model_dump(mode="json")
            key = (
                str(payload.get("kind") or ""),
                str(payload.get("object_id") or ""),
                str(payload.get("relation") or ""),
            )
            if key in seen:
                return
            objects.append(payload)
            seen.add(key)

        append_object(
            NativeProductObjectRef(
                kind="response",
                object_id=response_id,
                relation="primary_follow_object",
                lifecycle_state=lifecycle_status,
                details={
                    "requested_model": request.model,
                    "resolved_model": resolved_model,
                    "provider_key": provider_key,
                },
            )
        )

        input_items = list(request.input_items or [])
        output_items = list(body.get("output") or [])
        input_tool_call_count = 0
        output_tool_call_count = 0
        tool_output_count = 0
        for phase, items in (("input", input_items), ("output", output_items)):
            for item_index, item in enumerate(items):
                payload = dict(item) if isinstance(item, dict) else {"value": item}
                item_object_id = str(
                    payload.get("id")
                    or self._native_item_row_id(response_id, phase, item_index)
                )
                item_type = str(payload.get("type") or "unknown")
                append_object(
                    NativeProductObjectRef(
                        kind="response_item",
                        object_id=item_object_id,
                        relation=f"{phase}_item",
                        lifecycle_state=str(payload.get("status") or lifecycle_status),
                        label=item_type,
                        details={
                            "phase": phase,
                            "item_index": item_index,
                            "item_type": item_type,
                            "role": payload.get("role"),
                        },
                    )
                )
                if item_type == "function_call":
                    call_id = str(payload.get("call_id") or payload.get("id") or "")
                    if call_id:
                        tool_call_row_id = self._native_tool_call_row_id(response_id, phase, call_id)
                        append_object(
                            NativeProductObjectRef(
                                kind="response_tool_call",
                                object_id=tool_call_row_id,
                                relation=f"{phase}_tool_call",
                                lifecycle_state=str(payload.get("status") or lifecycle_status),
                                label=str(payload.get("name") or call_id),
                                details={
                                    "phase": phase,
                                    "call_id": call_id,
                                    "item_id": payload.get("id"),
                                    "provider_key": provider_key,
                                },
                            )
                        )
                        if phase == "input":
                            input_tool_call_count += 1
                        else:
                            output_tool_call_count += 1
                if item_type == "function_call_output":
                    call_id = str(payload.get("call_id") or "")
                    if call_id:
                        tool_output_count += 1
                        append_object(
                            NativeProductObjectRef(
                                kind="response_tool_output",
                                object_id=self._native_tool_output_row_id(response_id, call_id, item_index),
                                relation="tool_output",
                                lifecycle_state=str(payload.get("status") or lifecycle_status),
                                label=call_id,
                                details={
                                    "phase": phase,
                                    "call_id": call_id,
                                    "output_index": item_index,
                                },
                            )
                        )

        route_context.update(
            {
                "requested_model": request.model,
                "resolved_model": resolved_model,
                "provider_key": provider_key,
                "input_item_count": len(input_items),
                "output_item_count": len(output_items),
                "input_tool_call_count": input_tool_call_count,
                "output_tool_call_count": output_tool_call_count,
                "tool_output_count": tool_output_count,
            }
        )
        mapping["route_context"] = route_context
        mapping["objects"] = objects
        notes = [str(note) for note in mapping.get("notes") or [] if str(note).strip()]
        native_projection_note = (
            "Native response projections include persisted response items, tool calls, tool outputs, "
            "follow objects, lifecycle events, and stream events."
        )
        if native_projection_note not in notes:
            notes.append(native_projection_note)
        mapping["notes"] = notes
        return mapping

    def _replace_native_response_projection(
        self,
        session: Session,
        *,
        response_id: str,
        company_id: str,
        instance_id: str,
        account_id: str | None,
        request_path: str,
        processing_mode: str,
        lifecycle_status: str,
        request: NormalizedResponsesRequest,
        stream: bool,
        resolved_model: str | None,
        provider_key: str | None,
        body: dict[str, Any],
        normalized_native_mapping: dict[str, Any],
        error_json: dict[str, Any] | None,
        current_time: datetime,
        completed_at: datetime | None,
    ) -> None:
        metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
        cost = body.get("cost") if isinstance(body.get("cost"), dict) else {}
        output_text = str(body.get("output_text", "") or "")
        native_record = session.get(NativeResponseORM, response_id)
        if native_record is None:
            native_record = NativeResponseORM(
                response_id=response_id,
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
                metadata_json=dict(metadata),
                usage_json=dict(usage),
                cost_json=dict(cost),
                error_json=dict(error_json) if error_json else None,
                output_text=output_text,
                created_at=current_time,
                updated_at=current_time,
                completed_at=completed_at,
            )
            session.add(native_record)
        else:
            native_record.instance_id = instance_id
            native_record.account_id = account_id
            native_record.request_path = request_path
            native_record.processing_mode = processing_mode
            native_record.lifecycle_status = lifecycle_status
            native_record.background = request.background
            native_record.stream = stream
            native_record.requested_model = request.model
            native_record.resolved_model = resolved_model
            native_record.provider_key = provider_key
            native_record.instructions = request.instructions
            native_record.metadata_json = dict(metadata)
            native_record.usage_json = dict(usage)
            native_record.cost_json = dict(cost)
            native_record.error_json = dict(error_json) if error_json else None
            native_record.output_text = output_text
            native_record.updated_at = current_time
            native_record.completed_at = completed_at

        session.query(NativeResponseItemORM).filter(
            NativeResponseItemORM.company_id == company_id,
            NativeResponseItemORM.response_id == response_id,
        ).delete(synchronize_session=False)
        session.query(NativeResponseToolCallORM).filter(
            NativeResponseToolCallORM.company_id == company_id,
            NativeResponseToolCallORM.response_id == response_id,
        ).delete(synchronize_session=False)
        session.query(NativeResponseToolOutputORM).filter(
            NativeResponseToolOutputORM.company_id == company_id,
            NativeResponseToolOutputORM.response_id == response_id,
        ).delete(synchronize_session=False)
        session.query(NativeResponseFollowObjectORM).filter(
            NativeResponseFollowObjectORM.company_id == company_id,
            NativeResponseFollowObjectORM.response_id == response_id,
        ).delete(synchronize_session=False)

        input_items = list(request.input_items or [])
        output_items = list(body.get("output") or [])
        for phase, items in (("input", input_items), ("output", output_items)):
            for item_index, item in enumerate(items):
                payload = dict(item) if isinstance(item, dict) else {"value": item}
                session.add(
                    NativeResponseItemORM(
                        row_id=self._native_item_row_id(response_id, phase, item_index),
                        company_id=company_id,
                        response_id=response_id,
                        phase=phase,
                        item_index=item_index,
                        item_id=str(payload.get("id")) if payload.get("id") else None,
                        item_type=str(payload.get("type") or "unknown"),
                        role=str(payload.get("role")) if payload.get("role") else None,
                        status=str(payload.get("status")) if payload.get("status") else None,
                        payload_json=payload,
                        created_at=current_time,
                    )
                )
                item_type = str(payload.get("type") or "")
                if item_type == "function_call":
                    call_id = str(payload.get("call_id") or payload.get("id") or "")
                    session.add(
                        NativeResponseToolCallORM(
                            row_id=self._native_tool_call_row_id(response_id, phase, call_id),
                            company_id=company_id,
                            response_id=response_id,
                            phase=phase,
                            item_id=str(payload.get("id")) if payload.get("id") else None,
                            call_id=call_id,
                            name=str(payload.get("name") or ""),
                            arguments_text=str(payload.get("arguments") or ""),
                            status=str(payload.get("status")) if payload.get("status") else None,
                            payload_json=payload,
                            created_at=current_time,
                            updated_at=current_time,
                        )
                    )
                if item_type == "function_call_output":
                    call_id = str(payload.get("call_id") or "")
                    session.add(
                        NativeResponseToolOutputORM(
                            row_id=self._native_tool_output_row_id(response_id, call_id, item_index),
                            company_id=company_id,
                            response_id=response_id,
                            call_id=call_id,
                            output_index=item_index,
                            payload_json=payload,
                            created_at=current_time,
                        )
                    )

        mapping_record = session.get(NativeResponseMappingORM, response_id)
        if mapping_record is None:
            mapping_record = NativeResponseMappingORM(
                response_id=response_id,
                company_id=company_id,
                mapping_json=dict(normalized_native_mapping or {}),
                created_at=current_time,
                updated_at=current_time,
            )
            session.add(mapping_record)
        else:
            mapping_record.mapping_json = dict(normalized_native_mapping or {})
            mapping_record.updated_at = current_time

        follow_objects = list((normalized_native_mapping or {}).get("objects") or [])
        if not any(
            isinstance(item, dict)
            and str(item.get("kind") or "") == "response"
            and str(item.get("object_id") or "") == response_id
            for item in follow_objects
        ):
            follow_objects.insert(
                0,
                NativeProductObjectRef(
                    kind="response",
                    object_id=response_id,
                    relation="primary_follow_object",
                    lifecycle_state=lifecycle_status,
                    details={
                        "requested_model": request.model,
                        "resolved_model": resolved_model,
                        "provider_key": provider_key,
                    },
                ).model_dump(mode="json"),
            )
        for index, follow_object in enumerate(follow_objects):
            payload = dict(follow_object) if isinstance(follow_object, dict) else {"value": follow_object}
            object_id = str(payload.get("object_id") or payload.get("id") or f"unknown-{index}")
            session.add(
                NativeResponseFollowObjectORM(
                    row_id=self._native_follow_object_row_id(
                        response_id,
                        str(payload.get("relation") or "related"),
                        object_id,
                        index,
                    ),
                    company_id=company_id,
                    response_id=response_id,
                    object_kind=str(payload.get("kind") or "unknown"),
                    object_id=object_id,
                    relation=str(payload.get("relation") or "related"),
                    lifecycle_state=str(payload.get("lifecycle_state")) if payload.get("lifecycle_state") else None,
                    payload_json=payload,
                    created_at=current_time,
                    updated_at=current_time,
                )
            )

        self._append_native_response_event(
            session,
            company_id=company_id,
            response_id=response_id,
            lifecycle_status=lifecycle_status,
            payload_json={
                "status": lifecycle_status,
                "model": resolved_model or request.model,
                "provider_key": provider_key,
                "stream": stream,
                "background": request.background,
            },
            current_time=current_time,
        )

    def record_stream_event(
        self,
        *,
        response_id: str,
        company_id: str,
        event_name: str,
        payload: dict[str, Any],
        now: datetime | None = None,
    ) -> None:
        current_time = self._now(now)
        with self._session_factory() as session, session.begin():
            last_event = (
                session.query(NativeResponseStreamEventORM)
                .filter(
                    NativeResponseStreamEventORM.company_id == company_id,
                    NativeResponseStreamEventORM.response_id == response_id,
                )
                .order_by(NativeResponseStreamEventORM.sequence_no.desc())
                .first()
            )
            sequence_no = 1 if last_event is None else int(last_event.sequence_no) + 1
            session.add(
                NativeResponseStreamEventORM(
                    event_id=self._native_stream_event_id(response_id, sequence_no),
                    company_id=company_id,
                    response_id=response_id,
                    sequence_no=sequence_no,
                    event_name=event_name,
                    payload_json=dict(payload),
                    created_at=current_time,
                )
            )

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
        native_mapping: RuntimeNativeMapping | dict[str, Any] | None = None,
        now: datetime | None = None,
    ) -> None:
        current_time = self._now(now)
        completed_at = current_time if lifecycle_status in {"completed", "failed", "incomplete"} else None
        normalized_native_mapping = normalize_runtime_native_mapping(native_mapping)
        if not normalized_native_mapping:
            normalized_native_mapping = extract_runtime_native_mapping(body.get("metadata"))
        normalized_native_mapping = self._augment_runtime_native_mapping(
            response_id=response_id,
            lifecycle_status=lifecycle_status,
            request=request,
            resolved_model=resolved_model,
            provider_key=provider_key,
            body=body,
            normalized_native_mapping=normalized_native_mapping,
        )
        stored_body = dict(body)
        stored_body["metadata"] = attach_runtime_native_mapping(
            stored_body.get("metadata") if isinstance(stored_body.get("metadata"), dict) else {},
            normalized_native_mapping,
        )
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
                    native_mapping=normalized_native_mapping,
                    response_body=stored_body,
                    error_json=dict(error_json) if error_json else None,
                    execution_run_id=execution_run_id,
                    created_at=current_time,
                    updated_at=current_time,
                    completed_at=completed_at,
                )
                session.add(record)
            else:
                record.instance_id = instance_id
                record.account_id = account_id
                record.request_path = request_path
                record.processing_mode = processing_mode
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
                record.native_mapping = normalized_native_mapping or dict(record.native_mapping or {})
                record.response_body = stored_body
                record.error_json = dict(error_json) if error_json else None
                record.execution_run_id = execution_run_id or record.execution_run_id
                record.updated_at = current_time
                record.completed_at = completed_at

            self._replace_native_response_projection(
                session,
                response_id=response_id,
                company_id=company_id,
                instance_id=instance_id,
                account_id=account_id,
                request_path=request_path,
                processing_mode=processing_mode,
                lifecycle_status=lifecycle_status,
                request=request,
                stream=stream,
                resolved_model=resolved_model,
                provider_key=provider_key,
                body=stored_body,
                normalized_native_mapping=normalized_native_mapping,
                error_json=error_json,
                current_time=current_time,
                completed_at=completed_at,
            )

    @staticmethod
    def _native_items_payload(
        session: Session,
        *,
        company_id: str,
        response_id: str,
        phase: str,
    ) -> list[dict[str, Any]]:
        rows = (
            session.query(NativeResponseItemORM)
            .filter(
                NativeResponseItemORM.company_id == company_id,
                NativeResponseItemORM.response_id == response_id,
                NativeResponseItemORM.phase == phase,
            )
            .order_by(NativeResponseItemORM.item_index.asc())
            .all()
        )
        return [dict(row.payload_json or {}) for row in rows]

    @classmethod
    def _scrub_public_runtime_payload(cls, value: Any) -> Any:
        if isinstance(value, dict):
            cleaned: dict[str, Any] = {}
            for key, item in value.items():
                if key in {"provider_key", "credential_type", "auth_source"}:
                    continue
                cleaned[key] = cls._scrub_public_runtime_payload(item)
            return cleaned
        if isinstance(value, list):
            return [cls._scrub_public_runtime_payload(item) for item in value]
        return value

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
                native_mapping=dict(record.native_mapping or extract_runtime_native_mapping(record.response_body.get("metadata"))),
            )

    def get_response(self, *, company_id: str, response_id: str) -> dict[str, Any]:
        with self._session_factory() as session:
            record = session.get(RuntimeResponseORM, response_id)
            if record is None or record.company_id != company_id:
                raise ResponseNotFoundError(f"Response '{response_id}' was not found for company '{company_id}'.")
            body = dict(record.response_body)
            body["metadata"] = attach_runtime_native_mapping(
                body.get("metadata") if isinstance(body.get("metadata"), dict) else {},
                dict(record.native_mapping or {}),
            )
            return self._scrub_public_runtime_payload(body)

    def get_response_input_items(self, *, company_id: str, response_id: str) -> dict[str, Any]:
        with self._session_factory() as session:
            record = session.get(RuntimeResponseORM, response_id)
            if record is None or record.company_id != company_id:
                raise ResponseNotFoundError(f"Response '{response_id}' was not found for company '{company_id}'.")
            items = self._native_items_payload(
                session,
                company_id=company_id,
                response_id=response_id,
                phase="input",
            )
            if not items:
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

    def get_response_native_projection(self, *, company_id: str, response_id: str) -> dict[str, Any]:
        with self._session_factory() as session:
            record = session.get(RuntimeResponseORM, response_id)
            if record is None or record.company_id != company_id:
                raise ResponseNotFoundError(f"Response '{response_id}' was not found for company '{company_id}'.")

            native_record = session.get(NativeResponseORM, response_id)
            mapping_record = session.get(NativeResponseMappingORM, response_id)
            lifecycle_events = (
                session.query(NativeResponseEventORM)
                .filter(
                    NativeResponseEventORM.company_id == company_id,
                    NativeResponseEventORM.response_id == response_id,
                )
                .order_by(NativeResponseEventORM.sequence_no.asc())
                .all()
            )
            stream_events = (
                session.query(NativeResponseStreamEventORM)
                .filter(
                    NativeResponseStreamEventORM.company_id == company_id,
                    NativeResponseStreamEventORM.response_id == response_id,
                )
                .order_by(NativeResponseStreamEventORM.sequence_no.asc())
                .all()
            )
            tool_calls = (
                session.query(NativeResponseToolCallORM)
                .filter(
                    NativeResponseToolCallORM.company_id == company_id,
                    NativeResponseToolCallORM.response_id == response_id,
                )
                .order_by(
                    NativeResponseToolCallORM.phase.asc(),
                    NativeResponseToolCallORM.created_at.asc(),
                    NativeResponseToolCallORM.row_id.asc(),
                )
                .all()
            )
            tool_outputs = (
                session.query(NativeResponseToolOutputORM)
                .filter(
                    NativeResponseToolOutputORM.company_id == company_id,
                    NativeResponseToolOutputORM.response_id == response_id,
                )
                .order_by(NativeResponseToolOutputORM.output_index.asc(), NativeResponseToolOutputORM.row_id.asc())
                .all()
            )
            follow_objects = (
                session.query(NativeResponseFollowObjectORM)
                .filter(
                    NativeResponseFollowObjectORM.company_id == company_id,
                    NativeResponseFollowObjectORM.response_id == response_id,
                )
                .order_by(
                    NativeResponseFollowObjectORM.created_at.asc(),
                    NativeResponseFollowObjectORM.row_id.asc(),
                )
                .all()
            )

            payload = {
                "object": "forgeframe.native_response_projection",
                "response_id": response_id,
                "request_path": record.request_path,
                "processing_mode": record.processing_mode,
                "lifecycle_status": record.lifecycle_status,
                "background": record.background,
                "stream": record.stream,
                "requested_model": record.requested_model,
                "resolved_model": record.resolved_model,
                "provider_key": record.provider_key,
                "execution_run_id": record.execution_run_id,
                "native_mapping": dict(
                    (mapping_record.mapping_json if mapping_record is not None else record.native_mapping) or {}
                ),
                "response": {
                    "output_text": native_record.output_text if native_record is not None else record.response_body.get("output_text"),
                    "metadata": dict((native_record.metadata_json if native_record is not None else {}) or {}),
                    "usage": dict((native_record.usage_json if native_record is not None else {}) or {}),
                    "cost": dict((native_record.cost_json if native_record is not None else {}) or {}),
                    "error": dict((native_record.error_json if native_record is not None and native_record.error_json else record.error_json) or {}),
                    "completed_at": (
                        native_record.completed_at.isoformat()
                        if native_record is not None and native_record.completed_at is not None
                        else (record.completed_at.isoformat() if record.completed_at is not None else None)
                    ),
                },
                "input_items": self._native_items_payload(
                    session,
                    company_id=company_id,
                    response_id=response_id,
                    phase="input",
                )
                or list(record.input_items or []),
                "output_items": self._native_items_payload(
                    session,
                    company_id=company_id,
                    response_id=response_id,
                    phase="output",
                )
                or list(record.response_body.get("output") or []),
                "lifecycle_events": [
                    {
                        "event_id": event.event_id,
                        "sequence_no": event.sequence_no,
                        "event_type": event.event_type,
                        "lifecycle_status": event.lifecycle_status,
                        "payload": dict(event.payload_json or {}),
                        "created_at": event.created_at.isoformat(),
                    }
                    for event in lifecycle_events
                ],
                "stream_events": [
                    {
                        "event_id": event.event_id,
                        "sequence_no": event.sequence_no,
                        "event_name": event.event_name,
                        "payload": dict(event.payload_json or {}),
                        "created_at": event.created_at.isoformat(),
                    }
                    for event in stream_events
                ],
                "tool_calls": [
                    {
                        "row_id": item.row_id,
                        "phase": item.phase,
                        "item_id": item.item_id,
                        "call_id": item.call_id,
                        "name": item.name,
                        "arguments_text": item.arguments_text,
                        "status": item.status,
                        "payload": dict(item.payload_json or {}),
                        "created_at": item.created_at.isoformat(),
                        "updated_at": item.updated_at.isoformat(),
                    }
                    for item in tool_calls
                ],
                "tool_outputs": [
                    {
                        "row_id": item.row_id,
                        "call_id": item.call_id,
                        "output_index": item.output_index,
                        "payload": dict(item.payload_json or {}),
                        "created_at": item.created_at.isoformat(),
                    }
                    for item in tool_outputs
                ],
                "follow_objects": [
                    {
                        "row_id": item.row_id,
                        "kind": item.object_kind,
                        "object_id": item.object_id,
                        "relation": item.relation,
                        "lifecycle_state": item.lifecycle_state,
                        "payload": dict(item.payload_json or {}),
                        "created_at": item.created_at.isoformat(),
                        "updated_at": item.updated_at.isoformat(),
                    }
                    for item in follow_objects
                ],
            }
            return self._scrub_public_runtime_payload(payload)
