"""Admin runtime key endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.models import InstanceRecord

router = APIRouter(prefix="/keys", tags=["admin-keys"])
_RUNTIME_KEY_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for runtime key issuance, rotation, or status mutations until ForgeFrame "
    "defines replay-safe redaction for secret-bearing key-admin responses."
)


class RuntimeKeyCreateRequest(BaseModel):
    label: str = Field(min_length=1)
    account_id: str | None = None
    scopes: list[str] = Field(default_factory=lambda: ["models:read", "chat:write", "responses:write"])


@router.get("/")
def list_runtime_keys(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "keys": [item.model_dump() for item in service.list_runtime_keys(instance_id=instance.instance_id)]}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_runtime_key(
    payload: RuntimeKeyCreateRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_RUNTIME_KEY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    issued = service.issue_runtime_key(
        instance_id=instance.instance_id,
        tenant_id=instance.tenant_id,
        account_id=payload.account_id,
        label=payload.label,
        scopes=payload.scopes,
        actor=admin,
    )
    return {"status": "ok", "issued": issued.model_dump()}


@router.post("/{key_id}/rotate")
def rotate_runtime_key(
    key_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_RUNTIME_KEY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        issued = service.rotate_runtime_key(key_id, admin, instance_id=instance.instance_id)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "issued": issued.model_dump()}


@router.post("/{key_id}/disable")
def disable_runtime_key(
    key_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_RUNTIME_KEY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        key = service.set_runtime_key_status(key_id, "disabled", admin, instance_id=instance.instance_id)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}


@router.post("/{key_id}/activate")
def activate_runtime_key(
    key_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_RUNTIME_KEY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        key = service.set_runtime_key_status(key_id, "active", admin, instance_id=instance.instance_id)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}


@router.post("/{key_id}/revoke")
def revoke_runtime_key(
    key_id: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_RUNTIME_KEY_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        key = service.set_runtime_key_status(key_id, "revoked", admin, instance_id=instance.instance_id)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "runtime_key_not_found", "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}
