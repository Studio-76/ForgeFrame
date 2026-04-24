"""Separated target-profile axes for routing, policy, and operator surfaces."""

from __future__ import annotations

from typing import Any


def provider_technical_capabilities(provider: str) -> dict[str, object]:
    defaults = {
        "forgeframe_baseline": {
            "streaming": True,
            "tool_calling": False,
            "vision": False,
            "reasoning_band": "baseline",
        },
        "openai_api": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "reasoning_band": "general",
        },
        "openai_codex": {
            "streaming": True,
            "tool_calling": True,
            "vision": False,
            "reasoning_band": "coding",
        },
        "gemini": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "reasoning_band": "multimodal",
        },
        "anthropic": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "reasoning_band": "multimodal",
        },
        "generic_harness": {
            "streaming": False,
            "tool_calling": False,
            "vision": False,
            "reasoning_band": "bridge",
        },
        "ollama": {
            "streaming": True,
            "tool_calling": False,
            "vision": False,
            "reasoning_band": "local",
        },
    }
    return dict(defaults.get(provider, {
        "streaming": False,
        "tool_calling": False,
        "vision": False,
        "reasoning_band": "unknown",
    }))


def provider_execution_traits(provider: str) -> dict[str, object]:
    defaults = {
        "forgeframe_baseline": {
            "queue_eligible": False,
            "default_execution_lane": "sync_interactive",
            "task_complexity_floor": "simple_only",
            "dispatch_mode": "sync_only",
        },
        "openai_api": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "sync_or_async",
        },
        "openai_codex": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "sync_or_async",
        },
        "gemini": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "sync_or_async",
        },
        "anthropic": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "sync_or_async",
        },
        "generic_harness": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "bridge_runtime",
        },
        "ollama": {
            "queue_eligible": True,
            "default_execution_lane": "queued_background",
            "task_complexity_floor": "general",
            "dispatch_mode": "local_runtime",
        },
    }
    return dict(defaults.get(provider, {
        "queue_eligible": False,
        "default_execution_lane": "sync_interactive",
        "task_complexity_floor": "unknown",
        "dispatch_mode": "unknown",
    }))


def provider_policy_flags(provider: str) -> dict[str, object]:
    defaults = {
        "forgeframe_baseline": {
            "local_preferred": True,
            "fallback_allowed": True,
            "escalation_allowed": False,
            "premium_policy_gate": "never",
        },
        "openai_api": {
            "local_preferred": False,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "operator_budget",
        },
        "openai_codex": {
            "local_preferred": False,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "operator_budget",
        },
        "gemini": {
            "local_preferred": False,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "operator_budget",
        },
        "anthropic": {
            "local_preferred": False,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "operator_budget",
        },
        "generic_harness": {
            "local_preferred": False,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "operator_budget",
        },
        "ollama": {
            "local_preferred": True,
            "fallback_allowed": True,
            "escalation_allowed": True,
            "premium_policy_gate": "never",
        },
    }
    return dict(defaults.get(provider, {
        "local_preferred": False,
        "fallback_allowed": True,
        "escalation_allowed": True,
        "premium_policy_gate": "operator_budget",
    }))


def provider_economic_profile(provider: str) -> dict[str, object]:
    defaults = {
        "forgeframe_baseline": {
            "cost_class": "baseline",
            "latency_class": "low",
            "quality_tier": "baseline",
        },
        "openai_api": {
            "cost_class": "high",
            "latency_class": "medium",
            "quality_tier": "premium",
        },
        "openai_codex": {
            "cost_class": "high",
            "latency_class": "medium",
            "quality_tier": "premium",
        },
        "gemini": {
            "cost_class": "medium",
            "latency_class": "medium",
            "quality_tier": "high",
        },
        "anthropic": {
            "cost_class": "premium",
            "latency_class": "medium",
            "quality_tier": "high",
        },
        "generic_harness": {
            "cost_class": "medium",
            "latency_class": "medium",
            "quality_tier": "variable",
        },
        "ollama": {
            "cost_class": "low",
            "latency_class": "low",
            "quality_tier": "local",
        },
    }
    return dict(defaults.get(provider, {
        "cost_class": "medium",
        "latency_class": "medium",
        "quality_tier": "unknown",
    }))


def build_legacy_capability_profile(
    *,
    technical_capabilities: dict[str, object],
    execution_traits: dict[str, object],
) -> dict[str, object]:
    return {
        "streaming": bool(technical_capabilities.get("streaming", False)),
        "tool_calling": bool(technical_capabilities.get("tool_calling", False)),
        "vision": bool(technical_capabilities.get("vision", False)),
        "queue_eligible": bool(execution_traits.get("queue_eligible", False)),
        "execution_lane": str(execution_traits.get("default_execution_lane", "sync_interactive")),
        "capability_profile": str(execution_traits.get("task_complexity_floor", "unknown")),
    }


def split_legacy_capability_profile(
    *,
    provider: str,
    capability_profile: dict[str, Any] | None,
    cost_class: str | None = None,
    latency_class: str | None = None,
) -> tuple[dict[str, object], dict[str, object], dict[str, object], dict[str, object]]:
    technical = provider_technical_capabilities(provider)
    execution = provider_execution_traits(provider)
    policy = provider_policy_flags(provider)
    economic = provider_economic_profile(provider)
    payload = dict(capability_profile or {})

    if "streaming" in payload:
        technical["streaming"] = bool(payload["streaming"])
    if "tool_calling" in payload:
        technical["tool_calling"] = bool(payload["tool_calling"])
    if "vision" in payload:
        technical["vision"] = bool(payload["vision"])
    if "reasoning_band" in payload and str(payload["reasoning_band"]).strip():
        technical["reasoning_band"] = str(payload["reasoning_band"]).strip()

    if "queue_eligible" in payload:
        execution["queue_eligible"] = bool(payload["queue_eligible"])
    if "execution_lane" in payload and str(payload["execution_lane"]).strip():
        execution["default_execution_lane"] = str(payload["execution_lane"]).strip()
    if "task_complexity_floor" in payload and str(payload["task_complexity_floor"]).strip():
        execution["task_complexity_floor"] = str(payload["task_complexity_floor"]).strip()
    elif "capability_profile" in payload and str(payload["capability_profile"]).strip():
        legacy_value = str(payload["capability_profile"]).strip()
        execution["task_complexity_floor"] = "simple_only" if legacy_value == "baseline_simple" else "general"
        execution["legacy_profile_name"] = legacy_value

    if "dispatch_mode" in payload and str(payload["dispatch_mode"]).strip():
        execution["dispatch_mode"] = str(payload["dispatch_mode"]).strip()

    if "fallback_allowed" in payload:
        policy["fallback_allowed"] = bool(payload["fallback_allowed"])
    if "escalation_allowed" in payload:
        policy["escalation_allowed"] = bool(payload["escalation_allowed"])
    if "local_preferred" in payload:
        policy["local_preferred"] = bool(payload["local_preferred"])
    if "premium_policy_gate" in payload and str(payload["premium_policy_gate"]).strip():
        policy["premium_policy_gate"] = str(payload["premium_policy_gate"]).strip()

    if "cost_class" in payload and str(payload["cost_class"]).strip():
        economic["cost_class"] = str(payload["cost_class"]).strip()
    elif cost_class is not None:
        economic["cost_class"] = cost_class
    if "latency_class" in payload and str(payload["latency_class"]).strip():
        economic["latency_class"] = str(payload["latency_class"]).strip()
    elif latency_class is not None:
        economic["latency_class"] = latency_class
    if "quality_tier" in payload and str(payload["quality_tier"]).strip():
        economic["quality_tier"] = str(payload["quality_tier"]).strip()

    return technical, execution, policy, economic
