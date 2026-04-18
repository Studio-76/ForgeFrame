"""Admin usage endpoints for analytics/cost control-plane foundations."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import get_model_registry, get_settings
from app.core.model_registry import ModelRegistry
from app.settings.config import Settings
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(prefix="/usage", tags=["admin-usage"])


@router.get("/")
def usage_summary(
    settings: Settings = Depends(get_settings),
    registry: ModelRegistry = Depends(get_model_registry),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> dict[str, object]:
    models = registry.list_active_models()
    aggregates = analytics.aggregate()
    return {
        "status": "ok",
        "object": "usage_summary",
        "metrics": {
            "active_model_count": len(models),
            "stream_capable_model_count": len([m for m in models if m.provider in {"forgegate_baseline", "openai_api"}]),
            "recorded_request_count": aggregates["event_count"],
        },
        "aggregations": {
            "by_provider": aggregates["by_provider"],
            "by_model": aggregates["by_model"],
            "by_auth": aggregates["by_auth"],
        },
        "cost_axes": {
            "actual": "tracked for metered API providers",
            "hypothetical": "tracked for comparison and forecast",
            "avoided": "derived from actual vs hypothetical",
        },
        "pricing_snapshot": {
            "openai_input_per_1m": settings.pricing_openai_input_per_1m_tokens,
            "openai_output_per_1m": settings.pricing_openai_output_per_1m_tokens,
            "codex_hyp_input_per_1m": settings.pricing_codex_hypothetical_input_per_1m_tokens,
            "codex_hyp_output_per_1m": settings.pricing_codex_hypothetical_output_per_1m_tokens,
        },
    }
