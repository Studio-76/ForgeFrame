"""Admin logs and audit endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.governance.service import GovernanceService, get_governance_service
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/logs", tags=["admin-logs"])


@router.get("/")
def logs_view(
    governance: GovernanceService = Depends(get_governance_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    recent_alerts = analytics.alert_indicators()
    aggregates = analytics.aggregate(window_seconds=24 * 3600)
    return {
        "status": "ok",
        "audit_events": [item.model_dump() for item in governance.list_audit_events(limit=100)],
        "alerts": recent_alerts,
        "error_summary": {
            "errors_24h": aggregates["error_event_count"],
            "errors_by_provider": aggregates["errors_by_provider"][:10],
            "errors_by_type": aggregates["errors_by_type"][:10],
        },
    }
