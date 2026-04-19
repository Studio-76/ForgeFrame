"""Admin control-plane service for provider/model/health/harness workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from typing import Literal

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
        codex_status = self._providers.get_provider_status("openai_codex")
        gemini_status = self._providers.get_provider_status("gemini")
        harness_status = self._providers.get_provider_status("generic_harness")
        targets = [
            BetaProviderTarget(
                provider_key="openai_codex",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth/api_key hybrid",
                runtime_path="native provider adapter",
                readiness="partial",
                readiness_score=62 if codex_status["ready"] else 48,
                runtime_readiness="partial",
                streaming_readiness="planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="provider + model health with auth readiness",
                verify_probe_axis="verify/probe supported",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + harness control plane",
                status_summary="Auth semantics wired; runtime bridge still beta-scaffold.",
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
                readiness_score=46 if gemini_status["ready"] else 34,
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="provider/model discovery + auth readiness",
                verify_probe_axis="verify/probe supported via harness/runtime",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers + usage + harness",
                status_summary="OAuth/account credentials modeled; runtime implementation pending.",
                oauth_account_provider=True,
                notes="Existing path; needs stronger beta account onboarding.",
            ),
            BetaProviderTarget(
                provider_key="antigravity",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness="planned",
                readiness_score=24,
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth + connection + discovery phases",
                verify_probe_axis="verify/probe planned on generic harness profile",
                observability_axis="integration/profile/client error axis",
                ui_axis="beta target table + harness onboarding",
                status_summary="Model axis explicit, no native adapter yet.",
                oauth_account_provider=True,
                notes="Beta target explicitly planned; adapter not yet native.",
            ),
            BetaProviderTarget(
                provider_key="github_copilot",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness="planned",
                readiness_score=23,
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth/session readiness + probe",
                verify_probe_axis="verify/probe planned with profile template",
                observability_axis="client/integration/profile errors",
                ui_axis="providers beta target table",
                status_summary="OAuth/account axis explicit, runtime bridge pending.",
                oauth_account_provider=True,
                notes="Beta target explicitly planned; runtime bridge pending.",
            ),
            BetaProviderTarget(
                provider_key="claude_code",
                provider_type="oauth_account",
                product_axis="oauth_account_providers",
                auth_model="oauth_account",
                runtime_path="generic openai-compatible harness",
                readiness="planned",
                readiness_score=23,
                runtime_readiness="planned",
                streaming_readiness="planned",
                verify_probe_readiness="partial",
                ui_readiness="partial",
                beta_tier="concept",
                health_semantics="auth + request rendering + mapping",
                verify_probe_axis="verify/probe planned",
                observability_axis="provider/model/client/integration/profile",
                ui_axis="providers beta target table",
                status_summary="OAuth/account axis explicit, dedicated adapter pending.",
                oauth_account_provider=True,
                notes="Beta target explicitly planned; dedicated adapter pending.",
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
                readiness="partial",
                readiness_score=44,
                runtime_readiness="partial",
                streaming_readiness="partial",
                verify_probe_readiness="ready",
                ui_readiness="partial",
                beta_tier="beta",
                health_semantics="connection/discovery/model availability",
                verify_probe_axis="verify/probe via local endpoint profile",
                observability_axis="provider/model/client integration errors",
                ui_axis="beta target table + harness profile template",
                status_summary="Dedicated local axis with explicit template and control-plane lifecycle.",
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
