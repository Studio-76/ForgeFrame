"""Admin usage endpoints for analytics/cost control-plane foundations."""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from math import ceil
from typing import Any, cast

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.core.model_registry import ModelRegistry
from app.instances.models import InstanceRecord
from app.settings.config import Settings, get_settings
from app.tenancy import TenantFilterRequiredError
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store
from app.usage.events import ErrorEvent, HealthEvent, UsageEvent

router = APIRouter(prefix="/usage", tags=["admin-usage"])

WINDOW_MAP: dict[str, int | None] = {
    "1h": 3600,
    "24h": 24 * 3600,
    "7d": 7 * 24 * 3600,
    "all": None,
}


def _tenant_filter_error(exc: TenantFilterRequiredError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": {"type": "tenant_filter_required", "message": str(exc)}},
    )


def get_admin_model_registry(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    settings: Settings = Depends(get_settings),
) -> ModelRegistry:
    return ModelRegistry(settings, instance_id=instance.instance_id)


def _window_seconds(window: str) -> int | None:
    return WINDOW_MAP[window]


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _window_filter(
    entries: list[UsageEvent] | list[ErrorEvent] | list[HealthEvent],
    window_seconds: int | None,
):
    if window_seconds is None:
        return entries
    cutoff = datetime.now(tz=UTC) - timedelta(seconds=window_seconds)
    return [entry for entry in entries if _parse_dt(getattr(entry, "created_at")) >= cutoff]


def _matches_usage_filters(
    event: UsageEvent,
    *,
    provider: str | None,
    client_id: str | None,
    model: str | None,
) -> bool:
    return (provider is None or event.provider == provider) and (client_id is None or event.client_id == client_id) and (model is None or event.model == model)


def _matches_error_filters(
    event: ErrorEvent,
    *,
    provider: str | None,
    client_id: str | None,
    model: str | None,
) -> bool:
    return (provider is None or event.provider == provider) and (client_id is None or event.client_id == client_id) and (model is None or event.model == model)


def _matches_health_filters(
    event: HealthEvent,
    *,
    provider: str | None,
    model: str | None,
) -> bool:
    return (provider is None or event.provider == provider) and (model is None or event.model == model)


def _normalized_stream_mode(event: UsageEvent) -> str:
    if event.stream_mode in {"stream", "non_stream"}:
        return event.stream_mode
    return "stream" if event.credential_type == "stream" else "non_stream"


def _duration_percentile(samples: list[int], percentile: float) -> int | None:
    if not samples:
        return None
    index = max(0, ceil(percentile * len(samples)) - 1)
    return samples[index]


def _runtime_duration_summary(
    events: list[UsageEvent],
    errors: list[ErrorEvent],
) -> Any:
    samples = sorted(int(duration_ms) for entry in [*events, *errors] if getattr(entry, "traffic_type", None) == "runtime" and (duration_ms := getattr(entry, "duration_ms", None)) is not None)
    if not samples:
        return {
            "sample_count": 0,
            "avg": None,
            "p50": None,
            "p95": None,
            "max": None,
        }
    return {
        "sample_count": len(samples),
        "avg": round(sum(samples) / len(samples), 2),
        "p50": _duration_percentile(samples, 0.50),
        "p95": _duration_percentile(samples, 0.95),
        "max": samples[-1],
    }


def _build_timeline(
    events: list[UsageEvent],
    errors: list[ErrorEvent],
    *,
    window_seconds: int = 24 * 3600,
    bucket_seconds: int = 3600,
) -> list[dict[str, Any]]:
    now = datetime.now(tz=UTC)
    bucket_count = max(1, window_seconds // bucket_seconds)
    buckets: list[dict[str, Any]] = []
    for index in range(bucket_count):
        bucket_start = now - timedelta(seconds=(bucket_count - index) * bucket_seconds)
        bucket_end = bucket_start + timedelta(seconds=bucket_seconds)
        bucket_events = [event for event in events if bucket_start <= _parse_dt(event.created_at) < bucket_end]
        bucket_errors = [event for event in errors if bucket_start <= _parse_dt(event.created_at) < bucket_end]
        buckets.append({
            "bucket_start": bucket_start.isoformat(),
            "bucket_end": bucket_end.isoformat(),
            "requests": len(bucket_events),
            "errors": len(bucket_errors),
            "actual_cost": sum(event.actual_cost for event in bucket_events),
            "hypothetical_cost": sum(event.hypothetical_cost for event in bucket_events),
            "avoided_cost": sum(event.avoided_cost for event in bucket_events),
            "error_rate": (len(bucket_errors) / max(1, len(bucket_events) + len(bucket_errors))),
        })
    return buckets


def _build_alerts(
    events: list[UsageEvent],
    errors: list[ErrorEvent],
) -> list[dict[str, Any]]:
    runtime_events = [event for event in events if event.traffic_type == "runtime"]
    runtime_errors = [event for event in errors if event.traffic_type == "runtime"]
    requests = len(runtime_events)
    error_rate = len(runtime_errors) / max(1, requests + len(runtime_errors))
    alerts: list[dict[str, Any]] = []
    if error_rate >= 0.25 and len(runtime_errors) >= 3:
        alerts.append({
            "severity": "critical",
            "type": "error_rate_spike",
            "message": "Error rate exceeded 25% in last hour.",
            "value": error_rate,
        })
    elif error_rate >= 0.1 and len(runtime_errors) >= 2:
        alerts.append({
            "severity": "warning",
            "type": "error_rate_rising",
            "message": "Error rate exceeded 10% in last hour.",
            "value": error_rate,
        })

    health_failures = len([event for event in errors if event.traffic_type == "health_check"])
    if health_failures >= 5:
        alerts.append({
            "severity": "warning",
            "type": "health_failures",
            "message": "Health checks report repeated failures.",
            "value": health_failures,
        })

    health_cost = sum(event.actual_cost for event in events if event.traffic_type == "health_check")
    runtime_cost = sum(event.actual_cost for event in runtime_events)
    if health_cost > runtime_cost and health_cost > 0:
        alerts.append({
            "severity": "warning",
            "type": "health_cost_pressure",
            "message": "Health-check costs exceeded runtime costs in last hour.",
            "value": health_cost,
        })
    if requests == 0 and len(runtime_errors) > 0:
        alerts.append({
            "severity": "warning",
            "type": "control_plane_only_errors",
            "message": "Only error traffic was recorded in the last hour.",
            "value": len(runtime_errors),
        })

    errors_by_provider: dict[str, int] = defaultdict(int)
    for event in runtime_errors:
        errors_by_provider[event.provider or "unknown"] += 1
    if errors_by_provider:
        top_provider, provider_errors = max(errors_by_provider.items(), key=lambda item: item[1])
        if provider_errors >= 3:
            alerts.append({
                "severity": "warning",
                "type": "provider_hotspot",
                "message": f"Provider {top_provider} is the current error hotspot.",
                "value": provider_errors,
            })
    return alerts


def _cost_truths(
    *,
    runtime: dict[str, Any],
    health_check: dict[str, Any],
) -> Any:
    runtime_actual = float(runtime.get("actual_cost", 0.0) or 0.0)
    runtime_hypothetical = float(runtime.get("hypothetical_cost", 0.0) or 0.0)
    runtime_avoided = float(runtime.get("avoided_cost", 0.0) or 0.0)
    health_actual = float(health_check.get("actual_cost", 0.0) or 0.0)
    health_hypothetical = float(health_check.get("hypothetical_cost", 0.0) or 0.0)
    health_avoided = float(health_check.get("avoided_cost", 0.0) or 0.0)

    estimated_runtime = round(runtime_hypothetical, 6)
    estimated_health = round(health_hypothetical, 6)
    modeled_runtime = round(max(runtime_hypothetical - runtime_actual, 0.0), 6)
    modeled_health = round(max(health_hypothetical - health_actual, 0.0), 6)

    return {
        "actual": {
            "label": "Actual",
            "status": "tracked",
            "billing_truth": True,
            "description": "Persisted runtime and health costs when ForgeFrame is the direct metering path.",
            "runtime_cost": round(runtime_actual, 6),
            "health_check_cost": round(health_actual, 6),
            "total_cost": round(runtime_actual + health_actual, 6),
        },
        "provider_reported": {
            "label": "Provider reported",
            "status": "unsupported",
            "billing_truth": True,
            "description": "ForgeFrame does not ingest provider invoices or billing exports on this host.",
            "runtime_cost": None,
            "health_check_cost": None,
            "total_cost": None,
        },
        "estimated": {
            "label": "Estimated",
            "status": "derived",
            "billing_truth": False,
            "description": "Configured price-card estimate across recorded traffic. Useful for forecast, not billing truth.",
            "runtime_cost": estimated_runtime,
            "health_check_cost": estimated_health,
            "total_cost": round(estimated_runtime + estimated_health, 6),
        },
        "modeled": {
            "label": "Modeled",
            "status": "derived",
            "billing_truth": False,
            "description": "Estimated cost exposure that is not directly metered by ForgeFrame actual-cost records.",
            "runtime_cost": modeled_runtime,
            "health_check_cost": modeled_health,
            "total_cost": round(modeled_runtime + modeled_health, 6),
        },
        "avoided": {
            "label": "Avoided",
            "status": "derived",
            "billing_truth": False,
            "description": "Estimated spend avoided when traffic would have been billable under a metered equivalent.",
            "runtime_cost": round(runtime_avoided, 6),
            "health_check_cost": round(health_avoided, 6),
            "total_cost": round(runtime_avoided + health_avoided, 6),
        },
    }


def _filtered_usage_summary_payload(
    *,
    window: str,
    instance: InstanceRecord,
    settings: Settings,
    registry: ModelRegistry,
    analytics: UsageAnalyticsStore,
    provider: str | None,
    client_id: str | None,
    model: str | None,
) -> Any:
    selected_window = _window_seconds(window)
    events = [
        event
        for event in _window_filter(analytics.list_usage_events(tenant_id=instance.tenant_id), selected_window)
        if _matches_usage_filters(event, provider=provider, client_id=client_id, model=model)
    ]
    errors = [
        event
        for event in _window_filter(analytics.list_error_events(tenant_id=instance.tenant_id), selected_window)
        if _matches_error_filters(event, provider=provider, client_id=client_id, model=model)
    ]
    health = [event for event in _window_filter(analytics.list_health_events(tenant_id=instance.tenant_id), selected_window) if _matches_health_filters(event, provider=provider, model=model)]

    models = registry.list_active_models()
    grouped_provider: defaultdict[str, dict[str, int | float]] = defaultdict(
        lambda: {
            "requests": 0,
            "tokens": 0,
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
        }
    )
    grouped_model: defaultdict[str, dict[str, int | float]] = defaultdict(lambda: {"requests": 0, "tokens": 0})
    grouped_auth: defaultdict[str, dict[str, int | float]] = defaultdict(lambda: {"requests": 0, "tokens": 0})
    grouped_client: defaultdict[str, dict[str, int | float]] = defaultdict(
        lambda: {
            "requests": 0,
            "tokens": 0,
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
        }
    )
    grouped_traffic: defaultdict[str, dict[str, int | float]] = defaultdict(
        lambda: {
            "requests": 0,
            "tokens": 0,
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
        }
    )
    grouped_stream_mode: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"requests": 0})
    grouped_error_provider: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_model: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_client: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_traffic: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_type: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_integration: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})
    grouped_error_profile: defaultdict[str, dict[str, int]] = defaultdict(lambda: {"errors": 0})

    for event in events:
        grouped_provider[event.provider]["requests"] += 1
        grouped_provider[event.provider]["tokens"] += event.total_tokens
        grouped_provider[event.provider]["actual_cost"] += event.actual_cost
        grouped_provider[event.provider]["hypothetical_cost"] += event.hypothetical_cost
        grouped_provider[event.provider]["avoided_cost"] += event.avoided_cost

        grouped_model[event.model]["requests"] += 1
        grouped_model[event.model]["tokens"] += event.total_tokens

        auth_key = f"{event.credential_type}:{event.auth_source}"
        grouped_auth[auth_key]["requests"] += 1
        grouped_auth[auth_key]["tokens"] += event.total_tokens

        grouped_client[event.client_id]["requests"] += 1
        grouped_client[event.client_id]["tokens"] += event.total_tokens
        grouped_client[event.client_id]["actual_cost"] += event.actual_cost
        grouped_client[event.client_id]["hypothetical_cost"] += event.hypothetical_cost
        grouped_client[event.client_id]["avoided_cost"] += event.avoided_cost

        grouped_traffic[event.traffic_type]["requests"] += 1
        grouped_traffic[event.traffic_type]["tokens"] += event.total_tokens
        grouped_traffic[event.traffic_type]["actual_cost"] += event.actual_cost
        grouped_traffic[event.traffic_type]["hypothetical_cost"] += event.hypothetical_cost
        grouped_traffic[event.traffic_type]["avoided_cost"] += event.avoided_cost

        if event.traffic_type == "runtime":
            grouped_stream_mode[_normalized_stream_mode(event)]["requests"] += 1

    for error in errors:
        grouped_error_provider[error.provider or "unknown"]["errors"] += 1
        grouped_error_model[error.model or "unknown"]["errors"] += 1
        grouped_error_client[error.client_id]["errors"] += 1
        grouped_error_traffic[error.traffic_type]["errors"] += 1
        grouped_error_type[f"{error.error_type}:{error.status_code}"]["errors"] += 1
        integration_key = f"{error.integration_class or 'runtime'}:{error.template_id or 'none'}:{error.test_phase or 'none'}"
        grouped_error_integration[integration_key]["errors"] += 1
        grouped_error_profile[error.profile_key or "none"]["errors"] += 1

    latest_health: dict[tuple[str, str], HealthEvent] = {}
    for event in health:
        latest_health[(event.provider, event.model)] = event

    active_model_count = len(models)
    stream_capable_model_count = len([item for item in models if item.provider in {"forgeframe_baseline", "openai_api"}])
    runtime_duration_ms = _runtime_duration_summary(events, errors)
    timeline = _build_timeline(events, errors)
    last_hour_cutoff = 3600
    last_hour_events = _window_filter(events, last_hour_cutoff)
    last_hour_errors = _window_filter(errors, last_hour_cutoff)
    by_provider = sorted(
        [{"provider": key, **value} for key, value in grouped_provider.items()],
        key=lambda item: (-int(cast(int, item["requests"])), str(item["provider"])),
    )
    by_model = sorted(
        [{"model": key, **value} for key, value in grouped_model.items()],
        key=lambda item: (-int(cast(int, item["requests"])), str(item["model"])),
    )
    by_auth = sorted(
        [{"auth_key": key, **value} for key, value in grouped_auth.items()],
        key=lambda item: (-int(cast(int, item["requests"])), str(item["auth_key"])),
    )
    by_client = sorted(
        [{"client_id": key, **value} for key, value in grouped_client.items()],
        key=lambda item: (-int(cast(int, item["requests"])), str(item["client_id"])),
    )
    by_traffic_type = sorted(
        [{"traffic_type": key, **value} for key, value in grouped_traffic.items()],
        key=lambda item: (-int(cast(int, item["requests"])), str(item["traffic_type"])),
    )
    errors_by_provider = sorted(
        [{"provider": key, **value} for key, value in grouped_error_provider.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["provider"])),
    )
    errors_by_model = sorted(
        [{"model": key, **value} for key, value in grouped_error_model.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["model"])),
    )
    errors_by_client = sorted(
        [{"client_id": key, **value} for key, value in grouped_error_client.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["client_id"])),
    )
    errors_by_traffic_type = sorted(
        [{"traffic_type": key, **value} for key, value in grouped_error_traffic.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["traffic_type"])),
    )
    errors_by_type = sorted(
        [{"error_key": key, **value} for key, value in grouped_error_type.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["error_key"])),
    )
    errors_by_integration = sorted(
        [{"integration_key": key, **value} for key, value in grouped_error_integration.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["integration_key"])),
    )
    errors_by_profile = sorted(
        [{"profile_key": key, **value} for key, value in grouped_error_profile.items()],
        key=lambda item: (-int(cast(int, item["errors"])), str(item["profile_key"])),
    )

    runtime_split = next(
        (item for item in by_traffic_type if item["traffic_type"] == "runtime"),
        {
            "traffic_type": "runtime",
            "requests": 0,
            "tokens": 0,
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
        },
    )
    health_split = next(
        (item for item in by_traffic_type if item["traffic_type"] == "health_check"),
        {
            "traffic_type": "health_check",
            "requests": 0,
            "tokens": 0,
            "actual_cost": 0.0,
            "hypothetical_cost": 0.0,
            "avoided_cost": 0.0,
        },
    )

    return {
        "status": "ok",
        "object": "usage_summary",
        "metrics": {
            "active_model_count": active_model_count,
            "stream_capable_model_count": stream_capable_model_count,
            "recorded_request_count": len(events),
            "recorded_error_count": len(errors),
            "recorded_health_event_count": len(health),
        },
        "aggregations": {
            "by_provider": by_provider,
            "by_model": by_model,
            "by_auth": by_auth,
            "by_client": by_client,
            "by_traffic_type": by_traffic_type,
            "errors_by_provider": errors_by_provider,
            "errors_by_model": errors_by_model,
            "errors_by_client": errors_by_client,
            "errors_by_traffic_type": errors_by_traffic_type,
            "errors_by_type": errors_by_type,
            "errors_by_integration": errors_by_integration,
            "errors_by_profile": errors_by_profile,
        },
        "traffic_split": {
            "runtime": runtime_split,
            "health_check": health_split,
        },
        "cost_axes": {
            "actual": "tracked for metered API providers",
            "provider_reported": "unsupported in the current control plane",
            "estimated": "derived from configured pricing, never billing truth",
            "modeled": "derived gap between estimated and metered actual cost",
            "avoided": "derived from actual vs hypothetical",
        },
        "cost_truths": _cost_truths(runtime=runtime_split, health_check=health_split),
        "window": window,
        "instance": {
            "instance_id": instance.instance_id,
            "tenant_id": instance.tenant_id,
            "company_id": instance.company_id,
        },
        "latest_health": [
            {
                "provider": event.provider,
                "model": event.model,
                "check_type": event.check_type,
                "status": event.status,
                "readiness_reason": event.readiness_reason,
                "last_error": event.last_error,
                "checked_at": event.created_at,
            }
            for event in sorted(latest_health.values(), key=lambda item: item.created_at, reverse=True)
        ],
        "timeline_24h": timeline,
        "alerts": _build_alerts(last_hour_events, last_hour_errors),
        "pricing_snapshot": {
            "openai_input_per_1m": settings.pricing_openai_input_per_1m_tokens,
            "openai_output_per_1m": settings.pricing_openai_output_per_1m_tokens,
            "codex_hyp_input_per_1m": settings.pricing_codex_hypothetical_input_per_1m_tokens,
            "codex_hyp_output_per_1m": settings.pricing_codex_hypothetical_output_per_1m_tokens,
        },
        "runtime_duration_ms": runtime_duration_ms,
        "stream_mode_counts": {
            "stream": int(grouped_stream_mode["stream"]["requests"]),
            "non_stream": int(grouped_stream_mode["non_stream"]["requests"]),
            "runtime_request_count": int(grouped_stream_mode["stream"]["requests"] + grouped_stream_mode["non_stream"]["requests"]),
        },
        "selected_filters": {
            "provider": provider,
            "client_id": client_id,
            "model": model,
        },
    }


@router.get("/")
def usage_summary(
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    provider: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    model: str | None = Query(default=None),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    settings: Settings = Depends(get_settings),
    registry: ModelRegistry = Depends(get_admin_model_registry),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> Any:
    window_map: dict[str, int | None] = {
        "1h": 3600,
        "24h": 24 * 3600,
        "7d": 7 * 24 * 3600,
        "all": None,
    }
    selected_window = window_map[window]
    try:
        aggregates = analytics.aggregate(window_seconds=selected_window, tenant_id=instance.tenant_id)
    except TenantFilterRequiredError as exc:
        return _tenant_filter_error(exc)
    client_map = {str(item["client_id"]): item for item in aggregates["by_client"]}
    for err in aggregates["errors_by_client"]:
        cid = str(err["client_id"])
        client_map.setdefault(
            cid,
            {
                "client_id": cid,
                "requests": 0,
                "tokens": 0,
                "actual_cost": 0.0,
                "hypothetical_cost": 0.0,
                "avoided_cost": 0.0,
            },
        )
        client_map[cid]["errors"] = int(err["errors"])
    for value in client_map.values():
        requests = int(value.get("requests", 0))
        errors = int(value.get("errors", 0))
        value["error_rate"] = errors / max(1, errors + requests)
        value["needs_attention"] = bool(errors >= 3 or value["error_rate"] >= 0.2)
    ranked = sorted(
        client_map.values(),
        key=lambda item: (
            bool(item["needs_attention"]),
            float(item.get("actual_cost", 0.0)),
            int(item.get("errors", 0)),
        ),
        reverse=True,
    )
    return {"status": "ok", "window": window, "clients": ranked[:50]}


@router.get("/providers/{provider_name}")
def provider_drilldown(
    provider_name: str,
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> Any:
    window_map: dict[str, int | None] = {
        "1h": 3600,
        "24h": 24 * 3600,
        "7d": 7 * 24 * 3600,
        "all": None,
    }
    try:
        drilldown = analytics.provider_drilldown(
            provider_name,
            window_seconds=window_map[window],
            tenant_id=instance.tenant_id,
        )
    except TenantFilterRequiredError as exc:
        return _tenant_filter_error(exc)
    return {"status": "ok", "window": window, "drilldown": drilldown}


@router.get("/clients/{client_id}")
def client_drilldown(
    client_id: str,
    window: str = Query(default="24h", pattern="^(1h|24h|7d|all)$"),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> Any:
    window_map: dict[str, int | None] = {
        "1h": 3600,
        "24h": 24 * 3600,
        "7d": 7 * 24 * 3600,
        "all": None,
    }
    try:
        drilldown = analytics.client_drilldown(
            client_id,
            window_seconds=window_map[window],
            tenant_id=instance.tenant_id,
        )
    except TenantFilterRequiredError as exc:
        return _tenant_filter_error(exc)
    return {"status": "ok", "window": window, "drilldown": drilldown}
