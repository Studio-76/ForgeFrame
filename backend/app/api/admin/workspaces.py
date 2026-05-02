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
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_workspaces(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> dict[str, object]:
    """
    List all workspaces for the current instance, with optional filtering.

    :param status_filter: Filter by workspace status
    :type status_filter: str | None
    :param limit: Maximum number of workspaces to return
    :type limit: int
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected work interaction admin service
    :type service: WorkInteractionAdminService
    :return: Status, instance data, and list of workspaces
    :rtype: dict[str, object]
    """
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
    """
    Retrieve a single workspace by its ID.

    :param workspace_id: Unique identifier of the workspace
    :type workspace_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected work interaction admin service
    :type service: WorkInteractionAdminService
    :return: Status and workspace data
    :rtype: object
    :raises ValueError: If the workspace is not found, returns a 404 error response
    """
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
    """
    Create a new workspace.

    :param payload: Workspace creation payload
    :type payload: CreateWorkspace
    :param admin: Authenticated admin performing the creation
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected work interaction admin service
    :type service: WorkInteractionAdminService
    :return: Status and created workspace data
    :rtype: object
    :raises ValueError: If the workspace conflicts with an existing one
    """
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
    """
    Update an existing workspace.

    :param workspace_id: Unique identifier of the workspace to update
    :type workspace_id: str
    :param payload: Workspace update payload
    :type payload: UpdateWorkspace
    :param admin: Authenticated admin performing the update
    :type admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected work interaction admin service
    :type service: WorkInteractionAdminService
    :return: Status and updated workspace data
    :rtype: object
    :raises ValueError: If the workspace is not found or the update is invalid
    """
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
