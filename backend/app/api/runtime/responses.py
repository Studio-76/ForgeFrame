"""Runtime responses endpoint for broader OpenAI-compatible client behavior."""

from time import monotonic
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.authz import RequestActor
from app.api.runtime.access import (
    allowed_provider_set,
    ensure_runtime_model_access,
    list_public_runtime_model_ids,
    requested_model_blocked_by_disabled_public_bridge,
)
from app.api.runtime.chat import _duration_ms, _error_response, _provider_exception_to_http
from app.api.runtime.errors import public_runtime_exception_message, public_runtime_provider_message
from app.api.runtime.dependencies import (
    get_dispatch_service,
    get_model_registry,
    get_routing_service,
    get_runtime_gateway_identity,
    require_runtime_permission,
    get_settings,
)
from app.api.runtime.schemas import ResponsesRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.response_normalization import build_responses_payload
from app.core.routing import RoutingService
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity
from app.governance.service import GovernanceService, get_governance_service
from app.providers import ChatDispatchResult
from app.settings.config import Settings
from app.telemetry.context import telemetry_context_from_request
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

router = APIRouter(tags=["runtime-responses"])

_RESPONSES_CONTENT_BLOCK_TYPES = {"text", "input_text", "image_url", "input_image"}
_RESPONSES_MESSAGE_ROLES = {"system", "user", "assistant", "tool"}
_SUPPORTED_RESPONSES_FIELDS = (
    "model",
    "input",
    "instructions",
    "max_output_tokens",
    "temperature",
    "stream",
    "tools",
    "tool_choice",
    "metadata",
    "client",
)


def _is_responses_content_block(value: object) -> bool:
    return isinstance(value, dict) and str(value.get("type", "") or "") in _RESPONSES_CONTENT_BLOCK_TYPES


def _is_responses_message(value: object) -> bool:
    return isinstance(value, dict) and ("role" in value or "content" in value) and not _is_responses_content_block(value)


def _normalize_responses_content_block(block: object) -> dict[str, object]:
    if not isinstance(block, dict):
        return {"type": "text", "text": str(block)}

    block_type = str(block.get("type", "") or "")
    if block_type in {"text", "input_text"}:
        return {"type": "text", "text": str(block.get("text", ""))}
    if block_type in {"image_url", "input_image"}:
        if block.get("file_id") is not None:
            raise ValueError("Responses image inputs on the current runtime path require image_url or data URLs; file_id is not supported.")
        raw_image_url = block.get("image_url", block.get("url"))
        if isinstance(raw_image_url, dict):
            if raw_image_url.get("file_id") is not None:
                raise ValueError("Responses image inputs on the current runtime path require image_url or data URLs; file_id is not supported.")
            raw_image_url = raw_image_url.get("url")
        image_url = str(raw_image_url or "").strip()
        if not image_url:
            raise ValueError("Responses image input blocks must include a non-empty image_url.")
        normalized_block: dict[str, object] = {"type": "image_url", "image_url": {"url": image_url}}
        detail = block.get("detail")
        if detail is None and isinstance(block.get("image_url"), dict):
            detail = block["image_url"].get("detail")
        if detail is not None:
            normalized_block["image_url"]["detail"] = detail
        return normalized_block

    raise ValueError(f"Unsupported responses content block type '{block_type or 'unknown'}'.")


def _normalize_responses_message_content(content: object) -> object:
    if content is None:
        return " "
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return [_normalize_responses_content_block(block) for block in content]
    if _is_responses_content_block(content):
        return [_normalize_responses_content_block(content)]
    if _is_responses_message(content):
        nested_content = content.get("content")
        if nested_content is None:
            raise ValueError("Responses input message objects must contain a 'content' field.")
        return _normalize_responses_message_content(nested_content)
    return str(content)


def _normalize_responses_message(item: object) -> dict[str, object]:
    if not isinstance(item, dict):
        return {"role": "user", "content": _normalize_responses_message_content(item)}

    if "content" not in item:
        raise ValueError("Responses input message objects must contain a 'content' field.")

    role = str(item.get("role", "user") or "user")
    if role == "developer":
        role = "system"
    if role not in _RESPONSES_MESSAGE_ROLES:
        raise ValueError(f"Unsupported responses input role '{role}'.")

    normalized_message: dict[str, object] = {
        "role": role,
        "content": _normalize_responses_message_content(item.get("content")),
    }
    if role == "assistant" and isinstance(item.get("tool_calls"), list):
        normalized_message["tool_calls"] = item.get("tool_calls")
    if role == "tool" and item.get("tool_call_id") is not None:
        normalized_message["tool_call_id"] = str(item.get("tool_call_id"))
    return normalized_message


def _normalize_responses_input(input_value: object, *, instructions: str | None = None) -> list[dict[str, object]]:
    messages: list[dict[str, object]] = []
    if instructions and instructions.strip():
        messages.append({"role": "system", "content": instructions})

    if isinstance(input_value, list):
        if input_value and all(_is_responses_message(item) for item in input_value):
            messages.extend(_normalize_responses_message(item) for item in input_value)
        else:
            messages.append({"role": "user", "content": _normalize_responses_message_content(input_value)})
        return messages

    if _is_responses_message(input_value):
        messages.append(_normalize_responses_message(input_value))
        return messages

    messages.append({"role": "user", "content": _normalize_responses_message_content(input_value)})
    return messages


def _responses_content_has_value(content: object) -> bool:
    if isinstance(content, str):
        return bool(content.strip())
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                if str(block).strip():
                    return True
                continue
            block_type = str(block.get("type", "") or "")
            if block_type == "text" and str(block.get("text", "")).strip():
                return True
            if block_type == "image_url":
                image_url = block.get("image_url")
                if isinstance(image_url, dict) and str(image_url.get("url", "") or "").strip():
                    return True
                if isinstance(image_url, str) and image_url.strip():
                    return True
        return False
    return bool(str(content).strip())


def _responses_messages_have_content(messages: list[dict[str, object]]) -> bool:
    return any(_responses_content_has_value(message.get("content")) for message in messages)


def _unsupported_responses_fields(payload: ResponsesRequest) -> list[str]:
    extras = getattr(payload, "model_extra", None) or {}
    return sorted(str(field) for field in extras.keys())


def _responses_control_payload(payload: ResponsesRequest) -> dict[str, object]:
    controls: dict[str, object] = {}
    if payload.max_output_tokens is not None:
        controls["max_output_tokens"] = payload.max_output_tokens
    if payload.temperature is not None:
        controls["temperature"] = payload.temperature
    if payload.metadata:
        controls["metadata"] = dict(payload.metadata)
    return controls


def _responses_stream_error_payload(
    *,
    response_id: str,
    model: str,
    error_type: str,
    message: str,
    **extra: object,
) -> dict[str, object]:
    error_payload: dict[str, object] = {
        "type": error_type,
        "message": message,
    }
    error_payload.update(extra)
    return {
        "id": response_id,
        "object": "response",
        "status": "failed",
        "model": model,
        "error": error_payload,
    }


@router.post("/responses", response_model=None)
def create_response(
    payload: ResponsesRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    routing: RoutingService = Depends(get_routing_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    governance: GovernanceService = Depends(get_governance_service),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.write")),
) -> object:
    unsupported_fields = _unsupported_responses_fields(payload)
    if unsupported_fields:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "type": "invalid_request",
                    "message": (
                        "Unsupported /v1/responses fields: "
                        f"{', '.join(unsupported_fields)}. Supported fields: {', '.join(_SUPPORTED_RESPONSES_FIELDS)}."
                    ),
                }
            },
        )
    if payload.max_output_tokens is not None and payload.max_output_tokens <= 0:
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "max_output_tokens must be > 0 when provided."}})
    if payload.temperature is not None and not 0 <= payload.temperature <= 2:
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "temperature must be between 0 and 2."}})

    try:
        resolved_input = _normalize_responses_input(payload.input, instructions=payload.instructions)
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": {"type": "unsupported_input", "message": str(exc)}})
    if not _responses_messages_have_content(resolved_input):
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "input must not be empty."}})

    analytics = get_usage_analytics_store()
    runtime_route = request.url.path or "/v1/responses"
    started_at = monotonic()
    telemetry_context = telemetry_context_from_request(
        request,
        route=runtime_route,
        operation="runtime.responses.create",
        service_name="forgegate-runtime-api",
        service_kind="runtime_api",
    )
    client_identity = (
        ClientIdentity(
            client_id=gateway_identity.client_id,
            consumer=gateway_identity.consumer,
            integration=gateway_identity.integration,
            tenant_id=gateway_identity.account_id or settings.bootstrap_tenant_id,
        )
        if gateway_identity is not None
        else ClientIdentity(
            client_id=payload.client.get("client_id") or request.headers.get("x-forgegate-client") or "unknown_client",
            consumer=payload.client.get("consumer") or request.headers.get("x-forgegate-consumer") or "unknown_consumer",
            integration=payload.client.get("integration") or request.headers.get("x-forgegate-integration") or "unknown_integration",
            tenant_id=settings.bootstrap_tenant_id,
        )
    )
    response_controls = _responses_control_payload(payload)
    allowed_providers = allowed_provider_set(gateway_identity)

    if payload.stream:
        try:
            ensure_runtime_model_access(
                requested_model=payload.model,
                registry=registry,
                identity=gateway_identity,
                governance=governance,
            )
        except RuntimeAuthorizationError as exc:
            analytics.record_runtime_error(
                provider=None,
                model=payload.model,
                client=client_identity,
                route=runtime_route,
                stream_mode="stream",
                error_type=exc.error_type,
                status_code=exc.status_code,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
            )
            return _error_response(
                status_code=exc.status_code,
                error_type=exc.error_type,
                message=public_runtime_exception_message(exc),
            )
        public_model_ids: list[str] | None = None
        if requested_model_blocked_by_disabled_public_bridge(
            requested_model=payload.model,
            registry=registry,
            settings=settings,
        ):
            public_model_ids = list_public_runtime_model_ids(
                routing=routing,
                identity=gateway_identity,
            )
            analytics.record_runtime_error(
                provider=None,
                model=payload.model,
                client=client_identity,
                route=runtime_route,
                stream_mode="stream",
                error_type="model_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
            )
            return _error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                error_type="model_not_found",
                message=f"Requested model '{payload.model}' is not available.",
                available_models=public_model_ids,
            )
        if payload.model and not registry.has_model(payload.model) and not settings.runtime_allow_unknown_models:
            analytics.record_runtime_error(
                provider=None,
                model=payload.model,
                client=client_identity,
                route=runtime_route,
                stream_mode="stream",
                error_type="model_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
            )
            return _error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                error_type="model_not_found",
                message=f"Requested model '{payload.model}' is not available.",
                available_models=public_model_ids if public_model_ids is not None else list_public_runtime_model_ids(
                    routing=routing,
                    identity=gateway_identity,
                ),
            )
        try:
            model, provider, events = dispatch.dispatch_chat_stream(
                requested_model=payload.model,
                messages=resolved_input,
                tools=payload.tools,
                tool_choice=payload.tool_choice,
                allowed_providers=allowed_providers,
                request_metadata=telemetry_context.as_request_metadata(),
                response_controls=response_controls,
            )
        except Exception as exc:
            status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
            analytics.record_runtime_error(
                provider=provider,
                model=payload.model,
                client=client_identity,
                route=runtime_route,
                stream_mode="stream",
                error_type=error_type,
                status_code=status_code,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
            )
            return _error_response(
                status_code=status_code,
                error_type=error_type,
                message=message,
                **extra,
            )

        response_id = f"resp_{uuid4().hex}"

        def _sse_body():
            yield f"event: response.created\ndata: {JSONResponse(content={'id': response_id, 'object': 'response', 'status': 'in_progress', 'model': model}).body.decode()}\n\n"
            collected = ""
            usage_payload: dict[str, object] = {}
            try:
                for event in events:
                    if event.event == "delta":
                        collected += event.delta
                        yield f"event: response.output_text.delta\ndata: {JSONResponse(content={'id': response_id, 'delta': event.delta}).body.decode()}\n\n"
                        continue
                    if event.event == "error":
                        error_type = event.error_type or "provider_stream_interrupted"
                        analytics.record_runtime_error(
                            provider=provider,
                            model=model,
                            client=client_identity,
                            route=runtime_route,
                            stream_mode="stream",
                            error_type=error_type,
                            status_code=502,
                            context=telemetry_context.with_duration(_duration_ms(started_at)),
                        )
                        error_payload = _responses_stream_error_payload(
                            response_id=response_id,
                            model=model,
                            error_type=error_type,
                            message=public_runtime_provider_message(event.error_type),
                        )
                        yield (
                            "event: response.error\ndata: "
                            f"{JSONResponse(content=error_payload).body.decode()}\n\n"
                        )
                        break
                    if event.event == "done":
                        analytics.record_stream_done_event(
                            provider=provider,
                            model=model,
                            event=event,
                            client=client_identity,
                            context=telemetry_context.with_duration(_duration_ms(started_at)),
                        )
                        usage_payload = event.usage.model_dump() if event.usage else {}
                        final_payload = build_responses_payload(
                            ChatDispatchResult(
                                model=model,
                                provider=provider,
                                content=collected,
                                finish_reason=event.finish_reason or "stop",
                                usage=event.usage or usage_payload,
                                cost=event.cost or {},
                                credential_type=str(event.credential_type or "unknown"),
                                auth_source=str(event.auth_source or "unknown"),
                                tool_calls=event.tool_calls,
                            ),
                            response_id=response_id,
                            status="completed",
                        )
                        yield f"event: response.completed\ndata: {JSONResponse(content=final_payload).body.decode()}\n\n"
                        break
            except Exception as exc:
                status_code, error_type, mapped_provider, message, extra = _provider_exception_to_http(exc)
                analytics.record_runtime_error(
                    provider=mapped_provider or provider,
                    model=model,
                    client=client_identity,
                    route=runtime_route,
                    stream_mode="stream",
                    error_type=error_type,
                    status_code=status_code,
                    context=telemetry_context.with_duration(_duration_ms(started_at)),
                )
                error_payload = _responses_stream_error_payload(
                    response_id=response_id,
                    model=model,
                    error_type=error_type,
                    message=message,
                    **extra,
                )
                yield (
                    "event: response.error\ndata: "
                    f"{JSONResponse(content=error_payload).body.decode()}\n\n"
                )
            yield "data: [DONE]\n\n"

        return StreamingResponse(_sse_body(), media_type="text/event-stream")

    try:
        ensure_runtime_model_access(
            requested_model=payload.model,
            registry=registry,
            identity=gateway_identity,
            governance=governance,
        )
    except RuntimeAuthorizationError as exc:
        analytics.record_runtime_error(
            provider=None,
            model=payload.model,
            client=client_identity,
            route=runtime_route,
            stream_mode="non_stream",
            error_type=exc.error_type,
            status_code=exc.status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=exc.status_code,
            error_type=exc.error_type,
            message=public_runtime_exception_message(exc),
        )

    public_model_ids: list[str] | None = None
    if requested_model_blocked_by_disabled_public_bridge(
        requested_model=payload.model,
        registry=registry,
        settings=settings,
    ):
        public_model_ids = list_public_runtime_model_ids(
            routing=routing,
            identity=gateway_identity,
        )
        analytics.record_runtime_error(
            provider=None,
            model=payload.model,
            client=client_identity,
            route=runtime_route,
            stream_mode="non_stream",
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{payload.model}' is not available.",
            available_models=public_model_ids,
        )
    if payload.model and not registry.has_model(payload.model) and not settings.runtime_allow_unknown_models:
        analytics.record_runtime_error(
            provider=None,
            model=payload.model,
            client=client_identity,
            route=runtime_route,
            stream_mode="non_stream",
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{payload.model}' is not available.",
            available_models=public_model_ids if public_model_ids is not None else list_public_runtime_model_ids(
                routing=routing,
                identity=gateway_identity,
            ),
        )

    try:
        result = dispatch.dispatch_chat(
            requested_model=payload.model,
            messages=resolved_input,
            stream=False,
            tools=payload.tools,
            tool_choice=payload.tool_choice,
            allowed_providers=allowed_providers,
            request_metadata=telemetry_context.as_request_metadata(),
            response_controls=response_controls,
        )
    except Exception as exc:
        status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
        analytics.record_runtime_error(
            provider=provider,
            model=payload.model,
            client=client_identity,
            route=runtime_route,
            stream_mode="non_stream",
            error_type=error_type,
            status_code=status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=status_code,
            error_type=error_type,
            message=message,
            **extra,
        )

    analytics.record_non_stream_result(
        result,
        client=client_identity,
        context=telemetry_context.with_duration(_duration_ms(started_at)),
    )
    return build_responses_payload(result)
