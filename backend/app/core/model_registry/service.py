"""In-memory model registry baseline for ForgeFrame phase 5."""

from app.control_plane import ControlPlaneStateRecord, ManagedModelRecord, ManagedProviderRecord
from app.control_plane.routing_defaults import (
    build_default_routing_policies,
    merge_routing_circuits,
    merge_routing_policies,
    normalize_routing_budget_state,
)
from app.control_plane.target_defaults import (
    build_default_targets_from_providers,
    ensure_model_registry_metadata,
    merge_targets_with_defaults,
)
from app.core.model_registry.models import RuntimeModel, RuntimeTarget
from app.settings.config import Settings
from app.storage.control_plane_repository import (
    ControlPlaneStateRepository,
    get_control_plane_state_repository,
)
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


class ModelRegistry:
    def __init__(
        self,
        settings: Settings,
        instance_id: str | None = None,
        state_repository: ControlPlaneStateRepository | None = None,
    ):
        self._settings = settings
        self._instance_id = instance_id
        self._state_repository = state_repository or get_control_plane_state_repository(settings)
        self._state = self._load_or_seed_state()
        self._models = self._build_registry()
        self._models_by_id = self._index_models_by_id()
        self._targets = self._build_target_registry()

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
                ensure_model_registry_metadata(
                    ManagedModelRecord(
                        id=model_id,
                        source="static",
                        discovery_status="template_seed" if model_id == "generic-placeholder-chat" else "catalog",
                        active=model_id != "generic-placeholder-chat",
                        owned_by=owned_by,
                        display_name=model_id,
                        category="general",
                    ),
                    provider_label=owned_by,
                    provider_name=provider,
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
                    ensure_model_registry_metadata(
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
                        ),
                        provider_label="Anthropic",
                        provider_name="anthropic",
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
                    ensure_model_registry_metadata(
                        ManagedModelRecord(
                            id=model_id,
                            source="discovered",
                            discovery_status="synced",
                            active=True,
                            owned_by="OpenAI Codex",
                            display_name=model_id,
                            category="general",
                        ),
                        provider_label="OpenAI Codex",
                        provider_name="openai_codex",
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
        stored_state = self._state_repository.load_state(self._instance_id)
        if stored_state is not None:
            merged_state = self._merge_bootstrap_provider_state(stored_state)
            default_targets = build_default_targets_from_providers(
                merged_state.providers,
                instance_id=self._instance_id or DEFAULT_BOOTSTRAP_TENANT_ID,
                default_model=self._settings.default_model,
                default_provider=self._settings.default_provider,
            )
            merged_state = merged_state.model_copy(
                update={
                    "provider_targets": merge_targets_with_defaults(
                        default_targets,
                        merged_state.provider_targets,
                    ),
                }
            )
            available_target_keys = [target.target_key for target in merged_state.provider_targets]
            merged_state = merged_state.model_copy(
                update={
                    "routing_policies": merge_routing_policies(
                        build_default_routing_policies(merged_state.provider_targets),
                        merged_state.routing_policies,
                        available_target_keys=available_target_keys,
                    ),
                    "routing_budget_state": normalize_routing_budget_state(
                        merged_state.routing_budget_state
                    ),
                    "routing_circuits": merge_routing_circuits(
                        merged_state.routing_circuits,
                        available_target_keys=available_target_keys,
                    ),
                }
            )
            if merged_state.model_dump() != stored_state.model_dump():
                return self._state_repository.save_state(merged_state)
            return merged_state
        seed_state = ControlPlaneStateRecord(
            instance_id=self._instance_id or DEFAULT_BOOTSTRAP_TENANT_ID,
            providers=self._bootstrap_provider_state(),
        )
        seed_state.provider_targets = build_default_targets_from_providers(
            seed_state.providers,
            instance_id=self._instance_id or DEFAULT_BOOTSTRAP_TENANT_ID,
            default_model=self._settings.default_model,
            default_provider=self._settings.default_provider,
        )
        seed_state.routing_policies = build_default_routing_policies(seed_state.provider_targets)
        return self._state_repository.save_state(seed_state)

    def _build_registry(self) -> dict[str, RuntimeModel]:
        models: dict[str, RuntimeModel] = {}
        for provider in self._state.providers:
            if not provider.enabled:
                continue
            if not self._settings.is_provider_enabled(provider.provider):
                continue
            for managed_model in provider.managed_models:
                ensure_model_registry_metadata(
                    managed_model,
                    provider.label or provider.provider,
                    provider.provider,
                )
                if not managed_model.active:
                    continue
                runtime_model = RuntimeModel(
                    id=managed_model.id,
                    provider=provider.provider,
                    owned_by=managed_model.owned_by or provider.label or provider.provider,
                    display_name=managed_model.display_name or managed_model.id,
                    category=managed_model.category,
                    routing_key=managed_model.routing_key,
                    capabilities=dict(managed_model.capabilities),
                    execution_traits=dict(managed_model.execution_traits),
                    policy_flags=dict(managed_model.policy_flags),
                    economic_profile=dict(managed_model.economic_profile),
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
                models[runtime_model.routing_key or runtime_model.id] = runtime_model

        return models

    def _index_models_by_id(self) -> dict[str, list[RuntimeModel]]:
        indexed: dict[str, list[RuntimeModel]] = {}
        for model in self._models.values():
            indexed.setdefault(model.id, []).append(model)
        for model_id in indexed:
            indexed[model_id] = sorted(
                indexed[model_id],
                key=lambda item: (item.provider != self._settings.default_provider, item.provider, item.routing_key or item.id),
            )
        return indexed

    def _build_target_registry(self) -> dict[str, RuntimeTarget]:
        targets: dict[str, RuntimeTarget] = {}
        for target in self._state.provider_targets:
            model = self.get_model_by_routing_key(target.model_routing_key)
            if model is None:
                continue
            targets[target.target_key] = RuntimeTarget(
                target_key=target.target_key,
                provider=target.provider,
                model_id=target.model_id,
                model_routing_key=target.model_routing_key,
                label=target.label,
                instance_id=target.instance_id,
                product_axis=target.product_axis,
                auth_type=target.auth_type,
                credential_type=target.credential_type,
                capability_profile=dict(target.capability_profile),
                technical_capabilities=dict(target.technical_capabilities),
                execution_traits=dict(target.execution_traits),
                policy_flags=dict(target.policy_flags),
                economic_profile=dict(target.economic_profile),
                cost_class=target.cost_class,
                latency_class=target.latency_class,
                enabled=target.enabled,
                priority=target.priority,
                queue_eligible=target.queue_eligible,
                stream_capable=target.stream_capable,
                tool_capable=target.tool_capable,
                vision_capable=target.vision_capable,
                fallback_allowed=target.fallback_allowed,
                fallback_target_keys=list(target.fallback_target_keys),
                escalation_allowed=target.escalation_allowed,
                escalation_target_keys=list(target.escalation_target_keys),
                health_status=target.health_status,
                availability_status=target.availability_status,
                readiness_status=target.readiness_status,
                status_reason=target.status_reason,
                last_seen_at=target.last_seen_at,
                last_probe_at=target.last_probe_at,
                stale_since=target.stale_since,
                model=model,
            )
        return targets

    def list_active_models(self) -> list[RuntimeModel]:
        return [m for m in self._models.values() if m.active]

    def list_targets(self) -> list[RuntimeTarget]:
        return list(self._targets.values())

    def list_active_targets(self) -> list[RuntimeTarget]:
        return [target for target in self._targets.values() if target.enabled and target.model.active]

    def get_target(self, target_key: str) -> RuntimeTarget | None:
        return self._targets.get(target_key)

    def has_model(self, model_id: str) -> bool:
        return any(model.active for model in self._models_by_id.get(model_id, []))

    def get_model(self, model_id: str) -> RuntimeModel | None:
        models = self._models_by_id.get(model_id, [])
        return next((model for model in models if model.active), None)

    def get_model_by_routing_key(self, routing_key: str | None) -> RuntimeModel | None:
        if routing_key is None:
            return None
        model = self._models.get(routing_key)
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
            raise RuntimeError("No active models configured in ForgeFrame registry.")
        return active[0]

    def discovery_summary(self) -> dict[str, int]:
        active_models = self.list_active_models()
        return {
            "static": len([model for model in active_models if model.source == "static"]),
            "discovered": len([model for model in active_models if model.source == "discovered"]),
        }
