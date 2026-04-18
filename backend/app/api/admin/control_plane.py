"""In-memory admin control-plane service for provider/model/health workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field

from app.core.model_registry import ModelRegistry
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store
from app.usage.models import CostBreakdown, TokenUsage
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
    config: dict[str, str] = Field(default_factory=dict)
    last_sync_at: str | None = None
    last_sync_status: str = "never"
    managed_models: list[ManagedModelRecord] = Field(default_factory=list)


class ProviderCreateRequest(BaseModel):
    provider: str
    label: str
    config: dict[str, str] = Field(default_factory=dict)


class ProviderUpdateRequest(BaseModel):
    label: str | None = None
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


class ControlPlaneService:
    def __init__(
        self,
        settings: Settings,
        registry: ModelRegistry,
        providers: ProviderRegistry,
        analytics_store: UsageAnalyticsStore,
    ):
        self._settings = settings
        self._registry = registry
        self._providers = providers
        self._usage_accounting = UsageAccountingService(settings)
        self._analytics = analytics_store
        self._providers_state = self._bootstrap_provider_state()
        self._health_config = HealthConfig()
        self._health_records: dict[str, HealthStatusRecord] = {}

    def _bootstrap_provider_state(self) -> dict[str, ManagedProviderRecord]:
        provider_map: dict[str, ManagedProviderRecord] = {}
        models = self._registry.list_active_models()
        provider_names = sorted({model.provider for model in models})

        for provider_name in provider_names:
            provider_map[provider_name] = ManagedProviderRecord(
                provider=provider_name,
                label=provider_name,
                enabled=True,
                managed_models=[
                    ManagedModelRecord(
                        id=model.id,
                        source=model.source,
                        discovery_status=model.discovery_status,
                        active=model.active,
                    )
                    for model in models
                    if model.provider == provider_name
                ],
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
            config=payload.config,
            last_sync_status="created",
        )
        self._providers_state[payload.provider] = provider
        return provider

    def update_provider(self, provider_name: str, payload: ProviderUpdateRequest) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        if payload.label is not None:
            provider.label = payload.label
        if payload.config is not None:
            provider.config = payload.config
        return provider

    def set_provider_enabled(self, provider_name: str, enabled: bool) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        provider.enabled = enabled
        return provider

    def run_sync(self, target_provider: str | None = None) -> dict[str, object]:
        providers = [self.get_provider(target_provider)] if target_provider else self.list_providers()
        now = datetime.now(tz=UTC).isoformat()

        for provider in providers:
            if provider.provider in {"openai_codex"}:
                discovered_models = self._settings.openai_codex_discovered_models
                if discovered_models:
                    existing_ids = {model.id for model in provider.managed_models}
                    for model_id in discovered_models:
                        if model_id not in existing_ids:
                            provider.managed_models.append(
                                ManagedModelRecord(
                                    id=model_id,
                                    source="discovered",
                                    discovery_status="synced",
                                    active=True,
                                )
                            )
            provider.last_sync_at = now
            provider.last_sync_status = "ok"

        return {
            "status": "ok",
            "synced_providers": [provider.provider for provider in providers],
            "sync_at": now,
            "note": "Control-plane sync uses configured/discovered metadata in this phase.",
        }

    def get_health_config(self) -> HealthConfig:
        return self._health_config

    def update_health_config(self, payload: HealthConfigUpdateRequest) -> HealthConfig:
        if payload.provider_health_enabled is not None:
            self._health_config.provider_health_enabled = payload.provider_health_enabled
        if payload.model_health_enabled is not None:
            self._health_config.model_health_enabled = payload.model_health_enabled
        if payload.interval_seconds is not None:
            self._health_config.interval_seconds = payload.interval_seconds
        if payload.probe_mode is not None:
            self._health_config.probe_mode = payload.probe_mode
        if payload.selected_models is not None:
            self._health_config.selected_models = payload.selected_models
        return self._health_config

    def run_health_checks(self) -> dict[str, object]:
        now = datetime.now(tz=UTC).isoformat()
        check_type = self._health_config.probe_mode

        for provider in self.list_providers():
            runtime_status = None
            if provider.provider in {m.provider for m in self._registry.list_active_models()}:
                runtime_status = self._providers.get_provider_status(provider.provider)

            for model in provider.managed_models:
                if self._health_config.selected_models and model.id not in self._health_config.selected_models:
                    continue

                key = f"{provider.provider}:{model.id}"
                status_record = HealthStatusRecord(
                    provider=provider.provider,
                    model=model.id,
                    check_type=check_type,
                    status="unknown",
                    last_check_at=now,
                )

                if not self._health_config.model_health_enabled:
                    status_record.status = "discovery_only"
                elif not provider.enabled:
                    status_record.status = "unavailable"
                    status_record.last_error = "provider_disabled"
                elif not runtime_status:
                    status_record.status = "unknown"
                    status_record.last_error = "provider_not_wired"
                elif not runtime_status["ready"]:
                    status_record.status = "not_configured"
                    status_record.readiness_reason = str(runtime_status["readiness_reason"])
                elif check_type == "synthetic_probe":
                    status_record.status = "healthy"
                    status_record.last_success_at = now
                    self._record_health_check_cost(provider.provider, model.id, check_type)
                elif check_type == "discovery":
                    status_record.status = "discovery_only"
                    status_record.last_success_at = now
                    self._record_health_check_cost(provider.provider, model.id, check_type)
                else:
                    status_record.status = "healthy"
                    status_record.last_success_at = now
                    self._record_health_check_cost(provider.provider, model.id, check_type)

                self._health_records[key] = status_record

        return {
            "status": "ok",
            "check_type": check_type,
            "checked_at": now,
            "health_records": [record.model_dump() for record in self._health_records.values()],
        }

    def _record_health_check_cost(self, provider: str, model: str, check_type: str) -> None:
        usage = TokenUsage(input_tokens=8, output_tokens=4, total_tokens=12)
        cost = self._usage_accounting.costs_for_provider(provider=provider, usage=usage, oauth_mode=(provider == "openai_codex"))
        self._analytics.record_health_check(
            provider=provider,
            model=model,
            usage=usage,
            cost=cost,
            check_type=check_type,
            credential_type="health_probe",
            auth_source="control_plane",
        )

    def get_health_records(self) -> list[HealthStatusRecord]:
        return list(self._health_records.values())

    def provider_control_snapshot(self) -> list[dict[str, object]]:
        snapshot: list[dict[str, object]] = []
        health_by_provider: dict[str, dict[str, str]] = {}
        for record in self._health_records.values():
            health_by_provider.setdefault(record.provider, {})[record.model] = record.status

        for provider in self.list_providers():
            runtime_status = None
            if provider.provider in {m.provider for m in self._registry.list_active_models()}:
                runtime_status = self._providers.get_provider_status(provider.provider)

            snapshot.append(
                {
                    "provider": provider.provider,
                    "label": provider.label,
                    "enabled": provider.enabled,
                    "config": provider.config,
                    "last_sync_at": provider.last_sync_at,
                    "last_sync_status": provider.last_sync_status,
                    "ready": runtime_status["ready"] if runtime_status else False,
                    "readiness_reason": runtime_status["readiness_reason"] if runtime_status else "provider_not_wired",
                    "capabilities": runtime_status["capabilities"] if runtime_status else {},
                    "oauth_required": runtime_status["oauth_required"] if runtime_status else False,
                    "discovery_supported": runtime_status["discovery_supported"] if runtime_status else False,
                    "model_count": len(provider.managed_models),
                    "models": [
                        {
                            **model.model_dump(),
                            "health_status": health_by_provider.get(provider.provider, {}).get(model.id, "unknown"),
                        }
                        for model in provider.managed_models
                    ],
                }
            )
        return snapshot


@lru_cache(maxsize=1)
def get_control_plane_service() -> ControlPlaneService:
    settings = get_settings()
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    analytics = get_usage_analytics_store()
    return ControlPlaneService(settings, registry, providers, analytics)
