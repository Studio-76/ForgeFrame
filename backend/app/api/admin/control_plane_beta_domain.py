"""Expansion-target projection helpers for the control plane."""

from __future__ import annotations

from app.api.admin.control_plane_models import BetaProviderTarget


class ControlPlaneBetaDomainMixin:
    def beta_provider_targets(self) -> list[dict[str, object]]:
        codex_status = self._safe_provider_status("openai_codex")
        gemini_status = self._safe_provider_status("gemini")
        harness_status = self._safe_provider_status("generic_harness")
        ollama_status = self._safe_provider_status("ollama")
        antigravity_status = self._oauth_target_status("antigravity")
        copilot_status = self._oauth_target_status("github_copilot")
        claude_code_status = self._oauth_target_status("claude_code")
        targets = [
            BetaProviderTarget(
                provider_key="openai_codex",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key hybrid",
                runtime_path="native provider adapter",
                readiness="partial",
                readiness_score=62 if codex_status["ready"] else 48,
                runtime_readiness="partial" if self._settings.openai_codex_bridge_enabled else "planned",
                streaming_readiness="partial" if self._settings.openai_codex_bridge_enabled else "planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="provider + model health with auth readiness",
                verify_probe_axis="verify/probe supported",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + harness control plane",
                status_summary=(
                    "Codex is wired but still relies on partial bridge/runtime semantics."
                    if self._settings.openai_codex_bridge_enabled
                    else "Codex auth is wired, but runtime remains outside default release truth until bridge fidelity is complete."
                ),
                oauth_account_provider=True,
                notes="Existing path; keep marked partial until runtime, streaming and tool fidelity are release-grade.",
            ),
            BetaProviderTarget(
                provider_key="gemini",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key",
                runtime_path="native provider adapter",
                readiness="partial",
                readiness_score=52 if self._settings.gemini_probe_enabled else (46 if gemini_status["ready"] else 34),
                runtime_readiness="partial" if self._settings.gemini_probe_enabled else "planned",
                streaming_readiness="planned",
                verify_probe_readiness="ready" if self._settings.gemini_probe_enabled else "partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="provider/model discovery + auth readiness",
                verify_probe_axis="verify/probe supported via harness/runtime",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + usage + harness",
                status_summary=(
                    "Gemini probe/runtime bridge is available but still partial."
                    if self._settings.gemini_probe_enabled
                    else "Gemini credentials are modeled, but runtime truth remains partial until bridge/runtime depth is stronger."
                ),
                oauth_account_provider=True,
                notes="Keep Gemini explicitly partial until runtime fidelity moves beyond probe-first behavior.",
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
                verify_probe_readiness="ready" if antigravity_status.probe_enabled else "partial",
                ui_readiness="partial",
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
                verify_probe_readiness="ready" if copilot_status.probe_enabled else "partial",
                ui_readiness="partial",
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
                verify_probe_readiness="ready" if claude_code_status.probe_enabled else "partial",
                ui_readiness="partial",
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
                readiness="partial",
                readiness_score=66 if harness_status["ready"] else 52,
                runtime_readiness="partial",
                streaming_readiness="partial",
                verify_probe_readiness="ready",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="connection/auth/discovery/request/response/stream",
                verify_probe_axis="preview/verify/dry-run/probe available",
                observability_axis="integration/profile error axes active",
                ui_axis="harness onboarding + runs/history",
                status_summary="Generic harness is operational, but runtime compatibility and tool fidelity remain partial.",
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
