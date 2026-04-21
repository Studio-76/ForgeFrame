"""Runtime models endpoint on target path `/v1/models`."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import (
    get_model_registry,
    get_provider_registry,
    get_runtime_gateway_identity,
)
from app.core.model_registry import ModelRegistry
from app.governance.models import RuntimeGatewayIdentity
from app.providers import ProviderRegistry

router = APIRouter(tags=["runtime-models"])


@router.get("/models")
def list_models(
    registry: ModelRegistry = Depends(get_model_registry),
    providers: ProviderRegistry = Depends(get_provider_registry),
    _gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
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
                "runtime_status": model.runtime_status,
                "availability_status": model.availability_status,
                "status_reason": model.status_reason,
                "last_seen_at": model.last_seen_at,
                "last_probe_at": model.last_probe_at,
                "stale_since": model.stale_since,
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
