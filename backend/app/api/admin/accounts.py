"""Admin accounts endpoints."""

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

router = APIRouter(prefix="/accounts", tags=["admin-accounts"])
_ACCOUNT_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for account mutations until ForgeFrame persists replay-safe account write "
    "responses without duplicating governance audit side effects."
)


class AccountCreateRequest(BaseModel):
    label: str = Field(min_length=1)
    provider_bindings: list[str] = Field(default_factory=list)
    notes: str = ""


class AccountUpdateRequest(BaseModel):
    label: str | None = None
    provider_bindings: list[str] | None = None
    notes: str | None = None
    status: str | None = None


@router.get("/")
def list_accounts(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    keys = service.list_runtime_keys(instance_id=instance.instance_id)
    key_counts: dict[str, int] = {}
    for item in keys:
        if item.account_id:
            key_counts[item.account_id] = key_counts.get(item.account_id, 0) + 1
    return {
        "status": "ok",
        "accounts": [
            {
                **account.model_dump(),
                "runtime_key_count": key_counts.get(account.account_id, 0),
            }
            for account in service.list_accounts(instance_id=instance.instance_id)
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreateRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_ACCOUNT_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    account = service.create_account(
        instance_id=instance.instance_id,
        tenant_id=instance.tenant_id,
        label=payload.label,
        provider_bindings=payload.provider_bindings,
        notes=payload.notes,
        actor=admin,
    )
    return {"status": "ok", "account": account.model_dump()}


@router.patch("/{account_id}")
def update_account(
    account_id: str,
    payload: AccountUpdateRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_ACCOUNT_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        account = service.update_account(
            account_id,
            instance_id=instance.instance_id,
            label=payload.label,
            provider_bindings=payload.provider_bindings,
            notes=payload.notes,
            status=payload.status,
            actor=admin,
        )
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "account_not_found", "message": str(exc)}})
    return {"status": "ok", "account": account.model_dump()}
