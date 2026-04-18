"""Runtime models endpoint on target path `/v1/models`."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import get_model_registry, get_provider_registry
from app.core.model_registry import ModelRegistry
from app.providers import ProviderRegistry

router = APIRouter(tags=["runtime-models"])


@router.get("/models")
def list_models(
    registry: ModelRegistry = Depends(get_model_registry),
    providers: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, object]:
    models = registry.list_active_models()
    data = []
    for model in models:
        status = providers.get_provider_status(model.provider)
        data.append(
            {
                "id": model.id,
                "object": "model",
                "owned_by": model.owned_by,
                "provider": model.provider,
                "display_name": model.display_name,
                "active": model.active,
                "category": model.category,
                "source": model.source,
                "discovery_status": model.discovery_status,
                "ready": status["ready"],
                "readiness_reason": status["readiness_reason"],
                "capabilities": status["capabilities"],
                "oauth_required": status["oauth_required"],
                "discovery_supported": status["discovery_supported"],
            }
        )

    return {
        "object": "list",
        "data": data,
    }
