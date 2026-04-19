"""Admin control-plane service for provider/model/health/harness workflows."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from app.core.model_registry import ModelRegistry
from app.harness import HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.service import HarnessService, get_harness_service
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class ManagedModelRecord(BaseModel):
    id: str
    source: str
    discovery_status: str
    active: bool


class ManagedProviderRecord(BaseModel):
    provider: str
    label: str
    enabled: bool
    integration_class: str = "native"
    template_id: str | None = None
    config: dict[str, str] = Field(default_factory=dict)
    last_sync_at: str | None = None
    last_sync_status: str = "never"
    last_sync_error: str | None = None
    managed_models: list[ManagedModelRecord] = Field(default_factory=list)


class ProviderCreateRequest(BaseModel):
    provider: str
    label: str
    integration_class: str = "native"
    template_id: str | None = None
    config: dict[str, str] = Field(default_factory=dict)


class ProviderUpdateRequest(BaseModel):
    label: str | None = None
    integration_class: str | None = None
    template_id: str | None = None
    config: dict[str, str] | None = None


class ProviderSyncRequest(BaseModel):
    provider: str | None = None


class HealthConfig(BaseModel):
    provider_health_enabled: bool = True
    model_health_enabled: bool = True
    interval_seconds: int = 300
    probe_mode: Literal["provider", "discovery", "synthetic_probe"] = "discovery"
    selected_models: list[str] = Field(default_factory=list)


class HealthConfigUpdateRequest(BaseModel):
    provider_health_enabled: bool | None = None
    model_health_enabled: bool | None = None
    interval_seconds: int | None = None
    probe_mode: Literal["provider", "discovery", "synthetic_probe"] | None = None
    selected_models: list[str] | None = None


class HealthStatusRecord(BaseModel):
    provider: str
    model: str
    check_type: Literal["provider", "discovery", "synthetic_probe"]
    status: Literal["healthy", "degraded", "unavailable", "auth_failed", "not_configured", "discovery_only", "probe_failed", "unknown"]
    readiness_reason: str | None = None
    last_check_at: str | None = None
    last_success_at: str | None = None
    last_error: str | None = None




class BetaProviderTarget(BaseModel):
    provider_key: str
    provider_type: Literal["oauth_account", "openai_compatible", "local"]
    product_axis: Literal["oauth_account_providers", "openai_compatible_providers", "local_providers", "openai_compatible_clients"]
    auth_model: str
    runtime_path: str
    readiness: Literal["planned", "partial", "ready"]
    readiness_score: int = Field(ge=0, le=100)
    runtime_readiness: Literal["planned", "partial", "ready"]
    streaming_readiness: Literal["planned", "partial", "ready"]
    verify_probe_readiness: Literal["planned", "partial", "ready"]
    ui_readiness: Literal["planned", "partial", "ready"]
    beta_tier: Literal["concept", "beta", "beta_plus"]
    health_semantics: str
    verify_probe_axis: str
    observability_axis: str
    ui_axis: str
    status_summary: str
    oauth_account_provider: bool = False
    notes: str


class OAuthAccountProbeResult(BaseModel):
    provider_key: str
    ready: bool
    probe_mode: Literal["readiness_only", "live_http_probe"]
    status: Literal["ok", "warning", "failed"]
    details: str
    status_code: int | None = None
    checked_at: str


class OAuthAccountTargetStatus(BaseModel):
    provider_key: str
    configured: bool
    runtime_bridge_enabled: bool
    probe_enabled: bool
    harness_profile_enabled: bool
    readiness: Literal["planned", "partial", "ready"]
    readiness_reason: str
    auth_kind: Literal["oauth_account"]


class OAuthOperationRecord(BaseModel):
    provider_key: str
    action: Literal["probe", "bridge_sync"]
    status: Literal["ok", "warning", "failed", "skipped"]
    details: str
    executed_at: str

class ControlPlaneService:
    def __init__(
        self,
        settings: Settings,
        registry: ModelRegistry,
        providers: ProviderRegistry,
        analytics_store: UsageAnalyticsStore,
        harness: HarnessService,
    ):
        self._settings = settings
        self._registry = registry
        self._providers = providers
        self._usage_accounting = UsageAccountingService(settings)
        self._analytics = analytics_store
        self._harness = harness
        self._providers_state = self._bootstrap_provider_state()
        self._health_config = HealthConfig()
        self._health_records: dict[str, HealthStatusRecord] = {}
        self._oauth_operations: list[OAuthOperationRecord] = []

    def _bootstrap_provider_state(self) -> dict[str, ManagedProviderRecord]:
        provider_map: dict[str, ManagedProviderRecord] = {}
        for model in self._registry.list_active_models():
            provider = provider_map.setdefault(
                model.provider,
                ManagedProviderRecord(
                    provider=model.provider,
                    label=model.provider,
                    enabled=True,
                    integration_class="harness_generic" if model.provider == "generic_harness" else "native",
                ),
            )
            provider.managed_models.append(
                ManagedModelRecord(id=model.id, source=model.source, discovery_status=model.discovery_status, active=model.active)
            )
        return provider_map

    def list_providers(self) -> list[ManagedProviderRecord]:
        return sorted(self._providers_state.values(), key=lambda item: item.provider)

    def get_provider(self, provider_name: str) -> ManagedProviderRecord:
        provider = self._providers_state.get(provider_name)
        if not provider:
            raise ValueError(f"Provider '{provider_name}' is not managed in control plane.")
        return provider

    def create_provider(self, payload: ProviderCreateRequest) -> ManagedProviderRecord:
        if payload.provider in self._providers_state:
            raise ValueError(f"Provider '{payload.provider}' already exists.")
        provider = ManagedProviderRecord(
            provider=payload.provider,
            label=payload.label,
            enabled=False,
            integration_class=payload.integration_class,
            template_id=payload.template_id,
            config=payload.config,
            last_sync_status="created",
        )
        self._providers_state[payload.provider] = provider
        return provider

    def update_provider(self, provider_name: str, payload: ProviderUpdateRequest) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        if payload.label is not None:
            provider.label = payload.label
        if payload.integration_class is not None:
            provider.integration_class = payload.integration_class
        if payload.template_id is not None:
            provider.template_id = payload.template_id
        if payload.config is not None:
            provider.config = payload.config
        return provider

    def set_provider_enabled(self, provider_name: str, enabled: bool) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        provider.enabled = enabled
        return provider

    def list_harness_templates(self) -> list[dict[str, object]]:
        return self._harness.list_templates()

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
                status_summary="Auth semantics wired; partial bridge active." if self._settings.openai_codex_bridge_enabled else "Auth semantics wired; runtime bridge still beta-scaffold.",
                oauth_account_provider=True,
                notes="Existing path; needs deeper account lifecycle automation.",
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
                status_summary="OAuth/account probe-ready flow active." if self._settings.gemini_probe_enabled else "OAuth/account credentials modeled; runtime implementation pending.",
                oauth_account_provider=True,
                notes="Existing path; needs stronger beta account onboarding.",
            ),
            BetaProviderTarget(
                provider_key="antigravity",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=antigravity_status.readiness,
                readiness_score=58 if antigravity_status.readiness == "ready" else (42 if antigravity_status.readiness == "partial" else 24),
                runtime_readiness="partial" if antigravity_status.runtime_bridge_enabled else "planned",
                streaming_readiness="partial" if antigravity_status.harness_profile_enabled else "planned",
                verify_probe_readiness="ready" if antigravity_status.probe_enabled else "partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth + connection + discovery phases",
                verify_probe_axis="verify/probe planned on generic harness profile",
                observability_axis="integration/profile/client error axis",
                ui_axis="beta target table + harness onboarding",
                status_summary=antigravity_status.readiness_reason,
                oauth_account_provider=True,
                notes="OAuth/account bridge status is code-driven; native adapter intentionally deferred.",
            ),
            BetaProviderTarget(
                provider_key="github_copilot",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=copilot_status.readiness,
                readiness_score=58 if copilot_status.readiness == "ready" else (42 if copilot_status.readiness == "partial" else 23),
                runtime_readiness="partial" if copilot_status.runtime_bridge_enabled else "planned",
                streaming_readiness="partial" if copilot_status.harness_profile_enabled else "planned",
                verify_probe_readiness="ready" if copilot_status.probe_enabled else "partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth/session readiness + probe",
                verify_probe_axis="verify/probe planned with profile template",
                observability_axis="client/integration/profile errors",
                ui_axis="providers beta target table",
                status_summary=copilot_status.readiness_reason,
                oauth_account_provider=True,
                notes="OAuth/account bridge status is code-driven; native adapter intentionally deferred.",
            ),
            BetaProviderTarget(
                provider_key="claude_code",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness=claude_code_status.readiness,
                readiness_score=58 if claude_code_status.readiness == "ready" else (42 if claude_code_status.readiness == "partial" else 23),
                runtime_readiness="partial" if claude_code_status.runtime_bridge_enabled else "planned",
                streaming_readiness="partial" if claude_code_status.harness_profile_enabled else "planned",
                verify_probe_readiness="ready" if claude_code_status.probe_enabled else "partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth + request rendering + mapping",
                verify_probe_axis="verify/probe planned",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers beta target table",
                status_summary=claude_code_status.readiness_reason,
                oauth_account_provider=True,
                notes="OAuth/account bridge status is code-driven; native adapter intentionally deferred.",
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
                beta_tier="beta_plus",
                health_semantics="connection/auth/discovery/request/response/stream",
                verify_probe_axis="preview/verify/dry-run/probe available",
                observability_axis="integration/profile error axes active",
                ui_axis="harness onboarding + runs/history",
                status_summary="Operational harness path with profile-level runtime, verify and probe.",
                notes="Core beta axis for broad provider compatibility.",
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
                status_summary="Dedicated local runtime adapter and template are active." if ollama_status["ready"] else "Dedicated local axis with explicit template and control-plane lifecycle.",
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
                beta_tier="beta_plus",
                health_semantics="runtime + health traffic split",
                verify_probe_axis="harness + runtime validation",
                observability_axis="client/provider/model/profile/integration",
                ui_axis="usage + providers + harness",
                status_summary="Client compatibility expanded beyond chat baseline.",
                notes="OpenAI-compatible client-facing beta axis.",
            ),
        ]
        return [item.model_dump() for item in targets]

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
                    runtime_bridge_enabled=(provider_key == "openai_codex" and self._settings.openai_codex_bridge_enabled),
                    probe_enabled=(provider_key == "gemini" and self._settings.gemini_probe_enabled),
                    harness_profile_enabled=False,
                    readiness="ready" if probe.status == "ok" else ("partial" if probe.ready else "planned"),
                    readiness_reason=probe.details,
                    auth_kind="oauth_account",
                ).model_dump()
            )
        return statuses

    def oauth_account_operations_summary(self) -> dict[str, object]:
        providers = ["openai_codex", "gemini", "antigravity", "github_copilot", "claude_code"]
        per_provider: list[dict[str, object]] = []
        for provider_key in providers:
            status = self._oauth_target_status(provider_key) if provider_key in {"antigravity", "github_copilot", "claude_code"} else None
            provider_ops = [item for item in self._oauth_operations if item.provider_key == provider_key]
            last_probe = next((item for item in reversed(provider_ops) if item.action == "probe"), None)
            last_bridge_sync = next((item for item in reversed(provider_ops) if item.action == "bridge_sync"), None)
            failures = len([item for item in provider_ops if item.status == "failed"])
            per_provider.append(
                {
                    "provider_key": provider_key,
                    "configured": status.configured if status else bool(
                        (self._settings.openai_codex_oauth_access_token if provider_key == "openai_codex" else self._settings.gemini_oauth_access_token).strip()
                    ),
                    "probe_enabled": status.probe_enabled if status else (
                        self._settings.openai_codex_bridge_enabled if provider_key == "openai_codex" else self._settings.gemini_probe_enabled
                    ),
                    "bridge_profile_enabled": status.harness_profile_enabled if status else False,
                    "needs_attention": failures >= 2,
                    "failures": failures,
                    "last_probe": last_probe.model_dump() if last_probe else None,
                    "last_bridge_sync": last_bridge_sync.model_dump() if last_bridge_sync else None,
                }
            )
        return {"status": "ok", "operations": per_provider, "recent": [item.model_dump() for item in self._oauth_operations[-50:]]}

    def bootstrap_readiness_report(self) -> dict[str, object]:
        root_dir = Path(__file__).resolve().parents[4]
        env_compose = root_dir / ".env.compose"
        compose_file = root_dir / "docker" / "docker-compose.yml"
        checks = [
            {"id": "compose_file", "ok": compose_file.exists(), "details": str(compose_file)},
            {"id": "env_compose", "ok": env_compose.exists(), "details": str(env_compose)},
            {"id": "postgres_url", "ok": bool(self._settings.harness_postgres_url.strip()), "details": "FORGEGATE_HARNESS_POSTGRES_URL"},
            {"id": "storage_backend", "ok": self._settings.harness_storage_backend in {"file", "postgresql"}, "details": self._settings.harness_storage_backend},
            {"id": "app_port", "ok": bool(str(self._settings.port).strip()), "details": str(self._settings.port)},
            {"id": "docker_host_hint", "ok": bool(os.environ.get("DOCKER_HOST") or os.path.exists("/var/run/docker.sock")), "details": os.environ.get("DOCKER_HOST", "/var/run/docker.sock")},
        ]
        ready = all(item["ok"] for item in checks[:5])
        next_steps = [
            "Run ./scripts/bootstrap-forgegate.sh for docker-first setup.",
            "Use ./scripts/compose-smoke.sh to verify harness + control-plane path.",
            "Open /app/ and verify provider probes + bridge profile sync from Providers page.",
        ]
        return {"status": "ok", "ready": ready, "checks": checks, "next_steps": next_steps}

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
            return {"ready": False, "readiness_reason": "provider_disabled_or_not_registered", "capabilities": {}}

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
            payload = {"model": self._settings.openai_codex_probe_model, "messages": [{"role": "user", "content": "health probe"}], "stream": False, "max_tokens": 8}
            endpoint = f"{self._settings.openai_codex_base_url.rstrip('/')}/chat/completions"
            token = self._settings.openai_codex_oauth_access_token if self._settings.openai_codex_auth_mode == "oauth" else self._settings.openai_codex_api_key
            try:
                response = httpx.post(endpoint, json=payload, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=self._settings.openai_codex_timeout_seconds)
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
                details="Codex bridge probe succeeded." if response.status_code < 400 else f"Codex bridge probe failed: {response.text[:300]}",
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
            payload = {"model": self._settings.gemini_probe_model, "messages": [{"role": "user", "content": "health probe"}], "stream": False, "max_tokens": 8}
            token = self._settings.gemini_oauth_access_token if self._settings.gemini_auth_mode == "oauth" else self._settings.gemini_api_key
            endpoint = f"{self._settings.gemini_probe_base_url.rstrip('/')}/chat/completions"
            try:
                response = httpx.post(endpoint, json=payload, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=self._settings.gemini_timeout_seconds)
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
                details="Gemini OAuth/account probe succeeded." if response.status_code < 400 else f"Gemini probe failed: {response.text[:300]}",
                status_code=response.status_code,
                checked_at=now,
            )
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result

        if provider_key in {"antigravity", "github_copilot", "claude_code"}:
            return self._probe_additional_oauth_target(provider_key, now=now)

        raise ValueError(f"Unsupported oauth/account probe provider: {provider_key}")

    def _probe_additional_oauth_target(self, provider_key: str, *, now: str) -> OAuthAccountProbeResult:
        status = self._oauth_target_status(provider_key)
        target_map = {
            "antigravity": (self._settings.antigravity_probe_base_url, self._settings.antigravity_probe_model, self._settings.antigravity_oauth_access_token),
            "github_copilot": (self._settings.github_copilot_probe_base_url, self._settings.github_copilot_probe_model, self._settings.github_copilot_oauth_access_token),
            "claude_code": (self._settings.claude_code_probe_base_url, self._settings.claude_code_probe_model, self._settings.claude_code_oauth_access_token),
        }
        base_url, model, token = target_map[provider_key]
        if not status.configured:
            result = OAuthAccountProbeResult(provider_key=provider_key, ready=False, probe_mode="readiness_only", status="failed", details=status.readiness_reason, checked_at=now)
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result
        if not status.probe_enabled:
            result = OAuthAccountProbeResult(provider_key=provider_key, ready=True, probe_mode="readiness_only", status="warning", details="Probe disabled; credentials are configured.", checked_at=now)
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result
        payload = {"model": model, "messages": [{"role": "user", "content": "health probe"}], "stream": False, "max_tokens": 8}
        endpoint = f"{base_url.rstrip('/')}/chat/completions"
        try:
            response = httpx.post(endpoint, json=payload, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=self._settings.oauth_account_probe_timeout_seconds)
        except httpx.RequestError as exc:
            result = OAuthAccountProbeResult(provider_key=provider_key, ready=True, probe_mode="live_http_probe", status="failed", details=f"Probe request failed: {exc}", checked_at=now)
            self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
            return result
        result = OAuthAccountProbeResult(
            provider_key=provider_key,
            ready=True,
            probe_mode="live_http_probe",
            status="ok" if response.status_code < 400 else "failed",
            details=f"{provider_key} probe succeeded." if response.status_code < 400 else f"{provider_key} probe failed: {response.text[:300]}",
            status_code=response.status_code,
            checked_at=now,
        )
        self._record_oauth_operation(provider_key, "probe", result.status, result.details, now)
        return result

    def sync_oauth_account_bridge_profiles(self) -> dict[str, object]:
        provider_configs = {
            "antigravity": (self._settings.antigravity_bridge_profile_enabled, self._settings.antigravity_probe_base_url, self._settings.antigravity_oauth_access_token, self._settings.antigravity_probe_model),
            "github_copilot": (self._settings.github_copilot_bridge_profile_enabled, self._settings.github_copilot_probe_base_url, self._settings.github_copilot_oauth_access_token, self._settings.github_copilot_probe_model),
            "claude_code": (self._settings.claude_code_bridge_profile_enabled, self._settings.claude_code_probe_base_url, self._settings.claude_code_oauth_access_token, self._settings.claude_code_probe_model),
        }
        upserted: list[str] = []
        skipped: list[str] = []
        for provider_key, (enabled, base_url, token, model) in provider_configs.items():
            if not enabled:
                skipped.append(provider_key)
                self._record_oauth_operation(provider_key, "bridge_sync", "skipped", "Bridge profile sync disabled in settings.", datetime.now(tz=UTC).isoformat())
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
                capabilities={"streaming": True, "model_source": "manual", "discovery_support": False},
            )
            self._harness.upsert_profile(profile)
            upserted.append(profile.provider_key)
            self._record_oauth_operation(provider_key, "bridge_sync", "ok", f"Upserted bridge profile {profile.provider_key}.", datetime.now(tz=UTC).isoformat())
        return {"status": "ok", "upserted_profiles": upserted, "skipped": skipped}

    def _record_oauth_operation(self, provider_key: str, action: Literal["probe", "bridge_sync"], status: Literal["ok", "warning", "failed", "skipped"], details: str, executed_at: str) -> None:
        self._oauth_operations.append(OAuthOperationRecord(provider_key=provider_key, action=action, status=status, details=details, executed_at=executed_at))
        if len(self._oauth_operations) > 200:
            self._oauth_operations = self._oauth_operations[-200:]


    def upsert_harness_profile(self, payload: HarnessProviderProfile):
        return self._harness.upsert_profile(payload)

    def delete_harness_profile(self, provider_key: str) -> None:
        self._harness.delete_profile(provider_key)

    def set_harness_profile_active(self, provider_key: str, enabled: bool):
        return self._harness.set_profile_active(provider_key, enabled)

    def list_harness_profiles(self):
        return self._harness.list_profiles()

    def harness_preview(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        preview = self._harness.build_request_preview(payload)
        return {"status": "ok", "preview": preview}

    def harness_dry_run(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        result = self._harness.dry_run(payload)
        return {"status": "ok", **result}

    def harness_probe(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        try:
            result = self._harness.probe(payload)
        except RuntimeError as exc:
            self._analytics.record_integration_error(
                provider=payload.provider_key,
                model=payload.model,
                integration_class="harness_probe",
                template_id=None,
                test_phase="probe",
                error_type="probe_runtime_error",
                status_code=422,
                client_id="control_plane",
                profile_key=payload.provider_key,
            )
            raise
        if int(result["status_code"]) >= 400:
            self._analytics.record_integration_error(
                provider=payload.provider_key,
                model=payload.model,
                integration_class="harness_probe",
                template_id=None,
                test_phase="probe",
                error_type="probe_failed",
                status_code=int(result["status_code"]),
                client_id="control_plane",
                profile_key=payload.provider_key,
            )
        return {"status": "ok", **result}

    def verify_harness_profile(self, payload: HarnessVerificationRequest) -> dict[str, object]:
        result = self._harness.verify_profile(payload)
        for step in result.steps:
            if step["status"] in {"failed", "error"}:
                self._analytics.record_integration_error(
                    provider=payload.provider_key,
                    model=payload.model,
                    integration_class=result.integration_class,
                    template_id=None,
                    test_phase=str(step["step"]),
                    error_type="harness_step_failed",
                    status_code=422,
                    client_id="control_plane",
                    profile_key=payload.provider_key,
                )
        return result.model_dump()

    def run_sync(self, target_provider: str | None = None) -> dict[str, object]:
        providers = [self.get_provider(target_provider)] if target_provider else self.list_providers()
        now = datetime.now(tz=UTC).isoformat()
        for provider in providers:
            provider.last_sync_error = None
            if provider.provider == "openai_codex":
                for model_id in self._settings.openai_codex_discovered_models:
                    if model_id not in {m.id for m in provider.managed_models}:
                        provider.managed_models.append(ManagedModelRecord(id=model_id, source="discovered", discovery_status="synced", active=True))

            if provider.provider == "generic_harness":
                profile_failures = 0
                for profile in self._harness.list_profiles():
                    sync_state = self._harness.sync_profile_inventory(profile.provider_key)
                    if sync_state.last_sync_status != "ok":
                        profile_failures += 1
                        self._analytics.record_integration_error(
                            provider="generic_harness",
                            model=None,
                            integration_class=sync_state.integration_class,
                            template_id=sync_state.template_id,
                            test_phase="sync_inventory",
                            error_type=sync_state.last_sync_error or "sync_warning",
                            status_code=422,
                            client_id="control_plane",
                            profile_key=profile.provider_key,
                        )
                    existing_map = {m.id: m for m in provider.managed_models}
                    profile_model_ids = {item.model for item in sync_state.model_inventory}
                    for item in sync_state.model_inventory:
                        model_id = item.model
                        if model_id in existing_map:
                            existing_map[model_id].source = item.source
                            existing_map[model_id].discovery_status = sync_state.last_sync_status
                            existing_map[model_id].active = item.active
                        else:
                            provider.managed_models.append(ManagedModelRecord(id=model_id, source=item.source, discovery_status=sync_state.last_sync_status, active=item.active))
                    for model_id in [m.id for m in provider.managed_models if m.source in {"manual", "templated", "discovered", "static"} and m.id not in profile_model_ids and m.id != "no_models_configured"]:
                        existing_map = {m.id: m for m in provider.managed_models}
                        if model_id in existing_map:
                            existing_map[model_id].active = False
                            existing_map[model_id].discovery_status = "stale"
                if profile_failures:
                    provider.last_sync_error = f"{profile_failures} harness profile sync issues"
                    provider.last_sync_status = "warning"
                else:
                    provider.last_sync_status = "ok"

            provider.last_sync_at = now
            if provider.last_sync_status == "never":
                provider.last_sync_status = "ok"
        return {"status": "ok", "synced_providers": [provider.provider for provider in providers], "sync_at": now, "note": "Sync merges native discovery + persisted harness inventory."}

    def harness_snapshot(self) -> dict[str, object]:
        return {"status": "ok", "snapshot": self._harness.export_snapshot()}

    def harness_runs(self, provider_key: str | None = None, mode: str | None = None, status: str | None = None, client_id: str | None = None, limit: int = 200) -> dict[str, object]:
        runs = self._harness.list_runs(provider_key, mode=mode, status=status, client_id=client_id, limit=limit)
        return {"status": "ok", "runs": [item.model_dump() for item in runs], "summary": self._harness.runs_summary(provider_key)}

    def get_health_config(self) -> HealthConfig:
        return self._health_config

    def update_health_config(self, payload: HealthConfigUpdateRequest) -> HealthConfig:
        for field in ["provider_health_enabled", "model_health_enabled", "interval_seconds", "probe_mode", "selected_models"]:
            value = getattr(payload, field)
            if value is not None:
                setattr(self._health_config, field, value)
        return self._health_config

    def run_health_checks(self) -> dict[str, object]:
        now = datetime.now(tz=UTC).isoformat()
        check_type = self._health_config.probe_mode
        for provider in self.list_providers():
            runtime_status = self._providers.get_provider_status(provider.provider) if provider.provider in {m.provider for m in self._registry.list_active_models()} else None
            for model in provider.managed_models:
                if self._health_config.selected_models and model.id not in self._health_config.selected_models:
                    continue
                key = f"{provider.provider}:{model.id}"
                status_record = HealthStatusRecord(provider=provider.provider, model=model.id, check_type=check_type, status="unknown", last_check_at=now)
                if not self._health_config.model_health_enabled:
                    status_record.status = "discovery_only"
                elif not provider.enabled:
                    status_record.status = "unavailable"
                    status_record.last_error = "provider_disabled"
                    self._analytics.record_health_check_error(provider=provider.provider, model=model.id, check_type=check_type, error_type="provider_disabled")
                elif not runtime_status:
                    status_record.status = "unknown"
                    status_record.last_error = "provider_not_wired"
                elif not runtime_status["ready"]:
                    status_record.status = "not_configured"
                    status_record.readiness_reason = str(runtime_status["readiness_reason"])
                    self._analytics.record_health_check_error(provider=provider.provider, model=model.id, check_type=check_type, error_type="not_configured")
                else:
                    status_record.status = "healthy" if check_type != "discovery" else "discovery_only"
                    status_record.last_success_at = now
                    self._record_health_check_cost(provider.provider, model.id, check_type)
                self._health_records[key] = status_record
                self._analytics.record_health_status(provider=status_record.provider, model=status_record.model, check_type=status_record.check_type, status=status_record.status, readiness_reason=status_record.readiness_reason, last_error=status_record.last_error)
        return {"status": "ok", "check_type": check_type, "checked_at": now, "health_records": [record.model_dump() for record in self._health_records.values()]}

    def _record_health_check_cost(self, provider: str, model: str, check_type: str) -> None:
        usage = TokenUsage(input_tokens=8, output_tokens=4, total_tokens=12)
        cost = self._usage_accounting.costs_for_provider(provider=provider, usage=usage, oauth_mode=(provider == "openai_codex"))
        self._analytics.record_health_check(provider=provider, model=model, usage=usage, cost=cost, check_type=check_type, credential_type="health_probe", auth_source="control_plane")

    def provider_control_snapshot(self) -> list[dict[str, object]]:
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
        snapshot: list[dict[str, object]] = []
        harness_profiles = self._harness.list_profiles()
        harness_runs = self._harness.list_runs(limit=500)
        for provider in self.list_providers():
            runtime_status = self._providers.get_provider_status(provider.provider) if provider.provider in {m.provider for m in self._registry.list_active_models()} else None
            snapshot.append(
                {
                    "provider": provider.provider,
                    "label": provider.label,
                    "enabled": provider.enabled,
                    "integration_class": provider.integration_class,
                    "template_id": provider.template_id,
                    "config": provider.config,
                    "last_sync_at": provider.last_sync_at,
                    "last_sync_status": provider.last_sync_status,
                    "last_sync_error": provider.last_sync_error,
                    "ready": runtime_status["ready"] if runtime_status else False,
                    "readiness_reason": runtime_status["readiness_reason"] if runtime_status else "provider_not_wired",
                    "capabilities": runtime_status["capabilities"] if runtime_status else {},
                    "provider_axis": (runtime_status["capabilities"].get("provider_axis") if runtime_status else "unknown"),
                    "auth_mechanism": (runtime_status["capabilities"].get("auth_mechanism") if runtime_status else "unknown"),
                    "oauth_required": runtime_status["oauth_required"] if runtime_status else False,
                    "discovery_supported": runtime_status["discovery_supported"] if runtime_status else False,
                    "model_count": len(provider.managed_models),
                    "models": [{**model.model_dump(), "health_status": health_by_provider.get(provider.provider, {}).get(model.id, "unknown")} for model in provider.managed_models],
                    "harness_profile_count": len([p for p in harness_profiles if p.enabled]) if provider.provider == "generic_harness" else 0,
                    "harness_needs_attention_count": len([p for p in harness_profiles if p.needs_attention]) if provider.provider == "generic_harness" else 0,
                    "harness_run_count": len(harness_runs) if provider.provider == "generic_harness" else 0,
                    "oauth_failure_count": oauth_failures.get(provider.provider, 0),
                    "oauth_last_probe": oauth_last_probe.get(provider.provider),
                    "oauth_last_bridge_sync": oauth_last_bridge.get(provider.provider),
                }
            )
        return snapshot


@lru_cache(maxsize=1)
def get_control_plane_service() -> ControlPlaneService:
    settings = get_settings()
    harness = get_harness_service()
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings, harness_service=harness)
    analytics = get_usage_analytics_store()
    return ControlPlaneService(settings, registry, providers, analytics, harness)
