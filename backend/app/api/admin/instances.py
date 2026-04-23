"""Admin endpoints for ForgeFrame instances."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.security import require_admin_session, require_admin_write_session
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.service import InstanceService, get_instance_service

router = APIRouter(prefix="/instances", tags=["admin-instances"])


class InstanceCreateRequest(BaseModel):
    instance_id: str | None = Field(default=None, min_length=1, max_length=191)
    slug: str | None = Field(default=None, min_length=1, max_length=191)
    display_name: str = Field(min_length=1, max_length=191)
    description: str = Field(default="", max_length=2000)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=191)
    company_id: str | None = Field(default=None, min_length=1, max_length=191)
    status: Literal["active", "disabled"] = "active"
    deployment_mode: Literal["linux_host_native", "restricted_eval", "container_optional"] = "restricted_eval"
    exposure_mode: Literal["same_origin", "local_only", "edge_admission"] = "local_only"
    metadata: dict[str, Any] = Field(default_factory=dict)


class InstanceUpdateRequest(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=191)
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    description: str | None = Field(default=None, max_length=2000)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=191)
    company_id: str | None = Field(default=None, min_length=1, max_length=191)
    status: Literal["active", "disabled"] | None = None
    deployment_mode: Literal["linux_host_native", "restricted_eval", "container_optional"] | None = None
    exposure_mode: Literal["same_origin", "local_only", "edge_admission"] | None = None
    metadata: dict[str, Any] | None = None


def _instance_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/")
def list_instances(
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    instances = governance.list_accessible_instances(
        actor=admin,
        instances=service.list_instances(),
        permission_key="instance.read",
    )
    return {
        "status": "ok",
        "instances": [item.model_dump(mode="json") for item in instances],
    }


@router.get("/{instance_id}")
def get_instance(
    instance_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        instance = service.get_instance(instance_id)
    except ValueError as exc:
        return _instance_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        governance.authorize_admin_instance_permission(
            actor=admin,
            instance=instance,
            permission_key="instance.read",
        )
    except PermissionError as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    return {"status": "ok", "instance": instance.model_dump(mode="json")}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_instance(
    payload: InstanceCreateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        active_instance = service.resolve_instance(
            instance_id=admin.active_instance_id,
            allow_default=True,
            allow_legacy_backfill=False,
        )
        creator_membership = governance.authorize_admin_instance_permission(
            actor=admin,
            instance=active_instance,
            permission_key="instance.write",
        )
    except (PermissionError, ValueError) as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    try:
        instance = service.create_instance(**payload.model_dump())
    except ValueError as exc:
        return _instance_error(status.HTTP_409_CONFLICT, "instance_conflict", str(exc))
    governance.upsert_admin_instance_membership(
        user_id=admin.user_id,
        instance=instance,
        role="owner" if creator_membership.role == "owner" else "admin",
        actor=admin,
    )
    return {"status": "ok", "instance": instance.model_dump(mode="json")}


@router.patch("/{instance_id}")
def update_instance(
    instance_id: str,
    payload: InstanceUpdateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: InstanceService = Depends(get_instance_service),
    governance: GovernanceService = Depends(get_governance_service),
) -> object:
    try:
        current = service.get_instance(instance_id)
    except ValueError as exc:
        return _instance_error(status.HTTP_404_NOT_FOUND, "instance_not_found", str(exc))
    try:
        governance.authorize_admin_instance_permission(
            actor=admin,
            instance=current,
            permission_key="instance.write",
        )
    except PermissionError as exc:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)})
    try:
        instance = service.update_instance(instance_id, **payload.model_dump(exclude_none=True))
    except ValueError as exc:
        error_type = "instance_not_found" if "was not found" in str(exc) else "instance_conflict"
        status_code = status.HTTP_404_NOT_FOUND if error_type == "instance_not_found" else status.HTTP_409_CONFLICT
        return _instance_error(status_code, error_type, str(exc))
    return {"status": "ok", "instance": instance.model_dump(mode="json")}
