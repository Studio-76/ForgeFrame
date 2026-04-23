"""Admin routes for artifact inventory and cross-surface attachments."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role, require_admin_role
from app.artifacts.models import CreateArtifact, UpdateArtifact
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.workspaces.dependencies import get_work_interaction_admin_service
from app.workspaces.service import WorkInteractionAdminService

router = APIRouter(prefix="/artifacts", tags=["admin-artifacts"])


def _artifact_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("")
def list_artifacts(
    workspace_id: str | None = Query(default=None, alias="workspaceId"),
    target_kind: str | None = Query(default=None, alias="targetKind"),
    target_id: str | None = Query(default=None, alias="targetId"),
    limit: int = 100,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> dict[str, object]:
    artifacts = service.list_artifacts(
        instance=instance,
        workspace_id=workspace_id,
        target_kind=target_kind,
        target_id=target_id,
        limit=limit,
    )
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "artifacts": [item.model_dump(mode="json") for item in artifacts],
    }


@router.get("/{artifact_id}")
def get_artifact(
    artifact_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_role("operator")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        artifact = service.get_artifact(instance=instance, artifact_id=artifact_id)
    except ValueError as exc:
        return _artifact_error(status.HTTP_404_NOT_FOUND, "artifact_not_found", str(exc))
    return {"status": "ok", "artifact": artifact.model_dump(mode="json")}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_artifact(
    payload: CreateArtifact,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        artifact = service.create_artifact(
            instance=instance,
            payload=payload,
            actor_type="user",
            actor_id=admin.user_id,
        )
    except ValueError as exc:
        error_type = "artifact_conflict" if "already exists" in str(exc) else "artifact_invalid"
        code = status.HTTP_409_CONFLICT if error_type == "artifact_conflict" else status.HTTP_404_NOT_FOUND
        return _artifact_error(code, error_type, str(exc))
    return {"status": "ok", "artifact": artifact.model_dump(mode="json")}


@router.patch("/{artifact_id}")
def update_artifact(
    artifact_id: str,
    payload: UpdateArtifact,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: WorkInteractionAdminService = Depends(get_work_interaction_admin_service),
) -> object:
    try:
        artifact = service.update_artifact(instance=instance, artifact_id=artifact_id, payload=payload)
    except ValueError as exc:
        return _artifact_error(status.HTTP_404_NOT_FOUND, "artifact_not_found", str(exc))
    return {"status": "ok", "artifact": artifact.model_dump(mode="json")}
