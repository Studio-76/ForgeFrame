"""Admin routes for workspaces, preview, review, and handoff truth."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.workspaces.dependencies import get_work_interaction_admin_service
from app.workspaces.models import CreateWorkspace, UpdateWorkspace
from app.workspaces.service import WorkInteractionAdminService

router = APIRouter(prefix="/workspaces", tags=["admin-workspaces"])


def _workspace_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_workspaces(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> dict[str, object]:
    workspaces = service.list_workspaces(instance=instance, status=status_filter, limit=limit)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "workspaces": [item.model_dump(mode="json") for item in workspaces],
    }


@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        workspace = service.get_workspace(instance=instance, workspace_id=workspace_id)
    except ValueError as exc:
        return _workspace_error(status.HTTP_404_NOT_FOUND, "workspace_not_found", str(exc))
    return {"status": "ok", "workspace": workspace.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: CreateWorkspace,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        workspace = service.create_workspace(
            instance=instance,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        return _workspace_error(status.HTTP_409_CONFLICT, "workspace_conflict", str(exc))
    return {"status": "ok", "workspace": workspace.model_dump(mode="json")}


@router.patch("/{workspace_id}")
def update_workspace(
    workspace_id: str,
    payload: UpdateWorkspace,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        workspace = service.update_workspace(
            instance=instance,
            workspace_id=workspace_id,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        error_type = "workspace_not_found" if "not found" in str(exc) else "workspace_conflict"
        code = status.HTTP_404_NOT_FOUND if error_type == "workspace_not_found" else status.HTTP_409_CONFLICT
        return _workspace_error(code, error_type, str(exc))
    return {"status": "ok", "workspace": workspace.model_dump(mode="json")}
