"""OAuth target status, probe, and bridge-profile behavior."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

import httpx

from app.api.admin.control_plane_models import OAuthAccountProbeResult, OAuthAccountTargetStatus
from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.auth.oauth.openai import resolve_codex_auth_state
from app.harness import HarnessProviderProfile


class ControlPlaneOAuthTargetsDomainMixin:
    @staticmethod
    def _oauth_target_contract_classification(
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> str:
        if provider_key in {"openai_codex", "gemini"}:
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

    def _oauth_target_next_steps(self, provider_key: str, status: OAuthAccountTargetStatus) -> list[str]:
        steps: list[str] = []
        if not status.configured:
            steps.append(f"Configure credentials or OAuth access token for {provider_key}.")
        if not status.probe_enabled:
            steps.append(f"Enable live probe support for {provider_key}.")
        if not status.runtime_bridge_enabled and provider_key in {"openai_codex", "gemini"}:
            steps.append(f"Enable native runtime bridge for {provider_key}.")
        if status.configured and status.evidence.live_probe.status != "observed" and provider_key in {"openai_codex", "gemini"}:
            steps.append(f"Run an explicit live probe for {provider_key} so the control plane can promote the route beyond credentials-only readiness.")
        if status.configured and status.evidence.runtime.status != "observed" and provider_key in {"openai_codex", "gemini"}:
            steps.append(f"Send a real runtime request through {provider_key} to record live non-stream evidence.")
        if not status.harness_profile_enabled and provider_key in {"antigravity", "github_copilot", "claude_code"}:
            steps.append(f"Enable OAuth bridge profile sync for {provider_key}.")
        if not steps:
            if provider_key in {"antigravity", "github_copilot", "claude_code"}:
                steps.append(
                    f"Keep {provider_key} positioned as onboarding/bridge-only; probe success does not promote it to native runtime-ready truth."
                )
            else:
                steps.append(f"{provider_key} is operational; verify UI and runtime behavior against live upstreams.")
        return steps

    @staticmethod
    def _oauth_target_operational_depth(
        provider_key: str,
        status: OAuthAccountTargetStatus,
    ) -> str:
        if provider_key in {"openai_codex", "gemini"} and not ControlPlaneOAuthTargetsDomainMixin._native_oauth_bridge_path_enabled(status):
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
            return "bridge_probe_evidenced" if provider_key in {"antigravity", "github_copilot", "claude_code"} else "probe_evidenced"
        if status.runtime_bridge_enabled and status.probe_enabled:
            return "runtime_path_configured"
        if status.harness_profile_enabled or status.probe_enabled:
            return "bridge_path_configured"
        if status.configured:
            return "credentials_only"
        return "not_configured"

    def list_oauth_account_target_statuses(self, tenant_id: str | None = None) -> list[dict[str, object]]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        providers = ["openai_codex", "gemini", "antigravity", "github_copilot", "claude_code"]
        statuses: list[dict[str, object]] = []
        for provider_key in providers:
            if provider_key in {"antigravity", "github_copilot", "claude_code"}:
                statuses.append(self._oauth_target_status(provider_key, tenant_id=effective_tenant_id).model_dump())
                continue
            status = self._native_oauth_target_status(provider_key, tenant_id=effective_tenant_id)
            statuses.append(
                status.model_dump()
            )
        return statuses

    def oauth_account_onboarding_summary(self, tenant_id: str | None = None) -> dict[str, object]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        targets = []
        for item in self.list_oauth_account_target_statuses(tenant_id=effective_tenant_id):
            status = OAuthAccountTargetStatus(**item)
            targets.append(
                {
                    **status.model_dump(),
                    "next_steps": self._oauth_target_next_steps(status.provider_key, status),
                    "operational_depth": self._oauth_target_operational_depth(status.provider_key, status),
                }
            )
        return {"status": "ok", "targets": targets, "tenant_id": effective_tenant_id}

    def _native_oauth_target_status(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
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

        auth_kind: Literal["oauth_account", "api_key"] = (
            "oauth_account" if auth_state.auth_mode == "oauth" else "api_key"
        )
        provider_status = self._safe_provider_status(provider_key)
        provider_ready = bool(provider_status.get("ready"))
        provider_reason = str(provider_status.get("readiness_reason") or "")
        evidence = self._provider_capability_evidence(provider_key, tenant_id=tenant_id)
        readiness: Literal["planned", "partial", "ready"] = "planned"
        reason = "OAuth/account credentials missing."
        if configured:
            readiness = "partial"
            if runtime_bridge_enabled and not provider_ready and provider_reason:
                reason = provider_reason
            elif provider_key == "openai_codex" and auth_state.auth_mode == "oauth":
                reason = (
                    f"Codex OAuth mode '{auth_state.oauth_mode}' is configured via a pre-issued access token, "
                    "but no live probe or runtime evidence is recorded yet."
                )
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
                reason = (
                    f"Codex OAuth mode '{auth_state.oauth_mode}' is configured, but the native runtime bridge is still disabled."
                )
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
        return status

    def _oauth_target_status(
        self,
        provider_key: str,
        *,
        tenant_id: str | None = None,
    ) -> OAuthAccountTargetStatus:
        config = {
            "antigravity": (
                self._settings.antigravity_oauth_access_token,
                self._settings.antigravity_probe_enabled,
                self._settings.antigravity_bridge_profile_enabled,
            ),
            "github_copilot": (
                self._settings.github_copilot_oauth_access_token,
                self._settings.github_copilot_probe_enabled,
                self._settings.github_copilot_bridge_profile_enabled,
            ),
            "claude_code": (
                self._settings.claude_code_oauth_access_token,
                self._settings.claude_code_probe_enabled,
                self._settings.claude_code_bridge_profile_enabled,
            ),
        }
        token, probe_enabled, bridge_enabled = config[provider_key]
        configured = bool(token.strip())
        evidence = self._provider_capability_evidence(provider_key, tenant_id=tenant_id)
        readiness: Literal["planned", "partial", "ready"] = "planned"
        reason = "OAuth/account credentials missing."
        if configured:
            readiness = "partial"
            reason = "OAuth/account credentials configured; runtime truth remains onboarding/bridge-only until explicit live evidence exists."
        if configured and evidence.live_probe.status == "observed":
            reason = "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current release truth."
        elif configured and (probe_enabled or bridge_enabled):
            reason = "OAuth/account operational knobs are enabled, but this axis still remains onboarding/bridge-only in the current release truth."
        contract_classification = "bridge-only" if configured or probe_enabled or bridge_enabled else "onboarding-only"
        return OAuthAccountTargetStatus(
            provider_key=provider_key,
            configured=configured,
            runtime_bridge_enabled=bridge_enabled,
            probe_enabled=probe_enabled,
            harness_profile_enabled=bridge_enabled,
            contract_classification=contract_classification,  # type: ignore[arg-type]
            queue_lane=self._oauth_target_queue_lane(contract_classification),  # type: ignore[arg-type]
            parallelism_mode=self._oauth_target_parallelism_mode(contract_classification),  # type: ignore[arg-type]
            parallelism_limit=None,
            session_reuse_strategy="Pre-issued OAuth access token is forwarded through bridge/profile operations only; no managed refresh or session reuse contract exists.",
            escalation_support="native_runtime_unavailable",
            cost_posture=self._oauth_target_cost_posture("oauth_account"),
            operator_surface="/oauth-targets",
            operator_truth="ForgeFrame can probe or sync bridge profiles for this target, but no native runtime lane is shipped for it in the current release truth.",
            readiness=readiness,
            readiness_reason=reason,
            auth_kind="oauth_account",
            evidence=evidence,
        )

    def _safe_provider_status(self, provider_key: str) -> dict[str, object]:
        try:
            return self._providers.get_provider_status(provider_key)
        except ValueError:
            return {
                "ready": False,
                "readiness_reason": "provider_disabled_or_not_registered",
                "capabilities": {},
            }

    def probe_oauth_account_provider(self, provider_key: str) -> OAuthAccountProbeResult:
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
                return result
            payload = {
                "model": self._settings.openai_codex_probe_model,
                "messages": [{"role": "user", "content": "health probe"}],
                "stream": False,
                "max_tokens": 8,
            }
            endpoint = f"{self._settings.openai_codex_base_url.rstrip('/')}/chat/completions"
            token = (
                self._settings.openai_codex_oauth_access_token
                if self._settings.openai_codex_auth_mode == "oauth"
                else self._settings.openai_codex_api_key
            )
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
                return result
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="live_http_probe",
                status="ok" if response.status_code < 400 else "failed",
                details=(
                    "Codex bridge probe succeeded."
                    if response.status_code < 400
                    else f"Codex bridge probe failed: {response.text[:300]}"
                ),
                status_code=response.status_code,
                checked_at=now,
            )
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
                return result
            payload = {
                "model": self._settings.gemini_probe_model,
                "messages": [{"role": "user", "content": "health probe"}],
                "stream": False,
                "max_tokens": 8,
            }
            token = (
                self._settings.gemini_oauth_access_token
                if self._settings.gemini_auth_mode == "oauth"
                else self._settings.gemini_api_key
            )
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
                self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
                return result
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=True,
                probe_mode="live_http_probe",
                status="ok" if response.status_code < 400 else "failed",
                details=(
                    "Gemini OAuth/account probe succeeded."
                    if response.status_code < 400
                    else f"Gemini probe failed: {response.text[:300]}"
                ),
                status_code=response.status_code,
                checked_at=now,
            )
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result

        if provider_key in {"antigravity", "github_copilot", "claude_code"}:
            return self._probe_additional_oauth_target(provider_key, now=now)

        raise ValueError(f"Unsupported oauth/account probe provider: {provider_key}")

    def _probe_additional_oauth_target(
        self,
        provider_key: str,
        *,
        now: str,
    ) -> OAuthAccountProbeResult:
        status = self._oauth_target_status(provider_key)
        target_map = {
            "antigravity": (
                self._settings.antigravity_probe_base_url,
                self._settings.antigravity_probe_model,
                self._settings.antigravity_oauth_access_token,
            ),
            "github_copilot": (
                self._settings.github_copilot_probe_base_url,
                self._settings.github_copilot_probe_model,
                self._settings.github_copilot_oauth_access_token,
            ),
            "claude_code": (
                self._settings.claude_code_probe_base_url,
                self._settings.claude_code_probe_model,
                self._settings.claude_code_oauth_access_token,
            ),
        }
        base_url, model, token = target_map[provider_key]
        if not status.configured:
            result = OAuthAccountProbeResult(
                provider_key=provider_key,
                ready=False,
                probe_mode="readiness_only",
                status="failed",
                details=status.readiness_reason,
                checked_at=now,
            )
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
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
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
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
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
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
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result
        result = OAuthAccountProbeResult(
            provider_key=provider_key,
            ready=True,
            probe_mode="live_http_probe",
            status="ok" if response.status_code < 400 else "failed",
            details=(
                f"{provider_key} probe succeeded."
                if response.status_code < 400
                else f"{provider_key} probe failed: {response.text[:300]}"
            ),
            status_code=response.status_code,
            checked_at=now,
        )
        self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
        return result

    def sync_oauth_account_bridge_profiles(self) -> dict[str, object]:
        provider_configs = {
            "antigravity": (
                self._settings.antigravity_bridge_profile_enabled,
                self._settings.antigravity_probe_base_url,
                self._settings.antigravity_oauth_access_token,
                self._settings.antigravity_probe_model,
            ),
            "github_copilot": (
                self._settings.github_copilot_bridge_profile_enabled,
                self._settings.github_copilot_probe_base_url,
                self._settings.github_copilot_oauth_access_token,
                self._settings.github_copilot_probe_model,
            ),
            "claude_code": (
                self._settings.claude_code_bridge_profile_enabled,
                self._settings.claude_code_probe_base_url,
                self._settings.claude_code_oauth_access_token,
                self._settings.claude_code_probe_model,
            ),
        }
        upserted: list[str] = []
        skipped: list[str] = []
        for provider_key, (enabled, base_url, token, model) in provider_configs.items():
            if not enabled:
                skipped.append(provider_key)
                self._record_oauth_operation(
                    provider_key,
                    "bridge_sync",
                    "skipped",
                    "Bridge profile sync disabled in settings.",
                    datetime.now(tz=UTC).isoformat(),
                )
                continue
            profile = HarnessProviderProfile(
                provider_key=f"{provider_key}_oauth_bridge",
                label=f"{provider_key} OAuth Bridge",
                integration_class="openai_compatible",
                endpoint_base_url=base_url.rstrip("/"),
                auth_scheme="bearer",
                auth_value=token,
                enabled=True,
                models=[model],
                discovery_enabled=False,
                stream_mapping={"enabled": True},
                capabilities={
                    "streaming": True,
                    "model_source": "manual",
                    "discovery_support": False,
                },
            )
            self._harness.upsert_profile(profile)
            upserted.append(profile.provider_key)
            self._record_oauth_operation(
                provider_key,
                "bridge_sync",
                "ok",
                f"Upserted bridge profile {profile.provider_key}.",
                datetime.now(tz=UTC).isoformat(),
            )
        return {"status": "ok", "upserted_profiles": upserted, "skipped": skipped}
