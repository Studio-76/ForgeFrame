"""Model register and provider-target register behavior for the control plane."""

from __future__ import annotations

from app.api.admin.control_plane_models import ProviderTargetUpdateRequest
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.control_plane import ManagedProviderTargetRecord, ManagedProviderTargetUiRecord
from app.control_plane.target_defaults import (
    build_default_targets_from_providers,
    merge_targets_with_defaults,
    sort_targets,
)


class ControlPlaneTargetsDomainMixin:
    def _load_provider_targets(
        self,
        stored_targets: list[ManagedProviderTargetRecord] | None,
    ) -> dict[str, ManagedProviderTargetRecord]:
        default_targets = build_default_targets_from_providers(
            self.list_providers(),
            instance_id=self._instance.instance_id,
            default_model=self._settings.default_model,
            default_provider=self._settings.default_provider,
        )
        targets = merge_targets_with_defaults(default_targets, stored_targets)
        self._apply_provider_runtime_truth_to_targets(targets)
        return {target.target_key: target for target in targets}

    def _apply_provider_runtime_truth_to_targets(
        self,
        targets: list[ManagedProviderTargetRecord],
    ) -> None:
        health_index = {
            (record.provider, record.model): record
            for record in self._health_records.values()
        }
        provider_map = {
            provider.provider: provider
            for provider in self.list_providers()
        }
        model_index = {
            (provider.provider, model.id): model
            for provider in self.list_providers()
            for model in provider.managed_models
        }
        runtime_truth_map = {
            truth.provider.provider: truth.runtime
            for truth in self.provider_truth_axes(tenant_id=self._instance.tenant_id)
        }
        for target in targets:
            provider = provider_map.get(target.provider)
            model = model_index.get((target.provider, target.model_id))
            runtime_truth = runtime_truth_map.get(target.provider)
            if model is not None:
                target.model_routing_key = model.routing_key or target.model_routing_key
                target.last_seen_at = model.last_seen_at
                target.last_probe_at = model.last_probe_at
                target.stale_since = model.stale_since
                target.availability_status = model.availability_status or target.availability_status
                target.status_reason = model.status_reason or target.status_reason
                target.readiness_status = (
                    "ready"
                    if model.runtime_status == "ready"
                    else ("partial" if model.active else "unavailable")
                )
            health_record = health_index.get((target.provider, target.model_id))
            if health_record is not None:
                target.health_status = health_record.status
                if health_record.readiness_reason:
                    target.status_reason = health_record.readiness_reason
            if runtime_truth is not None:
                target.capability_profile = {
                    **target.capability_profile,
                    **runtime_truth.capabilities,
                }
                target.stream_capable = bool(runtime_truth.capabilities.get("streaming", target.stream_capable))
                target.tool_capable = runtime_truth.tool_calling_level == "full" or bool(runtime_truth.capabilities.get("tool_calling", target.tool_capable))
                target.vision_capable = bool(runtime_truth.capabilities.get("vision", target.vision_capable))
                target.queue_eligible = bool(target.capability_profile.get("queue_eligible", target.queue_eligible))
                if runtime_truth.ready and target.enabled and target.readiness_status != "unavailable":
                    target.readiness_status = "ready"
                elif target.readiness_status != "unavailable":
                    target.readiness_status = "partial"
                target.availability_status = (
                    target.availability_status
                    if target.availability_status not in {"unknown", ""}
                    else ("healthy" if runtime_truth.ready else "degraded")
                )
                target.status_reason = runtime_truth.readiness_reason or target.status_reason

    def _refresh_provider_targets(self) -> list[ManagedProviderTargetRecord]:
        refreshed = self._load_provider_targets(list(self._provider_targets_state.values()))
        self._provider_targets_state = refreshed
        refresh_routing_state = getattr(self, "_refresh_routing_state", None)
        if callable(refresh_routing_state):
            refresh_routing_state()
        return list(refreshed.values())

    def list_provider_targets(self) -> list[ManagedProviderTargetRecord]:
        return sort_targets(self._provider_targets_state.values())

    def get_provider_target(self, target_key: str) -> ManagedProviderTargetRecord:
        target = self._provider_targets_state.get(target_key)
        if target is None:
            raise ValueError(f"Provider target '{target_key}' is not managed in control plane.")
        return target

    def provider_target_snapshot(self) -> list[dict[str, object]]:
        provider_map = {
            provider.provider: provider
            for provider in self.list_providers()
        }
        model_map = {
            (provider.provider, model.id): model
            for provider in self.list_providers()
            for model in provider.managed_models
        }
        runtime_truth_map = {
            truth.provider.provider: truth.runtime
            for truth in self.provider_truth_axes(tenant_id=self._instance.tenant_id)
        }
        return [
            ManagedProviderTargetUiRecord(
                **target.model_dump(),
                provider_label=provider_map.get(target.provider).label if provider_map.get(target.provider) else None,
                model_display_name=model_map.get((target.provider, target.model_id)).display_name if model_map.get((target.provider, target.model_id)) else None,
                model_owned_by=model_map.get((target.provider, target.model_id)).owned_by if model_map.get((target.provider, target.model_id)) else None,
                runtime_ready=bool(runtime_truth_map.get(target.provider).ready) if runtime_truth_map.get(target.provider) else False,
                runtime_readiness_reason=runtime_truth_map.get(target.provider).readiness_reason if runtime_truth_map.get(target.provider) else None,
                provider_enabled=bool(provider_map.get(target.provider).enabled) if provider_map.get(target.provider) else False,
                model_active=bool(model_map.get((target.provider, target.model_id)).active) if model_map.get((target.provider, target.model_id)) else False,
            ).model_dump(mode="json")
            for target in self.list_provider_targets()
        ]

    def model_register_snapshot(self) -> list[dict[str, object]]:
        target_map: dict[tuple[str, str], list[ManagedProviderTargetRecord]] = {}
        for target in self.list_provider_targets():
            target_map.setdefault((target.provider, target.model_id), []).append(target)

        health_by_provider = {
            (record.provider, record.model): record.status
            for record in self._health_records.values()
        }
        models: list[dict[str, object]] = []
        for provider in self.list_providers():
            for model in provider.managed_models:
                linked_targets = sort_targets(target_map.get((provider.provider, model.id), []))
                models.append(
                    {
                        "provider": provider.provider,
                        "provider_label": provider.label,
                        "model_id": model.id,
                        "display_name": model.display_name or model.id,
                        "owned_by": model.owned_by or provider.label or provider.provider,
                        "category": model.category,
                        "routing_key": model.routing_key,
                        "capabilities": dict(model.capabilities),
                        "source": model.source,
                        "discovery_status": model.discovery_status,
                        "runtime_status": model.runtime_status,
                        "availability_status": model.availability_status,
                        "health_status": health_by_provider.get((provider.provider, model.id), "unknown"),
                        "status_reason": model.status_reason,
                        "active": model.active,
                        "target_count": len(linked_targets),
                        "active_target_count": len([target for target in linked_targets if target.enabled]),
                        "target_keys": [target.target_key for target in linked_targets],
                        "last_seen_at": model.last_seen_at,
                        "last_probe_at": model.last_probe_at,
                        "stale_since": model.stale_since,
                    }
                )
        return sorted(models, key=lambda item: (str(item["provider"]), str(item["model_id"])))

    def update_provider_target(
        self,
        target_key: str,
        payload: ProviderTargetUpdateRequest,
    ) -> ManagedProviderTargetRecord:
        target = self.get_provider_target(target_key)
        available_target_keys = set(self._provider_targets_state.keys())
        if payload.enabled is not None:
            target.enabled = payload.enabled
        if payload.priority is not None:
            target.priority = payload.priority
        if payload.queue_eligible is not None:
            target.queue_eligible = payload.queue_eligible
            target.capability_profile["queue_eligible"] = payload.queue_eligible
        if payload.fallback_allowed is not None:
            target.fallback_allowed = payload.fallback_allowed
        if payload.escalation_allowed is not None:
            target.escalation_allowed = payload.escalation_allowed
        if payload.fallback_target_keys is not None:
            invalid = [item for item in payload.fallback_target_keys if item not in available_target_keys or item == target_key]
            if invalid:
                raise ValueError(f"Unknown or invalid fallback targets: {', '.join(invalid)}")
            target.fallback_target_keys = list(payload.fallback_target_keys)
        if payload.escalation_target_keys is not None:
            invalid = [item for item in payload.escalation_target_keys if item not in available_target_keys or item == target_key]
            if invalid:
                raise ValueError(f"Unknown or invalid escalation targets: {', '.join(invalid)}")
            target.escalation_target_keys = list(payload.escalation_target_keys)
        self._provider_targets_state[target_key] = target
        self._refresh_provider_targets()
        self._persist_state()
        clear_runtime_dependency_caches()
        return self.get_provider_target(target_key)
