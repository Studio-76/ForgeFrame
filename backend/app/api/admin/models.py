"""Admin model register endpoints."""

from fastapi import APIRouter, Depends

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/models", tags=["admin-models"])


@router.get("/")
def list_model_register(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
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
        },
    }
