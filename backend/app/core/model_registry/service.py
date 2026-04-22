"""In-memory model registry baseline for ForgeGate phase 5."""

from app.control_plane import ControlPlaneStateRecord, ManagedModelRecord, ManagedProviderRecord
from app.core.model_registry.models import RuntimeModel
from app.settings.config import Settings
from app.storage.control_plane_repository import (
    ControlPlaneStateRepository,
    get_control_plane_state_repository,
)


class ModelRegistry:
    def __init__(
        self,
        settings: Settings,
        state_repository: ControlPlaneStateRepository | None = None,
    ):
        self._settings = settings
        self._state_repository = state_repository or get_control_plane_state_repository(settings)
        self._state = self._load_or_seed_state()
        self._models = self._build_registry()

    def _bootstrap_provider_state(self) -> list[ManagedProviderRecord]:
        providers: dict[str, ManagedProviderRecord] = {}
        for model_id, provider, owned_by in self._settings.bootstrap_model_catalog:
            if not self._settings.is_provider_enabled(provider):
                continue
            provider_record = providers.setdefault(
                provider,
                ManagedProviderRecord(
                    provider=provider,
                    label=owned_by,
                    enabled=True,
                    integration_class="harness_generic" if provider == "generic_harness" else "native",
                ),
            )
            provider_record.managed_models.append(
                ManagedModelRecord(
                    id=model_id,
                    source="static",
                    discovery_status="template_seed" if model_id == "generic-placeholder-chat" else "catalog",
                    active=model_id != "generic-placeholder-chat",
                    owned_by=owned_by,
                    display_name=model_id,
                    category="general",
                )
            )

        if self._settings.anthropic_enabled:
            provider_record = providers.setdefault(
                "anthropic",
                ManagedProviderRecord(
                    provider="anthropic",
                    label="Anthropic",
                    enabled=True,
                    integration_class="native",
                ),
            )
            existing_ids = {model.id for model in provider_record.managed_models}
            seed_models = [
                model_id
                for model_id in (
                    *self._settings.anthropic_discovered_models,
                    self._settings.anthropic_probe_model,
                )
                if model_id.strip()
            ]
            for model_id in seed_models:
                if model_id in existing_ids:
                    continue
                provider_record.managed_models.append(
                    ManagedModelRecord(
                        id=model_id,
                        source="discovered",
                        discovery_status="catalog",
                        active=True,
                        owned_by="Anthropic",
                        display_name=model_id,
                        category="general",
                        runtime_status="partial",
                        availability_status="healthy",
                        status_reason="anthropic_catalog_seed",
                    )
                )
                existing_ids.add(model_id)

        if self._settings.openai_codex_enabled and self._settings.openai_codex_discovery_enabled:
            provider_record = providers.setdefault(
                "openai_codex",
                ManagedProviderRecord(
                    provider="openai_codex",
                    label="OpenAI Codex",
                    enabled=True,
                    integration_class="native",
                )
            )
            for model_id in self._settings.openai_codex_discovered_models:
                existing_ids = {model.id for model in provider_record.managed_models}
                if model_id in existing_ids:
                    continue
                provider_record.managed_models.append(
                    ManagedModelRecord(
                        id=model_id,
                        source="discovered",
                        discovery_status="synced",
                        active=True,
                        owned_by="OpenAI Codex",
                        display_name=model_id,
                        category="general",
                    )
                )

        for provider_record in providers.values():
            provider_record.managed_models = sorted(
                provider_record.managed_models,
                key=lambda item: item.id,
            )

        return sorted(providers.values(), key=lambda item: item.provider)

    def _merge_bootstrap_provider_state(
        self,
        stored_state: ControlPlaneStateRecord,
    ) -> ControlPlaneStateRecord:
        if not self._settings.anthropic_enabled:
            return stored_state

        anthropic_bootstrap_provider = next(
            (
                provider
                for provider in self._bootstrap_provider_state()
                if provider.provider == "anthropic"
            ),
            None,
        )
        if anthropic_bootstrap_provider is None:
            return stored_state

        provider_map = {
            provider.provider: provider.model_copy(deep=True)
            for provider in stored_state.providers
        }

        existing_provider = provider_map.get(anthropic_bootstrap_provider.provider)
        if existing_provider is None:
            provider_map[anthropic_bootstrap_provider.provider] = anthropic_bootstrap_provider.model_copy(deep=True)
        else:
            existing_model_ids = {model.id for model in existing_provider.managed_models}
            for bootstrap_model in anthropic_bootstrap_provider.managed_models:
                if bootstrap_model.id in existing_model_ids:
                    continue
                existing_provider.managed_models.append(bootstrap_model.model_copy(deep=True))
                existing_model_ids.add(bootstrap_model.id)
            existing_provider.managed_models = sorted(existing_provider.managed_models, key=lambda item: item.id)

        return stored_state.model_copy(
            update={
                "providers": sorted(provider_map.values(), key=lambda item: item.provider),
            }
        )

    def _load_or_seed_state(self) -> ControlPlaneStateRecord:
        stored_state = self._state_repository.load_state()
        if stored_state is not None:
            merged_state = self._merge_bootstrap_provider_state(stored_state)
            if merged_state.model_dump() != stored_state.model_dump():
                return self._state_repository.save_state(merged_state)
            return merged_state
        seed_state = ControlPlaneStateRecord(
            providers=self._bootstrap_provider_state(),
        )
        return self._state_repository.save_state(seed_state)

    def _build_registry(self) -> dict[str, RuntimeModel]:
        models: dict[str, RuntimeModel] = {}
        for provider in self._state.providers:
            if not provider.enabled:
                continue
            if not self._settings.is_provider_enabled(provider.provider):
                continue
            for managed_model in provider.managed_models:
                if not managed_model.active:
                    continue
                models[managed_model.id] = RuntimeModel(
                    id=managed_model.id,
                    provider=provider.provider,
                    owned_by=managed_model.owned_by or provider.label or provider.provider,
                    display_name=managed_model.display_name or managed_model.id,
                    category=managed_model.category,
                    active=managed_model.active and provider.enabled,
                    source=managed_model.source,
                    discovery_status=managed_model.discovery_status,
                    runtime_status=managed_model.runtime_status,
                    availability_status=managed_model.availability_status,
                    status_reason=managed_model.status_reason,
                    last_seen_at=managed_model.last_seen_at,
                    last_probe_at=managed_model.last_probe_at,
                    stale_since=managed_model.stale_since,
                )

        return models

    def list_active_models(self) -> list[RuntimeModel]:
        return [m for m in self._models.values() if m.active]

    def has_model(self, model_id: str) -> bool:
        model = self._models.get(model_id)
        return bool(model and model.active)

    def get_model(self, model_id: str) -> RuntimeModel | None:
        model = self._models.get(model_id)
        if model and model.active:
            return model
        return None

    def default_model(self) -> RuntimeModel:
        model = self.get_model(self._settings.default_model)
        if model:
            return model

        provider_candidates = [
            m for m in self.list_active_models() if m.provider == self._settings.default_provider
        ]
        if provider_candidates:
            return provider_candidates[0]

        active = self.list_active_models()
        if not active:
            raise RuntimeError("No active models configured in ForgeGate registry.")
        return active[0]

    def discovery_summary(self) -> dict[str, int]:
        active_models = self.list_active_models()
        return {
            "static": len([model for model in active_models if model.source == "static"]),
            "discovered": len([model for model in active_models if model.source == "discovered"]),
        }
