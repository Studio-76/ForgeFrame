"""Runtime chat entrypoint on `/v1/chat/completions` for phase-3 core baseline."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.runtime.dependencies import get_dispatch_service, get_model_registry
from app.api.runtime.schemas import ChatCompletionsRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.providers import ProviderNotImplementedError

router = APIRouter(tags=["runtime-chat"])


@router.post("/v1/chat/completions")
def create_chat_completion(
    payload: ChatCompletionsRequest,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
) -> dict[str, object]:
    requested_model = payload.model
    if requested_model and not registry.has_model(requested_model):
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
                "type": "provider_not_implemented",
                "message": str(exc),
                "phase": "phase-3 core baseline",
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "routing_error", "message": str(exc)},
        ) from exc

    return {
        "id": "chatcmpl-scaffold",
        "object": "chat.completion",
        "model": result.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result.content},
                "finish_reason": "stop",
            }
        ],
    }
