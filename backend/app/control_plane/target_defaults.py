"""Default model/target metadata used by the control-plane registry."""

from __future__ import annotations

from collections.abc import Iterable

from app.control_plane.models import ManagedModelRecord, ManagedProviderRecord, ManagedProviderTargetRecord
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


def build_model_routing_key(provider: str, model_id: str) -> str:
    return f"{provider}/{model_id}"


def build_target_key(provider: str, model_id: str) -> str:
    return f"{provider}::{model_id}"


def provider_product_axis(provider: str) -> str:
    return {
        "openai_codex": "oauth_account_providers",
        "gemini": "oauth_account_providers",
        "openai_api": "openai_compatible_providers",
        "generic_harness": "openai_compatible_providers",
        "ollama": "local_providers",
        "forgeframe_baseline": "openai_compatible_clients",
        "anthropic": "unmapped_native_runtime",
    }.get(provider, "unknown")


def provider_auth_type(provider: str) -> str:
    return {
        "forgeframe_baseline": "internal",
        "openai_api": "api_key",
        "openai_codex": "oauth_or_api_key",
        "gemini": "oauth_or_api_key",
        "anthropic": "api_key",
        "generic_harness": "api_key_or_none",
        "ollama": "local_none",
    }.get(provider, "unknown")


def provider_credential_type(provider: str) -> str:
    return {
        "forgeframe_baseline": "internal_runtime",
        "openai_api": "api_key_secret",
        "openai_codex": "oauth_grant",
        "gemini": "oauth_grant",
        "anthropic": "api_key_secret",
        "generic_harness": "harness_profile",
        "ollama": "local_endpoint",
    }.get(provider, "unknown")


def provider_cost_class(provider: str) -> str:
    return {
        "forgeframe_baseline": "baseline",
        "ollama": "low",
        "generic_harness": "medium",
        "gemini": "medium",
        "openai_codex": "high",
        "openai_api": "high",
        "anthropic": "premium",
    }.get(provider, "medium")


def provider_latency_class(provider: str) -> str:
    return {
        "forgeframe_baseline": "low",
        "ollama": "low",
        "generic_harness": "medium",
        "openai_api": "medium",
        "openai_codex": "medium",
        "gemini": "medium",
        "anthropic": "medium",
    }.get(provider, "medium")


def provider_capability_defaults(provider: str) -> dict[str, object]:
    defaults = {
        "forgeframe_baseline": {
            "streaming": True,
            "tool_calling": False,
            "vision": False,
            "queue_eligible": False,
            "execution_lane": "sync_interactive",
            "capability_profile": "baseline_simple",
        },
        "openai_api": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "queue_eligible": True,
            "execution_lane": "sync_interactive",
            "capability_profile": "general_premium",
        },
        "openai_codex": {
            "streaming": True,
            "tool_calling": True,
            "vision": False,
            "queue_eligible": True,
            "execution_lane": "sync_interactive",
            "capability_profile": "coding_premium",
        },
        "gemini": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "queue_eligible": True,
            "execution_lane": "sync_interactive",
            "capability_profile": "multimodal_general",
        },
        "anthropic": {
            "streaming": True,
            "tool_calling": True,
            "vision": True,
            "queue_eligible": True,
            "execution_lane": "sync_interactive",
            "capability_profile": "multimodal_general",
        },
        "generic_harness": {
            "streaming": False,
            "tool_calling": False,
            "vision": False,
            "queue_eligible": True,
            "execution_lane": "sync_or_async",
            "capability_profile": "bridge_runtime",
        },
        "ollama": {
            "streaming": True,
            "tool_calling": False,
            "vision": False,
            "queue_eligible": True,
            "execution_lane": "sync_or_async",
            "capability_profile": "local_runtime",
        },
    }
    return dict(defaults.get(provider, {
        "streaming": False,
        "tool_calling": False,
        "vision": False,
        "queue_eligible": False,
        "execution_lane": "sync_interactive",
        "capability_profile": "unknown",
    }))


def ensure_model_registry_metadata(model: ManagedModelRecord, provider_label: str, provider_name: str) -> ManagedModelRecord:
    if not model.owned_by:
        model.owned_by = provider_label
    if not model.display_name:
        model.display_name = model.id
    if not model.category:
        model.category = "general"
    if not model.routing_key:
        model.routing_key = build_model_routing_key(provider_name, model.id)
    if not model.capabilities:
        model.capabilities = provider_capability_defaults(provider_name)
    return model


def default_target_priority(
    provider: str,
    model_id: str,
    *,
    default_model: str | None = None,
    default_provider: str | None = None,
) -> int:
    priority = {
        "forgeframe_baseline": 140,
        "ollama": 120,
        "generic_harness": 100,
        "gemini": 95,
        "openai_codex": 90,
        "openai_api": 85,
        "anthropic": 80,
    }.get(provider, 75)
    if model_id == default_model:
        priority += 30
    if provider == default_provider:
        priority += 10
    return priority


def build_default_target_record(
    *,
    provider: ManagedProviderRecord,
    model: ManagedModelRecord,
    instance_id: str | None = None,
    default_model: str | None = None,
    default_provider: str | None = None,
) -> ManagedProviderTargetRecord:
    capabilities = provider_capability_defaults(provider.provider)
    queue_eligible = bool(capabilities.get("queue_eligible", False))
    stream_capable = bool(capabilities.get("streaming", False))
    tool_capable = bool(capabilities.get("tool_calling", False))
    vision_capable = bool(capabilities.get("vision", False))
    readiness_status = "ready" if model.runtime_status == "ready" else ("partial" if model.active else "unavailable")
    return ManagedProviderTargetRecord(
        target_key=build_target_key(provider.provider, model.id),
        provider=provider.provider,
        model_id=model.id,
        model_routing_key=model.routing_key or build_model_routing_key(provider.provider, model.id),
        label=f"{provider.label} · {model.display_name or model.id}",
        instance_id=instance_id or DEFAULT_BOOTSTRAP_TENANT_ID,
        product_axis=provider_product_axis(provider.provider),
        auth_type=provider_auth_type(provider.provider),
        credential_type=provider_credential_type(provider.provider),
        capability_profile=dict(capabilities),
        cost_class=provider_cost_class(provider.provider),
        latency_class=provider_latency_class(provider.provider),
        enabled=model.active and provider.enabled,
        priority=default_target_priority(
            provider.provider,
            model.id,
            default_model=default_model,
            default_provider=default_provider,
        ),
        queue_eligible=queue_eligible,
        stream_capable=stream_capable,
        tool_capable=tool_capable,
        vision_capable=vision_capable,
        fallback_allowed=True,
        escalation_allowed=provider.provider not in {"forgeframe_baseline"},
        health_status=model.availability_status or "unknown",
        availability_status=model.availability_status or "unknown",
        readiness_status=readiness_status,
        status_reason=model.status_reason,
        last_seen_at=model.last_seen_at,
        last_probe_at=model.last_probe_at,
        stale_since=model.stale_since,
    )


def build_default_targets_from_providers(
    providers: Iterable[ManagedProviderRecord],
    *,
    instance_id: str | None = None,
    default_model: str | None = None,
    default_provider: str | None = None,
) -> list[ManagedProviderTargetRecord]:
    targets: list[ManagedProviderTargetRecord] = []
    for provider in providers:
        for model in provider.managed_models:
            ensure_model_registry_metadata(model, provider.label or provider.provider, provider.provider)
            targets.append(
                build_default_target_record(
                    provider=provider,
                    model=model,
                    instance_id=instance_id,
                    default_model=default_model,
                    default_provider=default_provider,
                )
            )
    return sort_targets(targets)


def merge_targets_with_defaults(
    default_targets: Iterable[ManagedProviderTargetRecord],
    stored_targets: Iterable[ManagedProviderTargetRecord] | None,
) -> list[ManagedProviderTargetRecord]:
    stored_map = {
        target.target_key: target.model_copy(deep=True)
        for target in (stored_targets or [])
    }
    merged: list[ManagedProviderTargetRecord] = []
    for default_target in default_targets:
        existing = stored_map.get(default_target.target_key)
        if existing is None:
            merged.append(default_target)
            continue
        existing.provider = default_target.provider
        existing.model_id = default_target.model_id
        existing.model_routing_key = default_target.model_routing_key
        existing.label = default_target.label
        existing.instance_id = default_target.instance_id
        existing.product_axis = default_target.product_axis
        existing.auth_type = default_target.auth_type
        existing.credential_type = default_target.credential_type
        existing.capability_profile = dict(default_target.capability_profile)
        existing.cost_class = default_target.cost_class
        existing.latency_class = default_target.latency_class
        existing.stream_capable = default_target.stream_capable
        existing.tool_capable = default_target.tool_capable
        existing.vision_capable = default_target.vision_capable
        existing.health_status = default_target.health_status
        existing.availability_status = default_target.availability_status
        existing.readiness_status = default_target.readiness_status
        existing.status_reason = default_target.status_reason
        existing.last_seen_at = default_target.last_seen_at
        existing.last_probe_at = default_target.last_probe_at
        existing.stale_since = default_target.stale_since
        merged.append(existing)
    return sort_targets(merged)


def sort_targets(targets: Iterable[ManagedProviderTargetRecord]) -> list[ManagedProviderTargetRecord]:
    return sorted(
        targets,
        key=lambda item: (item.provider, -item.priority, item.model_id, item.target_key),
    )
