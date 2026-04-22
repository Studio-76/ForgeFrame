"""Telemetry metric helpers for operator observability views."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from statistics import mean

from sqlalchemy import func, select

from app.execution.dependencies import get_execution_session_factory
from app.settings.config import Settings
from app.storage.execution_repository import RunAttemptORM, RunORM, RunOutboxORM
from app.usage.analytics import UsageAnalyticsStore
from app.usage.events import ErrorEvent, HealthEvent, UsageEvent


def _percentile(values: list[int], percentile: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    index = round((len(ordered) - 1) * percentile)
    return ordered[index]


def _within_window(created_at: str, *, window_seconds: int) -> bool:
    cutoff = datetime.now(tz=UTC) - timedelta(seconds=window_seconds)
    return datetime.fromisoformat(created_at) >= cutoff


def _runtime_usage_events(
    analytics: UsageAnalyticsStore,
    *,
    tenant_id: str | None,
    window_seconds: int,
) -> list[UsageEvent]:
    return [
        event
        for event in analytics.list_usage_events(tenant_id=tenant_id)
        if event.traffic_type == "runtime" and _within_window(event.created_at, window_seconds=window_seconds)
    ]


def _runtime_error_events(
    analytics: UsageAnalyticsStore,
    *,
    tenant_id: str | None,
    window_seconds: int,
) -> list[ErrorEvent]:
    return [
        event
        for event in analytics.list_error_events(tenant_id=tenant_id)
        if event.traffic_type == "runtime" and _within_window(event.created_at, window_seconds=window_seconds)
    ]


def _health_events(
    analytics: UsageAnalyticsStore,
    *,
    tenant_id: str | None,
    window_seconds: int,
) -> list[HealthEvent]:
    return [
        event
        for event in analytics.list_health_events(tenant_id=tenant_id)
        if _within_window(event.created_at, window_seconds=window_seconds)
    ]


def _red_metrics(runtime_usage: list[UsageEvent], runtime_errors: list[ErrorEvent]) -> dict[str, object]:
    total_requests = len(runtime_usage) + len(runtime_errors)
    durations = [
        int(duration)
        for duration in [
            *[event.duration_ms for event in runtime_usage],
            *[event.duration_ms for event in runtime_errors],
        ]
        if isinstance(duration, int)
    ]
    error_count = len(runtime_errors)
    return {
        "requests": total_requests,
        "successes": len(runtime_usage),
        "errors": error_count,
        "error_rate": (error_count / total_requests) if total_requests else 0.0,
        "duration_coverage": len(durations),
        "avg_duration_ms": round(mean(durations), 2) if durations else None,
        "p95_duration_ms": _percentile(durations, 0.95),
    }


def _dependency_metrics(
    runtime_usage: list[UsageEvent],
    runtime_errors: list[ErrorEvent],
    health_events: list[HealthEvent],
) -> list[dict[str, object]]:
    grouped_usage: dict[str, list[UsageEvent]] = defaultdict(list)
    grouped_errors: dict[str, list[ErrorEvent]] = defaultdict(list)
    latest_health: dict[str, HealthEvent] = {}

    for event in runtime_usage:
        grouped_usage[event.provider].append(event)
    for event in runtime_errors:
        grouped_errors[event.provider or "unknown"].append(event)
    for event in health_events:
        latest_health[event.provider] = event

    providers = sorted(set(grouped_usage) | set(grouped_errors) | set(latest_health))
    rows: list[dict[str, object]] = []
    for provider in providers:
        usage_events = grouped_usage.get(provider, [])
        error_events = grouped_errors.get(provider, [])
        durations = [
            int(duration)
            for duration in [
                *[event.duration_ms for event in usage_events],
                *[event.duration_ms for event in error_events],
            ]
            if isinstance(duration, int)
        ]
        request_count = len(usage_events) + len(error_events)
        health = latest_health.get(provider)
        rows.append(
            {
                "provider": provider,
                "requests": request_count,
                "errors": len(error_events),
                "error_rate": (len(error_events) / request_count) if request_count else 0.0,
                "avg_duration_ms": round(mean(durations), 2) if durations else None,
                "p95_duration_ms": _percentile(durations, 0.95),
                "latest_health_status": health.status if health is not None else None,
                "latest_health_reason": health.readiness_reason if health is not None else None,
                "latest_health_error": health.last_error if health is not None else None,
                "trace_coverage": sum(1 for event in [*usage_events, *error_events] if getattr(event, "trace_id", None)),
            }
        )
    return rows


def _queue_metrics(*, company_id: str | None) -> dict[str, object]:
    session_factory = get_execution_session_factory()
    with session_factory() as session:
        run_query = select(RunORM.state, func.count()).group_by(RunORM.state)
        attempt_query = select(RunAttemptORM.attempt_state, func.count()).group_by(RunAttemptORM.attempt_state)
        outbox_query = select(RunOutboxORM.publish_state, func.count()).group_by(RunOutboxORM.publish_state)
        if company_id:
            run_query = run_query.where(RunORM.company_id == company_id)
            attempt_query = attempt_query.where(RunAttemptORM.company_id == company_id)
            outbox_query = outbox_query.where(RunOutboxORM.company_id == company_id)

        run_states = Counter({str(state): int(count) for state, count in session.execute(run_query).all()})
        attempt_states = Counter({str(state): int(count) for state, count in session.execute(attempt_query).all()})
        outbox_states = Counter({str(state): int(count) for state, count in session.execute(outbox_query).all()})

    active_backlog = sum(
        run_states.get(state, 0)
        for state in ("queued", "dispatching", "executing", "waiting_on_approval", "retry_backoff", "cancel_requested", "compensating")
    )
    return {
        "company_scope": company_id or "all",
        "run_states": dict(run_states),
        "attempt_states": dict(attempt_states),
        "outbox_publish_states": dict(outbox_states),
        "active_backlog": active_backlog,
        "pending_dispatch": attempt_states.get("queued", 0),
        "retry_backoff": attempt_states.get("retry_backoff", 0),
        "dead_letters": run_states.get("dead_lettered", 0) + attempt_states.get("dead_lettered", 0) + outbox_states.get("dead", 0),
        "pending_outbox": outbox_states.get("pending", 0),
        "leased_outbox": outbox_states.get("leased", 0),
    }


def _slo_indicators(red_metrics: dict[str, object], dependency_metrics: list[dict[str, object]]) -> dict[str, object]:
    request_count = int(red_metrics["requests"])
    error_rate = float(red_metrics["error_rate"])
    degraded_dependencies = [
        item["provider"]
        for item in dependency_metrics
        if item["latest_health_status"] not in {None, "healthy", "discovery_only"}
    ]
    return {
        "request_volume": request_count,
        "availability_ratio": 1.0 - error_rate if request_count else None,
        "error_rate": error_rate if request_count else None,
        "latency_p95_ms": red_metrics["p95_duration_ms"],
        "latency_avg_ms": red_metrics["avg_duration_ms"],
        "telemetry_ready": bool(red_metrics["duration_coverage"]) and request_count > 0,
        "degraded_dependencies": degraded_dependencies,
    }


def build_metrics_operability_snapshot(
    settings: Settings,
    analytics: UsageAnalyticsStore,
    *,
    window_seconds: int = 24 * 3600,
    tenant_id: str | None = None,
    company_id: str | None = None,
) -> dict[str, object]:
    aggregates = analytics.aggregate(window_seconds=window_seconds, tenant_id=tenant_id)
    traffic_by_type = {str(item["traffic_type"]): item for item in aggregates["by_traffic_type"]}
    runtime_usage = _runtime_usage_events(analytics, tenant_id=tenant_id, window_seconds=window_seconds)
    runtime_errors = _runtime_error_events(analytics, tenant_id=tenant_id, window_seconds=window_seconds)
    health_events = _health_events(analytics, tenant_id=tenant_id, window_seconds=window_seconds)
    red_metrics = _red_metrics(runtime_usage, runtime_errors)
    dependency_metrics = _dependency_metrics(runtime_usage, runtime_errors, health_events)
    queue_metrics = _queue_metrics(company_id=company_id)
    slo_indicators = _slo_indicators(red_metrics, dependency_metrics)
    return {
        "window_seconds": window_seconds,
        "storage_backend": settings.observability_storage_backend,
        "runtime_requests": int(
            traffic_by_type.get(
                "runtime",
                {
                    "requests": 0,
                },
            )["requests"]
        ),
        "runtime_errors": red_metrics["errors"],
        "health_events": int(aggregates["health_event_count"]),
        "runtime_traffic": traffic_by_type.get(
            "runtime",
            {
                "traffic_type": "runtime",
                "requests": 0,
                "tokens": 0,
                "actual_cost": 0.0,
                "hypothetical_cost": 0.0,
                "avoided_cost": 0.0,
            },
        ),
        "health_traffic": traffic_by_type.get(
            "health_check",
            {
                "traffic_type": "health_check",
                "requests": 0,
                "tokens": 0,
                "actual_cost": 0.0,
                "hypothetical_cost": 0.0,
                "avoided_cost": 0.0,
            },
        ),
        "red_metrics": red_metrics,
        "runtime_duration_ms": aggregates.get("runtime_duration_ms"),
        "dependency_metrics": dependency_metrics,
        "queue_metrics": queue_metrics,
        "slo_indicators": slo_indicators,
        "latest_health": sorted(
            aggregates["latest_health"],
            key=lambda item: str(item["checked_at"]),
            reverse=True,
        )[:10],
        "alerts": analytics.alert_indicators(tenant_id=tenant_id),
    }
