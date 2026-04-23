"""Scoped routing budget evaluation for cost safety and explainability."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.control_plane import (
    RoutingBudgetAnomalyRecord,
    RoutingBudgetScopeRecord,
    RoutingBudgetStateRecord,
)
from app.control_plane.routing_defaults import normalize_routing_budget_state
from app.instances.service import InstanceService, get_instance_service
from app.request_metadata import normalize_request_metadata
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store
from app.usage.events import UsageEvent

_WINDOW_SECONDS: dict[str, int] = {
    "1h": 3600,
    "24h": 24 * 3600,
    "7d": 7 * 24 * 3600,
    "30d": 30 * 24 * 3600,
}
_DEFAULT_SOFT_BLOCKED_COST_CLASSES = ("high", "premium")


@dataclass(frozen=True)
class RoutingBudgetEvaluation:
    budget_state: RoutingBudgetStateRecord
    blocked_cost_classes: list[str]
    hard_blocked: bool
    hard_block_reason: str | None
    matching_scopes: list[RoutingBudgetScopeRecord]


def evaluate_routing_budget_state(
    budget_state: RoutingBudgetStateRecord | None,
    *,
    instance_id: str,
    route_context: dict[str, str] | None = None,
    analytics_store: UsageAnalyticsStore | None = None,
    instance_service: InstanceService | None = None,
    now: datetime | None = None,
) -> RoutingBudgetEvaluation:
    current_time = _utc_now(now)
    normalized_context = normalize_request_metadata(route_context)
    normalized_context.setdefault("instance_id", instance_id)
    normalized_state = normalize_routing_budget_state(budget_state)
    resolved_instance_service = instance_service or get_instance_service()
    resolved_analytics_store = analytics_store or get_usage_analytics_store()
    tenant_id = _resolve_tenant_id(resolved_instance_service, instance_id)
    usage_events = [
        event
        for event in resolved_analytics_store.list_usage_events(tenant_id=tenant_id)
        if event.traffic_type == "runtime"
    ]

    evaluated_scopes: list[RoutingBudgetScopeRecord] = []
    anomalies: list[RoutingBudgetAnomalyRecord] = []
    matching_scopes: list[RoutingBudgetScopeRecord] = []
    blocked_cost_classes = list(normalized_state.blocked_cost_classes)
    hard_block_reason = normalized_state.reason

    for scope in normalized_state.scopes:
        evaluated_scope, scope_anomalies = _evaluate_scope(
            scope,
            usage_events=usage_events,
            instance_id=instance_id,
            route_context=normalized_context,
            now=current_time,
        )
        evaluated_scopes.append(evaluated_scope)
        anomalies.extend(scope_anomalies)
        if not _scope_matches_route_context(scope, route_context=normalized_context, instance_id=instance_id):
            continue
        matching_scopes.append(evaluated_scope)
        if evaluated_scope.soft_limit_exceeded:
            soft_blocked = evaluated_scope.soft_blocked_cost_classes or list(_DEFAULT_SOFT_BLOCKED_COST_CLASSES)
            for cost_class in soft_blocked:
                if cost_class not in blocked_cost_classes:
                    blocked_cost_classes.append(cost_class)
        if evaluated_scope.hard_limit_exceeded and not hard_block_reason:
            hard_block_reason = (
                f"{evaluated_scope.scope_type} scope '{evaluated_scope.scope_key}' exceeded "
                f"its hard budget in window {evaluated_scope.window}."
            )

    evaluated_state = normalized_state.model_copy(
        update={
            "scopes": evaluated_scopes,
            "anomalies": anomalies,
            "last_evaluated_at": current_time.isoformat(),
        }
    )
    return RoutingBudgetEvaluation(
        budget_state=evaluated_state,
        blocked_cost_classes=blocked_cost_classes,
        hard_blocked=normalized_state.hard_blocked or any(scope.hard_limit_exceeded for scope in matching_scopes),
        hard_block_reason=hard_block_reason,
        matching_scopes=matching_scopes,
    )


def _utc_now(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(tz=UTC)
    if now.tzinfo is None:
        raise ValueError("routing budget evaluation requires timezone-aware timestamps")
    return now.astimezone(UTC)


def _resolve_tenant_id(instance_service: InstanceService, instance_id: str) -> str | None:
    try:
        return instance_service.get_instance(instance_id).tenant_id
    except ValueError:
        return None


def _scope_matches_route_context(
    scope: RoutingBudgetScopeRecord,
    *,
    route_context: dict[str, str],
    instance_id: str,
) -> bool:
    if not scope.enabled:
        return False
    if scope.scope_type == "instance":
        return scope.scope_key == instance_id
    if scope.scope_type == "agent":
        return route_context.get("agent_id") == scope.scope_key
    if scope.scope_type == "task":
        return route_context.get("task_id") == scope.scope_key
    return False


def _evaluate_scope(
    scope: RoutingBudgetScopeRecord,
    *,
    usage_events: list[UsageEvent],
    instance_id: str,
    route_context: dict[str, str],
    now: datetime,
) -> tuple[RoutingBudgetScopeRecord, list[RoutingBudgetAnomalyRecord]]:
    window_seconds = _WINDOW_SECONDS.get(scope.window, _WINDOW_SECONDS["24h"])
    current_window_start = now - timedelta(seconds=window_seconds)
    previous_window_start = current_window_start - timedelta(seconds=window_seconds)

    matching_events = [
        event
        for event in usage_events
        if _event_matches_scope(event, scope=scope, instance_id=instance_id)
    ]
    current_events = [
        event
        for event in matching_events
        if _parse_dt(event.created_at) >= current_window_start
    ]
    previous_events = [
        event
        for event in matching_events
        if previous_window_start <= _parse_dt(event.created_at) < current_window_start
    ]
    observed_cost = round(sum(event.actual_cost for event in current_events), 6)
    observed_tokens = sum(int(event.total_tokens) for event in current_events)
    previous_window_cost = round(sum(event.actual_cost for event in previous_events), 6)
    previous_window_tokens = sum(int(event.total_tokens) for event in previous_events)

    soft_limit_exceeded = _limit_exceeded(
        observed_cost=observed_cost,
        observed_tokens=observed_tokens,
        cost_limit=scope.soft_cost_limit,
        token_limit=scope.soft_token_limit,
    )
    hard_limit_exceeded = _limit_exceeded(
        observed_cost=observed_cost,
        observed_tokens=observed_tokens,
        cost_limit=scope.hard_cost_limit,
        token_limit=scope.hard_token_limit,
    )

    evaluated_scope = scope.model_copy(
        update={
            "observed_cost": observed_cost,
            "observed_tokens": observed_tokens,
            "previous_window_cost": previous_window_cost,
            "previous_window_tokens": previous_window_tokens,
            "soft_limit_exceeded": soft_limit_exceeded,
            "hard_limit_exceeded": hard_limit_exceeded,
            "last_evaluated_at": now.isoformat(),
        }
    )
    anomalies = _scope_anomalies(
        evaluated_scope,
        route_context=route_context,
        now=now,
    )
    return evaluated_scope, anomalies


def _event_matches_scope(
    event: UsageEvent,
    *,
    scope: RoutingBudgetScopeRecord,
    instance_id: str,
) -> bool:
    scope_attributes = dict(event.scope_attributes or {})
    if scope.scope_type == "instance":
        event_instance_id = scope_attributes.get("instance_id")
        if event_instance_id:
            return event_instance_id == scope.scope_key
        return scope.scope_key == instance_id
    if scope.scope_type == "agent":
        return scope_attributes.get("agent_id") == scope.scope_key
    if scope.scope_type == "task":
        return scope_attributes.get("task_id") == scope.scope_key
    return False


def _limit_exceeded(
    *,
    observed_cost: float,
    observed_tokens: int,
    cost_limit: float | None,
    token_limit: int | None,
) -> bool:
    if cost_limit is not None and observed_cost > cost_limit:
        return True
    if token_limit is not None and observed_tokens > token_limit:
        return True
    return False


def _scope_anomalies(
    scope: RoutingBudgetScopeRecord,
    *,
    route_context: dict[str, str],
    now: datetime,
) -> list[RoutingBudgetAnomalyRecord]:
    del route_context
    anomalies: list[RoutingBudgetAnomalyRecord] = []
    if scope.soft_limit_exceeded:
        anomalies.append(
            RoutingBudgetAnomalyRecord(
                scope_type=scope.scope_type,
                scope_key=scope.scope_key,
                window=scope.window,
                anomaly_type="soft_limit_exceeded",
                severity="warning",
                observed_cost=scope.observed_cost,
                observed_tokens=scope.observed_tokens,
                threshold_cost=scope.soft_cost_limit,
                threshold_tokens=scope.soft_token_limit,
                details=(
                    f"{scope.scope_type} scope '{scope.scope_key}' exceeded its soft budget window {scope.window}."
                ),
                detected_at=now.isoformat(),
            )
        )
    if scope.hard_limit_exceeded:
        anomalies.append(
            RoutingBudgetAnomalyRecord(
                scope_type=scope.scope_type,
                scope_key=scope.scope_key,
                window=scope.window,
                anomaly_type="hard_limit_exceeded",
                severity="critical",
                observed_cost=scope.observed_cost,
                observed_tokens=scope.observed_tokens,
                threshold_cost=scope.hard_cost_limit,
                threshold_tokens=scope.hard_token_limit,
                details=(
                    f"{scope.scope_type} scope '{scope.scope_key}' exceeded its hard budget window {scope.window}."
                ),
                detected_at=now.isoformat(),
            )
        )

    if (
        scope.previous_window_cost is not None
        and scope.previous_window_cost > 0
        and (scope.observed_cost or 0.0) >= scope.previous_window_cost * 2
    ):
        anomalies.append(
            RoutingBudgetAnomalyRecord(
                scope_type=scope.scope_type,
                scope_key=scope.scope_key,
                window=scope.window,
                anomaly_type="cost_spike",
                severity="warning" if (scope.observed_cost or 0.0) < scope.previous_window_cost * 3 else "critical",
                observed_cost=scope.observed_cost,
                observed_tokens=scope.observed_tokens,
                threshold_cost=scope.previous_window_cost * 2,
                threshold_tokens=None,
                details=(
                    f"{scope.scope_type} scope '{scope.scope_key}' doubled cost consumption against the previous "
                    f"{scope.window} window."
                ),
                detected_at=now.isoformat(),
            )
        )
    if (
        scope.previous_window_tokens is not None
        and scope.previous_window_tokens > 0
        and (scope.observed_tokens or 0) >= scope.previous_window_tokens * 2
    ):
        anomalies.append(
            RoutingBudgetAnomalyRecord(
                scope_type=scope.scope_type,
                scope_key=scope.scope_key,
                window=scope.window,
                anomaly_type="token_spike",
                severity="warning" if (scope.observed_tokens or 0) < scope.previous_window_tokens * 3 else "critical",
                observed_cost=scope.observed_cost,
                observed_tokens=scope.observed_tokens,
                threshold_cost=None,
                threshold_tokens=scope.previous_window_tokens * 2,
                details=(
                    f"{scope.scope_type} scope '{scope.scope_key}' doubled token consumption against the previous "
                    f"{scope.window} window."
                ),
                detected_at=now.isoformat(),
            )
        )
    return anomalies


def _parse_dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)
