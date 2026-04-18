"""Runtime chat entrypoint on `/v1/chat/completions` for phase-4 core baseline."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.runtime.dependencies import get_dispatch_service, get_model_registry, get_settings
from app.api.runtime.schemas import ChatCompletionsRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.providers import (
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderConfigurationError,
    ProviderError,
    ProviderNotImplementedError,
    ProviderUpstreamError,
)
from app.settings.config import Settings

router = APIRouter(tags=["runtime-chat"])


@router.post("/chat/completions")
def create_chat_completion(
    payload: ChatCompletionsRequest,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    requested_model = payload.model
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "type": "model_not_found",
                "message": f"Requested model '{requested_model}' is not available.",
                "available_models": [m.id for m in registry.list_active_models()],
            },
        )

    try:
        result = dispatch.dispatch_chat(
            requested_model=requested_model,
            messages=[message.model_dump() for message in payload.messages],
            stream=payload.stream,
        )
    except ProviderNotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "type": exc.error_type,
                "provider": exc.provider,
                "message": str(exc),
                "phase": "phase-4 core baseline",
            },
        ) from exc
    except ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"type": exc.error_type, "provider": exc.provider, "message": str(exc)},
        ) from exc
    except ProviderAuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": exc.error_type, "provider": exc.provider, "message": str(exc)},
        ) from exc
    except ProviderBadRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": exc.error_type, "provider": exc.provider, "message": str(exc)},
        ) from exc
    except ProviderUpstreamError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"type": exc.error_type, "provider": exc.provider, "message": str(exc)},
        ) from exc
    except ProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"type": exc.error_type, "provider": exc.provider, "message": str(exc)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "routing_error", "message": str(exc)},
        ) from exc

    return {
        "id": "chatcmpl-forgegate",
        "object": "chat.completion",
        "model": result.model,
        "provider": result.provider,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result.content},
                "finish_reason": result.finish_reason,
            }
        ],
    }
