"""OAuth target status, probe, and bridge-profile behavior."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

import httpx

from app.api.admin.control_plane_models import OAuthAccountProbeResult, OAuthAccountTargetStatus
from app.harness import HarnessProviderProfile


class ControlPlaneOAuthTargetsDomainMixin:
    def _oauth_target_next_steps(self, provider_key: str, status: OAuthAccountTargetStatus) -> list[str]:
        steps: list[str] = []
        if not status.configured:
            steps.append(f"Configure credentials or OAuth access token for {provider_key}.")
        if not status.probe_enabled:
            steps.append(f"Enable live probe support for {provider_key}.")
        if not status.runtime_bridge_enabled and provider_key in {"openai_codex", "gemini"}:
            steps.append(f"Enable native runtime bridge for {provider_key}.")
        if not status.harness_profile_enabled and provider_key in {"antigravity", "github_copilot", "claude_code"}:
            steps.append(f"Enable OAuth bridge profile sync for {provider_key}.")
        if not steps:
            steps.append(f"{provider_key} is operational; verify UI and runtime behavior against live upstreams.")
        return steps

    def list_oauth_account_target_statuses(self) -> list[dict[str, object]]:
        providers = ["openai_codex", "gemini", "antigravity", "github_copilot", "claude_code"]
        statuses: list[dict[str, object]] = []
        for provider_key in providers:
            if provider_key in {"antigravity", "github_copilot", "claude_code"}:
                statuses.append(self._oauth_target_status(provider_key).model_dump())
                continue
            probe = self.probe_oauth_account_provider(provider_key)
            statuses.append(
                OAuthAccountTargetStatus(
                    provider_key=provider_key,
                    configured=probe.ready,
                    runtime_bridge_enabled=(
                        provider_key == "openai_codex"
                        and self._settings.openai_codex_bridge_enabled
                    ),
                    probe_enabled=(
                        provider_key == "gemini"
                        and self._settings.gemini_probe_enabled
                    ),
                    harness_profile_enabled=False,
                    readiness="ready" if probe.status == "ok" else ("partial" if probe.ready else "planned"),
                    readiness_reason=probe.details,
                    auth_kind="oauth_account",
                ).model_dump()
            )
        return statuses

    def oauth_account_onboarding_summary(self) -> dict[str, object]:
        targets = []
        for item in self.list_oauth_account_target_statuses():
            status = OAuthAccountTargetStatus(**item)
            targets.append(
                {
                    **status.model_dump(),
                    "next_steps": self._oauth_target_next_steps(status.provider_key, status),
                    "operational_depth": (
                        "runtime_and_probe"
                        if status.runtime_bridge_enabled and status.probe_enabled
                        else ("probe_only" if status.probe_enabled else "credentials_only")
                    ),
                }
            )
        return {"status": "ok", "targets": targets}

    def _oauth_target_status(self, provider_key: str) -> OAuthAccountTargetStatus:
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
        readiness: Literal["planned", "partial", "ready"] = "planned"
        reason = "OAuth/account credentials missing."
        if configured:
            readiness = "partial"
            reason = "OAuth/account credentials configured; enable probe or bridge profile for operational depth."
        if configured and (probe_enabled or bridge_enabled):
            readiness = "ready"
            reason = "OAuth/account credentials + operational probe/bridge profile are enabled."
        return OAuthAccountTargetStatus(
            provider_key=provider_key,
            configured=configured,
            runtime_bridge_enabled=bridge_enabled,
            probe_enabled=probe_enabled,
            harness_profile_enabled=bridge_enabled,
            readiness=readiness,
            readiness_reason=reason,
            auth_kind="oauth_account",
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
                    details="Gemini probe flow disabled; set FORGEGATE_GEMINI_PROBE_ENABLED=true.",
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
