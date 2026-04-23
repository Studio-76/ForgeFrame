"""Admin routing policy and simulation endpoints."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.control_plane_models import (
    RoutingBudgetUpdateRequest,
    RoutingCircuitUpdateRequest,
    RoutingPolicyUpdateRequest,
    RoutingSimulationRequest,
)
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_instance_permission
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/routing", tags=["admin-routing"])


@router.get("/")
def get_routing_snapshot(
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.read")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    snapshot = service.routing_snapshot()
    return {
        "status": "ok",
        "object": "routing_control_plane",
        "instance": instance.model_dump(mode="json"),
        **snapshot,
    }


@router.patch("/policies/{classification}")
def update_routing_policy(
    classification: str,
    payload: RoutingPolicyUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.write", allow_impersonation=False)),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    try:
        policy = service.update_routing_policy(classification, payload)
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"type": "routing_policy_invalid", "message": str(exc)}},
        )
    return {"status": "ok", "policy": policy.model_dump(mode="json")}


@router.patch("/budget")
def update_routing_budget(
    payload: RoutingBudgetUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.write", allow_impersonation=False)),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    budget = service.update_routing_budget(payload)
    return {"status": "ok", "budget": budget.model_dump(mode="json")}


@router.patch("/circuits/{target_key:path}")
def update_routing_circuit(
    target_key: str,
    payload: RoutingCircuitUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.write", allow_impersonation=False)),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    try:
        circuit = service.update_routing_circuit(target_key, payload)
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"type": "routing_circuit_invalid", "message": str(exc)}},
        )
    return {"status": "ok", "circuit": circuit.model_dump(mode="json")}


@router.post("/simulate")
def simulate_routing(
    payload: RoutingSimulationRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.read")),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    return service.simulate_routing(payload)
