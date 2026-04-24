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
    allowed_request_paths: list[str] = Field(default_factory=lambda: ["smart_routing"])
    default_request_path: str = "smart_routing"
    pinned_target_key: str | None = None
    local_only_policy: str = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)


class RuntimeKeyRequestPathPolicyRequest(BaseModel):
    allowed_request_paths: list[str] = Field(default_factory=lambda: ["smart_routing"])
    default_request_path: str = "smart_routing"
    pinned_target_key: str | None = None
    local_only_policy: str = "require_local_target"
    review_required_conditions: list[str] = Field(default_factory=list)


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
        allowed_request_paths=payload.allowed_request_paths,
        default_request_path=payload.default_request_path,
        pinned_target_key=payload.pinned_target_key,
        local_only_policy=payload.local_only_policy,
        review_required_conditions=payload.review_required_conditions,
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


@router.get("/{key_id}/request-path-policy")
def get_runtime_key_request_path_policy(
    key_id: str,
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    key = next(
        (
            item
            for item in service.list_runtime_keys(instance_id=instance.instance_id)
            if item.key_id == key_id
        ),
        None,
    )
    if key is None:
        return JSONResponse(
            status_code=404,
            content={"error": {"type": "runtime_key_not_found", "message": f"Runtime key '{key_id}' not found."}},
        )
    return {
        "status": "ok",
        "policy": {
            "allowed_request_paths": list(key.allowed_request_paths),
            "default_request_path": key.default_request_path,
            "pinned_target_key": key.pinned_target_key,
            "local_only_policy": key.local_only_policy,
            "review_required_conditions": list(key.review_required_conditions),
        },
    }


@router.patch("/{key_id}/request-path-policy")
def update_runtime_key_request_path_policy(
    key_id: str,
    payload: RuntimeKeyRequestPathPolicyRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        key = service.update_runtime_key_request_path_policy(
            key_id,
            actor=admin,
            instance_id=instance.instance_id,
            allowed_request_paths=payload.allowed_request_paths,
            default_request_path=payload.default_request_path,
            pinned_target_key=payload.pinned_target_key,
            local_only_policy=payload.local_only_policy,
            review_required_conditions=payload.review_required_conditions,
        )
    except ValueError as exc:
        error_type = "runtime_key_not_found" if "not found" in str(exc).lower() else "invalid_request"
        status_code = 404 if error_type == "runtime_key_not_found" else 422
        return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": str(exc)}})
    return {"status": "ok", "key": key.model_dump()}
