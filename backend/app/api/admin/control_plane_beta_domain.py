"""Expansion-target projection helpers for the control plane."""

from __future__ import annotations

from app.api.admin.control_plane_models import BetaProviderTarget, OAuthAccountTargetStatus


class ControlPlaneBetaDomainMixin:
    @staticmethod
    def _bridge_only_verify_probe_readiness(status: OAuthAccountTargetStatus) -> str:
        if status.configured and status.probe_enabled and status.evidence.live_probe.status == "observed":
            return "ready"
        return "partial" if status.configured else "planned"

    def beta_provider_targets(self, tenant_id: str | None = None) -> list[dict[str, object]]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        codex_status = self._safe_provider_status("openai_codex")
        gemini_status = self._safe_provider_status("gemini")
        harness_status = self._safe_provider_status("generic_harness")
        ollama_status = self._safe_provider_status("ollama")
        harness_profiles_configured = bool(self._harness.list_profiles())
        harness_runtime_ready = bool(harness_status["ready"])
        harness_streaming_ready = harness_runtime_ready and bool(harness_status["capabilities"].get("streaming"))
        harness_verify_probe_readiness = "ready" if harness_runtime_ready else ("partial" if harness_profiles_configured else "planned")
        harness_readiness = "partial" if harness_runtime_ready else "planned"
        harness_status_summary = (
            "Generic harness is operational, but runtime compatibility and tool fidelity remain partial."
            if harness_runtime_ready
            else (
                "Generic harness profiles exist, but no enabled profile currently owns a runtime model. "
                "Keep the axis planned until a dispatchable profile is configured."
                if harness_profiles_configured
                else "Generic harness profiles are not configured yet, so the openai-compatible provider axis remains planned."
            )
        )
        antigravity_status = self._oauth_target_status("antigravity", tenant_id=effective_tenant_id)
        copilot_status = self._oauth_target_status("github_copilot", tenant_id=effective_tenant_id)
        claude_code_status = self._oauth_target_status("claude_code", tenant_id=effective_tenant_id)
        codex_evidence = self._provider_capability_evidence("openai_codex", tenant_id=effective_tenant_id)
        gemini_evidence = self._provider_capability_evidence("gemini", tenant_id=effective_tenant_id)
        codex_oauth_status = self._native_oauth_target_status("openai_codex", tenant_id=effective_tenant_id)
        gemini_oauth_status = self._native_oauth_target_status("gemini", tenant_id=effective_tenant_id)
        codex_runtime_readiness = (
            "ready"
            if codex_status["ready"] and codex_evidence.runtime.status == "observed"
            else ("partial" if codex_oauth_status.runtime_bridge_enabled and codex_oauth_status.configured else "planned")
        )
        codex_streaming_readiness = (
            "ready"
            if codex_status["ready"] and codex_evidence.streaming.status == "observed"
            else ("partial" if codex_oauth_status.runtime_bridge_enabled and codex_oauth_status.configured else "planned")
        )
        codex_probe_readiness = (
            "ready"
            if codex_status["ready"] and codex_evidence.live_probe.status == "observed"
            else ("partial" if codex_oauth_status.probe_enabled and codex_oauth_status.configured else "planned")
        )
        gemini_runtime_readiness = (
            "ready"
            if gemini_status["ready"] and gemini_evidence.runtime.status == "observed"
            else ("partial" if gemini_oauth_status.runtime_bridge_enabled and gemini_oauth_status.configured else "planned")
        )
        gemini_streaming_readiness = (
            "ready"
            if gemini_status["ready"] and gemini_evidence.streaming.status == "observed"
            else ("partial" if gemini_oauth_status.runtime_bridge_enabled and gemini_oauth_status.configured else "planned")
        )
        gemini_probe_readiness = (
            "ready"
            if gemini_status["ready"] and gemini_evidence.live_probe.status == "observed"
            else ("partial" if gemini_oauth_status.probe_enabled and gemini_oauth_status.configured else "planned")
        )
        targets = [
            BetaProviderTarget(
                provider_key="openai_codex",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key hybrid",
                runtime_path="native provider adapter",
                readiness="partial",
                readiness_score=78 if codex_runtime_readiness == "ready" else (62 if codex_status["ready"] else 48),
                runtime_readiness=codex_runtime_readiness,
                streaming_readiness=codex_streaming_readiness,
                verify_probe_readiness=codex_probe_readiness,
                ui_readiness="partial",
                evidence=codex_evidence,
                beta_tier="beta",
                health_semantics="provider + model health with auth readiness",
                verify_probe_axis="verify/probe supported",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + harness control plane",
                status_summary=(
                    "Codex runtime path has recorded live evidence for the currently configured bridge."
                    if codex_runtime_readiness == "ready"
                    else (
                        str(codex_status["readiness_reason"])
                        if codex_oauth_status.runtime_bridge_enabled and codex_oauth_status.configured and not codex_status["ready"]
                        else (
                            "Codex bridge is configured, but live runtime evidence is still missing; keep the slice explicitly partial."
                            if codex_oauth_status.runtime_bridge_enabled and codex_oauth_status.configured
                            else (
                                "Codex auth is wired, but runtime remains outside default release truth until the bridge path is enabled and proven."
                                if codex_oauth_status.configured
                                else "Codex credentials are not configured yet, so runtime truth remains planned."
                            )
                        )
                    )
                ),
                oauth_account_provider=True,
                notes="Codex keeps native runtime semantics, but runtime/stream/tool claims only graduate when probe and observability evidence exist.",
            ),
            BetaProviderTarget(
                provider_key="gemini",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key",
                runtime_path="native provider adapter",
                readiness="partial",
                readiness_score=(
                    74
                    if gemini_runtime_readiness == "ready"
                    else (
                        52
                        if gemini_oauth_status.runtime_bridge_enabled and gemini_oauth_status.configured and gemini_status["ready"]
                        else (46 if gemini_oauth_status.configured else 34)
                    )
                ),
                runtime_readiness=gemini_runtime_readiness,
                streaming_readiness=gemini_streaming_readiness,
                verify_probe_readiness=gemini_probe_readiness,
                ui_readiness="partial",
                evidence=gemini_evidence,
                beta_tier="concept",
                health_semantics="provider/model discovery + auth readiness",
                verify_probe_axis="verify/probe supported via harness/runtime",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + usage + harness",
                status_summary=(
                    "Gemini runtime path has recorded live evidence for the currently configured bridge."
                    if gemini_runtime_readiness == "ready"
                    else (
                        str(gemini_status["readiness_reason"])
                        if gemini_oauth_status.runtime_bridge_enabled and gemini_oauth_status.configured and not gemini_status["ready"]
                        else (
                            "Gemini probe/runtime bridge is configured, but live runtime evidence is still missing; keep the slice explicitly partial."
                            if gemini_oauth_status.runtime_bridge_enabled and gemini_oauth_status.configured
                            else (
                                "Gemini credentials are modeled, but runtime truth remains partial until the probe/runtime path is enabled and proven."
                                if gemini_oauth_status.configured
                                else "Gemini credentials are not configured yet, so runtime truth remains planned."
                            )
                        )
                    )
                ),
                oauth_account_provider=True,
                notes="Gemini keeps native runtime semantics, but runtime/stream/tool claims only graduate when probe and observability evidence exist.",
            ),
            BetaProviderTarget(
                provider_key="antigravity",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=antigravity_status.readiness,
                readiness_score=58 if antigravity_status.readiness == "ready" else (42 if antigravity_status.readiness == "partial" else 24),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(antigravity_status),
                ui_readiness="partial",
                evidence=antigravity_status.evidence.model_copy(deep=True),
                beta_tier="concept",
                health_semantics="auth + connection + discovery phases",
                verify_probe_axis="verify/probe planned on generic harness profile",
                observability_axis="integration/profile/client error axis",
                ui_axis="beta target table + harness onboarding",
                status_summary=f"{antigravity_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            BetaProviderTarget(
                provider_key="github_copilot",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=copilot_status.readiness,
                readiness_score=58 if copilot_status.readiness == "ready" else (42 if copilot_status.readiness == "partial" else 23),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(copilot_status),
                ui_readiness="partial",
                evidence=copilot_status.evidence.model_copy(deep=True),
                beta_tier="concept",
                health_semantics="auth/session readiness + probe",
                verify_probe_axis="verify/probe planned with profile template",
                observability_axis="client/integration/profile errors",
                ui_axis="providers beta target table",
                status_summary=f"{copilot_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            BetaProviderTarget(
                provider_key="claude_code",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=claude_code_status.readiness,
                readiness_score=58 if claude_code_status.readiness == "ready" else (42 if claude_code_status.readiness == "partial" else 23),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(claude_code_status),
                ui_readiness="partial",
                evidence=claude_code_status.evidence.model_copy(deep=True),
                beta_tier="concept",
                health_semantics="auth + request rendering + mapping",
                verify_probe_axis="verify/probe planned",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers beta target table",
                status_summary=f"{claude_code_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            BetaProviderTarget(
                provider_key="openai_compatible_generic",
                provider_type="openai_compatible",
                product_axis="openai_compatible_providers",
                auth_model="api_key_header/bearer/none",
                runtime_path="generic_harness openai-compatible profile",
                readiness=harness_readiness,
                readiness_score=66 if harness_runtime_ready else (38 if harness_profiles_configured else 24),
                runtime_readiness="partial" if harness_runtime_ready else "planned",
                streaming_readiness="partial" if harness_streaming_ready else "planned",
                verify_probe_readiness=harness_verify_probe_readiness,
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="connection/auth/discovery/request/response/stream",
                verify_probe_axis="preview/verify/dry-run/probe available",
                observability_axis="integration/profile error axes active",
                ui_axis="harness onboarding + runs/history",
                status_summary=harness_status_summary,
                notes="Treat this as a broad integration axis with real runtime value, but not as full compatibility truth yet.",
            ),
            BetaProviderTarget(
                provider_key="ollama",
                provider_type="local",
                product_axis="local_providers",
                auth_model="none/local network",
                runtime_path="dedicated ollama template + local endpoint harness path",
                readiness="ready" if ollama_status["ready"] else "partial",
                readiness_score=72 if ollama_status["ready"] else 44,
                runtime_readiness="ready" if ollama_status["ready"] else "partial",
                streaming_readiness="ready" if ollama_status["ready"] else "partial",
                verify_probe_readiness="ready",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="connection/discovery/model availability",
                verify_probe_axis="verify/probe via local endpoint profile",
                observability_axis="provider/model/client integration errors",
                ui_axis="beta target table + harness profile template",
                status_summary=(
                    "Dedicated local runtime adapter and template are active."
                    if ollama_status["ready"]
                    else "Dedicated local axis with explicit template and control-plane lifecycle."
                ),
                notes="Dedicated Ollama axis explicitly in beta scope.",
            ),
            BetaProviderTarget(
                provider_key="openai_client_compat",
                provider_type="openai_compatible",
                product_axis="openai_compatible_clients",
                auth_model="forgegate key + provider routing",
                runtime_path="/v1/models + /v1/chat/completions + /v1/responses",
                readiness="partial",
                readiness_score=68,
                runtime_readiness="partial",
                streaming_readiness="partial",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="runtime + health traffic split",
                verify_probe_axis="harness + runtime validation",
                observability_axis="client/provider/model/profile/integration",
                ui_axis="usage + providers + harness",
                status_summary="Client compatibility is available, but /v1/responses and streaming fidelity remain partial.",
                notes="Do not present this axis as release-finished until native responses fidelity is complete.",
            ),
        ]
        return [item.model_dump() for item in targets]
