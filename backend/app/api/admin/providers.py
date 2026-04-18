"""Admin provider control-plane endpoints."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import get_model_registry, get_provider_registry
from app.core.model_registry import ModelRegistry
from app.providers import ProviderRegistry

router = APIRouter(prefix="/providers", tags=["admin-providers"])


@router.get("/")
def list_provider_control_plane(
    registry: ModelRegistry = Depends(get_model_registry),
    providers: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, object]:
    models = registry.list_active_models()
    provider_names = sorted({model.provider for model in models})

    provider_items: list[dict[str, object]] = []
    for provider_name in provider_names:
        status = providers.get_provider_status(provider_name)
        provider_models = [model for model in models if model.provider == provider_name]
        provider_items.append(
            {
                "provider": provider_name,
                "ready": status["ready"],
                "readiness_reason": status["readiness_reason"],
                "capabilities": status["capabilities"],
                "oauth_required": status["oauth_required"],
                "discovery_supported": status["discovery_supported"],
                "model_count": len(provider_models),
                "models": [
                    {
                        "id": model.id,
                        "source": model.source,
                        "discovery_status": model.discovery_status,
                        "active": model.active,
                    }
                    for model in provider_models
                ],
            }
        )

    return {
        "status": "ok",
        "object": "provider_control_plane",
        "providers": provider_items,
        "notes": {
            "sync_action": "Model discovery sync orchestration is a planned next increment.",
            "ui_first": True,
        },
    }
