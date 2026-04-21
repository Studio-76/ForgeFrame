"""Admin usage endpoints for analytics/cost control-plane foundations."""

from fastapi import APIRouter, Depends, Query

from app.api.runtime.dependencies import get_model_registry, get_settings
from app.core.model_registry import ModelRegistry
from app.settings.config import Settings
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/usage", tags=["admin-usage"])


@router.get("/")
def usage_summary(
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    settings: Settings = Depends(get_settings),
    registry: ModelRegistry = Depends(get_model_registry),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    window_map: dict[str, int | None] = {"1h": 3600, "24h": 24 * 3600, "7d": 7 * 24 * 3600, "all": None}
    selected_window = window_map[window]
    models = registry.list_active_models()
    aggregates = analytics.aggregate(window_seconds=selected_window)
    timeline = analytics.timeline(window_seconds=24 * 3600, bucket_seconds=3600)
    alerts = analytics.alert_indicators()
    return {
        "status": "ok",
        "object": "usage_summary",
        "metrics": {
            "active_model_count": len(models),
            "stream_capable_model_count": len([m for m in models if m.provider in {"forgegate_baseline", "openai_api"}]),
            "recorded_request_count": aggregates["event_count"],
            "recorded_error_count": aggregates["error_event_count"],
            "recorded_health_event_count": aggregates["health_event_count"],
        },
        "aggregations": {
            "by_provider": aggregates["by_provider"],
            "by_model": aggregates["by_model"],
            "by_auth": aggregates["by_auth"],
            "by_client": aggregates["by_client"],
            "by_traffic_type": aggregates["by_traffic_type"],
            "errors_by_provider": aggregates["errors_by_provider"],
            "errors_by_model": aggregates["errors_by_model"],
            "errors_by_client": aggregates["errors_by_client"],
            "errors_by_traffic_type": aggregates["errors_by_traffic_type"],
            "errors_by_type": aggregates["errors_by_type"],
            "errors_by_integration": aggregates["errors_by_integration"],
            "errors_by_profile": aggregates["errors_by_profile"],
        },
        "traffic_split": {
            "runtime": next((item for item in aggregates["by_traffic_type"] if item["traffic_type"] == "runtime"), {"traffic_type": "runtime", "requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0}),
            "health_check": next((item for item in aggregates["by_traffic_type"] if item["traffic_type"] == "health_check"), {"traffic_type": "health_check", "requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0}),
        },
        "cost_axes": {
            "actual": "tracked for metered API providers",
            "hypothetical": "tracked for comparison and forecast",
            "avoided": "derived from actual vs hypothetical",
        },
        "window": window,
        "latest_health": aggregates["latest_health"],
        "timeline_24h": timeline,
        "alerts": alerts,
        "pricing_snapshot": {
            "openai_input_per_1m": settings.pricing_openai_input_per_1m_tokens,
            "openai_output_per_1m": settings.pricing_openai_output_per_1m_tokens,
            "codex_hyp_input_per_1m": settings.pricing_codex_hypothetical_input_per_1m_tokens,
            "codex_hyp_output_per_1m": settings.pricing_codex_hypothetical_output_per_1m_tokens,
        },
    }


@router.get("/clients")
def client_operational_view(
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    window_map: dict[str, int | None] = {"1h": 3600, "24h": 24 * 3600, "7d": 7 * 24 * 3600, "all": None}
    selected_window = window_map[window]
    aggregates = analytics.aggregate(window_seconds=selected_window)
    client_map = {str(item["client_id"]): item for item in aggregates["by_client"]}
    for err in aggregates["errors_by_client"]:
        cid = str(err["client_id"])
        client_map.setdefault(cid, {"client_id": cid, "requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        client_map[cid]["errors"] = int(err["errors"])
    for value in client_map.values():
        requests = int(value.get("requests", 0))
        errors = int(value.get("errors", 0))
        value["error_rate"] = errors / max(1, errors + requests)
        value["needs_attention"] = bool(errors >= 3 or value["error_rate"] >= 0.2)
    ranked = sorted(client_map.values(), key=lambda item: (bool(item["needs_attention"]), float(item.get("actual_cost", 0.0)), int(item.get("errors", 0))), reverse=True)
    return {"status": "ok", "window": window, "clients": ranked[:50]}


@router.get("/providers/{provider_name}")
def provider_drilldown(
    provider_name: str,
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    window_map: dict[str, int | None] = {"1h": 3600, "24h": 24 * 3600, "7d": 7 * 24 * 3600, "all": None}
    return {
        "status": "ok",
        "window": window,
        "drilldown": analytics.provider_drilldown(provider_name, window_seconds=window_map[window]),
    }


@router.get("/clients/{client_id}")
def client_drilldown(
    client_id: str,
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    window_map: dict[str, int | None] = {"1h": 3600, "24h": 24 * 3600, "7d": 7 * 24 * 3600, "all": None}
    return {
        "status": "ok",
        "window": window,
        "drilldown": analytics.client_drilldown(client_id, window_seconds=window_map[window]),
    }
