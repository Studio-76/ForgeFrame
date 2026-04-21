"""Provider and persisted state domain behavior for the control plane."""

from __future__ import annotations

from datetime import UTC, datetime

from app.api.admin.control_plane_models import ProviderCreateRequest, ProviderUpdateRequest
from app.control_plane import ControlPlaneStateRecord, HealthConfig, HealthStatusRecord, ManagedModelRecord, ManagedProviderRecord


class ControlPlaneProviderDomainMixin:
    @staticmethod
    def _managed_model_runtime_status(model: ManagedModelRecord) -> str:
        if not model.active:
            return "unavailable"
        if model.discovery_status in {"stale", "removed", "removed_from_profile_models"}:
            return "stale"
        if model.discovery_status in {"warning", "failed"}:
            return "failed"
        if model.source in {"discovered", "manual", "templated"}:
            return "partial"
        return "ready"

    @staticmethod
    def _managed_model_availability(model: ManagedModelRecord) -> str:
        if not model.active:
            return "unavailable"
        if model.discovery_status in {"stale", "removed", "removed_from_profile_models"}:
            return "stale"
        if model.discovery_status in {"warning", "failed"}:
            return "degraded"
        return "healthy"

    def _bootstrap_provider_state(self) -> dict[str, ManagedProviderRecord]:
        provider_map: dict[str, ManagedProviderRecord] = {}
        for model in self._registry.list_active_models():
            provider = provider_map.setdefault(
                model.provider,
                ManagedProviderRecord(
                    provider=model.provider,
                    label=model.owned_by or model.provider,
                    enabled=True,
                    integration_class="harness_generic" if model.provider == "generic_harness" else "native",
                ),
            )
            provider.managed_models.append(
                ManagedModelRecord(
                    id=model.id,
                    source=model.source,
                    discovery_status=model.discovery_status,
                    active=model.active,
                    owned_by=model.owned_by,
                    display_name=model.display_name,
                    category=model.category,
                    runtime_status=model.runtime_status,
                    availability_status=model.availability_status,
                    status_reason=model.status_reason,
                    last_seen_at=model.last_seen_at,
                    last_probe_at=model.last_probe_at,
                    stale_since=model.stale_since,
                )
            )
        return provider_map

    @staticmethod
    def _health_record_key(provider: str, model: str) -> str:
        return f"{provider}:{model}"

    def _load_health_records(self, records: list[HealthStatusRecord]) -> dict[str, HealthStatusRecord]:
        loaded: dict[str, HealthStatusRecord] = {}
        for record in records:
            loaded[self._health_record_key(record.provider, record.model)] = record
        return loaded

    def _load_provider_state(
        self,
        stored_providers: list[ManagedProviderRecord] | None,
    ) -> dict[str, ManagedProviderRecord]:
        provider_map = {
            key: value.model_copy(deep=True)
            for key, value in self._bootstrap_provider_state().items()
        }
        if not stored_providers:
            return provider_map

        for stored in stored_providers:
            existing = provider_map.get(stored.provider)
            if existing is None:
                provider_map[stored.provider] = stored.model_copy(deep=True)
                continue

            existing.label = stored.label
            existing.enabled = stored.enabled
            existing.integration_class = stored.integration_class
            existing.template_id = stored.template_id
            existing.config = dict(stored.config)
            existing.last_sync_at = stored.last_sync_at
            existing.last_sync_status = stored.last_sync_status
            existing.last_sync_error = stored.last_sync_error

            model_map = {
                model.id: model.model_copy(deep=True)
                for model in existing.managed_models
            }
            for stored_model in stored.managed_models:
                model_map[stored_model.id] = stored_model.model_copy(deep=True)
            existing.managed_models = sorted(model_map.values(), key=lambda item: item.id)
            for model in existing.managed_models:
                if not model.runtime_status:
                    model.runtime_status = self._managed_model_runtime_status(model)  # type: ignore[assignment]
                if not model.availability_status:
                    model.availability_status = self._managed_model_availability(model)  # type: ignore[assignment]

        return provider_map

    def _persist_state(self) -> ControlPlaneStateRecord:
        state = ControlPlaneStateRecord(
            providers=[item.model_copy(deep=True) for item in self.list_providers()],
            health_config=self._health_config.model_copy(deep=True),
            health_records=[
                item.model_copy(deep=True)
                for item in sorted(
                    self._health_records.values(),
                    key=lambda record: (record.provider, record.model),
                )
            ],
            last_bootstrap_readiness=(
                self._last_bootstrap_readiness.model_copy(deep=True)
                if self._last_bootstrap_readiness
                else None
            ),
        )
        return self._state_repository.save_state(state)

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
        self._persist_state()
        return provider

    def update_provider(
        self,
        provider_name: str,
        payload: ProviderUpdateRequest,
    ) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        if payload.label is not None:
            provider.label = payload.label
        if payload.integration_class is not None:
            provider.integration_class = payload.integration_class
        if payload.template_id is not None:
            provider.template_id = payload.template_id
        if payload.config is not None:
            provider.config = payload.config
        self._persist_state()
        return provider

    def set_provider_enabled(self, provider_name: str, enabled: bool) -> ManagedProviderRecord:
        provider = self.get_provider(provider_name)
        provider.enabled = enabled
        self._persist_state()
        return provider

    def run_sync(self, target_provider: str | None = None) -> dict[str, object]:
        providers = [self.get_provider(target_provider)] if target_provider else self.list_providers()
        now = datetime.now(tz=UTC).isoformat()
        for provider in providers:
            provider.last_sync_error = None
            if provider.provider == "openai_codex":
                for model_id in self._settings.openai_codex_discovered_models:
                    if model_id not in {model.id for model in provider.managed_models}:
                        provider.managed_models.append(
                            ManagedModelRecord(
                                id=model_id,
                                source="discovered",
                                discovery_status="synced",
                                active=True,
                                owned_by=provider.label or "OpenAI Codex",
                                display_name=model_id,
                                category="general",
                                runtime_status="partial",
                                availability_status="healthy",
                                status_reason="codex_discovery_sync",
                                last_seen_at=now,
                            )
                        )

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
                    existing_map = {model.id: model for model in provider.managed_models}
                    profile_model_ids = {item.model for item in sync_state.model_inventory}
                    for item in sync_state.model_inventory:
                        model_id = item.model
                        if model_id in existing_map:
                            existing_map[model_id].source = item.source
                            existing_map[model_id].discovery_status = sync_state.last_sync_status
                            existing_map[model_id].active = item.active
                            existing_map[model_id].owned_by = provider.label or provider.provider
                            existing_map[model_id].display_name = model_id
                            existing_map[model_id].runtime_status = "partial" if item.active else "unavailable"
                            existing_map[model_id].availability_status = "healthy" if item.active else "unavailable"
                            existing_map[model_id].status_reason = sync_state.last_sync_status
                            existing_map[model_id].last_seen_at = now
                            existing_map[model_id].stale_since = None if item.active else existing_map[model_id].stale_since
                        else:
                            provider.managed_models.append(
                                ManagedModelRecord(
                                    id=model_id,
                                    source=item.source,
                                    discovery_status=sync_state.last_sync_status,
                                    active=item.active,
                                    owned_by=provider.label or provider.provider,
                                    display_name=model_id,
                                    category="general",
                                    runtime_status="partial" if item.active else "unavailable",
                                    availability_status="healthy" if item.active else "unavailable",
                                    status_reason=sync_state.last_sync_status,
                                    last_seen_at=now,
                                )
                            )
                    for model_id in [
                        model.id
                        for model in provider.managed_models
                        if model.source in {"manual", "templated", "discovered", "static"}
                        and model.id not in profile_model_ids
                        and model.id != "no_models_configured"
                    ]:
                        existing_map = {model.id: model for model in provider.managed_models}
                        if model_id in existing_map:
                            existing_map[model_id].active = False
                            existing_map[model_id].discovery_status = "stale"
                            existing_map[model_id].runtime_status = "stale"
                            existing_map[model_id].availability_status = "stale"
                            existing_map[model_id].status_reason = "removed_from_profile_models"
                            existing_map[model_id].stale_since = now
                if profile_failures:
                    provider.last_sync_error = f"{profile_failures} harness profile sync issues"
                    provider.last_sync_status = "warning"
                else:
                    provider.last_sync_status = "ok"

            if provider.provider == "anthropic" and self._settings.anthropic_enabled:
                existing_ids = {model.id for model in provider.managed_models}
                for model_id in self._settings.anthropic_discovered_models:
                    if model_id in existing_ids:
                        continue
                    provider.managed_models.append(
                        ManagedModelRecord(
                            id=model_id,
                            source="discovered",
                            discovery_status="catalog",
                            active=True,
                            owned_by=provider.label or "Anthropic",
                            display_name=model_id,
                            category="general",
                            runtime_status="partial",
                            availability_status="healthy",
                            status_reason="anthropic_catalog_seed",
                            last_seen_at=now,
                        )
                    )

            provider.last_sync_at = now
            if provider.last_sync_status == "never":
                provider.last_sync_status = "ok"
            for model in provider.managed_models:
                if not model.runtime_status or model.runtime_status == "planned":
                    model.runtime_status = self._managed_model_runtime_status(model)  # type: ignore[assignment]
                if not model.availability_status or model.availability_status == "unknown":
                    model.availability_status = self._managed_model_availability(model)  # type: ignore[assignment]
            provider.managed_models = sorted(provider.managed_models, key=lambda item: item.id)
        self._persist_state()
        return {
            "status": "ok",
            "synced_providers": [provider.provider for provider in providers],
            "sync_at": now,
            "note": "Sync merges native discovery + persisted harness inventory.",
        }
