"""Model register and provider-target register behavior for the control plane."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.api.admin.control_plane_models import (
    ModelRegisterEvidenceSnapshot,
    ModelRegisterRecord,
    ModelRegisterSyncSupport,
    ModelRegisterTargetLink,
    ProviderTargetUpdateRequest,
)
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.control_plane import ManagedProviderTargetRecord, ManagedProviderTargetUiRecord
from app.control_plane.profile_taxonomy import (
    build_legacy_capability_profile,
    split_legacy_capability_profile,
)
from app.control_plane.target_defaults import (
    build_default_targets_from_providers,
    merge_targets_with_defaults,
    sort_targets,
)


class ControlPlaneTargetsDomainMixin:
    if TYPE_CHECKING:
        _instance: Any
        _settings: Any
        _health_records: Any
        _provider_targets_state: dict[str, ManagedProviderTargetRecord]
        _routing_policies_state: Any

        def list_providers(self) -> list[Any]: ...
        def provider_truth_axes(self, *args: Any, **kwargs: Any) -> list[Any]: ...
        def _persist_state(self) -> Any: ...

    @staticmethod
    def _target_routing_eligible(
        target: ManagedProviderTargetRecord,
        *,
        provider_enabled: bool,
        model_active: bool,
    ) -> bool:
        if not target.enabled or not provider_enabled or not model_active:
            return False
        if target.readiness_status not in {"ready", "partial"}:
            return False
        if target.availability_status in {"unavailable", "stale"}:
            return False
        return True

    @staticmethod
    def _model_declared_capability_keys(
        *,
        capabilities: dict[str, object],
        execution_traits: dict[str, object],
    ) -> list[str]:
        keys: list[str] = []
        if bool(capabilities.get("streaming")):
            keys.append("streaming")
        if bool(capabilities.get("tool_calling")):
            keys.append("tool_calling")
        if bool(capabilities.get("vision")):
            keys.append("vision")
        if bool(capabilities.get("responses")):
            keys.append("responses")
        if bool(capabilities.get("embeddings")):
            keys.append("embeddings")
        if bool(capabilities.get("discovery_support")):
            keys.append("discovery_support")
        if bool(execution_traits.get("queue_eligible")):
            keys.append("queue_eligible")
        return keys

    @staticmethod
    def _normalize_evidence_status(raw_status: str) -> str:
        if raw_status in {"observed", "failed", "not_applicable"}:
            return raw_status
        return "missing"

    @classmethod
    def _snapshot_evidence(
        cls,
        *,
        status: str,
        source: str,
        recorded_at: str | None,
        details: str,
    ) -> ModelRegisterEvidenceSnapshot:
        return ModelRegisterEvidenceSnapshot(
            status=cls._normalize_evidence_status(status),
            source=source,
            recorded_at=recorded_at,
            details=details,
        )

    def _model_tested_evidence(
        self,
        *,
        provider_truth,
        health_status: str,
        model: Any,
        provider: Any,
        source: str,
    ) -> dict[str, ModelRegisterEvidenceSnapshot]:
        live_probe = provider_truth.runtime.evidence.live_probe
        if provider_truth.ui.last_health_check_at:
            health_snapshot = self._snapshot_evidence(
                status="observed" if health_status == "healthy" else ("failed" if health_status in {"degraded", "unavailable"} else "missing"),
                source="provider_health",
                recorded_at=provider_truth.ui.last_health_check_at,
                details=f"Latest provider health posture is {health_status}.",
            )
        else:
            health_snapshot = self._snapshot_evidence(
                status="missing",
                source="provider_health",
                recorded_at=None,
                details="No provider health check has been recorded for this model yet.",
            )

        sync_available = bool(source in {"discovered", "manual", "templated"} or provider_truth.ui.discovery_supported)
        if sync_available:
            sync_status = provider.last_sync_status
            sync_snapshot = self._snapshot_evidence(
                status="observed" if sync_status == "ok" else ("failed" if sync_status in {"warning", "failed"} else "missing"),
                source="provider_sync",
                recorded_at=provider.last_sync_at,
                details=provider.last_sync_error or f"Latest provider sync status is {sync_status}.",
            )
        else:
            sync_snapshot = self._snapshot_evidence(
                status="not_applicable",
                source="provider_sync",
                recorded_at=provider.last_sync_at,
                details="This provider does not expose discovery-backed model sync on the models surface.",
            )

        if provider_truth.ui.oauth_last_probe is not None or live_probe.status != "missing":
            live_probe_snapshot = self._snapshot_evidence(
                status=live_probe.status,
                source=live_probe.source,
                recorded_at=live_probe.recorded_at,
                details=live_probe.details,
            )
        else:
            live_probe_snapshot = self._snapshot_evidence(
                status="not_applicable",
                source="oauth_probe",
                recorded_at=getattr(model, "last_probe_at", None),
                details="No explicit OAuth or live probe evidence exists for this model/provider path.",
            )

        return {
            "health_check": health_snapshot,
            "discovery_sync": sync_snapshot,
            "live_probe": live_probe_snapshot,
        }

    def _model_trust_posture(
        self,
        *,
        runtime_evidence,
        tested_evidence: dict[str, ModelRegisterEvidenceSnapshot],
    ) -> tuple[str, str]:
        if any(item.status == "failed" for item in tested_evidence.values()):
            return (
                "verification_failed",
                "A recorded sync, health check, or live probe failed for this provider/model path.",
            )
        if any(item.status == "observed" for item in tested_evidence.values()):
            return (
                "tested",
                "Operator-visible verification exists through sync, health, or live probe records.",
            )
        if any(
            item.status == "observed"
            for item in (
                runtime_evidence.runtime,
                runtime_evidence.streaming,
                runtime_evidence.tool_calling,
            )
        ):
            return (
                "observed",
                "Runtime traffic has observed this model capability profile, but no explicit verification record is present.",
            )
        return (
            "declared_only",
            "This model is currently backed only by declared catalog/profile metadata.",
        )

    @staticmethod
    def _model_sync_support(
        *,
        provider: Any,
        source: str,
        discovery_supported: bool,
    ) -> ModelRegisterSyncSupport:
        if source in {"discovered", "manual", "templated"} or discovery_supported or provider.provider in {"openai_codex", "generic_harness", "anthropic"}:
            return ModelRegisterSyncSupport(
                available=True,
                mode="provider_sync",
                detail="Provider model discovery can be refreshed through POST /admin/providers/sync.",
            )
        return ModelRegisterSyncSupport(
            available=False,
            mode="not_ready",
            detail="This model currently has no dedicated discovery-backed sync path on the control plane.",
        )

    def _model_routing_policy_classes(self, target_keys: list[str]) -> list[str]:
        if not target_keys:
            return []
        target_key_set = set(target_keys)
        policy_classes: list[str] = []
        for policy in sorted(
            getattr(self, "_routing_policies_state", {}).values(),
            key=lambda item: item.classification,
        ):
            linked_keys = {
                *policy.preferred_target_keys,
                *policy.fallback_target_keys,
                *policy.escalation_target_keys,
            }
            if target_key_set.intersection(linked_keys):
                policy_classes.append(policy.classification)
        return policy_classes

    def _model_routing_posture(
        self,
        *,
        provider_enabled: bool,
        model_active: bool,
        discovery_status: str,
        runtime_status: str,
        availability_status: str,
        linked_targets: list[ModelRegisterTargetLink],
    ) -> tuple[str, bool, str]:
        if not provider_enabled or not model_active:
            return (
                "disabled",
                False,
                "Provider or model is disabled, so runtime routing excludes it.",
            )
        if discovery_status in {"removed", "removed_from_profile_models"}:
            return (
                "removed",
                False,
                "This model was removed from the backing profile or discovery inventory.",
            )
        if discovery_status == "stale" or runtime_status == "stale" or availability_status == "stale":
            return (
                "stale",
                False,
                "This model is stale and is not treated as a healthy routing candidate.",
            )
        if not linked_targets:
            return (
                "no_target_coverage",
                False,
                "No provider target is bound to this model on the selected instance.",
            )
        eligible_targets = [target for target in linked_targets if target.routing_eligible]
        if not eligible_targets:
            return (
                "degraded",
                False,
                "Targets exist, but none are currently routing-eligible because they are disabled or unavailable.",
            )
        return (
            "routable",
            True,
            f"{len(eligible_targets)} provider target(s) can route this model on the selected instance.",
        )

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
        health_index = {(record.provider, record.model): record for record in self._health_records.values()}
        model_index = {(provider.provider, model.id): model for provider in self.list_providers() for model in provider.managed_models}
        runtime_truth_map = {truth.provider.provider: truth.runtime for truth in self.provider_truth_axes(tenant_id=self._instance.tenant_id)}
        for target in targets:
            model = model_index.get((target.provider, target.model_id))
            runtime_truth = runtime_truth_map.get(target.provider)
            if model is not None:
                target.model_routing_key = model.routing_key or target.model_routing_key
                target.last_seen_at = model.last_seen_at
                target.last_probe_at = model.last_probe_at
                target.stale_since = model.stale_since
                target.availability_status = model.availability_status or target.availability_status
                target.status_reason = model.status_reason or target.status_reason
                target.readiness_status = "ready" if model.runtime_status == "ready" else ("partial" if model.active else "unavailable")
            health_record = health_index.get((target.provider, target.model_id))
            if health_record is not None:
                target.health_status = health_record.status
                if health_record.readiness_reason:
                    target.status_reason = health_record.readiness_reason
            if runtime_truth is not None:
                (
                    technical_capabilities,
                    execution_traits,
                    policy_flags,
                    economic_profile,
                ) = split_legacy_capability_profile(
                    provider=target.provider,
                    capability_profile={
                        **target.capability_profile,
                        **target.technical_capabilities,
                        **target.execution_traits,
                        **target.policy_flags,
                        **target.economic_profile,
                        **runtime_truth.capabilities,
                    },
                    cost_class=target.cost_class,
                    latency_class=target.latency_class,
                )
                target.technical_capabilities = technical_capabilities
                target.execution_traits = execution_traits
                target.policy_flags = policy_flags
                target.economic_profile = economic_profile
                target.capability_profile = build_legacy_capability_profile(
                    technical_capabilities=technical_capabilities,
                    execution_traits=execution_traits,
                )
                target.stream_capable = bool(target.technical_capabilities.get("streaming", target.stream_capable))
                target.tool_capable = runtime_truth.tool_calling_level == "full" or bool(target.technical_capabilities.get("tool_calling", target.tool_capable))
                target.vision_capable = bool(target.technical_capabilities.get("vision", target.vision_capable))
                target.queue_eligible = bool(target.execution_traits.get("queue_eligible", target.queue_eligible))
                if runtime_truth.ready and target.enabled and target.readiness_status != "unavailable":
                    target.readiness_status = "ready"
                elif target.readiness_status != "unavailable":
                    target.readiness_status = "partial"
                target.availability_status = target.availability_status if target.availability_status not in {"unknown", ""} else ("healthy" if runtime_truth.ready else "degraded")
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

    def provider_target_snapshot(self) -> list[dict[str, Any]]:
        provider_map = {provider.provider: provider for provider in self.list_providers()}
        model_map = {(provider.provider, model.id): model for provider in self.list_providers() for model in provider.managed_models}
        runtime_truth_map = {truth.provider.provider: truth.runtime for truth in self.provider_truth_axes(tenant_id=self._instance.tenant_id)}
        return [
            ManagedProviderTargetUiRecord(
                **target.model_dump(),
                provider_label=provider_map[target.provider].label if target.provider in provider_map else None,
                model_display_name=model_map[(target.provider, target.model_id)].display_name if (target.provider, target.model_id) in model_map else None,
                model_owned_by=model_map[(target.provider, target.model_id)].owned_by if (target.provider, target.model_id) in model_map else None,
                runtime_ready=bool(runtime_truth_map[target.provider].ready) if target.provider in runtime_truth_map else False,
                runtime_readiness_reason=runtime_truth_map[target.provider].readiness_reason if target.provider in runtime_truth_map else None,
                provider_enabled=bool(provider_map[target.provider].enabled) if target.provider in provider_map else False,
                model_active=bool(model_map[(target.provider, target.model_id)].active) if (target.provider, target.model_id) in model_map else False,
            ).model_dump(mode="json")
            for target in self.list_provider_targets()
        ]

    def model_register_snapshot(self) -> list[dict[str, Any]]:
        target_map: dict[tuple[str, str], list[ManagedProviderTargetRecord]] = {}
        for target in self.list_provider_targets():
            target_map.setdefault((target.provider, target.model_id), []).append(target)

        health_by_provider = {(record.provider, record.model): record.status for record in self._health_records.values()}
        provider_truth_map = {
            truth.provider.provider: truth
            for truth in self.provider_truth_axes(
                tenant_id=self._instance.tenant_id,
                instance_id=self._instance.instance_id,
            )
        }
        models: list[dict[str, object]] = []
        for provider in self.list_providers():
            for model in provider.managed_models:
                provider_truth = provider_truth_map.get(provider.provider)
                runtime_evidence = provider_truth.runtime.evidence.model_copy(deep=True) if provider_truth is not None else None
                linked_targets = sort_targets(target_map.get((provider.provider, model.id), []))
                linked_target_records = [
                    ModelRegisterTargetLink(
                        target_key=target.target_key,
                        label=target.label,
                        enabled=target.enabled,
                        readiness_status=target.readiness_status,
                        availability_status=target.availability_status,
                        priority=target.priority,
                        provider_enabled=provider.enabled,
                        model_active=model.active,
                        routing_eligible=self._target_routing_eligible(
                            target,
                            provider_enabled=provider.enabled,
                            model_active=model.active,
                        ),
                    )
                    for target in linked_targets
                ]
                health_status = health_by_provider.get((provider.provider, model.id), "unknown")
                tested_evidence = (
                    self._model_tested_evidence(
                        provider_truth=provider_truth,
                        health_status=health_status,
                        model=model,
                        provider=provider,
                        source=model.source,
                    )
                    if provider_truth is not None
                    else {
                        "health_check": self._snapshot_evidence(
                            status="missing",
                            source="provider_health",
                            recorded_at=None,
                            details="No provider truth record exists for this model yet.",
                        ),
                        "discovery_sync": self._snapshot_evidence(
                            status="missing",
                            source="provider_sync",
                            recorded_at=provider.last_sync_at,
                            details="No provider truth record exists for this model yet.",
                        ),
                        "live_probe": self._snapshot_evidence(
                            status="not_applicable",
                            source="oauth_probe",
                            recorded_at=model.last_probe_at,
                            details="No provider truth record exists for this model yet.",
                        ),
                    }
                )
                trust_status, trust_reason = (
                    self._model_trust_posture(
                        runtime_evidence=runtime_evidence,
                        tested_evidence=tested_evidence,
                    )
                    if runtime_evidence is not None
                    else (
                        "declared_only",
                        "This model currently has no observed or verified evidence attached to its provider path.",
                    )
                )
                routing_status, routing_ready, routing_reason = self._model_routing_posture(
                    provider_enabled=provider.enabled,
                    model_active=model.active,
                    discovery_status=model.discovery_status,
                    runtime_status=model.runtime_status,
                    availability_status=model.availability_status,
                    linked_targets=linked_target_records,
                )
                models.append(
                    ModelRegisterRecord(
                        provider=provider.provider,
                        provider_label=provider.label,
                        provider_enabled=provider.enabled,
                        provider_integration_class=provider.integration_class,
                        provider_last_sync_status=provider.last_sync_status,
                        provider_last_sync_at=provider.last_sync_at,
                        provider_last_sync_error=provider.last_sync_error,
                        model_id=model.id,
                        display_name=model.display_name or model.id,
                        owned_by=model.owned_by or provider.label or provider.provider,
                        category=model.category,
                        routing_key=model.routing_key or f"{provider.provider}/{model.id}",
                        capabilities=dict(model.capabilities),
                        execution_traits=dict(model.execution_traits),
                        policy_flags=dict(model.policy_flags),
                        economic_profile=dict(model.economic_profile),
                        declared_capability_keys=self._model_declared_capability_keys(
                            capabilities=dict(model.capabilities),
                            execution_traits=dict(model.execution_traits),
                        ),
                        source=model.source,
                        discovery_status=model.discovery_status,
                        runtime_status=model.runtime_status,
                        availability_status=model.availability_status,
                        health_status=health_status,
                        status_reason=model.status_reason,
                        active=model.active,
                        target_count=len(linked_targets),
                        active_target_count=len([target for target in linked_targets if target.enabled]),
                        routing_target_count=len([target for target in linked_target_records if target.routing_eligible]),
                        target_keys=[target.target_key for target in linked_targets],
                        linked_targets=linked_target_records,
                        routing_policy_classes=self._model_routing_policy_classes([target.target_key for target in linked_targets]),
                        routing_status=routing_status,
                        routing_ready=routing_ready,
                        routing_reason=routing_reason,
                        trust_status=trust_status,
                        trust_reason=trust_reason,
                        evidence=runtime_evidence.model_copy(deep=True) if runtime_evidence is not None else {},
                        tested_evidence=tested_evidence,
                        sync=self._model_sync_support(
                            provider=provider,
                            source=model.source,
                            discovery_supported=bool(provider_truth.ui.discovery_supported) if provider_truth is not None else False,
                        ),
                        last_seen_at=model.last_seen_at,
                        last_probe_at=model.last_probe_at,
                        stale_since=model.stale_since,
                    ).model_dump(mode="json")
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
            target.execution_traits["queue_eligible"] = payload.queue_eligible
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
