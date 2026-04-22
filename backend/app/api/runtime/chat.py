"""Runtime chat entrypoint on `/v1/chat/completions`."""

from collections.abc import Iterator
from time import monotonic
from typing import Any

from fastapi import APIRouter, Body, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from app.authz import RequestActor
from app.api.runtime.access import (
    allowed_provider_set,
    ensure_runtime_model_access,
    list_public_runtime_model_ids,
    requested_model_blocked_by_disabled_public_bridge,
)
from app.api.runtime.errors import public_runtime_exception_message
from app.api.runtime.dependencies import (
    get_dispatch_service,
    get_model_registry,
    get_routing_service,
    get_runtime_gateway_identity,
    require_runtime_permission,
    get_settings,
)
from app.api.runtime.schemas import ChatCompletionsRequest, normalize_chat_messages
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.response_normalization import build_chat_completion_payload, new_chat_completion_created, new_chat_completion_id
from app.core.routing import RoutingService
from app.core.streaming import provider_events_to_sse
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity
from app.governance.service import GovernanceService, get_governance_service
from app.providers import (
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderConfigurationError,
    ProviderConflictError,
    ProviderError,
    ProviderNotImplementedError,
    ProviderModelNotFoundError,
    ProviderNotReadyError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderRequestTimeoutError,
    ProviderUnavailableError,
    ProviderUnsupportedMediaTypeError,
    ProviderPayloadTooLargeError,
    ProviderUnsupportedFeatureError,
    ProviderUpstreamError,
    ProviderValidationError,
)
from app.settings.config import Settings
from app.telemetry.context import telemetry_context_from_request
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

router = APIRouter(tags=["runtime-chat"])


def _duration_ms(started_at: float) -> int:
    return max(0, int((monotonic() - started_at) * 1000))


def _error_response(*, status_code: int, error_type: str, message: str, **extra: object) -> JSONResponse:
    error_payload: dict[str, object] = {
        "type": error_type,
        "message": message,
    }
    error_payload.update(extra)
    response = JSONResponse(status_code=status_code, content={"error": error_payload})
    retry_after = extra.get("retry_after_seconds")
    if isinstance(retry_after, int) and retry_after >= 0:
        response.headers["Retry-After"] = str(retry_after)
    return response


def _validation_error_response(exc: ValidationError) -> JSONResponse:
    issues: list[dict[str, object]] = []
    for item in exc.errors():
        loc = [part for part in item.get("loc", ()) if part != "body"]
        issues.append(
            {
                "loc": list(loc),
                "type": str(item.get("type", "invalid_request")),
                "message": str(item.get("msg", "Request validation failed.")),
            }
        )

    unsupported_fields = [
        str(issue["loc"][-1])
        for issue in issues
        if isinstance(issue.get("loc"), list) and issue["loc"] and issue.get("type") == "extra_forbidden"
    ]
    if unsupported_fields:
        if len(unsupported_fields) == 1:
            message = f"Unsupported field '{unsupported_fields[0]}' in /v1/chat/completions request."
        else:
            joined = ", ".join(f"'{field}'" for field in unsupported_fields)
            message = f"Unsupported fields in /v1/chat/completions request: {joined}."
    elif issues and issues[0]["loc"]:
        field_path = ".".join(str(part) for part in issues[0]["loc"])
        message = f"Invalid value for '{field_path}': {issues[0]['message']}"
    elif issues:
        message = str(issues[0]["message"])
    else:  # pragma: no cover - ValidationError always contains at least one issue.
        message = "Request validation failed."

    return _error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        error_type="invalid_request",
        message=message,
        details={"issues": issues},
    )


def _provider_exception_to_http(exc: Exception) -> tuple[int, str, str | None, str, dict[str, object]]:
    message = public_runtime_exception_message(exc)
    if isinstance(exc, RuntimeAuthorizationError):
        return exc.status_code, exc.error_type, None, message, {}
    if isinstance(exc, ProviderNotImplementedError):
        return status.HTTP_501_NOT_IMPLEMENTED, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderUnsupportedFeatureError):
        return status.HTTP_400_BAD_REQUEST, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderModelNotFoundError):
        return status.HTTP_404_NOT_FOUND, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderNotReadyError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderConfigurationError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderAuthenticationError):
        return status.HTTP_401_UNAUTHORIZED, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderRateLimitError):
        extras: dict[str, object] = {"retryable": True}
        retry_after = getattr(exc, "retry_after_seconds", None)
        if retry_after is not None:
            extras["retry_after_seconds"] = retry_after
        return status.HTTP_429_TOO_MANY_REQUESTS, exc.error_type, exc.provider, message, extras
    if isinstance(exc, ProviderConflictError):
        return status.HTTP_409_CONFLICT, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderResourceGoneError):
        return status.HTTP_410_GONE, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderPayloadTooLargeError):
        return status.HTTP_413_CONTENT_TOO_LARGE, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderUnsupportedMediaTypeError):
        return status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderUnavailableError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, message, {"retryable": True}
    if isinstance(exc, ProviderProtocolError):
        return status.HTTP_502_BAD_GATEWAY, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderTimeoutError):
        return status.HTTP_504_GATEWAY_TIMEOUT, exc.error_type, exc.provider, message, {"retryable": True}
    if isinstance(exc, ProviderRequestTimeoutError):
        return status.HTTP_408_REQUEST_TIMEOUT, exc.error_type, exc.provider, message, {"retryable": True}
    if isinstance(exc, ProviderBadRequestError):
        return status.HTTP_400_BAD_REQUEST, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ProviderValidationError):
        return status.HTTP_422_UNPROCESSABLE_CONTENT, exc.error_type, exc.provider, message, {}
    if isinstance(exc, (ProviderUpstreamError, ProviderError)):
        return status.HTTP_502_BAD_GATEWAY, exc.error_type, exc.provider, message, {}
    if isinstance(exc, ValueError):
        return status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_request", None, str(exc), {}
    raise exc


def _resolve_client_identity(
    request: Request,
    payload: ChatCompletionsRequest,
    gateway_identity: RuntimeGatewayIdentity | None,
    *,
    default_tenant_id: str,
) -> ClientIdentity:
    if gateway_identity is not None:
        return ClientIdentity(
            client_id=gateway_identity.client_id,
            consumer=gateway_identity.consumer,
            integration=gateway_identity.integration,
            tenant_id=gateway_identity.account_id or default_tenant_id,
        )
    return ClientIdentity(
        client_id=(
            payload.client.get("client_id")
            or request.headers.get("x-forgegate-client")
            or request.headers.get("x-api-key")
            or request.headers.get("user-agent")
            or "unknown_client"
        ),
        consumer=(payload.client.get("consumer") or request.headers.get("x-forgegate-consumer") or "unknown_consumer"),
        integration=(payload.client.get("integration") or request.headers.get("x-forgegate-integration") or "unknown_integration"),
        tenant_id=default_tenant_id,
    )


@router.post("/chat/completions", response_model=None)
def create_chat_completion(
    request: Request,
    payload: dict[str, Any] = Body(...),
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    governance: GovernanceService = Depends(get_governance_service),
    routing: RoutingService = Depends(get_routing_service),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.chat.write")),
) -> object:
    try:
        payload = ChatCompletionsRequest.model_validate(payload)
    except ValidationError as exc:
        return _validation_error_response(exc)

    analytics = get_usage_analytics_store()
    runtime_route = request.url.path or "/v1/chat/completions"
    started_at = monotonic()
    telemetry_context = telemetry_context_from_request(
        request,
        route=runtime_route,
        operation="runtime.chat.completions.create",
        service_name="forgegate-runtime-api",
        service_kind="runtime_api",
    )
    client_identity = _resolve_client_identity(
        request,
        payload,
        gateway_identity,
        default_tenant_id=settings.bootstrap_tenant_id,
    )
    completion_id = new_chat_completion_id()
    completion_created = new_chat_completion_created()
    requested_model = payload.model
    public_model_ids: list[str] | None = None
    try:
        ensure_runtime_model_access(
            requested_model=requested_model,
            registry=registry,
            identity=gateway_identity,
            governance=governance,
        )
    except RuntimeAuthorizationError as exc:
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode="stream" if payload.stream else "non_stream",
            error_type=exc.error_type,
            status_code=exc.status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=exc.status_code,
            error_type=exc.error_type,
            message=public_runtime_exception_message(exc),
        )
    if requested_model_blocked_by_disabled_public_bridge(
        requested_model=requested_model,
        registry=registry,
        settings=settings,
    ):
        public_model_ids = list_public_runtime_model_ids(
            routing=routing,
            identity=gateway_identity,
        )
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode="stream" if payload.stream else "non_stream",
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=public_model_ids,
        )
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode="stream" if payload.stream else "non_stream",
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=public_model_ids if public_model_ids is not None else list_public_runtime_model_ids(
                routing=routing,
                identity=gateway_identity,
            ),
        )

    try:
        normalized_messages = normalize_chat_messages(payload.messages)
        if payload.stream:
            model, provider, events = dispatch.dispatch_chat_stream(
                requested_model=requested_model,
                messages=normalized_messages,
                tools=payload.tools,
                tool_choice=payload.tool_choice,
                allowed_providers=allowed_provider_set(gateway_identity),
                request_metadata=telemetry_context.as_request_metadata(),
            )

            def _sse_body() -> Iterator[str]:
                try:
                    def _event_iterator() -> Iterator[ProviderStreamEvent]:
                        for event in events:
                            if event.event == "done":
                                analytics.record_stream_done_event(
                                    provider=provider,
                                    model=model,
                                    event=event,
                                    client=client_identity,
                                    context=telemetry_context.with_duration(_duration_ms(started_at)),
                                )
                            if event.event == "error":
                                analytics.record_runtime_error(
                                    provider=provider,
                                    model=model,
                                    client=client_identity,
                                    route=runtime_route,
                                    stream_mode="stream",
                                    error_type=event.error_type or "provider_stream_interrupted",
                                    status_code=status.HTTP_502_BAD_GATEWAY,
                                    context=telemetry_context.with_duration(_duration_ms(started_at)),
                                )
                            yield event

                    yield from provider_events_to_sse(
                        _event_iterator(),
                        model=model,
                        completion_id=completion_id,
                        created=completion_created,
                    )
                except Exception as exc:
                    status_code, error_type, _, _, _ = _provider_exception_to_http(exc)
                    analytics.record_runtime_error(
                        provider=provider,
                        model=model,
                        client=client_identity,
                        route=runtime_route,
                        stream_mode="stream",
                        error_type=error_type,
                        status_code=status_code,
                        context=telemetry_context.with_duration(_duration_ms(started_at)),
                    )
                    yield from provider_events_to_sse(
                        [
                            ProviderStreamEvent(
                                event="error",
                                error_type=error_type,
                                error_message=public_runtime_exception_message(exc),
                            )
                        ],
                        model=model,
                        completion_id=completion_id,
                        created=completion_created,
                    )

            return StreamingResponse(_sse_body(), media_type="text/event-stream")

        result = dispatch.dispatch_chat(
            requested_model=requested_model,
            messages=normalized_messages,
            stream=False,
            tools=payload.tools,
            tool_choice=payload.tool_choice,
            allowed_providers=allowed_provider_set(gateway_identity),
            request_metadata=telemetry_context.as_request_metadata(),
        )
    except Exception as exc:  # intentionally centralized mapping
        status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
        analytics.record_runtime_error(
            provider=provider,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode="stream" if payload.stream else "non_stream",
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

    return build_chat_completion_payload(
        result,
        completion_id=completion_id,
        created=completion_created,
    )
