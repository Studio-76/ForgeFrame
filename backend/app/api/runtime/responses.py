"""Runtime responses endpoint for broader OpenAI-compatible client behavior."""

from fastapi import APIRouter, Depends, Request

from app.api.runtime.chat import create_chat_completion
from app.api.runtime.dependencies import get_dispatch_service, get_model_registry, get_settings
from app.api.runtime.schemas import ChatCompletionsRequest, ResponsesRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.settings.config import Settings

router = APIRouter(tags=["runtime-responses"])


@router.post("/responses", response_model=None)
def create_response(
    payload: ResponsesRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
) -> object:
    chat_payload = ChatCompletionsRequest(
        model=payload.model,
        messages=[{"role": "user", "content": payload.input}],
        stream=False,
        client=payload.client,
    )
    chat_result = create_chat_completion(chat_payload, request, registry, dispatch, settings)
    if not isinstance(chat_result, dict):
        return chat_result
    return {
        "id": "resp-forgegate",
        "object": "response",
        "model": chat_result.get("model"),
        "output": [{"type": "output_text", "text": chat_result["choices"][0]["message"]["content"]}],
        "usage": chat_result.get("usage", {}),
        "provider": chat_result.get("provider"),
        "credential_type": chat_result.get("credential_type"),
        "auth_source": chat_result.get("auth_source"),
    }
