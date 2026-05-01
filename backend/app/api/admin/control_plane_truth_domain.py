"""Explicit truth-axis separation for provider, runtime, harness, and UI views."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.control_plane import (
    CapabilityEvidenceRecord,
    HarnessProviderTruthRecord,
    ManagedModelUiRecord,
    ManagedProviderRecord,
    ManagedProviderTruthRecord,
    OAuthOperationRecord,
    ProviderCapabilityEvidenceRecord,
    ProviderTruthAxesRecord,
    ProviderUiTruthRecord,
    RuntimeProviderTruthRecord,
)
from app.harness.redaction import redact_sensitive_payload as _redact_sensitive_payload
from app.usage.events import ErrorEvent, UsageEvent


class ControlPlaneTruthDomainMixin:
    if TYPE_CHECKING:
        _analytics: Any
        _providers: Any
        _settings: Any
        _harness: Any
        _health_records: Any
        _infer_provider_class: Any
        _effective_oauth_tenant_id: Any
        _provider_targets_state: Any

        def latest_oauth_operation(self, *args: Any, **kwargs: Any) -> Any: ...
        def oauth_operation_provider_summary(self, *args: Any, **kwargs: Any) -> Any: ...
        def list_providers(self) -> list[Any]: ...
        def list_oauth_account_target_statuses(self, *args: Any, **kwargs: Any) -> list[Any]: ...
        def product_axis_targets(self, *args: Any, **kwargs: Any) -> list[Any]: ...

    @staticmethod
    def _profile_has_owned_models(profile: Any) -> bool:
        return any(str(model).strip() for model in getattr(profile, "models", []))

    def _latest_usage_evidence(
        self,
        provider_name: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
        require_tool_calls: bool = False,
    ) -> UsageEvent | None:
        return self._analytics.latest_usage_event(
            provider_name,
            tenant_id=tenant_id,
            stream_mode=stream_mode,
            require_tool_calls=require_tool_calls,
        )

    def _latest_error_evidence(
        self,
        provider_name: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
    ) -> ErrorEvent | None:
        return self._analytics.latest_error_event(
            provider_name,
            tenant_id=tenant_id,
            stream_mode=stream_mode,
        )

    def _latest_oauth_operation(
        self,
        provider_name: str,
        *,
        action: str,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> OAuthOperationRecord | None:
        return self.latest_oauth_operation(
            provider_name,
            action=action,
            tenant_id=tenant_id,
            instance_id=instance_id,
        )

    def _provider_capability_evidence(
        self,
        provider_name: str,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> ProviderCapabilityEvidenceRecord:
        runtime_event = self._latest_usage_evidence(provider_name, tenant_id=tenant_id, stream_mode="non_stream")
        streaming_event = self._latest_usage_evidence(provider_name, tenant_id=tenant_id, stream_mode="stream")
        tool_event = self._latest_usage_evidence(provider_name, tenant_id=tenant_id, require_tool_calls=True)
        runtime_error = self._latest_error_evidence(provider_name, tenant_id=tenant_id, stream_mode="non_stream")
        streaming_error = self._latest_error_evidence(provider_name, tenant_id=tenant_id, stream_mode="stream")
        probe_operation = self._latest_oauth_operation(
            provider_name,
            action="probe",
            tenant_id=tenant_id,
            instance_id=instance_id,
        )

        runtime = (
            CapabilityEvidenceRecord(
                status="observed",
                source="runtime_non_stream",
                recorded_at=runtime_event.created_at,
                details="Successful non-stream runtime request recorded.",
            )
            if runtime_event is not None
            else (
                CapabilityEvidenceRecord(
                    status="failed",
                    source="none",
                    recorded_at=runtime_error.created_at,
                    details=f"Latest non-stream runtime attempt failed with {runtime_error.error_type}.",
                )
                if runtime_error is not None
                else CapabilityEvidenceRecord(details="No successful non-stream runtime request recorded yet.")
            )
        )
        streaming = (
            CapabilityEvidenceRecord(
                status="observed",
                source="runtime_stream",
                recorded_at=streaming_event.created_at,
                details="Successful streaming runtime request recorded.",
            )
            if streaming_event is not None
            else (
                CapabilityEvidenceRecord(
                    status="failed",
                    source="none",
                    recorded_at=streaming_error.created_at,
                    details=f"Latest streaming runtime attempt failed with {streaming_error.error_type}.",
                )
                if streaming_error is not None
                else CapabilityEvidenceRecord(details="No successful streaming runtime request recorded yet.")
            )
        )
        tool_calling = (
            CapabilityEvidenceRecord(
                status="observed",
                source="runtime_tool_call",
                recorded_at=tool_event.created_at,
                details="Successful runtime request with tool-call output recorded.",
            )
            if tool_event is not None
            else CapabilityEvidenceRecord(details="No successful runtime request with tool-call output recorded yet.")
        )
        live_probe = (
            CapabilityEvidenceRecord(
                status="observed",
                source="oauth_probe",
                recorded_at=probe_operation.executed_at,
                details=str(probe_operation.details),
            )
            if probe_operation is not None and probe_operation.status == "ok"
            else (
                CapabilityEvidenceRecord(
                    status="failed",
                    source="none",
                    recorded_at=probe_operation.executed_at,
                    details=str(probe_operation.details),
                )
                if probe_operation is not None and probe_operation.status == "failed"
                else CapabilityEvidenceRecord(details=str(probe_operation.details) if probe_operation is not None else "No successful live probe recorded yet.")
            )
        )
        return ProviderCapabilityEvidenceRecord(
            runtime=runtime,
            streaming=streaming,
            tool_calling=tool_calling,
            live_probe=live_probe,
        )

    def _readiness_axes_for_provider(
        self,
        provider_name: str,
        runtime_status: dict[str, Any],
        *,
        tenant_id: str | None = None,
    ) -> tuple[str, str]:
        ready = bool(runtime_status["ready"])
        streaming = bool(runtime_status["capabilities"].get("streaming"))
        if provider_name == "generic_harness":
            return ("partial" if ready else "planned"), ("partial" if ready and streaming else "planned")
        beta_target_key = {
            "openai_codex": "openai_codex",
            "gemini": "gemini",
            "generic_harness": "openai_compatible_generic",
            "ollama": "ollama",
        }.get(provider_name)
        if beta_target_key is not None:
            target = next(
                (item for item in self.product_axis_targets(tenant_id=tenant_id) if item["provider_key"] == beta_target_key),
                None,
            )
            if target is not None:
                return str(target["runtime_readiness"]), str(target["streaming_readiness"])

        if provider_name == "openai_api":
            readiness = "ready" if ready else "planned"
            return readiness, readiness if streaming else "planned"
        if provider_name == "forgeframe_baseline":
            return "ready", "ready"
        if provider_name == "anthropic":
            return ("partial" if ready else "planned"), ("partial" if ready and streaming else "planned")
        return ("partial" if ready else "planned"), ("partial" if ready and streaming else "planned")

    @staticmethod
    def _runtime_summary_ready(runtime_readiness: str) -> bool:
        return runtime_readiness == "ready"

    @staticmethod
    def _runtime_contract_classification(
        provider_name: str,
        runtime_status: dict[str, Any],
        runtime_readiness: str,
    ) -> str:
        if runtime_readiness == "ready":
            return "runtime-ready"

        provider_axis = str(runtime_status["capabilities"].get("provider_axis", "unknown"))
        ready = bool(runtime_status.get("ready"))

        if provider_name == "generic_harness":
            return "partial-runtime" if ready or runtime_readiness == "partial" else "onboarding-only"
        if provider_name in {"openai_codex", "gemini"}:
            return "partial-runtime" if runtime_readiness == "partial" else "onboarding-only"
        if provider_axis == "unmapped_native_runtime":
            return "partial-runtime" if ready else "unsupported"
        if runtime_readiness == "partial" or ready:
            return "partial-runtime"
        return "unsupported"

    @staticmethod
    def _compatibility_depth(
        provider_axis: str,
        ready: bool,
        runtime_readiness: str,
        streaming: bool,
        tool_calling_level: str,
    ) -> str:
        if provider_axis == "unmapped_native_runtime":
            return "limited" if ready or runtime_readiness == "partial" else "none"
        if ready and streaming and tool_calling_level == "full":
            return "validated"
        if ready:
            return "constrained"
        if runtime_readiness == "partial":
            return "limited"
        return "none"

    def _runtime_summary_reason(
        self,
        provider_name: str,
        runtime_status: dict[str, Any],
        runtime_readiness: str,
        evidence: ProviderCapabilityEvidenceRecord,
        *,
        tenant_id: str | None = None,
    ) -> str:
        raw_reason = runtime_status.get("readiness_reason")
        if not bool(runtime_status.get("ready")):
            return str(raw_reason or "Provider is not wired for runtime use.")
        if self._runtime_summary_ready(runtime_readiness):
            return str(raw_reason or "Live runtime evidence is recorded for this provider.")
        provider_axis = str(runtime_status["capabilities"].get("provider_axis", "unknown"))
        if provider_axis == "unmapped_native_runtime":
            if provider_name == "anthropic":
                return (
                    "Anthropic runs through the native /messages adapter. ForgeFrame still ships only four product axes, "
                    "so Anthropic stays outside the current product-axis taxonomy and is intentionally omitted from beta targets."
                )
            return (
                "This provider uses native runtime semantics outside ForgeFrame's current shipped product-axis taxonomy and stays intentionally omitted from beta targets until a truthful axis exists."
            )

        if provider_name == "generic_harness":
            streaming = bool(runtime_status["capabilities"].get("streaming"))
            tool_calling_level = str(runtime_status["capabilities"].get("tool_calling_level", "none"))
            if not streaming and tool_calling_level == "none":
                return "Active harness profiles currently expose only non-stream, non-tool runtime paths."
            if not streaming:
                return "Active harness profiles currently reject streaming runtime paths."
            if tool_calling_level == "none":
                return "Active harness profiles currently reject tool-calling runtime paths."

        beta_target_key = {
            "openai_codex": "openai_codex",
            "gemini": "gemini",
            "generic_harness": "openai_compatible_generic",
            "ollama": "ollama",
        }.get(provider_name)
        if beta_target_key is not None:
            target = next(
                (item for item in self.product_axis_targets(tenant_id=tenant_id) if item["provider_key"] == beta_target_key),
                None,
            )
            if target is not None and target.get("status_summary"):
                return str(target["status_summary"])

        if evidence.runtime.status == "failed":
            return str(evidence.runtime.details)
        if evidence.live_probe.status == "observed":
            return "Live probe evidence is recorded, but no successful runtime request is recorded yet."
        if evidence.live_probe.status == "failed":
            return str(evidence.live_probe.details)
        return "Provider is wired, but live runtime evidence is still missing."

    def _provider_truth_for_provider(
        self,
        provider: ManagedProviderRecord,
    ) -> ManagedProviderTruthRecord:
        return ManagedProviderTruthRecord(
            provider=provider.provider,
            label=provider.label,
            enabled=provider.enabled,
            integration_class=provider.integration_class,
            template_id=provider.template_id,
            config=dict(provider.config),
            last_sync_at=provider.last_sync_at,
            last_sync_status=provider.last_sync_status,
            last_sync_error=provider.last_sync_error,
            model_count=len(provider.managed_models),
            managed_models=[model.model_copy(deep=True) for model in provider.managed_models],
        )

    def _runtime_truth_for_provider(
        self,
        provider: ManagedProviderRecord,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> RuntimeProviderTruthRecord:
        try:
            runtime_status = self._providers.get_provider_status(
                provider.provider,
                instance_id=instance_id,
            )
        except ValueError:
            runtime_status = None
        if not runtime_status:
            return RuntimeProviderTruthRecord(provider=provider.provider)
        streaming = bool(runtime_status["capabilities"].get("streaming"))
        tool_calling_level = str(runtime_status["capabilities"].get("tool_calling_level", "none"))
        evidence = self._provider_capability_evidence(provider.provider, tenant_id=tenant_id)
        runtime_readiness, streaming_readiness = self._readiness_axes_for_provider(
            provider.provider,
            runtime_status,
            tenant_id=tenant_id,
        )
        summary_ready = self._runtime_summary_ready(runtime_readiness)
        provider_axis = str(runtime_status["capabilities"].get("provider_axis", "unknown"))
        readiness_reason = self._runtime_summary_reason(
            provider.provider,
            runtime_status,
            runtime_readiness,
            evidence,
            tenant_id=tenant_id,
        )
        compatibility_depth = self._compatibility_depth(
            provider_axis,
            bool(runtime_status["ready"]),
            runtime_readiness,
            streaming,
            tool_calling_level,
        )
        oauth_mode = self._settings.openai_codex_oauth_mode if provider.provider == "openai_codex" and self._settings.openai_codex_auth_mode == "oauth" else None
        return RuntimeProviderTruthRecord(
            provider=provider.provider,
            wired=True,
            ready=summary_ready,
            readiness_reason=readiness_reason,
            contract_classification=self._runtime_contract_classification(
                provider.provider,
                runtime_status,
                runtime_readiness,
            ),
            runtime_readiness=runtime_readiness,
            streaming_readiness=streaming_readiness,
            capabilities=dict(runtime_status["capabilities"]),
            tool_calling_level=str(runtime_status["capabilities"].get("tool_calling_level", "none")),
            evidence=evidence,
            compatibility_depth=compatibility_depth,
            provider_axis=provider_axis,
            auth_mechanism=str(runtime_status["capabilities"].get("auth_mechanism", "unknown")),
            oauth_required=bool(runtime_status["oauth_required"]),
            oauth_mode=oauth_mode,
            discovery_supported=bool(runtime_status["discovery_supported"]),
        )

    def _harness_truth_for_provider(
        self,
        provider: ManagedProviderRecord,
        harness_profiles: list[Any],
        harness_runs: list[Any],
    ) -> HarnessProviderTruthRecord:
        relevant_profiles = [profile for profile in harness_profiles if provider.provider == "generic_harness" or profile.provider_key.startswith(f"{provider.provider}_")]
        relevant_runs = [run for run in harness_runs if provider.provider == "generic_harness" or run.provider_key.startswith(f"{provider.provider}_")]
        successful_modes_by_profile: dict[str, set[str]] = {}
        for run in relevant_runs:
            if run.success:
                successful_modes_by_profile.setdefault(run.provider_key, set()).add(run.mode)
        enabled_profiles = [profile for profile in relevant_profiles if profile.enabled]
        runtime_profiles = [profile for profile in enabled_profiles if self._profile_has_owned_models(profile)]
        required_proof_modes = {
            "preview",
            "verify",
            "probe",
            "runtime_non_stream",
            "runtime_stream",
        }
        proven_profile_keys = sorted(
            profile.provider_key
            for profile in relevant_profiles
            if profile.integration_class == "openai_compatible" and required_proof_modes.issubset(successful_modes_by_profile.get(profile.provider_key, set()))
        )
        successful_modes = sorted({mode for modes in successful_modes_by_profile.values() for mode in modes})
        proof_status: str
        if proven_profile_keys:
            proof_status = "proven"
        elif successful_modes:
            proof_status = "partial"
        else:
            proof_status = "none"
        last_failed = next((run for run in relevant_runs if not run.success), None)
        return HarnessProviderTruthRecord(
            provider=provider.provider,
            profile_count=len(relevant_profiles),
            enabled_profile_count=len(enabled_profiles),
            runtime_profile_count=len(runtime_profiles),
            model_less_enabled_profile_count=len(enabled_profiles) - len(runtime_profiles),
            profiles_needing_attention=len([profile for profile in relevant_profiles if profile.needs_attention]),
            run_count=len(relevant_runs),
            profile_keys=[profile.provider_key for profile in relevant_profiles],
            proof_status=proof_status,
            successful_modes=successful_modes,
            proven_profile_keys=proven_profile_keys,
            last_failed_run=_redact_sensitive_payload(last_failed.model_dump()) if last_failed else None,
        )

    @staticmethod
    def _latest_iso_timestamp(*values: Any) -> str | None:
        timestamps = sorted({str(value) for value in values if isinstance(value, str) and value.strip()})
        return timestamps[-1] if timestamps else None

    @staticmethod
    def _provider_target_summary(targets: list[Any]) -> dict[str, Any]:
        last_probe_at = ControlPlaneTruthDomainMixin._latest_iso_timestamp(*[getattr(target, "last_probe_at", None) for target in targets])
        return {
            "target_count": len(targets),
            "enabled_target_count": len([target for target in targets if bool(getattr(target, "enabled", False))]),
            "ready_target_count": len([target for target in targets if str(getattr(target, "readiness_status", "planned")) == "ready"]),
            "last_probe_at": last_probe_at,
        }

    @staticmethod
    def _provider_health_summary(records: list[Any]) -> dict[str, Any]:
        if not records:
            return {
                "health_status": "not-run",
                "healthy_model_count": 0,
                "attention_model_count": 0,
                "last_health_check_at": None,
            }

        statuses = [str(getattr(record, "status", "unknown")) for record in records]
        healthy_count = len([status for status in statuses if status in {"healthy", "discovery_only"}])
        attention_count = len([status for status in statuses if status not in {"healthy", "discovery_only"}])
        if attention_count == 0:
            health_status = "healthy"
        elif any(status in {"auth_failed", "probe_failed", "degraded"} for status in statuses):
            health_status = "error"
        else:
            health_status = "attention"
        return {
            "health_status": health_status,
            "healthy_model_count": healthy_count,
            "attention_model_count": attention_count,
            "last_health_check_at": ControlPlaneTruthDomainMixin._latest_iso_timestamp(*[getattr(record, "last_check_at", None) for record in records]),
        }

    @staticmethod
    def _provider_next_action(
        *,
        enabled: bool,
        oauth_connect_required: bool,
        model_count: int,
        health_status: str,
        ready: bool,
        last_sync_status: str,
        last_sync_error: str | None,
    ) -> tuple[str, str]:
        if oauth_connect_required:
            return ("connect_oauth", "Connect required")
        if not enabled:
            return ("activate_provider", "Activate provider")
        if model_count == 0:
            return ("sync_models", "Sync models")
        if last_sync_error or last_sync_status in {"warning", "failed"}:
            return ("review_sync", "Review sync")
        if health_status in {"not-run", "attention", "error"}:
            return ("run_health", "Run health")
        if not ready:
            return ("edit_provider", "Finish setup")
        return ("edit_provider", "Review config")

    def _ui_truth_for_provider(
        self,
        provider_truth: ManagedProviderTruthRecord,
        runtime_truth: RuntimeProviderTruthRecord,
        harness_truth: HarnessProviderTruthRecord,
        *,
        health_by_provider: dict[str, dict[str, str]],
        health_records_by_provider: dict[str, list[Any]],
        oauth_failures: dict[str, int],
        oauth_last_probe: dict[str, dict[str, Any]],
        oauth_last_bridge: dict[str, dict[str, Any]],
        oauth_target_states: dict[str, dict[str, Any]],
        provider_targets_by_provider: dict[str, list[Any]],
    ) -> ProviderUiTruthRecord:
        provider_name = provider_truth.provider
        provider_class = self._infer_provider_class(
            provider_name=provider_name,
            integration_class=provider_truth.integration_class,
            template_id=provider_truth.template_id,
            config=provider_truth.config,
        )
        target_summary = self._provider_target_summary(provider_targets_by_provider.get(provider_name, []))
        health_summary = self._provider_health_summary(health_records_by_provider.get(provider_name, []))
        oauth_target_state = oauth_target_states.get(provider_name, {})
        oauth_connect_required = bool(runtime_truth.oauth_required and (not bool(oauth_target_state.get("configured")) or str(oauth_target_state.get("readiness", "planned")) != "ready"))
        last_probe_at = self._latest_iso_timestamp(
            target_summary["last_probe_at"],
            health_summary["last_health_check_at"],
            oauth_last_probe.get(provider_name, {}).get("executed_at") if oauth_last_probe.get(provider_name) else None,
            *[model.last_probe_at for model in provider_truth.managed_models],
        )
        next_action_kind, next_action = self._provider_next_action(
            enabled=provider_truth.enabled,
            oauth_connect_required=oauth_connect_required,
            model_count=provider_truth.model_count,
            health_status=str(health_summary["health_status"]),
            ready=runtime_truth.ready,
            last_sync_status=provider_truth.last_sync_status,
            last_sync_error=provider_truth.last_sync_error,
        )
        return ProviderUiTruthRecord(
            provider=provider_name,
            label=provider_truth.label,
            enabled=provider_truth.enabled,
            provider_class=provider_class,
            integration_class=provider_truth.integration_class,
            template_id=provider_truth.template_id,
            config=dict(provider_truth.config),
            last_sync_at=provider_truth.last_sync_at,
            last_sync_status=provider_truth.last_sync_status,
            last_sync_error=provider_truth.last_sync_error,
            ready=runtime_truth.ready,
            readiness_reason=runtime_truth.readiness_reason,
            contract_classification=runtime_truth.contract_classification,
            runtime_readiness=runtime_truth.runtime_readiness,
            streaming_readiness=runtime_truth.streaming_readiness,
            capabilities=dict(runtime_truth.capabilities),
            tool_calling_level=runtime_truth.tool_calling_level,
            evidence=runtime_truth.evidence.model_copy(deep=True),
            compatibility_depth=runtime_truth.compatibility_depth,
            provider_axis=runtime_truth.provider_axis,
            auth_mechanism=runtime_truth.auth_mechanism,
            oauth_required=runtime_truth.oauth_required,
            oauth_mode=runtime_truth.oauth_mode,
            discovery_supported=runtime_truth.discovery_supported,
            model_count=provider_truth.model_count,
            models=[
                ManagedModelUiRecord(
                    **model.model_dump(),
                    health_status=health_by_provider.get(provider_name, {}).get(model.id, "unknown"),
                )
                for model in provider_truth.managed_models
            ],
            harness_profile_count=harness_truth.profile_count,
            harness_enabled_profile_count=harness_truth.enabled_profile_count,
            harness_needs_attention_count=harness_truth.profiles_needing_attention,
            harness_run_count=harness_truth.run_count,
            harness_proof_status=harness_truth.proof_status,
            harness_proven_profile_keys=list(harness_truth.proven_profile_keys),
            oauth_failure_count=oauth_failures.get(provider_name, 0),
            oauth_last_probe=oauth_last_probe.get(provider_name),
            oauth_last_bridge_sync=oauth_last_bridge.get(provider_name),
            oauth_connect_required=oauth_connect_required,
            target_count=int(target_summary["target_count"]),
            enabled_target_count=int(target_summary["enabled_target_count"]),
            ready_target_count=int(target_summary["ready_target_count"]),
            health_status=str(health_summary["health_status"]),
            healthy_model_count=int(health_summary["healthy_model_count"]),
            attention_model_count=int(health_summary["attention_model_count"]),
            last_health_check_at=health_summary["last_health_check_at"],
            last_probe_at=last_probe_at,
            next_action=next_action,
            next_action_kind=next_action_kind,
        )

    def provider_truth_axes(
        self,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> list[ProviderTruthAxesRecord]:
        health_by_provider: dict[str, dict[str, str]] = {}
        health_records_by_provider: dict[str, list[Any]] = {}
        oauth_failures: dict[str, int] = {}
        oauth_last_probe: dict[str, dict[str, Any]] = {}
        oauth_last_bridge: dict[str, dict[str, Any]] = {}
        effective_tenant_id = self._effective_oauth_tenant_id(tenant_id)
        scoped_instance_id = (instance_id or "").strip() or None
        oauth_summary = self.oauth_operation_provider_summary(
            effective_tenant_id,
            scoped_instance_id,
        )
        for provider_key, details in oauth_summary.items():
            oauth_failures[provider_key] = int(details.get("failures", 0) or 0)
            if details.get("last_probe") is not None:
                oauth_last_probe[provider_key] = details["last_probe"]
            if details.get("last_bridge_sync") is not None:
                oauth_last_bridge[provider_key] = details["last_bridge_sync"]
        for record in self._health_records.values():
            health_by_provider.setdefault(record.provider, {})[record.model] = record.status
            health_records_by_provider.setdefault(record.provider, []).append(record)
        oauth_target_states = {
            str(item["provider_key"]): item
            for item in self.list_oauth_account_target_statuses(
                tenant_id=effective_tenant_id,
                instance_id=scoped_instance_id,
            )
        }
        provider_targets_by_provider: dict[str, list[Any]] = {}
        current_provider_targets = getattr(self, "_provider_targets_state", {})
        for target in current_provider_targets.values():
            provider_targets_by_provider.setdefault(target.provider, []).append(target)

        harness_profiles = self._harness.list_profiles(instance_id=scoped_instance_id)
        harness_runs = self._harness.list_runs(instance_id=scoped_instance_id, limit=500)
        truths: list[ProviderTruthAxesRecord] = []
        for provider in self.list_providers():
            provider_truth = self._provider_truth_for_provider(provider)
            runtime_truth = self._runtime_truth_for_provider(
                provider,
                tenant_id=effective_tenant_id,
                instance_id=scoped_instance_id,
            )
            harness_truth = self._harness_truth_for_provider(provider, harness_profiles, harness_runs)
            ui_truth = self._ui_truth_for_provider(
                provider_truth,
                runtime_truth,
                harness_truth,
                health_by_provider=health_by_provider,
                health_records_by_provider=health_records_by_provider,
                oauth_failures=oauth_failures,
                oauth_last_probe=oauth_last_probe,
                oauth_last_bridge=oauth_last_bridge,
                oauth_target_states=oauth_target_states,
                provider_targets_by_provider=provider_targets_by_provider,
            )
            truths.append(
                ProviderTruthAxesRecord(
                    provider=provider_truth,
                    runtime=runtime_truth,
                    harness=harness_truth,
                    ui=ui_truth,
                )
            )
        return truths
