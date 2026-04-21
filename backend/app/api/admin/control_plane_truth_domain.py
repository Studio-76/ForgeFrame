"""Explicit truth-axis separation for provider, runtime, harness, and UI views."""

from __future__ import annotations

from app.control_plane import (
    HarnessProviderTruthRecord,
    ManagedModelUiRecord,
    ManagedProviderRecord,
    ManagedProviderTruthRecord,
    ProviderTruthAxesRecord,
    ProviderUiTruthRecord,
    RuntimeProviderTruthRecord,
)


class ControlPlaneTruthDomainMixin:
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
        active_runtime_providers: set[str],
    ) -> RuntimeProviderTruthRecord:
        runtime_status = (
            self._providers.get_provider_status(provider.provider)
            if provider.provider in active_runtime_providers
            else None
        )
        if not runtime_status:
            return RuntimeProviderTruthRecord(provider=provider.provider)
        streaming = bool(runtime_status["capabilities"].get("streaming"))
        tool_calling_level = str(runtime_status["capabilities"].get("tool_calling_level", "none"))
        compatibility_tier = "planned"
        if runtime_status["ready"]:
            compatibility_tier = "beta_plus" if streaming and tool_calling_level == "full" else "beta"
        oauth_mode = (
            self._settings.openai_codex_auth_mode
            if provider.provider == "openai_codex"
            else (self._settings.gemini_auth_mode if provider.provider == "gemini" else None)
        )
        return RuntimeProviderTruthRecord(
            provider=provider.provider,
            wired=True,
            ready=bool(runtime_status["ready"]),
            readiness_reason=str(runtime_status["readiness_reason"]),
            capabilities=dict(runtime_status["capabilities"]),
            tool_calling_level=str(runtime_status["capabilities"].get("tool_calling_level", "none")),
            compatibility_tier=compatibility_tier,
            provider_axis=str(runtime_status["capabilities"].get("provider_axis", "unknown")),
            auth_mechanism=str(runtime_status["capabilities"].get("auth_mechanism", "unknown")),
            oauth_required=bool(runtime_status["oauth_required"]),
            oauth_mode=oauth_mode,
            discovery_supported=bool(runtime_status["discovery_supported"]),
        )

    def _harness_truth_for_provider(
        self,
        provider: ManagedProviderRecord,
        harness_profiles: list[object],
        harness_runs: list[object],
    ) -> HarnessProviderTruthRecord:
        relevant_profiles = [
            profile
            for profile in harness_profiles
            if provider.provider == "generic_harness"
            or profile.provider_key.startswith(f"{provider.provider}_")
        ]
        relevant_runs = [
            run
            for run in harness_runs
            if provider.provider == "generic_harness"
            or run.provider_key.startswith(f"{provider.provider}_")
        ]
        last_failed = next((run for run in relevant_runs if not run.success), None)
        return HarnessProviderTruthRecord(
            provider=provider.provider,
            profile_count=len(relevant_profiles),
            enabled_profile_count=len([profile for profile in relevant_profiles if profile.enabled]),
            profiles_needing_attention=len([profile for profile in relevant_profiles if profile.needs_attention]),
            run_count=len(relevant_runs),
            profile_keys=[profile.provider_key for profile in relevant_profiles],
            last_failed_run=last_failed.model_dump() if last_failed else None,
        )

    def _ui_truth_for_provider(
        self,
        provider_truth: ManagedProviderTruthRecord,
        runtime_truth: RuntimeProviderTruthRecord,
        harness_truth: HarnessProviderTruthRecord,
        *,
        health_by_provider: dict[str, dict[str, str]],
        oauth_failures: dict[str, int],
        oauth_last_probe: dict[str, dict[str, object]],
        oauth_last_bridge: dict[str, dict[str, object]],
    ) -> ProviderUiTruthRecord:
        return ProviderUiTruthRecord(
            provider=provider_truth.provider,
            label=provider_truth.label,
            enabled=provider_truth.enabled,
            integration_class=provider_truth.integration_class,
            template_id=provider_truth.template_id,
            config=dict(provider_truth.config),
            last_sync_at=provider_truth.last_sync_at,
            last_sync_status=provider_truth.last_sync_status,
            last_sync_error=provider_truth.last_sync_error,
            ready=runtime_truth.ready,
            readiness_reason=runtime_truth.readiness_reason,
            capabilities=dict(runtime_truth.capabilities),
            tool_calling_level=runtime_truth.tool_calling_level,
            compatibility_tier=runtime_truth.compatibility_tier,
            provider_axis=runtime_truth.provider_axis,
            auth_mechanism=runtime_truth.auth_mechanism,
            oauth_required=runtime_truth.oauth_required,
            oauth_mode=runtime_truth.oauth_mode,
            discovery_supported=runtime_truth.discovery_supported,
            model_count=provider_truth.model_count,
            models=[
                ManagedModelUiRecord(
                    **model.model_dump(),
                    health_status=health_by_provider.get(provider_truth.provider, {}).get(model.id, "unknown"),
                )
                for model in provider_truth.managed_models
            ],
            harness_profile_count=harness_truth.profile_count,
            harness_enabled_profile_count=harness_truth.enabled_profile_count,
            harness_needs_attention_count=harness_truth.profiles_needing_attention,
            harness_run_count=harness_truth.run_count,
            oauth_failure_count=oauth_failures.get(provider_truth.provider, 0),
            oauth_last_probe=oauth_last_probe.get(provider_truth.provider),
            oauth_last_bridge_sync=oauth_last_bridge.get(provider_truth.provider),
        )

    def provider_truth_axes(self) -> list[ProviderTruthAxesRecord]:
        health_by_provider: dict[str, dict[str, str]] = {}
        oauth_failures: dict[str, int] = {}
        oauth_last_probe: dict[str, dict[str, object]] = {}
        oauth_last_bridge: dict[str, dict[str, object]] = {}
        for item in self._oauth_operations:
            if item.status == "failed":
                oauth_failures[item.provider_key] = oauth_failures.get(item.provider_key, 0) + 1
            if item.action == "probe":
                oauth_last_probe[item.provider_key] = item.model_dump()
            if item.action == "bridge_sync":
                oauth_last_bridge[item.provider_key] = item.model_dump()
        for record in self._health_records.values():
            health_by_provider.setdefault(record.provider, {})[record.model] = record.status

        harness_profiles = self._harness.list_profiles()
        harness_runs = self._harness.list_runs(limit=500)
        active_runtime_providers = {model.provider for model in self._registry.list_active_models()}

        truths: list[ProviderTruthAxesRecord] = []
        for provider in self.list_providers():
            provider_truth = self._provider_truth_for_provider(provider)
            runtime_truth = self._runtime_truth_for_provider(provider, active_runtime_providers)
            harness_truth = self._harness_truth_for_provider(provider, harness_profiles, harness_runs)
            ui_truth = self._ui_truth_for_provider(
                provider_truth,
                runtime_truth,
                harness_truth,
                health_by_provider=health_by_provider,
                oauth_failures=oauth_failures,
                oauth_last_probe=oauth_last_probe,
                oauth_last_bridge=oauth_last_bridge,
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
