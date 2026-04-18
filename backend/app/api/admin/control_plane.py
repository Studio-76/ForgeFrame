"""In-memory admin control-plane service for provider and model management workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache

from pydantic import BaseModel, Field

from app.core.model_registry import ModelRegistry
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings


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


class ControlPlaneService:
    def __init__(self, settings: Settings, registry: ModelRegistry, providers: ProviderRegistry):
        self._settings = settings
        self._registry = registry
        self._providers = providers
        self._providers_state = self._bootstrap_provider_state()

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

    def provider_control_snapshot(self) -> list[dict[str, object]]:
        snapshot: list[dict[str, object]] = []
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
                    "models": [model.model_dump() for model in provider.managed_models],
                }
            )
        return snapshot


@lru_cache(maxsize=1)
def get_control_plane_service() -> ControlPlaneService:
    settings = get_settings()
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    return ControlPlaneService(settings, registry, providers)
