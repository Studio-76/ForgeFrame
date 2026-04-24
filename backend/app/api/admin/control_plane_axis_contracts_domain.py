"""Expansion-target projection helpers for the control plane."""

from __future__ import annotations

from app.api.admin.control_plane_models import OAuthAccountTargetStatus, ProductAxisTarget
from app.harness.templates import BUILTIN_TEMPLATES


_LOCAL_EXACT_PROVIDER_KEYS = ("localai", "llama_cpp", "llama_cpp_python", "vllm")


class ControlPlaneAxisContractsDomainMixin:
    @staticmethod
    def _bridge_only_verify_probe_readiness(status: OAuthAccountTargetStatus) -> str:
        if status.configured and status.probe_enabled and status.evidence.live_probe.status == "observed":
            return "ready"
        return "partial" if status.configured else "planned"

    def _local_provider_target(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
    ) -> ProductAxisTarget:
        template_id = f"openai_provider_{provider_key}"
        template = BUILTIN_TEMPLATES.get(template_id)
        if template is None:
            raise ValueError(f"Missing exact local provider template for {provider_key}")
        profiles = [
            profile
            for profile in self._harness.list_profiles()
            if profile.template_id == template_id and profile.enabled
        ]
        dispatchable_profiles = [profile for profile in profiles if profile.models]
        capabilities = template.profile_defaults.capabilities
        evidence = self._provider_capability_evidence(provider_key, tenant_id=tenant_id)
        readiness = "partial" if profiles else "planned"
        runtime_readiness = "partial" if dispatchable_profiles else "planned"
        streaming_readiness = "partial" if dispatchable_profiles and capabilities.streaming else "planned"
        verify_probe_readiness = "partial" if profiles else "planned"
        contract_classification = "partial-runtime" if dispatchable_profiles else "onboarding-only"
        profile_count = len(profiles)
        dispatchable_count = len(dispatchable_profiles)
        return ProductAxisTarget(
            provider_key=provider_key,
            provider_type="local",
            product_axis="local_providers",
            auth_model="none/local network" if template.profile_defaults.auth_scheme == "none" else template.profile_defaults.auth_scheme,
            runtime_path=f"exact local harness template '{template_id}'",
            contract_classification=contract_classification,
            classification_reason=(
                f"Exact local template '{template_id}' is shipped and {dispatchable_count} enabled profile(s) are dispatchable."
                if dispatchable_profiles
                else f"Exact local template '{template_id}' is shipped, but no enabled dispatchable profile is configured yet."
            ),
            technical_requirements=[
                "An exact local harness profile must be enabled for this provider.",
                "At least one enabled profile must own a concrete local model before runtime traffic can be routed.",
                "Local-only policy binding, endpoint health, and model inventory must stay visible on the operator surface.",
            ],
            operator_surface="/providers#harness-control",
            readiness=readiness,
            readiness_score=62 if dispatchable_profiles else (42 if profiles else 24),
            runtime_readiness=runtime_readiness,
            streaming_readiness=streaming_readiness,
            verify_probe_readiness=verify_probe_readiness,
            ui_readiness="partial",
            evidence=evidence,
            health_semantics="local endpoint reachability + model inventory + local-only policy binding",
            verify_probe_axis="exact local harness verify/probe path",
            observability_axis="provider/model/profile/local endpoint errors",
            ui_axis="provider catalog + harness control plane",
            status_summary=(
                f"{profile_count} enabled exact local profile(s) exist and {dispatchable_count} are dispatchable."
                if profiles
                else "Exact local template is shipped, but no enabled exact local profile exists yet."
            ),
            notes=(
                f"Template claims: responses={capabilities.responses}, embeddings={capabilities.embeddings}, "
                f"tool_calling={capabilities.tool_calling}, streaming={capabilities.streaming}. Live proof remains separate."
            ),
        )

    def product_axis_targets(self, tenant_id: str | None = None) -> list[dict[str, object]]:
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
        nous_oauth_status = self._oauth_target_status("nous_oauth", tenant_id=effective_tenant_id)
        qwen_oauth_status = self._oauth_target_status("qwen_oauth", tenant_id=effective_tenant_id)
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
            ProductAxisTarget(
                provider_key="openai_codex",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key hybrid",
                runtime_path="native provider adapter",
                contract_classification=(
                    "runtime-ready"
                    if codex_runtime_readiness == "ready"
                    and codex_streaming_readiness == "ready"
                    and codex_evidence.tool_calling.status == "observed"
                    else ("partial-runtime" if codex_oauth_status.configured and codex_oauth_status.runtime_bridge_enabled else "onboarding-only")
                ),
                classification_reason=(
                    "Codex native runtime traffic, streaming, and tool-call evidence are all recorded."
                    if codex_runtime_readiness == "ready"
                    and codex_streaming_readiness == "ready"
                    and codex_evidence.tool_calling.status == "observed"
                    else (
                        "Codex can accept runtime traffic, but the shipped contract remains partial until runtime, streaming, and tool-call evidence are all present."
                        if codex_oauth_status.configured and codex_oauth_status.runtime_bridge_enabled
                        else "Codex stays onboarding-only until credentials and the native runtime bridge are both enabled."
                    )
                ),
                technical_requirements=[
                    "Native runtime bridge must be enabled.",
                    "Live runtime and streaming evidence must both be recorded.",
                    "Tool-call evidence must be observed before the axis can claim full native runtime depth.",
                ],
                operator_surface="/oauth-targets",
                readiness="partial",
                readiness_score=78 if codex_runtime_readiness == "ready" else (62 if codex_status["ready"] else 48),
                runtime_readiness=codex_runtime_readiness,
                streaming_readiness=codex_streaming_readiness,
                verify_probe_readiness=codex_probe_readiness,
                ui_readiness="partial",
                evidence=codex_evidence,
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
            ProductAxisTarget(
                provider_key="gemini",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key",
                runtime_path="native provider adapter",
                contract_classification=(
                    "runtime-ready"
                    if gemini_runtime_readiness == "ready"
                    and gemini_streaming_readiness == "ready"
                    and gemini_evidence.tool_calling.status == "observed"
                    else ("partial-runtime" if gemini_oauth_status.configured and gemini_oauth_status.runtime_bridge_enabled else "onboarding-only")
                ),
                classification_reason=(
                    "Gemini native runtime traffic, streaming, and tool-call evidence are all recorded."
                    if gemini_runtime_readiness == "ready"
                    and gemini_streaming_readiness == "ready"
                    and gemini_evidence.tool_calling.status == "observed"
                    else (
                        "Gemini can accept runtime traffic, but the shipped contract remains partial until runtime, streaming, and tool-call evidence are all present."
                        if gemini_oauth_status.configured and gemini_oauth_status.runtime_bridge_enabled
                        else "Gemini stays onboarding-only until credentials and the native runtime bridge are both enabled."
                    )
                ),
                technical_requirements=[
                    "Probe/runtime bridge must be enabled.",
                    "Live runtime and streaming evidence must both be recorded.",
                    "Tool-call evidence must be observed before the axis can claim full native runtime depth.",
                ],
                operator_surface="/oauth-targets",
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
            ProductAxisTarget(
                provider_key="antigravity",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                contract_classification=(
                    "bridge-only"
                    if antigravity_status.configured or antigravity_status.probe_enabled or antigravity_status.harness_profile_enabled
                    else "onboarding-only"
                ),
                classification_reason="This target has no native runtime adapter in the current release truth and remains limited to bridge/profile operations.",
                technical_requirements=[
                    "Credentials must be configured before probe or bridge sync can run.",
                    "Probe success records bridge evidence only.",
                    "No native runtime route is exposed for this axis in the current release truth.",
                ],
                operator_surface="/oauth-targets",
                readiness=antigravity_status.readiness,
                readiness_score=58 if antigravity_status.readiness == "ready" else (42 if antigravity_status.readiness == "partial" else 24),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(antigravity_status),
                ui_readiness="partial",
                evidence=antigravity_status.evidence.model_copy(deep=True),
                health_semantics="auth + connection + discovery phases",
                verify_probe_axis="verify/probe planned on generic harness profile",
                observability_axis="integration/profile/client error axis",
                ui_axis="provider contract table + harness onboarding",
                status_summary=f"{antigravity_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            ProductAxisTarget(
                provider_key="github_copilot",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                contract_classification=(
                    "bridge-only"
                    if copilot_status.configured or copilot_status.probe_enabled or copilot_status.harness_profile_enabled
                    else "onboarding-only"
                ),
                classification_reason="This target has no native runtime adapter in the current release truth and remains limited to bridge/profile operations.",
                technical_requirements=[
                    "Credentials must be configured before probe or bridge sync can run.",
                    "Probe success records bridge evidence only.",
                    "No native runtime route is exposed for this axis in the current release truth.",
                ],
                operator_surface="/oauth-targets",
                readiness=copilot_status.readiness,
                readiness_score=58 if copilot_status.readiness == "ready" else (42 if copilot_status.readiness == "partial" else 23),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(copilot_status),
                ui_readiness="partial",
                evidence=copilot_status.evidence.model_copy(deep=True),
                health_semantics="auth/session readiness + probe",
                verify_probe_axis="verify/probe planned with profile template",
                observability_axis="client/integration/profile errors",
                ui_axis="provider contract table",
                status_summary=f"{copilot_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            ProductAxisTarget(
                provider_key="claude_code",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                contract_classification=(
                    "bridge-only"
                    if claude_code_status.configured or claude_code_status.probe_enabled or claude_code_status.harness_profile_enabled
                    else "onboarding-only"
                ),
                classification_reason="This target has no native runtime adapter in the current release truth and remains limited to bridge/profile operations.",
                technical_requirements=[
                    "Credentials must be configured before probe or bridge sync can run.",
                    "Probe success records bridge evidence only.",
                    "No native runtime route is exposed for this axis in the current release truth.",
                ],
                operator_surface="/oauth-targets",
                readiness=claude_code_status.readiness,
                readiness_score=58 if claude_code_status.readiness == "ready" else (42 if claude_code_status.readiness == "partial" else 23),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(claude_code_status),
                ui_readiness="partial",
                evidence=claude_code_status.evidence.model_copy(deep=True),
                health_semantics="auth + request rendering + mapping",
                verify_probe_axis="verify/probe planned",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="provider contract table",
                status_summary=f"{claude_code_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="No default runtime truth for this axis yet; keep it positioned as onboarding or bridge-only.",
            ),
            ProductAxisTarget(
                provider_key="nous_oauth",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account + minted runtime agent key",
                runtime_path="generic openai-compatible harness with separate runtime credential truth",
                contract_classification=(
                    "bridge-only"
                    if nous_oauth_status.configured or nous_oauth_status.probe_enabled or nous_oauth_status.harness_profile_enabled
                    else "onboarding-only"
                ),
                classification_reason=(
                    "Nous keeps a separate account-token and runtime-agent-key truth, so this release only ships onboarding/bridge semantics."
                ),
                technical_requirements=[
                    "Portal/account token must be configured for onboarding and account truth.",
                    "A separate minted runtime agent key must exist before bridge/runtime proof can be trusted.",
                    "Probe or profile sync must not flatten the account token into API-key truth.",
                ],
                operator_surface="/oauth-targets",
                readiness=nous_oauth_status.readiness,
                readiness_score=58 if nous_oauth_status.readiness == "ready" else (42 if nous_oauth_status.readiness == "partial" else 22),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(nous_oauth_status),
                ui_readiness="partial",
                evidence=nous_oauth_status.evidence.model_copy(deep=True),
                health_semantics="portal auth + bridge credential separation",
                verify_probe_axis="bridge probe only after minted runtime credential exists",
                observability_axis="oauth account + bridge profile + runtime credential gap",
                ui_axis="provider contract table + oauth onboarding",
                status_summary=f"{nous_oauth_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="Do not collapse Nous account OAuth into a normal API-key provider. Runtime proof depends on a separate agent key path.",
            ),
            ProductAxisTarget(
                provider_key="qwen_oauth",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account with mandatory QwenCode headers",
                runtime_path="generic openai-compatible harness with portal-specific request headers",
                contract_classification=(
                    "bridge-only"
                    if qwen_oauth_status.configured or qwen_oauth_status.probe_enabled or qwen_oauth_status.harness_profile_enabled
                    else "onboarding-only"
                ),
                classification_reason=(
                    "Qwen OAuth remains a portal-backed bridge target; required QwenCode/DashScope headers block any flat API-key interpretation."
                ),
                technical_requirements=[
                    "Portal OAuth token must be configured before probe or profile sync can run.",
                    "Every bridge request must carry the required QwenCode/DashScope headers.",
                    "Probe success records bridge evidence only and must not promote the target to native runtime-ready truth.",
                ],
                operator_surface="/oauth-targets",
                readiness=qwen_oauth_status.readiness,
                readiness_score=58 if qwen_oauth_status.readiness == "ready" else (42 if qwen_oauth_status.readiness == "partial" else 22),
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness=self._bridge_only_verify_probe_readiness(qwen_oauth_status),
                ui_readiness="partial",
                evidence=qwen_oauth_status.evidence.model_copy(deep=True),
                health_semantics="portal auth + header fidelity + bridge probe truth",
                verify_probe_axis="bridge probe only with portal-specific headers",
                observability_axis="oauth account + bridge profile + header correctness",
                ui_axis="provider contract table + oauth onboarding",
                status_summary=f"{qwen_oauth_status.readiness_reason} Runtime remains onboarding/bridge-only in the current release truth.",
                oauth_account_provider=True,
                notes="Treat Qwen OAuth as its own premium portal provider, not as a normal DashScope API-key route.",
            ),
            ProductAxisTarget(
                provider_key="openai_compatible_generic",
                provider_type="openai_compatible",
                product_axis="openai_compatible_providers",
                auth_model="api_key_header/bearer/none",
                runtime_path="generic_harness openai-compatible profile",
                contract_classification="partial-runtime" if harness_runtime_ready else "onboarding-only",
                classification_reason=(
                    "Enabled harness profiles can serve OpenAI-compatible runtime traffic, but fidelity remains partial."
                    if harness_runtime_ready
                    else "This axis stays onboarding-only until a dispatchable OpenAI-compatible profile is configured."
                ),
                technical_requirements=[
                    "At least one enabled OpenAI-compatible harness profile must own a runtime model.",
                    "Public runtime proof must be recorded per exact model before the public inventory can expose it.",
                    "Streaming and tool fidelity remain partial until the full proof set is recorded.",
                ],
                operator_surface="/providers#harness-control",
                readiness=harness_readiness,
                readiness_score=66 if harness_runtime_ready else (38 if harness_profiles_configured else 24),
                runtime_readiness="partial" if harness_runtime_ready else "planned",
                streaming_readiness="partial" if harness_streaming_ready else "planned",
                verify_probe_readiness=harness_verify_probe_readiness,
                ui_readiness="partial",
                health_semantics="connection/auth/discovery/request/response/stream",
                verify_probe_axis="preview/verify/dry-run/probe available",
                observability_axis="integration/profile error axes active",
                ui_axis="harness onboarding + runs/history",
                status_summary=harness_status_summary,
                notes="Treat this as a broad integration axis with real runtime value, but not as full compatibility truth yet.",
            ),
            ProductAxisTarget(
                provider_key="ollama",
                provider_type="local",
                product_axis="local_providers",
                auth_model="none/local network",
                runtime_path="dedicated ollama template + local endpoint harness path",
                contract_classification="runtime-ready" if ollama_status["ready"] else "partial-runtime",
                classification_reason=(
                    "Dedicated local runtime adapter and template are active."
                    if ollama_status["ready"]
                    else "The dedicated local axis exists, but runtime proof is incomplete or the local endpoint is not ready."
                ),
                technical_requirements=[
                    "The local Ollama endpoint must be reachable.",
                    "The dedicated adapter must expose runtime and streaming truth.",
                    "Health and discovery state must stay visible on the provider surface.",
                ],
                operator_surface="/providers#provider-health-runs",
                readiness="ready" if ollama_status["ready"] else "partial",
                readiness_score=72 if ollama_status["ready"] else 44,
                runtime_readiness="ready" if ollama_status["ready"] else "partial",
                streaming_readiness="ready" if ollama_status["ready"] else "partial",
                verify_probe_readiness="ready",
                ui_readiness="partial",
                health_semantics="connection/discovery/model availability",
                verify_probe_axis="verify/probe via local endpoint profile",
                observability_axis="provider/model/client integration errors",
                ui_axis="provider contract table + harness profile template",
                status_summary=(
                    "Dedicated local runtime adapter and template are active."
                    if ollama_status["ready"]
                    else "Dedicated local axis with explicit template and control-plane lifecycle."
                ),
                notes="Dedicated Ollama axis is shipped as a first-class local contract with explicit runtime truth.",
            ),
            *[
                self._local_provider_target(provider_key, tenant_id=effective_tenant_id)
                for provider_key in _LOCAL_EXACT_PROVIDER_KEYS
            ],
            ProductAxisTarget(
                provider_key="openai_client_compat",
                provider_type="openai_compatible",
                product_axis="openai_compatible_clients",
                auth_model="ForgeFrame runtime key + provider routing",
                runtime_path="/v1/models + /v1/chat/completions + /v1/responses",
                contract_classification="partial-runtime",
                classification_reason="The public OpenAI-compatible surface is live, but responses, streaming, and unsupported-path fidelity still remain partial.",
                technical_requirements=[
                    "Public model inventory must match actually routable models.",
                    "Streaming, tools, and unsupported paths must map to typed public error semantics.",
                    "Native /v1/responses semantics must stay truthful instead of collapsing back to chat-shim behavior.",
                ],
                operator_surface="/providers#provider-health-runs",
                readiness="partial",
                readiness_score=68,
                runtime_readiness="partial",
                streaming_readiness="partial",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                health_semantics="runtime + health traffic split",
                verify_probe_axis="harness + runtime validation",
                observability_axis="client/provider/model/profile/integration",
                ui_axis="usage + providers + harness",
                status_summary="Client compatibility is available, but /v1/responses and streaming fidelity remain partial.",
                notes="Do not present this axis as release-finished until native responses fidelity is complete.",
            ),
        ]
        return [item.model_dump() for item in targets]
