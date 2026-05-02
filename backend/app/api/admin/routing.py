"""Admin routing policy and simulation endpoints."""

from typing import Any

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
) -> Any:
    """
    Get the current routing control plane snapshot.

    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected control plane service
    :type service: ControlPlaneService
    :return: Status, object type, instance data, and routing snapshot
    :rtype: Any
    """
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
) -> Any:
    """
    Update a routing policy for a given classification.

    :param classification: The routing classification to update
    :type classification: str
    :param payload: Policy update request payload
    :type payload: RoutingPolicyUpdateRequest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected control plane service
    :type service: ControlPlaneService
    :return: Status and updated policy data
    :rtype: Any
    :raises ValueError: If the policy update is invalid, returns a 400 error response
    """
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
) -> Any:
    """
    Update the routing budget configuration.

    :param payload: Budget update request payload
    :type payload: RoutingBudgetUpdateRequest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected control plane service
    :type service: ControlPlaneService
    :return: Status and updated budget data
    :rtype: Any
    """
    budget = service.update_routing_budget(payload)
    return {"status": "ok", "budget": budget.model_dump(mode="json")}


@router.patch("/circuits/{target_key:path}")
def update_routing_circuit(
    target_key: str,
    payload: RoutingCircuitUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("routing.write", allow_impersonation=False)),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> Any:
    """
    Update a routing circuit breaker configuration for a target key.

    :param target_key: The target key for the circuit configuration
    :type target_key: str
    :param payload: Circuit update request payload
    :type payload: RoutingCircuitUpdateRequest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected control plane service
    :type service: ControlPlaneService
    :return: Status and updated circuit data
    :rtype: Any
    :raises ValueError: If the circuit update is invalid, returns a 400 error response
    """
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
) -> Any:
    """
    Simulate a routing decision based on the provided request.

    :param payload: Routing simulation request payload
    :type payload: RoutingSimulationRequest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected control plane service
    :type service: ControlPlaneService
    :return: Simulation result from the control plane service
    :rtype: Any
    :raises ValueError: If the simulation request is invalid, returns a 400 error response
    """
    try:
        return service.simulate_routing(payload)
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"type": "routing_simulation_invalid", "message": str(exc)}},
        )
