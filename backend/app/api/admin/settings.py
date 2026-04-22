"""Admin settings endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.admin.control_plane import get_control_plane_service
from app.api.admin.idempotency import unsupported_idempotency_response
from app.api.admin.security import require_admin_mutation_role
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.api.runtime.dependencies import get_settings as get_effective_settings
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.settings.config import Settings
from app.settings.service import (
    MUTABLE_SETTINGS,
    coerce_mutable_setting_value,
    serialize_mutable_settings,
)
from app.usage.analytics import get_usage_analytics_store

router = APIRouter(prefix="/settings", tags=["admin-settings"])
_SETTINGS_IDEMPOTENCY_MESSAGE = (
    "Idempotency-Key is not supported for settings mutations until ForgeGate persists replay-safe override write "
    "responses without duplicating configuration audit side effects."
)


class SettingsPatchRequest(BaseModel):
    updates: dict[str, object] = Field(default_factory=dict)


@router.get("/")
def list_settings(service: GovernanceService = Depends(get_governance_service)) -> dict[str, object]:
    raw = Settings()
    effective = get_effective_settings()
    overrides = service.list_setting_overrides()
    return {
        "status": "ok",
        "settings": serialize_mutable_settings(raw, effective, overrides),
    }


@router.patch("/")
def patch_settings(
    payload: SettingsPatchRequest,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_SETTINGS_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    updated: list[str] = []
    for key, raw_value in payload.updates.items():
        definition = MUTABLE_SETTINGS.get(key)
        if definition is None:
            continue
        value = coerce_mutable_setting_value(key, raw_value)
        service.upsert_setting_override(key=key, value=value, category=definition.category, actor=admin)
        updated.append(key)
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()
    service = get_governance_service()
    raw = Settings()
    effective = get_effective_settings()
    return {
        "status": "ok",
        "updated": updated,
        "settings": serialize_mutable_settings(raw, effective, service.list_setting_overrides()),
    }


@router.delete("/{key}")
def reset_setting(
    key: str,
    request: Request,
    admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    unsupported = unsupported_idempotency_response(request, message=_SETTINGS_IDEMPOTENCY_MESSAGE)
    if unsupported is not None:
        return unsupported
    try:
        service.remove_setting_override(key=key, actor=admin)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"error": {"type": "setting_override_not_found", "message": str(exc)}})
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    get_control_plane_service.cache_clear()
    get_usage_analytics_store.cache_clear()
    return {"status": "ok", "reset": key}
