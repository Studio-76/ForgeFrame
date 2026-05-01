"""OAuth target status, probe, and bridge-profile behavior."""

from __future__ import annotations

import platform
from datetime import UTC, datetime
from typing import Literal

import httpx

from app.api.admin.control_plane_models import (
    OAuthAccountProbeResult,
    OAuthAccountTargetStatus,
    OAuthTargetActionSpec,
    OAuthTargetSetupGuide,
)
from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.auth.oauth.openai import resolve_codex_auth_state
from app.harness import HarnessProviderProfile
from app.settings.config import OAUTH_TARGET_PROVIDER_LABELS, oauth_target_env_contract

_NATIVE_OAUTH_TARGET_KEYS = ("openai_codex", "gemini")
_BRIDGE_OAUTH_TARGET_KEYS = (
    "antigravity",
    "github_copilot",
    "claude_code",
    "nous_oauth",
    "qwen_oauth",
)
_BRIDGE_OAUTH_TOKEN_ATTRS = {
    "antigravity": "antigravity_oauth_access_token",
    "github_copilot": "github_copilot_oauth_access_token",
    "claude_code": "claude_code_oauth_access_token",
    "nous_oauth": "nous_oauth_access_token",
    "qwen_oauth": "qwen_oauth_access_token",
}


def _qwen_oauth_headers() -> dict[str, str]:
    os_name = platform.system() or "unknown-os"
    machine = platform.machine() or "unknown-arch"
    user_agent = f"QwenCode/0.14.1 ({os_name}; {machine})"
    return {
        "User-Agent": user_agent,
        "X-DashScope-CacheControl": "enable",
        "X-DashScope-UserAgent": user_agent,
        "X-DashScope-AuthType": "qwen-oauth",
    }


class ControlPlaneOAuthTargetsDomainMixin:
    @staticmethod
    def _oauth_target_provider_label(provider_key: str) -> str:
        return OAUTH_TARGET_PROVIDER_LABELS.get(provider_key, provider_key)

    @staticmethod
    def _oauth_operation_is_newer(candidate_at: str | None, baseline_at: str | None) -> bool:
        if not candidate_at:
            return False
        if not baseline_at:
            return True
        try:
            return datetime.fromisoformat(candidate_at) >= datetime.fromisoformat(baseline_at)
        except ValueError:
            return True

    @staticmethod
    def _oauth_failure_status(
        details: str,
    ) -> Literal["probe failed", "expired", "needs refresh"]:
        normalized = details.lower()
        if "expired" in normalized or "revoked" in normalized:
            return "expired"
        if "refresh" in normalized or "401" in normalized or "unauthoriz" in normalized or "invalid token" in normalized:
            return "needs refresh"
        return "probe failed"

    @staticmethod
    def _oauth_target_contract_classification(
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> str:
        if provider_key in _NATIVE_OAUTH_TARGET_KEYS:
            if status.readiness == "ready":
                return "runtime-ready"
            if status.configured and status.runtime_bridge_enabled:
                return "partial-runtime"
            return "onboarding-only"
        if status.configured or status.probe_enabled or status.harness_profile_enabled:
            return "bridge-only"
        return "onboarding-only"

    @staticmethod
    def _oauth_target_queue_lane(contract_classification: str) -> str:
        if contract_classification in {"runtime-ready", "partial-runtime"}:
            return "sync_interactive"
        if contract_classification == "bridge-only":
            return "bridge_probe_only"
        return "not_applicable"

    @staticmethod
    def _oauth_target_parallelism_mode(contract_classification: str) -> str:
        return "not_applicable" if contract_classification == "onboarding-only" else "not_enforced"

    @staticmethod
    def _oauth_target_cost_posture(auth_kind: str) -> str:
        if auth_kind == "oauth_account":
            return "avoided-cost is tracked while direct provider billing stays outside ForgeFrame."
        return "API-key traffic is metered directly in ForgeFrame usage and cost summaries."

    @staticmethod
    def _native_oauth_bridge_path_enabled(status: OAuthAccountTargetStatus) -> bool:
        return status.runtime_bridge_enabled or status.probe_enabled

    @staticmethod
    def _native_oauth_disabled_evidence_suffix(status: OAuthAccountTargetStatus) -> str:
        if status.evidence.runtime.status == "observed" and status.evidence.live_probe.status == "observed":
            return " Historical live runtime and probe evidence remain recorded from an earlier enabled state."
        if status.evidence.runtime.status == "observed":
            return " Historical live runtime evidence remains recorded from an earlier enabled state."
        if status.evidence.live_probe.status == "observed":
            return " Historical live probe evidence remains recorded from an earlier enabled state."
        return ""

    def _bridge_oauth_target_config(self, provider_key: str) -> dict[str, object]:
        if provider_key not in _BRIDGE_OAUTH_TARGET_KEYS:
            raise ValueError(f"Unsupported bridge oauth/account target: {provider_key}")
        return {
            "token": getattr(self._settings, _BRIDGE_OAUTH_TOKEN_ATTRS[provider_key]),
            "probe_enabled": getattr(self._settings, f"{provider_key}_probe_enabled"),
            "bridge_enabled": getattr(self._settings, f"{provider_key}_bridge_profile_enabled"),
            "base_url": getattr(self._settings, f"{provider_key}_probe_base_url"),
            "model": getattr(self._settings, f"{provider_key}_probe_model"),
            "runtime_agent_key": getattr(self._settings, "nous_oauth_runtime_agent_key", "") if provider_key == "nous_oauth" else "",
        }

    @staticmethod
    def _bridge_oauth_target_session_reuse_strategy(provider_key: str) -> str:
        if provider_key == "nous_oauth":
            return (
                "Portal access token proves account truth only; runtime should use a separately minted agent key "
                "(Nous runtime key) "
                "before the TTL floor, but ForgeFrame does not mint or refresh that key yet."
            )
        if provider_key == "qwen_oauth":
            return "Pre-issued Qwen portal OAuth token is forwarded with required QwenCode/DashScope headers; ForgeFrame does not own the upstream OAuth refresh cycle."
        return "Pre-issued OAuth access token is forwarded through bridge/profile operations only; no managed refresh or session reuse contract exists."

    @staticmethod
    def _bridge_oauth_target_operator_truth(provider_key: str) -> str:
        if provider_key == "nous_oauth":
            return (
                "ForgeFrame can expose Nous account/onboarding truth and bridge profiles, but native runtime truth still "
                "depends on a separately minted agent key (Nous runtime key) rather than flattening the account token into "
                "a normal API key."
            )
        if provider_key == "qwen_oauth":
            return (
                "ForgeFrame treats Qwen as a portal-backed OAuth provider with mandatory QwenCode/DashScope headers; "
                "no native runtime lane is shipped yet and DashScope API-key semantics must not replace that truth."
            )
        return "ForgeFrame can probe or sync bridge profiles for this target, but no native runtime lane is shipped for it in the current release truth."

    def _bridge_oauth_probe_headers(self, provider_key: str, token: str) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        if provider_key == "qwen_oauth":
            headers.update(_qwen_oauth_headers())
        return headers

    def _bridge_oauth_profile_request_headers(self, provider_key: str) -> dict[str, str]:
        if provider_key == "qwen_oauth":
            return _qwen_oauth_headers()
        return {}

    def _latest_provider_oauth_operation(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ):
        operations = [item for item in self._oauth_operations(tenant_id, instance_id) if item.provider_key == provider_key]
        return operations[-1] if operations else None

    def _latest_failed_oauth_operation(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ):
        operations = [item for item in self._oauth_operations(tenant_id, instance_id) if item.provider_key == provider_key and item.status == "failed"]
        return operations[-1] if operations else None

    def _oauth_target_connection_method(
        self,
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> str:
        if provider_key == "openai_codex":
            if status.auth_kind == "api_key":
                return "API-key mode only; ForgeFrame is not running Codex OAuth on this instance."
            oauth_mode = status.oauth_mode or "manual_redirect_completion"
            if oauth_mode == "device_hosted_code":
                return "Codex OAuth via externally completed device/hosted-code flow and a pre-issued access token."
            if oauth_mode == "browser_callback":
                return "Codex OAuth is configured for browser-callback semantics, but ForgeFrame still expects an externally supplied token."
            return "Codex OAuth via manual redirect completion with an externally supplied access token."
        if provider_key == "gemini":
            if status.auth_kind == "api_key":
                return "API-key mode only; Gemini OAuth/session semantics are not active on this instance."
            return "Gemini OAuth via externally supplied access token; ForgeFrame does not mint or refresh it."
        if provider_key == "nous_oauth":
            return "Bridge-only portal OAuth token plus separate Nous runtime agent key for live runtime proof."
        if provider_key == "qwen_oauth":
            return "Bridge-only portal OAuth token with mandatory QwenCode/DashScope request headers."
        return "Bridge-only portal OAuth token forwarded through probe and harness bridge profile paths."

    def _oauth_target_setup_guide(
        self,
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> OAuthTargetSetupGuide:
        env_contract = oauth_target_env_contract(provider_key, auth_mode=status.auth_kind)
        required_env_vars = list(env_contract["required"])
        optional_env_vars = list(env_contract["optional"])
        missing_env_vars: list[str] = []
        if not status.configured:
            missing_env_vars.extend(required_env_vars)
        if provider_key in _NATIVE_OAUTH_TARGET_KEYS and not status.runtime_bridge_enabled:
            bridge_flag = "FORGEFRAME_OPENAI_CODEX_BRIDGE_ENABLED" if provider_key == "openai_codex" else "FORGEFRAME_GEMINI_PROBE_ENABLED"
            if bridge_flag not in missing_env_vars:
                missing_env_vars.append(bridge_flag)
        if provider_key in _BRIDGE_OAUTH_TARGET_KEYS and not status.probe_enabled:
            probe_flag = f"FORGEFRAME_{provider_key.upper()}_PROBE_ENABLED"
            if probe_flag not in missing_env_vars:
                missing_env_vars.append(probe_flag)
        if provider_key in _BRIDGE_OAUTH_TARGET_KEYS and not status.harness_profile_enabled:
            sync_flag = f"FORGEFRAME_{provider_key.upper()}_BRIDGE_PROFILE_ENABLED"
            if sync_flag not in missing_env_vars:
                missing_env_vars.append(sync_flag)
        if provider_key == "nous_oauth" and not self._settings.nous_oauth_runtime_agent_key.strip():
            required_agent_key = "FORGEFRAME_NOUS_OAUTH_RUNTIME_AGENT_KEY"
            if required_agent_key not in missing_env_vars:
                missing_env_vars.append(required_agent_key)

        provider_label = self._oauth_target_provider_label(provider_key)
        summary = f"{provider_label} is configured externally through ForgeFrame env settings. This page shows the exact contract, but it does not write or rotate upstream OAuth tokens."
        steps = [f"Set the required env vars for {provider_label} outside ForgeFrame and reload the runtime."]
        if provider_key == "openai_codex" and status.auth_kind == "oauth_account":
            oauth_mode = status.oauth_mode or "manual_redirect_completion"
            if oauth_mode == "device_hosted_code":
                steps.append("Complete the device/hosted-code flow outside ForgeFrame, then place the resulting token into FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN.")
            elif oauth_mode == "browser_callback":
                steps.append("Use an external callback-capable tool to obtain the token; ForgeFrame does not accept the redirect or exchange the code itself.")
            else:
                steps.append("Complete the manual redirect flow outside ForgeFrame, then place the resulting token into FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN.")
        if provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
            steps.append("Use bridge profile sync only after the base URL, token, and probe model reflect the real upstream runtime lane.")
        if status.configured:
            steps.append("Use 'Verbindung testen' after setup changes so the page records a fresh probe result.")
        return OAuthTargetSetupGuide(
            summary=summary,
            required_env_vars=required_env_vars,
            optional_env_vars=optional_env_vars,
            missing_env_vars=missing_env_vars,
            steps=steps,
        )

    def _oauth_target_actions(
        self,
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> list[OAuthTargetActionSpec]:
        actions: list[OAuthTargetActionSpec] = []
        if provider_key == "openai_codex":
            if status.auth_kind == "oauth_account":
                actions.append(
                    OAuthTargetActionSpec(
                        action_key="manual_token",
                        label="Manuell Token hinterlegen",
                        mode="manual",
                        supported=True,
                        detail="ForgeFrame expects a pre-issued Codex OAuth token in the runtime env and does not acquire it itself.",
                    )
                )
                if status.oauth_mode == "device_hosted_code":
                    actions.append(
                        OAuthTargetActionSpec(
                            action_key="device_code",
                            label="Device-Code starten",
                            mode="unsupported",
                            supported=False,
                            detail="Codex device/hosted-code is documented only. ForgeFrame does not start or complete that flow yet.",
                        )
                    )
                else:
                    actions.append(
                        OAuthTargetActionSpec(
                            action_key="connect",
                            label="Verbinden",
                            mode="unsupported",
                            supported=False,
                            detail="ForgeFrame does not ship an in-product Codex OAuth connect flow. Use the manual token path instead.",
                        )
                    )
            else:
                actions.append(
                    OAuthTargetActionSpec(
                        action_key="manual_token",
                        label="Auf OAuth umstellen",
                        mode="manual",
                        supported=True,
                        detail="Switch FORGEFRAME_OPENAI_CODEX_AUTH_MODE=oauth and supply FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN outside ForgeFrame.",
                    )
                )
        elif provider_key == "gemini":
            actions.append(
                OAuthTargetActionSpec(
                    action_key="manual_token",
                    label="Manuell Token hinterlegen",
                    mode="manual",
                    supported=True,
                    detail=(
                        "Gemini OAuth is externally supplied only."
                        if status.auth_kind == "oauth_account"
                        else "Switch FORGEFRAME_GEMINI_AUTH_MODE=oauth and provide FORGEFRAME_GEMINI_OAUTH_ACCESS_TOKEN outside ForgeFrame."
                    ),
                )
            )
        else:
            actions.append(
                OAuthTargetActionSpec(
                    action_key="manual_token",
                    label="Manuell Token hinterlegen",
                    mode="manual",
                    supported=True,
                    detail="Bridge-only providers still rely on externally supplied portal tokens; ForgeFrame does not mint or refresh them.",
                )
            )
            actions.append(
                OAuthTargetActionSpec(
                    action_key="bridge_sync",
                    label="Bridge-Profil synchronisieren",
                    mode="api",
                    supported=True,
                    detail="Upserts or refreshes the saved harness bridge profile for this provider.",
                )
            )
        actions.append(
            OAuthTargetActionSpec(
                action_key="probe",
                label="Verbindung testen",
                mode="api",
                supported=True,
                detail="Runs the real probe path for this target. This is a test, not a connect or login action.",
            )
        )
        actions.append(
            OAuthTargetActionSpec(
                action_key="disconnect",
                label="Trennen",
                mode="manual",
                supported=True,
                detail="Remove or replace the relevant env token outside ForgeFrame and reload the runtime; no in-product disconnect API exists.",
            )
        )
        return actions

    def _hydrate_oauth_target_surface(
        self,
        status: OAuthAccountTargetStatus,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> OAuthAccountTargetStatus:
        provider_key = status.provider_key
        latest_probe = self.latest_oauth_operation(
            provider_key,
            action="probe",
            tenant_id=tenant_id,
            instance_id=instance_id,
        )
        latest_bridge_sync = self.latest_oauth_operation(
            provider_key,
            action="bridge_sync",
            tenant_id=tenant_id,
            instance_id=instance_id,
        )
        latest_failed = self._latest_failed_oauth_operation(
            provider_key,
            tenant_id=tenant_id,
            instance_id=instance_id,
        )
        latest_operation = self._latest_provider_oauth_operation(
            provider_key,
            tenant_id=tenant_id,
            instance_id=instance_id,
        )

        status.provider_label = self._oauth_target_provider_label(provider_key)
        status.connection_method = self._oauth_target_connection_method(provider_key, status)
        status.setup = self._oauth_target_setup_guide(provider_key, status)
        status.actions = self._oauth_target_actions(provider_key, status)
        status.last_probe = self._oauth_operation_snapshot(latest_probe)
        status.last_bridge_sync = self._oauth_operation_snapshot(latest_bridge_sync)
        status.last_failed_operation = self._oauth_operation_snapshot(latest_failed)

        if provider_key in _NATIVE_OAUTH_TARGET_KEYS and status.auth_kind == "api_key":
            status.connection_status = "oauth unsupported"
            status.connection_status_reason = f"{status.provider_label} is currently in API-key mode, so this page cannot claim an active OAuth connection."
        elif not status.configured:
            status.connection_status = "not configured"
            status.connection_status_reason = status.readiness_reason
        elif latest_operation is not None and latest_operation.status == "failed":
            status.connection_status = self._oauth_failure_status(latest_operation.details)
            status.connection_status_reason = latest_operation.details
        elif status.readiness == "ready" and status.contract_classification == "runtime-ready":
            status.connection_status = "runtime-ready"
            status.connection_status_reason = status.readiness_reason
        elif status.contract_classification == "bridge-only":
            status.connection_status = "bridge-only"
            status.connection_status_reason = status.readiness_reason
        else:
            status.connection_status = "token present"
            status.connection_status_reason = status.readiness_reason

        if latest_failed is not None and latest_operation is not None and latest_operation.status == "failed":
            status.connection_status_reason = latest_failed.details
        status.next_step = self._oauth_target_next_steps(provider_key, status)[0]
        return status

    def _oauth_target_next_steps(self, provider_key: str, status: OAuthAccountTargetStatus) -> list[str]:
        steps: list[str] = []
        if not status.configured:
            steps.append(f"Configure credentials or OAuth access token for {provider_key}.")
        if not status.probe_enabled:
            steps.append(f"Enable live probe support for {provider_key}.")
        if not status.runtime_bridge_enabled and provider_key in _NATIVE_OAUTH_TARGET_KEYS:
            steps.append(f"Enable native runtime bridge for {provider_key}.")
        if status.configured and status.evidence.live_probe.status != "observed" and provider_key in _NATIVE_OAUTH_TARGET_KEYS:
            steps.append(f"Run an explicit live probe for {provider_key} so the control plane can promote the route beyond credentials-only readiness.")
        if status.configured and status.evidence.runtime.status != "observed" and provider_key in _NATIVE_OAUTH_TARGET_KEYS:
            steps.append(f"Send a real runtime request through {provider_key} to record live non-stream evidence.")
        if not status.harness_profile_enabled and provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
            steps.append(f"Enable OAuth bridge profile sync for {provider_key}.")
        if provider_key == "nous_oauth":
            runtime_agent_key = str(self._bridge_oauth_target_config(provider_key)["runtime_agent_key"]).strip()
            if not runtime_agent_key:
                steps.append("Provide a minted Nous runtime agent key; account OAuth token alone must not be treated as runtime proof.")
        if provider_key == "qwen_oauth":
            steps.append("Keep the QwenCode/DashScope header set attached to every bridge probe and bridge profile request.")
        if not steps:
            if provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
                steps.append(f"Keep {provider_key} positioned as onboarding/bridge-only; probe success does not promote it to native runtime-ready truth.")
            else:
                steps.append(f"{provider_key} is operational; verify UI and runtime behavior against live upstreams.")
        return steps

    @staticmethod
    def _oauth_target_operational_depth(
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> str:
        if provider_key in _NATIVE_OAUTH_TARGET_KEYS and not ControlPlaneOAuthTargetsDomainMixin._native_oauth_bridge_path_enabled(status):
            if status.evidence.runtime.status == "observed" and status.evidence.live_probe.status == "observed":
                return "path_disabled_runtime_and_probe_evidenced"
            if status.evidence.runtime.status == "observed":
                return "path_disabled_runtime_evidenced"
            if status.evidence.live_probe.status == "observed":
                return "path_disabled_probe_evidenced"
        if status.evidence.runtime.status == "observed" and status.evidence.live_probe.status == "observed":
            return "runtime_and_probe_evidenced"
        if status.evidence.runtime.status == "observed":
            return "runtime_evidenced"
        if status.evidence.live_probe.status == "observed":
            return "bridge_probe_evidenced" if provider_key in _BRIDGE_OAUTH_TARGET_KEYS else "probe_evidenced"
        if status.runtime_bridge_enabled and status.probe_enabled:
            return "runtime_path_configured"
        if status.harness_profile_enabled or status.probe_enabled:
            return "bridge_path_configured"
        if status.configured:
            return "credentials_only"
        return "not_configured"

    def list_oauth_account_target_statuses(
        self,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> list[dict[str, object]]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        scoped_instance_id = (instance_id or "").strip() or None
        providers = [*_NATIVE_OAUTH_TARGET_KEYS, *_BRIDGE_OAUTH_TARGET_KEYS]
        statuses: list[dict[str, object]] = []
        for provider_key in providers:
            if provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
                statuses.append(
                    self._oauth_target_status(
                        provider_key,
                        tenant_id=effective_tenant_id,
                        instance_id=scoped_instance_id,
                    ).model_dump()
                )
                continue
            status = self._native_oauth_target_status(
                provider_key,
                tenant_id=effective_tenant_id,
                instance_id=scoped_instance_id,
            )
            statuses.append(status.model_dump())
        return statuses

    def oauth_account_onboarding_summary(
        self,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> dict[str, object]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        targets = []
        for item in self.list_oauth_account_target_statuses(
            tenant_id=effective_tenant_id,
            instance_id=instance_id,
        ):
            status = OAuthAccountTargetStatus(**item)
            targets.append({
                **status.model_dump(),
                "next_steps": self._oauth_target_next_steps(status.provider_key, status),
                "operational_depth": self._oauth_target_operational_depth(status.provider_key, status),
            })
        return {
            "status": "ok",
            "targets": targets,
            "tenant_id": effective_tenant_id,
            "instance_id": (instance_id or "").strip() or None,
        }

    def _native_oauth_target_status(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> OAuthAccountTargetStatus:
        if provider_key == "openai_codex":
            auth_state = resolve_codex_auth_state(self._settings)
            configured = auth_state.ready
            runtime_bridge_enabled = self._settings.openai_codex_bridge_enabled
            probe_enabled = runtime_bridge_enabled
        elif provider_key == "gemini":
            auth_state = resolve_gemini_auth_state(self._settings)
            configured = auth_state.ready
            runtime_bridge_enabled = self._settings.gemini_probe_enabled
            probe_enabled = self._settings.gemini_probe_enabled
        else:
            raise ValueError(f"Unsupported native oauth/account target: {provider_key}")

        auth_kind: Literal["oauth_account", "api_key"] = "oauth_account" if auth_state.auth_mode == "oauth" else "api_key"
        provider_status = self._safe_provider_status(provider_key)
        provider_ready = bool(provider_status.get("ready"))
        provider_reason = str(provider_status.get("readiness_reason") or "")
        evidence = self._provider_capability_evidence(
            provider_key,
            tenant_id=tenant_id,
            instance_id=instance_id,
        )
        readiness: Literal["planned", "partial", "ready"] = "planned"
        reason = "OAuth/account credentials missing."
        if configured:
            readiness = "partial"
            if runtime_bridge_enabled and not provider_ready and provider_reason:
                reason = provider_reason
            elif provider_key == "openai_codex" and auth_state.auth_mode == "oauth":
                reason = f"Codex OAuth mode '{auth_state.oauth_mode}' is configured via a pre-issued access token, but no live probe or runtime evidence is recorded yet."
            else:
                reason = "Credentials are configured, but no live probe or runtime evidence is recorded yet."
        if configured and runtime_bridge_enabled and provider_ready and evidence.live_probe.status == "observed":
            readiness = "ready"
            reason = str(evidence.live_probe.details)
        elif configured and runtime_bridge_enabled and provider_ready and evidence.runtime.status == "observed":
            readiness = "ready"
            reason = "Live runtime traffic is recorded for this provider."

        if configured and not runtime_bridge_enabled:
            if provider_key == "openai_codex" and auth_state.auth_mode == "oauth":
                reason = f"Codex OAuth mode '{auth_state.oauth_mode}' is configured, but the native runtime bridge is still disabled."
            else:
                reason = "Credentials are configured, but the native runtime bridge is still disabled."
        contract_classification = self._oauth_target_contract_classification(
            provider_key,
            OAuthAccountTargetStatus(
                provider_key=provider_key,
                configured=configured,
                runtime_bridge_enabled=runtime_bridge_enabled,
                probe_enabled=probe_enabled,
                harness_profile_enabled=False,
                contract_classification="onboarding-only",
                queue_lane="not_applicable",
                parallelism_mode="not_applicable",
                parallelism_limit=None,
                session_reuse_strategy="unknown",
                escalation_support="not_modeled_in_oauth_axis",
                cost_posture="unknown",
                operator_surface="/oauth-targets",
                operator_truth="",
                readiness=readiness,
                readiness_reason=reason,
                auth_kind=auth_kind,
                oauth_mode=(auth_state.oauth_mode if provider_key == "openai_codex" and auth_state.auth_mode == "oauth" else None),
                oauth_flow_support=(auth_state.oauth_flow_support if provider_key == "openai_codex" and auth_state.auth_mode == "oauth" else None),
                evidence=evidence,
            ),
        )
        session_reuse_strategy = (
            "pre-issued OAuth access token is forwarded per request; ForgeFrame does not mint, refresh, or reuse a managed session."
            if auth_state.auth_mode == "oauth"
            else "API key is forwarded per request; no ForgeFrame-managed session reuse exists for this target."
        )
        operator_truth = (
            auth_state.oauth_operator_truth
            if provider_key == "openai_codex" and auth_state.auth_mode == "oauth"
            else (
                "ForgeFrame consumes a pre-issued Gemini OAuth access token and does not initiate or refresh that OAuth flow itself."
                if provider_key == "gemini" and auth_state.auth_mode == "oauth"
                else "ForgeFrame uses direct API-key mode for this target; OAuth session semantics do not apply."
            )
        )
        status = OAuthAccountTargetStatus(
            provider_key=provider_key,
            provider_label=self._oauth_target_provider_label(provider_key),
            configured=configured,
            runtime_bridge_enabled=runtime_bridge_enabled,
            probe_enabled=probe_enabled,
            harness_profile_enabled=False,
            contract_classification=contract_classification,  # type: ignore[arg-type]
            queue_lane=self._oauth_target_queue_lane(contract_classification),  # type: ignore[arg-type]
            parallelism_mode=self._oauth_target_parallelism_mode(contract_classification),  # type: ignore[arg-type]
            parallelism_limit=None,
            session_reuse_strategy=session_reuse_strategy,
            escalation_support="not_modeled_in_oauth_axis",
            cost_posture=self._oauth_target_cost_posture(auth_kind),
            operator_surface="/oauth-targets",
            operator_truth=operator_truth,
            readiness=readiness,
            readiness_reason=reason,
            auth_kind=auth_kind,
            oauth_mode=(auth_state.oauth_mode if provider_key == "openai_codex" and auth_state.auth_mode == "oauth" else None),
            oauth_flow_support=(auth_state.oauth_flow_support if provider_key == "openai_codex" and auth_state.auth_mode == "oauth" else None),
            evidence=evidence,
        )
        if configured and not self._native_oauth_bridge_path_enabled(status):
            status.readiness = "partial"
            status.readiness_reason = f"{status.readiness_reason}{self._native_oauth_disabled_evidence_suffix(status)}"
        return self._hydrate_oauth_target_surface(status, tenant_id=tenant_id, instance_id=instance_id)

    def _oauth_target_status(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> OAuthAccountTargetStatus:
        config = self._bridge_oauth_target_config(provider_key)
        token = str(config["token"])
        probe_enabled = bool(config["probe_enabled"])
        bridge_enabled = bool(config["bridge_enabled"])
        runtime_agent_key = str(config["runtime_agent_key"])
        configured = bool(token.strip())
        evidence = self._provider_capability_evidence(
            provider_key,
            tenant_id=tenant_id,
            instance_id=instance_id,
        )
        readiness: Literal["planned", "partial", "ready"] = "planned"
        reason = "OAuth/account credentials missing."
        if configured:
            readiness = "partial"
            if provider_key == "nous_oauth":
                reason = "Nous account token is configured, but runtime truth still depends on a separately minted agent key and explicit bridge evidence."
            elif provider_key == "qwen_oauth":
                reason = "Qwen portal token is configured, but runtime truth remains onboarding/bridge-only until live evidence exists with the required QwenCode/DashScope headers."
            else:
                reason = "OAuth/account credentials configured; runtime truth remains onboarding/bridge-only until explicit live evidence exists."
        if configured and evidence.live_probe.status == "observed":
            reason = "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current release truth."
        elif provider_key == "nous_oauth" and configured and bridge_enabled and not runtime_agent_key.strip():
            reason = "Nous bridge knobs are enabled, but no minted runtime agent key is configured; account-token-only setup remains onboarding/bridge-only."
        elif configured and (probe_enabled or bridge_enabled):
            if provider_key == "qwen_oauth":
                reason = (
                    "Qwen portal token is configured and bridge knobs are enabled, but runtime truth remains onboarding/bridge-only "
                    "until live evidence exists with the required QwenCode/DashScope headers."
                )
            elif provider_key == "nous_oauth":
                reason = "Nous account token is configured and bridge knobs are enabled, but runtime truth still depends on a separately minted agent key and explicit bridge evidence."
            else:
                reason = "OAuth/account operational knobs are enabled, but this axis still remains onboarding/bridge-only in the current release truth."
        contract_classification = "bridge-only" if configured or probe_enabled or bridge_enabled else "onboarding-only"
        status = OAuthAccountTargetStatus(
            provider_key=provider_key,
            provider_label=self._oauth_target_provider_label(provider_key),
            configured=configured,
            runtime_bridge_enabled=bridge_enabled,
            probe_enabled=probe_enabled,
            harness_profile_enabled=bridge_enabled,
            contract_classification=contract_classification,  # type: ignore[arg-type]
            queue_lane=self._oauth_target_queue_lane(contract_classification),  # type: ignore[arg-type]
            parallelism_mode=self._oauth_target_parallelism_mode(contract_classification),  # type: ignore[arg-type]
            parallelism_limit=None,
            session_reuse_strategy=self._bridge_oauth_target_session_reuse_strategy(provider_key),
            escalation_support="native_runtime_unavailable",
            cost_posture=self._oauth_target_cost_posture("oauth_account"),
            operator_surface="/oauth-targets",
            operator_truth=self._bridge_oauth_target_operator_truth(provider_key),
            readiness=readiness,
            readiness_reason=reason,
            auth_kind="oauth_account",
            evidence=evidence,
        )
        return self._hydrate_oauth_target_surface(status, tenant_id=tenant_id, instance_id=instance_id)

    def _safe_provider_status(self, provider_key: str) -> dict[str, object]:
        try:
            return self._providers.get_provider_status(provider_key)
        except ValueError:
            return {
                "ready": False,
                "readiness_reason": "provider_disabled_or_not_registered",
                "capabilities": {},
            }

    def probe_oauth_account_provider(
        self,
        provider_key: str,
        instance_id: str | None = None,
    ) -> OAuthAccountProbeResult:
        scoped_instance_id = (instance_id or "").strip() or None
        now = datetime.now(tz=UTC).isoformat()
        if provider_key == "openai_codex":
            status = self._providers.get_provider_status("openai_codex")
            if not status["ready"]:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=False,
                    probe_mode="readiness_only",
                    status="failed",
                    details=str(status["readiness_reason"]),
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            if not self._settings.openai_codex_bridge_enabled:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=True,
                    probe_mode="readiness_only",
                    status="warning",
                    details="Codex bridge disabled; readiness only.",
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            payload = {
                "model": self._settings.openai_codex_probe_model,
                "messages": [{"role": "user", "content": "health probe"}],
                "stream": False,
                "max_tokens": 8,
            }
            endpoint = f"{self._settings.openai_codex_base_url.rstrip('/')}/chat/completions"
            token = self._settings.openai_codex_oauth_access_token if self._settings.openai_codex_auth_mode == "oauth" else self._settings.openai_codex_api_key
            try:
                response = httpx.post(
                    endpoint,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=self._settings.openai_codex_timeout_seconds,
                )
            except httpx.RequestError as exc:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=True,
                    probe_mode="live_http_probe",
                    status="failed",
                    details=f"Codex bridge probe request failed: {exc}",
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="live_http_probe",
                status="ok" if response.status_code < 400 else "failed",
                details=("Codex bridge probe succeeded." if response.status_code < 400 else f"Codex bridge probe failed: {response.text[:300]}"),
                status_code=response.status_code,
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=scoped_instance_id,
            )
            return result

        if provider_key == "gemini":
            status = self._providers.get_provider_status("gemini")
            if not status["ready"]:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=False,
                    probe_mode="readiness_only",
                    status="failed",
                    details=str(status["readiness_reason"]),
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            if not self._settings.gemini_probe_enabled:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=True,
                    probe_mode="readiness_only",
                    status="warning",
                    details="Gemini probe flow disabled; set FORGEFRAME_GEMINI_PROBE_ENABLED=true.",
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            payload = {
                "model": self._settings.gemini_probe_model,
                "messages": [{"role": "user", "content": "health probe"}],
                "stream": False,
                "max_tokens": 8,
            }
            token = self._settings.gemini_oauth_access_token if self._settings.gemini_auth_mode == "oauth" else self._settings.gemini_api_key
            endpoint = f"{self._settings.gemini_probe_base_url.rstrip('/')}/chat/completions"
            try:
                response = httpx.post(
                    endpoint,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=self._settings.gemini_timeout_seconds,
                )
            except httpx.RequestError as exc:
                result = OAuthAccountProbeResult(
                    provider_key=provider_key,
                    ready=True,
                    probe_mode="live_http_probe",
                    status="failed",
                    details=f"Gemini probe request failed: {exc}",
                    checked_at=now,
                )
                self._record_oauth_operation(
                    provider_key,
                    "probe",
                    result.status,
                    result.details,
                    now,
                    instance_id=scoped_instance_id,
                )
                return result
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="live_http_probe",
                status="ok" if response.status_code < 400 else "failed",
                details=("Gemini OAuth/account probe succeeded." if response.status_code < 400 else f"Gemini probe failed: {response.text[:300]}"),
                status_code=response.status_code,
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=scoped_instance_id,
            )
            return result

        if provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
            return self._probe_additional_oauth_target(
                provider_key,
                now=now,
                instance_id=scoped_instance_id,
            )

        raise ValueError(f"Unsupported oauth/account probe provider: {provider_key}")

    def _probe_additional_oauth_target(
        self,
        provider_key: str,
        *,
        now: str,
        instance_id: str | None = None,
    ) -> OAuthAccountProbeResult:
        status = self._oauth_target_status(provider_key, instance_id=instance_id)
        config = self._bridge_oauth_target_config(provider_key)
        base_url = str(config["base_url"])
        model = str(config["model"])
        token = str(config["token"])
        runtime_agent_key = str(config["runtime_agent_key"])
        if not status.configured:
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=False,
                probe_mode="readiness_only",
                status="failed",
                details=status.readiness_reason,
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=instance_id,
            )
            return result
        if not status.probe_enabled:
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="readiness_only",
                status="warning",
                details="Probe disabled; credentials are configured.",
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=instance_id,
            )
            return result
        if provider_key == "nous_oauth" and not runtime_agent_key.strip():
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="readiness_only",
                status="warning",
                details=("Nous live probe skipped because no minted runtime agent key is configured; the account token alone must not be treated as runtime proof."),
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=instance_id,
            )
            return result
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "health probe"}],
            "stream": False,
            "max_tokens": 8,
        }
        endpoint = f"{base_url.rstrip('/')}/chat/completions"
        try:
            response = httpx.post(
                endpoint,
                json=payload,
                headers=self._bridge_oauth_probe_headers(
                    provider_key,
                    runtime_agent_key if provider_key == "nous_oauth" else token,
                ),
                timeout=self._settings.oauth_account_probe_timeout_seconds,
            )
        except httpx.RequestError as exc:
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="live_http_probe",
                status="failed",
                details=f"Probe request failed: {exc}",
                checked_at=now,
            )
            self._record_oauth_operation(
                provider_key,
                "probe",
                result.status,
                result.details,
                now,
                instance_id=instance_id,
            )
            return result
        result = OAuthAccountProbeResult(
            provider_key=provider_key,
            ready=True,
            probe_mode="live_http_probe",
            status="ok" if response.status_code < 400 else "failed",
            details=(f"{provider_key} probe succeeded." if response.status_code < 400 else f"{provider_key} probe failed: {response.text[:300]}"),
            status_code=response.status_code,
            checked_at=now,
        )
        self._record_oauth_operation(
            provider_key,
            "probe",
            result.status,
            result.details,
            now,
            instance_id=instance_id,
        )
        return result

    def sync_oauth_account_bridge_profiles(self, instance_id: str | None = None) -> dict[str, object]:
        scoped_instance_id = (instance_id or "").strip() or self._instance.instance_id
        upserted: list[str] = []
        skipped: list[str] = []
        for provider_key in _BRIDGE_OAUTH_TARGET_KEYS:
            config = self._bridge_oauth_target_config(provider_key)
            enabled = bool(config["bridge_enabled"])
            base_url = str(config["base_url"])
            token = str(config["token"])
            model = str(config["model"])
            runtime_agent_key = str(config["runtime_agent_key"])
            if not enabled:
                skipped.append(provider_key)
                self._record_oauth_operation(
                    provider_key,
                    "bridge_sync",
                    "skipped",
                    "Bridge profile sync disabled in settings.",
                    datetime.now(tz=UTC).isoformat(),
                    instance_id=scoped_instance_id,
                )
                continue
            if provider_key == "nous_oauth" and not runtime_agent_key.strip():
                skipped.append(provider_key)
                self._record_oauth_operation(
                    provider_key,
                    "bridge_sync",
                    "skipped",
                    "Nous bridge profile sync skipped because no minted runtime agent key is configured.",
                    datetime.now(tz=UTC).isoformat(),
                    instance_id=scoped_instance_id,
                )
                continue
            logical_profile_key = f"{provider_key}_bridge"
            profile = HarnessProviderProfile(
                provider_key=logical_profile_key,
                instance_id=scoped_instance_id,
                label=f"{provider_key} OAuth Bridge",
                integration_class="openai_compatible",
                endpoint_base_url=base_url.rstrip("/"),
                auth_scheme="bearer",
                auth_value=runtime_agent_key if provider_key == "nous_oauth" else token,
                enabled=True,
                models=[model],
                discovery_enabled=False,
                template_id=f"{provider_key}_bridge",
                model_slug_policy="infer_vendor_if_missing" if provider_key == "nous_oauth" else "verbatim",
                model_prefix="openai" if provider_key == "nous_oauth" else "",
                request_mapping={"headers": self._bridge_oauth_profile_request_headers(provider_key)},
                stream_mapping={"enabled": True},
                capabilities={
                    "streaming": True,
                    "tool_calling": True,
                    "model_source": "manual",
                    "discovery_support": False,
                    "unsupported_features": (
                        [
                            "runtime requires minted agent key or equivalent live evidence",
                            "account-token-only setup remains blocked-by-live-evidence",
                        ]
                        if provider_key == "nous_oauth"
                        else (
                            [
                                "QwenCode/DashScope headers must stay attached to every bridge request",
                                "live runtime proof remains blocked without portal credentials",
                            ]
                            if provider_key == "qwen_oauth"
                            else []
                        )
                    ),
                },
            )
            self._harness.upsert_profile(profile, instance_id=scoped_instance_id)
            upserted.append(logical_profile_key)
            self._record_oauth_operation(
                provider_key,
                "bridge_sync",
                "ok",
                f"Upserted bridge profile {logical_profile_key} for instance {scoped_instance_id}.",
                datetime.now(tz=UTC).isoformat(),
                instance_id=scoped_instance_id,
            )
        return {"status": "ok", "upserted_profiles": upserted, "skipped": skipped}
