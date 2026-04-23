"""Default routing-policy and routing-state helpers for the control plane."""

from __future__ import annotations

from collections.abc import Iterable

from app.control_plane.models import (
    ManagedProviderTargetRecord,
    RoutingBudgetAnomalyRecord,
    RoutingBudgetScopeRecord,
    RoutingBudgetStateRecord,
    RoutingCircuitStateRecord,
    RoutingPolicyRecord,
)


def _dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _sorted_targets(targets: Iterable[ManagedProviderTargetRecord]) -> list[ManagedProviderTargetRecord]:
    return sorted(
        targets,
        key=lambda item: (-item.priority, item.provider, item.model_id, item.target_key),
    )


def _target_keys(targets: Iterable[ManagedProviderTargetRecord]) -> list[str]:
    return [target.target_key for target in _sorted_targets(targets)]


def _is_local_target(target: ManagedProviderTargetRecord) -> bool:
    return target.product_axis in {"local_providers", "openai_compatible_clients"} or target.auth_type in {
        "internal",
        "local_none",
    }


def _is_premium_target(target: ManagedProviderTargetRecord) -> bool:
    return target.cost_class == "premium"


def build_default_routing_policies(
    targets: Iterable[ManagedProviderTargetRecord],
) -> list[RoutingPolicyRecord]:
    target_list = _sorted_targets(targets)
    local_targets = [target for target in target_list if _is_local_target(target)]
    premium_targets = [target for target in target_list if _is_premium_target(target)]
    standard_external_targets = [
        target
        for target in target_list
        if not _is_local_target(target) and not _is_premium_target(target)
    ]

    simple_preferred = _target_keys(local_targets)
    simple_fallback = _target_keys(standard_external_targets)
    simple_escalation = _target_keys(premium_targets)

    non_simple_preferred = _target_keys(
        [target for target in standard_external_targets if target.queue_eligible]
        or standard_external_targets
    )
    non_simple_fallback = _target_keys(
        [target for target in local_targets if target.queue_eligible]
        or local_targets
    )
    non_simple_escalation = _target_keys(premium_targets)

    return [
        RoutingPolicyRecord(
            classification="simple",
            display_name="Simple",
            description="Low-friction interactive work should stay local or low-cost first and only escalate when the preferred lane cannot satisfy the request.",
            execution_lane="sync_interactive",
            prefer_local=True,
            prefer_low_latency=True,
            allow_premium=False,
            allow_fallback=True,
            allow_escalation=True,
            require_queue_eligible=False,
            preferred_target_keys=simple_preferred,
            fallback_target_keys=simple_fallback,
            escalation_target_keys=simple_escalation,
        ),
        RoutingPolicyRecord(
            classification="non_simple",
            display_name="Non-Simple",
            description="Heavier work may use queue-eligible external targets first, keep local fallbacks explicit, and escalate to premium only when necessary.",
            execution_lane="queued_background",
            prefer_local=False,
            prefer_low_latency=False,
            allow_premium=True,
            allow_fallback=True,
            allow_escalation=True,
            require_queue_eligible=True,
            preferred_target_keys=non_simple_preferred,
            fallback_target_keys=non_simple_fallback,
            escalation_target_keys=non_simple_escalation,
        ),
    ]


def merge_routing_policies(
    default_policies: Iterable[RoutingPolicyRecord],
    stored_policies: Iterable[RoutingPolicyRecord] | None,
    *,
    available_target_keys: Iterable[str],
) -> list[RoutingPolicyRecord]:
    available = set(_dedupe_preserve_order(available_target_keys))
    stored_map = {
        policy.classification: policy.model_copy(deep=True)
        for policy in (stored_policies or [])
    }
    merged: list[RoutingPolicyRecord] = []
    for default_policy in default_policies:
        policy = stored_map.get(default_policy.classification, default_policy.model_copy(deep=True))
        policy.display_name = policy.display_name or default_policy.display_name
        policy.description = policy.description or default_policy.description
        policy.preferred_target_keys = [
            key for key in _dedupe_preserve_order(policy.preferred_target_keys or default_policy.preferred_target_keys) if key in available
        ]
        policy.fallback_target_keys = [
            key for key in _dedupe_preserve_order(policy.fallback_target_keys or default_policy.fallback_target_keys) if key in available
        ]
        policy.escalation_target_keys = [
            key for key in _dedupe_preserve_order(policy.escalation_target_keys or default_policy.escalation_target_keys) if key in available
        ]
        merged.append(policy)
    return merged


def merge_routing_circuits(
    stored_circuits: Iterable[RoutingCircuitStateRecord] | None,
    *,
    available_target_keys: Iterable[str],
) -> list[RoutingCircuitStateRecord]:
    available = set(_dedupe_preserve_order(available_target_keys))
    merged: list[RoutingCircuitStateRecord] = []
    seen: set[str] = set()
    for circuit in stored_circuits or []:
        if circuit.target_key not in available or circuit.target_key in seen:
            continue
        seen.add(circuit.target_key)
        merged.append(circuit.model_copy(deep=True))
    return sorted(merged, key=lambda item: item.target_key)


def normalize_routing_budget_state(
    budget_state: RoutingBudgetStateRecord | None,
) -> RoutingBudgetStateRecord:
    if budget_state is None:
        return RoutingBudgetStateRecord()
    normalized = budget_state.model_copy(deep=True)
    normalized.blocked_cost_classes = _dedupe_preserve_order(normalized.blocked_cost_classes)
    normalized.scopes = _normalize_budget_scopes(normalized.scopes)
    normalized.anomalies = _normalize_budget_anomalies(normalized.anomalies)
    return normalized


def _normalize_budget_scopes(
    scopes: Iterable[RoutingBudgetScopeRecord] | None,
) -> list[RoutingBudgetScopeRecord]:
    normalized_scopes: list[RoutingBudgetScopeRecord] = []
    seen: set[tuple[str, str, str]] = set()
    for scope in scopes or []:
        normalized = scope.model_copy(deep=True)
        normalized.scope_key = normalized.scope_key.strip()
        if not normalized.scope_key:
            continue
        normalized.soft_blocked_cost_classes = _dedupe_preserve_order(normalized.soft_blocked_cost_classes)
        dedupe_key = (normalized.scope_type, normalized.scope_key, normalized.window)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized_scopes.append(normalized)
    return sorted(
        normalized_scopes,
        key=lambda item: (item.scope_type, item.scope_key, item.window),
    )


def _normalize_budget_anomalies(
    anomalies: Iterable[RoutingBudgetAnomalyRecord] | None,
) -> list[RoutingBudgetAnomalyRecord]:
    normalized_anomalies: list[RoutingBudgetAnomalyRecord] = []
    seen: set[tuple[str, str, str, str]] = set()
    for anomaly in anomalies or []:
        normalized = anomaly.model_copy(deep=True)
        normalized.scope_key = normalized.scope_key.strip()
        if not normalized.scope_key:
            continue
        dedupe_key = (
            normalized.scope_type,
            normalized.scope_key,
            normalized.window,
            normalized.anomaly_type,
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized_anomalies.append(normalized)
    return sorted(
        normalized_anomalies,
        key=lambda item: (item.severity, item.scope_type, item.scope_key, item.window, item.anomaly_type),
    )
