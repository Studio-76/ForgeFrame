"""Admin control-plane service for provider/model/health/harness workflows."""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.control_plane_axis_contracts_domain import ControlPlaneAxisContractsDomainMixin
from app.api.admin.control_plane_bootstrap_domain import ControlPlaneBootstrapDomainMixin
from app.api.admin.control_plane_harness_domain import ControlPlaneHarnessDomainMixin
from app.api.admin.control_plane_health_domain import ControlPlaneHealthDomainMixin
from app.api.admin.control_plane_models import (
    HealthConfigUpdateRequest,
    OAuthAccountProbeResult,
    OAuthAccountTargetStatus,
    ProviderCreateRequest,
    ProductAxisTarget,
    ProviderSyncRequest,
    ProviderUpdateRequest,
)
from app.api.admin.control_plane_oauth_operations_domain import (
    ControlPlaneOAuthOperationsDomainMixin,
)
from app.api.admin.control_plane_oauth_targets_domain import (
    ControlPlaneOAuthTargetsDomainMixin,
)
from app.api.admin.control_plane_provider_domain import ControlPlaneProviderDomainMixin
from app.api.admin.control_plane_routing_domain import ControlPlaneRoutingDomainMixin
from app.api.admin.control_plane_snapshot_domain import ControlPlaneSnapshotDomainMixin
from app.api.admin.control_plane_targets_domain import ControlPlaneTargetsDomainMixin
from app.api.admin.control_plane_truth_domain import ControlPlaneTruthDomainMixin
from app.control_plane import HealthConfig, RoutingBudgetStateRecord
from app.core.model_registry import ModelRegistry
from app.harness.service import HarnessService, get_harness_service
from app.instances.models import InstanceRecord
from app.providers import ProviderRegistry
from app.settings.config import Settings, get_settings
from app.storage.control_plane_repository import (
    ControlPlaneStateRepository,
    get_control_plane_state_repository,
)
from app.storage.oauth_operations_repository import (
    OAuthOperationsRepository,
    get_oauth_operations_repository,
)
from app.tenancy import normalize_tenant_id
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store
from app.usage.service import UsageAccountingService


class ControlPlaneService(
    ControlPlaneProviderDomainMixin,
    ControlPlaneTargetsDomainMixin,
    ControlPlaneRoutingDomainMixin,
    ControlPlaneAxisContractsDomainMixin,
    ControlPlaneOAuthTargetsDomainMixin,
    ControlPlaneOAuthOperationsDomainMixin,
    ControlPlaneHarnessDomainMixin,
    ControlPlaneHealthDomainMixin,
    ControlPlaneBootstrapDomainMixin,
    ControlPlaneTruthDomainMixin,
    ControlPlaneSnapshotDomainMixin,
):
    def __init__(
        self,
        settings: Settings,
        instance: InstanceRecord,
        registry: ModelRegistry,
        providers: ProviderRegistry,
        analytics_store: UsageAnalyticsStore,
        harness: HarnessService,
        state_repository: ControlPlaneStateRepository | None = None,
        oauth_operations_repository: OAuthOperationsRepository | None = None,
    ):
        self._settings = settings
        self._instance = instance
        self._default_tenant_id = normalize_tenant_id(instance.tenant_id)
        self._registry = registry
        self._providers = providers
        self._usage_accounting = UsageAccountingService(settings)
        self._analytics = analytics_store
        self._harness = harness
        self._state_repository = state_repository or get_control_plane_state_repository(settings)
        self._oauth_operations_repository = oauth_operations_repository or get_oauth_operations_repository(settings)

        stored_state = self._state_repository.load_state(instance.instance_id)
        self._providers_state = self._load_provider_state(
            stored_state.providers if stored_state else None
        )
        self._health_config = stored_state.health_config if stored_state else HealthConfig()
        self._health_records = self._load_health_records(
            stored_state.health_records if stored_state else []
        )
        self._last_bootstrap_readiness = (
            stored_state.last_bootstrap_readiness if stored_state else None
        )
        if self._last_bootstrap_readiness is None:
            self._last_bootstrap_readiness = self._build_bootstrap_readiness_report()
        self._provider_targets_state = self._load_provider_targets(
            stored_state.provider_targets if stored_state else None
        )
        self._routing_policies_state = self._load_routing_policies(
            stored_state.routing_policies if stored_state else None
        )
        self._routing_budget_state = self._load_routing_budget_state(
            stored_state.routing_budget_state if stored_state else RoutingBudgetStateRecord()
        )
        self._routing_circuits_state = self._load_routing_circuits(
            stored_state.routing_circuits if stored_state else None
        )
        self._routing_decisions_state = self._load_routing_decisions(
            stored_state.routing_decisions if stored_state else []
        )
        self._persist_state()


@lru_cache(maxsize=32)
def _build_control_plane_service(instance_id: str) -> ControlPlaneService:
    settings = get_settings()
    harness = get_harness_service()
    from app.instances.service import get_instance_service

    instance = get_instance_service().get_instance(instance_id)
    registry = ModelRegistry(settings, instance_id=instance.instance_id)
    providers = ProviderRegistry(settings, harness_service=harness)
    analytics = get_usage_analytics_store()
    return ControlPlaneService(settings, instance, registry, providers, analytics, harness)


def get_control_plane_service(
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
) -> ControlPlaneService:
    if not isinstance(instance, InstanceRecord):
        from app.instances.service import get_instance_service

        instance = get_instance_service().resolve_instance(allow_default=True)
    return _build_control_plane_service(instance.instance_id)


get_control_plane_service.cache_clear = _build_control_plane_service.cache_clear  # type: ignore[attr-defined]


__all__ = [
    "ControlPlaneService",
    "HealthConfigUpdateRequest",
    "OAuthAccountProbeResult",
    "OAuthAccountTargetStatus",
    "ProductAxisTarget",
    "ProviderCreateRequest",
    "ProviderSyncRequest",
    "ProviderUpdateRequest",
    "get_control_plane_service",
]
