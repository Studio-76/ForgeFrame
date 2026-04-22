"""Dashboard snapshot endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.security import require_admin_session
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.tenancy import TenantFilterRequiredError
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


@router.get("/")
def dashboard_snapshot(
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    control_plane: ControlPlaneService = Depends(get_control_plane_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
    governance: GovernanceService = Depends(get_governance_service),
    tenant_id: str | None = Query(default=None, alias="tenantId"),
) -> dict[str, object]:
    requested_tenant_id = (tenant_id or "").strip()
    try:
        aggregates = analytics.aggregate(window_seconds=24 * 3600, tenant_id=tenant_id)
        alerts = analytics.alert_indicators(tenant_id=tenant_id)
        provider_snapshot = control_plane.provider_control_snapshot(tenant_id=tenant_id)
    except TenantFilterRequiredError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
        )
    needs_attention = [
        item["provider"]
        for item in provider_snapshot
        if item.get("oauth_failure_count", 0) or item.get("harness_needs_attention_count", 0) or not item.get("ready", False)
    ]
    response: dict[str, object] = {
        "status": "ok",
        "kpis": {
            "providers": len(provider_snapshot),
            "active_models": sum(int(item.get("model_count", 0)) for item in provider_snapshot),
            "runtime_requests_24h": int(aggregates["event_count"]),
            "errors_24h": int(aggregates["error_event_count"]),
            "needs_attention_count": len(needs_attention),
            "runtime_keys": len(governance.list_runtime_keys(tenant_id=tenant_id)),
            "accounts": len(governance.list_accounts(tenant_id=tenant_id)),
        },
        "alerts": alerts,
        "needs_attention": needs_attention[:12],
    }
    if not requested_tenant_id and admin.role == "admin":
        response["security"] = governance.bootstrap_status()
    return response
