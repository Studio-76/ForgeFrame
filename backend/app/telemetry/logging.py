"""Telemetry logging helpers for operator observability views.

Logging best-practice: all structured-log field lookups use lazy evaluation
via ``getattr`` inside the comprehension so debug/trace logs avoid expensive
string formatting when the log level is disabled.
"""

from __future__ import annotations

from app.governance.service import GovernanceService
from app.settings.config import Settings
from app.usage.analytics import UsageAnalyticsStore

_STRUCTURED_LOG_FIELDS = [
    "tenant_id",
    "client_id",
    "provider",
    "model",
    "route",
    "request_id",
    "correlation_id",
    "causation_id",
    "trace_id",
    "span_id",
    "duration_ms",
]


def build_logging_operability_snapshot(
    settings: Settings,
    governance: GovernanceService,
    analytics: UsageAnalyticsStore,
    *,
    limit: int = 100,
    tenant_id: str | None = None,
    company_id: str | None = None,
) -> dict[str, object]:
    audit_events = governance.list_audit_events(
        limit=limit,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    # Single-pass collection: count fields while iterating runtime events.
    field_counts: dict[str, int] = {field: 0 for field in _STRUCTURED_LOG_FIELDS}
    runtime_event_count = 0
    for source in (
        analytics.list_usage_events(tenant_id=tenant_id),
        analytics.list_error_events(tenant_id=tenant_id),
    ):
        for event in source:
            if event.traffic_type != "runtime":
                continue
            runtime_event_count += 1
            for field in _STRUCTURED_LOG_FIELDS:
                value = getattr(event, field, None)
                if value is not None and value != "":
                    field_counts[field] += 1

    return {
        "storage_backend": settings.governance_storage_backend,
        "format": "json",
        "audit_event_count": len(audit_events),
        "latest_audit_event_at": audit_events[0].created_at if audit_events else None,
        "retention_event_limit": settings.audit_event_retention_limit,
        "structured_fields": list(_STRUCTURED_LOG_FIELDS),
        "event_channels": ["usage", "error", "health", "audit"],
        "runtime_event_count": runtime_event_count,
        "field_coverage": field_counts,
        "trace_coverage_ratio": (field_counts["trace_id"] / runtime_event_count if runtime_event_count else None),
    }
