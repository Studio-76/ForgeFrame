"""Admin runtime key endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import require_admin_mutation_role
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.instances.models import InstanceRecord
from app.instances.service import InstanceService, get_instance_service

router = APIRouter(prefix="/keys", tags=["admin-keys"])
_RUNTIME_KEY_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for runtime key issuance, rotation, or status mutations until ForgeFrame "
    "defines replay-safe redaction for secret-bearing key-admin responses."
)
_ONBOARDING_LAST_FIRST_SUCCESS_PROBE_KEY = "onboarding_last_first_success_probe"


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


class RuntimeKeyFirstSuccessProbeRequest(BaseModel):
    runtime_key: str = Field(min_length=1)
    chat_probe: bool = True
    model: str | None = None
    message: str = "ForgeFrame first success probe"


def _runtime_key_response(key) -> dict[str, object]:
    return key.model_dump(exclude={"secret_hash"})


@router.get("/")
def list_runtime_keys(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    return {"status": "ok", "keys": [_runtime_key_response(item) for item in service.list_runtime_keys(instance_id=instance.instance_id)]}


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
    return {"status": "ok", "key": _runtime_key_response(key)}


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
    return {"status": "ok", "key": _runtime_key_response(key)}


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
    return {"status": "ok", "key": _runtime_key_response(key)}


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
    return {"status": "ok", "key": _runtime_key_response(key)}


@router.post("/first-success/probe")
async def run_runtime_key_first_success_probe(
    payload: RuntimeKeyFirstSuccessProbeRequest,
    request: Request,
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
    instance_service: InstanceService = Depends(get_instance_service),
) -> dict[str, object]:
    runtime_key = payload.runtime_key.strip()
    identity = service.authenticate_runtime_key(runtime_key)
    executed_at = datetime.now(tz=UTC).isoformat()

    if identity is None:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "type": "runtime_key_invalid",
                    "message": "Runtime key is invalid, expired, or not active.",
                }
            },
        )

    if identity.instance_id != instance.instance_id:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "type": "runtime_key_instance_mismatch",
                    "message": (
                        f"Runtime key is scoped to instance '{identity.instance_id}', "
                        f"but onboarding is scoped to '{instance.instance_id}'."
                    ),
                }
            },
        )

    models_probe: dict[str, object] = {
        "attempted": True,
        "ok": False,
        "status_code": None,
        "model_count": 0,
        "error": None,
    }
    chat_probe: dict[str, object] = {
        "attempted": False,
        "ok": False,
        "status_code": None,
        "model": None,
        "error": None,
    }

    headers = {
        "Authorization": f"Bearer {runtime_key}",
        "Content-Type": "application/json",
    }

    models_payload: dict[str, object] | None = None
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=request.app), base_url="http://forgeframe.local") as client:
        try:
            models_response = await client.get("/v1/models", headers=headers)
            models_probe["status_code"] = models_response.status_code
            if models_response.status_code < 400:
                models_payload = models_response.json()
                models = models_payload.get("data") if isinstance(models_payload, dict) else []
                if isinstance(models, list):
                    models_probe["model_count"] = len(models)
                models_probe["ok"] = True
            else:
                models_probe["error"] = models_response.text[:500]
        except Exception as exc:  # pragma: no cover - defensive runtime boundary
            models_probe["error"] = str(exc)

        if payload.chat_probe and not bool(models_probe["ok"]):
            requested_model = payload.model.strip() if payload.model else ""
            if not requested_model and isinstance(models_payload, dict):
                data = models_payload.get("data")
                if isinstance(data, list) and data:
                    candidate = data[0]
                    if isinstance(candidate, dict) and isinstance(candidate.get("id"), str):
                        requested_model = candidate["id"]
            if not requested_model:
                requested_model = "forgeframe-baseline-chat-v1"

            chat_probe["attempted"] = True
            chat_probe["model"] = requested_model
            try:
                chat_response = await client.post(
                    "/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": requested_model,
                        "messages": [{"role": "user", "content": payload.message.strip() or "ForgeFrame first success probe"}],
                        "stream": False,
                    },
                )
                chat_probe["status_code"] = chat_response.status_code
                if chat_response.status_code < 400:
                    chat_probe["ok"] = True
                else:
                    chat_probe["error"] = chat_response.text[:500]
            except Exception as exc:  # pragma: no cover - defensive runtime boundary
                chat_probe["error"] = str(exc)

    success = bool(models_probe["ok"] or chat_probe["ok"])
    probe = {
        "runtime_key_id": identity.key_id,
        "instance_id": identity.instance_id,
        "tenant_id": identity.tenant_id,
        "models_probe": models_probe,
        "chat_probe": chat_probe,
        "success": success,
        "executed_at": executed_at,
    }
    metadata = dict(instance.metadata)
    metadata[_ONBOARDING_LAST_FIRST_SUCCESS_PROBE_KEY] = probe
    instance_service.update_instance(instance.instance_id, metadata=metadata)
    return {
        "status": "ok",
        "probe": probe,
    }
