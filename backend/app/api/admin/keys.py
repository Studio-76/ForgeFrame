"""Admin runtime key endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.security import require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

router = APIRouter(prefix="/keys", tags=["admin-keys"])


class RuntimeKeyCreateRequest(BaseModel):
    label: str = Field(min_length=1)
    account_id: str | None = None
    scopes: list[str] = Field(default_factory=lambda: ["models:read", "chat:write", "responses:write"])


@router.get("/")
def list_runtime_keys(service: GovernanceService = Depends(get_governance_service)) -> dict[str, object]:
    return {"status": "ok", "keys": [item.model_dump() for item in service.list_runtime_keys()]}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_runtime_key(
    payload: RuntimeKeyCreateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    issued = service.issue_runtime_key(
        account_id=payload.account_id,
        label=payload.label,
        scopes=payload.scopes,
        actor=admin,
    )
    return {"status": "ok", "issued": issued.model_dump()}


@router.post("/{key_id}/rotate")
def rotate_runtime_key(
    key_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        issued = service.rotate_runtime_key(key_id, admin)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "issued": issued.model_dump()}


@router.post("/{key_id}/disable")
def disable_runtime_key(
    key_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        key = service.set_runtime_key_status(key_id, "disabled", admin)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}


@router.post("/{key_id}/activate")
def activate_runtime_key(
    key_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        key = service.set_runtime_key_status(key_id, "active", admin)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}


@router.post("/{key_id}/revoke")
def revoke_runtime_key(
    key_id: str,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        key = service.set_runtime_key_status(key_id, "revoked", admin)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}
