"""Admin accounts endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.security import require_admin_role
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service

router = APIRouter(prefix="/accounts", tags=["admin-accounts"])


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
def list_accounts(service: GovernanceService = Depends(get_governance_service)) -> dict[str, object]:
    keys = service.list_runtime_keys()
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
            for account in service.list_accounts()
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreateRequest,
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    account = service.create_account(
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
    admin: AuthenticatedAdmin = Depends(require_admin_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    try:
        account = service.update_account(
            account_id,
            label=payload.label,
            provider_bindings=payload.provider_bindings,
            notes=payload.notes,
            status=payload.status,
            actor=admin,
        )
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "account_not_found", "message": str(exc)}})
    return {"status": "ok", "account": account.model_dump()}
