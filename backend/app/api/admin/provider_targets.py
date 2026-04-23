"""Admin provider-target register endpoints."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.control_plane_models import ProviderTargetUpdateRequest
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_instance_permission
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/provider-targets", tags=["admin-provider-targets"])


@router.get("/")
def list_provider_targets(
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("provider_targets.read")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    targets = service.provider_target_snapshot()
    return {
        "status": "ok",
        "object": "provider_target_register",
        "instance": instance.model_dump(mode="json"),
        "targets": targets,
        "summary": {
            "total_targets": len(targets),
            "enabled_targets": len([target for target in targets if bool(target["enabled"])]),
            "queue_eligible_targets": len([target for target in targets if bool(target["queue_eligible"])]),
            "ready_targets": len([target for target in targets if str(target["readiness_status"]) == "ready"]),
        },
    }


@router.patch("/{target_key:path}")
def update_provider_target(
    target_key: str,
    payload: ProviderTargetUpdateRequest,
    _admin: AuthenticatedAdmin = Depends(
        require_admin_instance_permission("provider_targets.write", allow_impersonation=False)
    ),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict[str, object]:
    try:
        target = service.update_provider_target(target_key, payload)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "is not managed" in str(exc) else status.HTTP_400_BAD_REQUEST
        error_type = "provider_target_not_found" if status_code == status.HTTP_404_NOT_FOUND else "provider_target_invalid"
        return JSONResponse(
            status_code=status_code,
            content={"error": {"type": error_type, "message": str(exc)}},
        )
    return {
        "status": "ok",
        "target": target.model_dump(mode="json"),
    }
