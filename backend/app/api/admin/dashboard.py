"""Dashboard snapshot endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.admin.control_plane import ControlPlaneService, get_control_plane_service
from app.api.admin.security import require_admin_session
from app.governance.models import AuthenticatedAdmin
from app.governance.service import GovernanceService, get_governance_service
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


@router.get("/")
def dashboard_snapshot(
    _admin: AuthenticatedAdmin = Depends(require_admin_session),
    control_plane: ControlPlaneService = Depends(get_control_plane_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
    governance: GovernanceService = Depends(get_governance_service),
) -> dict[str, object]:
    aggregates = analytics.aggregate(window_seconds=24 * 3600)
    alerts = analytics.alert_indicators()
    bootstrap = governance.bootstrap_status()
    provider_snapshot = control_plane.provider_control_snapshot()
    needs_attention = [
        item["provider"]
        for item in provider_snapshot
        if item.get("oauth_failure_count", 0) or item.get("harness_needs_attention_count", 0) or not item.get("ready", False)
    ]
    return {
        "status": "ok",
        "kpis": {
            "providers": len(provider_snapshot),
            "active_models": sum(int(item.get("model_count", 0)) for item in provider_snapshot),
            "runtime_requests_24h": int(aggregates["event_count"]),
            "errors_24h": int(aggregates["error_event_count"]),
            "needs_attention_count": len(needs_attention),
            "runtime_keys": len(governance.list_runtime_keys()),
            "accounts": len(governance.list_accounts()),
        },
        "alerts": alerts,
        "needs_attention": needs_attention[:12],
        "security": bootstrap,
    }
