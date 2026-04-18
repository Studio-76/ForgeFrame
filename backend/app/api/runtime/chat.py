"""Runtime chat entrypoint on `/v1/chat/completions` for phase-5 runtime."""

from collections.abc import Iterator

from fastapi import APIRouter, Depends, status
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
    ProviderError,
    ProviderNotImplementedError,
    ProviderNotReadyError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderUnsupportedFeatureError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.analytics import get_usage_analytics_store

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


def _provider_exception_to_http(exc: Exception) -> JSONResponse:
    if isinstance(exc, ProviderNotImplementedError):
        return _error_response(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
            phase="phase-5 streaming/codex",
        )
    if isinstance(exc, ProviderUnsupportedFeatureError):
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, ProviderNotReadyError):
        return _error_response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, ProviderConfigurationError):
        return _error_response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, ProviderAuthenticationError):
        return _error_response(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, ProviderBadRequestError):
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, (ProviderUpstreamError, ProviderError)):
        return _error_response(
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_type=exc.error_type,
            provider=exc.provider,
            message=str(exc),
        )
    if isinstance(exc, ValueError):
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_type="routing_error",
            message=str(exc),
        )
    raise exc


@router.post("/chat/completions", response_model=None)
def create_chat_completion(
    payload: ChatCompletionsRequest,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
) -> object:
    analytics = get_usage_analytics_store()
    requested_model = payload.model
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
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
            )

            def _sse_body() -> Iterator[str]:
                try:
                    def _event_iterator() -> Iterator[ProviderStreamEvent]:
                        for event in events:
                            if event.event == "done":
                                analytics.record_stream_done_event(provider=provider, model=model, event=event)
                            yield event

                    yield from provider_events_to_sse(_event_iterator(), model=model, provider=provider)
                except ProviderStreamInterruptedError as exc:
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
        )
    except Exception as exc:  # intentionally centralized mapping
        return _provider_exception_to_http(exc)

    analytics.record_non_stream_result(result)

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
