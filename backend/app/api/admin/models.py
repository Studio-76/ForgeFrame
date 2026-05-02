"""Admin model register endpoints."""

from typing import Any

from fastapi import APIRouter, Depends

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/models", tags=["admin-models"])


@router.get("/")
def list_model_register(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, Any]:
    """
    List the model register with summary statistics for the current instance.

    :param instance: Resolved instance scope
    :type instance: InstanceRecord
    :param service: Control plane service
    :type service: ControlPlaneService
    :return: Dictionary with status, instance data, model list, and summary statistics
    :rtype: dict[str, Any]
    """
    models = service.model_register_snapshot()
    return {
        "status": "ok",
        "object": "model_register",
        "instance": instance.model_dump(mode="json"),
        "models": models,
        "summary": {
            "total_models": len(models),
            "active_models": len([model for model in models if bool(model["active"])]),
            "models_with_targets": len([model for model in models if int(model["target_count"]) > 0]),
            "runtime_ready_models": len([model for model in models if str(model["runtime_status"]) == "ready"]),
            "routable_models": len([model for model in models if bool(model["routing_ready"])]),
            "tested_models": len([model for model in models if str(model["trust_status"]) == "tested"]),
            "uncovered_models": len([model for model in models if int(model["routing_target_count"]) == 0]),
        },
    }
