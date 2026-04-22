"""Runtime models endpoint on target path `/v1/models`."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import (
    get_routing_service,
    get_runtime_gateway_identity,
    require_runtime_permission,
)
from app.api.runtime.access import list_public_runtime_models
from app.api.runtime.schemas import RuntimeModelRecord, RuntimeModelsResponse
from app.authz import RequestActor
from app.core.routing import RoutingService
from app.governance.models import RuntimeGatewayIdentity

router = APIRouter(tags=["runtime-models"])


@router.get("/models", response_model=RuntimeModelsResponse)
def list_models(
    routing: RoutingService = Depends(get_routing_service),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.models.read")),
) -> RuntimeModelsResponse:
    models = list_public_runtime_models(
        routing=routing,
        identity=gateway_identity,
    )
    return RuntimeModelsResponse(
        data=[
            RuntimeModelRecord(
                id=model.id,
                owned_by=model.owned_by,
            )
            for model in models
        ]
    )
