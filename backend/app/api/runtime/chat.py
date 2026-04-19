"""Runtime chat entrypoint on `/v1/chat/completions` for phase-5 runtime."""

from collections.abc import Iterator

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.runtime.dependencies import get_dispatch_service, get_model_registry, get_settings
from app.api.runtime.schemas import ChatCompletionsRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.streaming import provider_events_to_sse
from app.providers import (
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderConfigurationError,
    ProviderConflictError,
    ProviderError,
    ProviderNotImplementedError,
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
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

router = APIRouter(tags=["runtime-chat"])


def _error_response(*, status_code: int, error_type: str, message: str, provider: str | None = None, **extra: object) -> JSONResponse:
    error_payload: dict[str, object] = {
        "type": error_type,
        "message": message,
    }
    if provider:
        error_payload["provider"] = provider
    error_payload.update(extra)
    return JSONResponse(status_code=status_code, content={"error": error_payload})


def _provider_exception_to_http(exc: Exception) -> tuple[int, str, str | None, str, dict[str, object]]:
    if isinstance(exc, ProviderNotImplementedError):
        return status.HTTP_501_NOT_IMPLEMENTED, exc.error_type, exc.provider, str(exc), {"phase": "phase-5 streaming/codex"}
    if isinstance(exc, ProviderUnsupportedFeatureError):
        return status.HTTP_400_BAD_REQUEST, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderNotReadyError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderConfigurationError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderAuthenticationError):
        return status.HTTP_401_UNAUTHORIZED, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderRateLimitError):
        extras: dict[str, object] = {"retryable": True}
        retry_after = getattr(exc, "retry_after_seconds", None)
        if retry_after is not None:
            extras["retry_after_seconds"] = retry_after
        return status.HTTP_429_TOO_MANY_REQUESTS, exc.error_type, exc.provider, str(exc), extras
    if isinstance(exc, ProviderConflictError):
        return status.HTTP_409_CONFLICT, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderResourceGoneError):
        return status.HTTP_410_GONE, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderPayloadTooLargeError):
        return status.HTTP_413_CONTENT_TOO_LARGE, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderUnsupportedMediaTypeError):
        return status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderUnavailableError):
        return status.HTTP_503_SERVICE_UNAVAILABLE, exc.error_type, exc.provider, str(exc), {"retryable": True}
    if isinstance(exc, ProviderProtocolError):
        return status.HTTP_502_BAD_GATEWAY, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderTimeoutError):
        return status.HTTP_504_GATEWAY_TIMEOUT, exc.error_type, exc.provider, str(exc), {"retryable": True}
    if isinstance(exc, ProviderRequestTimeoutError):
        return status.HTTP_408_REQUEST_TIMEOUT, exc.error_type, exc.provider, str(exc), {"retryable": True}
    if isinstance(exc, ProviderBadRequestError):
        return status.HTTP_400_BAD_REQUEST, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ProviderValidationError):
        return status.HTTP_422_UNPROCESSABLE_ENTITY, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, (ProviderUpstreamError, ProviderError)):
        return status.HTTP_502_BAD_GATEWAY, exc.error_type, exc.provider, str(exc), {}
    if isinstance(exc, ValueError):
        return status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_request", None, str(exc), {}
    raise exc


def _resolve_client_identity(request: Request, payload: ChatCompletionsRequest) -> ClientIdentity:
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
    )


@router.post("/chat/completions", response_model=None)
def create_chat_completion(
    payload: ChatCompletionsRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
) -> object:
    analytics = get_usage_analytics_store()
    client_identity = _resolve_client_identity(request, payload)
    requested_model = payload.model
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route="/v1/chat/completions",
            stream_mode="stream" if payload.stream else "non_stream",
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=[m.id for m in registry.list_active_models()],
        )

    try:
        if payload.stream:
            model, provider, events = dispatch.dispatch_chat_stream(
                requested_model=requested_model,
                messages=[message.model_dump() for message in payload.messages],
                tools=payload.tools,
                tool_choice=payload.tool_choice,
            )

            def _sse_body() -> Iterator[str]:
                try:
                    def _event_iterator() -> Iterator[ProviderStreamEvent]:
                        for event in events:
                            if event.event == "done":
                                analytics.record_stream_done_event(provider=provider, model=model, event=event, client=client_identity)
                            yield event

                    yield from provider_events_to_sse(_event_iterator(), model=model, provider=provider)
                except ProviderStreamInterruptedError as exc:
                    analytics.record_runtime_error(
                        provider=provider,
                        model=model,
                        client=client_identity,
                        route="/v1/chat/completions",
                        stream_mode="stream",
                        error_type=exc.error_type,
                        status_code=status.HTTP_502_BAD_GATEWAY,
                    )
                    yield from provider_events_to_sse(
                        [
                            ProviderStreamEvent(
                                event="error",
                                error_type=exc.error_type,
                                error_message=str(exc),
                            )
                        ],
                        model=model,
                        provider=provider,
                    )

            return StreamingResponse(_sse_body(), media_type="text/event-stream")

        result = dispatch.dispatch_chat(
            requested_model=requested_model,
            messages=[message.model_dump() for message in payload.messages],
            stream=False,
            tools=payload.tools,
            tool_choice=payload.tool_choice,
        )
    except Exception as exc:  # intentionally centralized mapping
        status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
        analytics.record_runtime_error(
            provider=provider,
            model=requested_model,
            client=client_identity,
            route="/v1/chat/completions",
            stream_mode="stream" if payload.stream else "non_stream",
            error_type=error_type,
            status_code=status_code,
        )
        return _error_response(
            status_code=status_code,
            error_type=error_type,
            provider=provider,
            message=message,
            **extra,
        )

    analytics.record_non_stream_result(result, client=client_identity)

    return {
        "id": "chatcmpl-forgegate",
        "object": "chat.completion",
        "model": result.model,
        "provider": result.provider,
        "credential_type": result.credential_type,
        "auth_source": result.auth_source,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result.content},
                "finish_reason": result.finish_reason,
            }
        ],
        "usage": result.usage.model_dump(),
        "cost": result.cost.model_dump(),
    }
