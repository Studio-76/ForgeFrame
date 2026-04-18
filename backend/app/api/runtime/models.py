"""Runtime models endpoint on target path `/v1/models`."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import get_model_registry
from app.core.model_registry import ModelRegistry

router = APIRouter(tags=["runtime-models"])


@router.get("/models")
def list_models(registry: ModelRegistry = Depends(get_model_registry)) -> dict[str, object]:
    models = registry.list_active_models()
    return {
        "object": "list",
        "data": [
            {
                "id": model.id,
                "object": "model",
                "owned_by": model.owned_by,
                "provider": model.provider,
                "display_name": model.display_name,
                "active": model.active,
                "category": model.category,
            }
            for model in models
        ],
    }
