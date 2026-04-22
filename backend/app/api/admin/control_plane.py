"""Admin control-plane service for provider/model/health/harness workflows."""

from __future__ import annotations

from functools import lru_cache

from app.api.admin.control_plane_beta_domain import ControlPlaneBetaDomainMixin
from app.api.admin.control_plane_bootstrap_domain import ControlPlaneBootstrapDomainMixin
from app.api.admin.control_plane_harness_domain import ControlPlaneHarnessDomainMixin
from app.api.admin.control_plane_health_domain import ControlPlaneHealthDomainMixin
from app.api.admin.control_plane_models import (
    BetaProviderTarget,
    HealthConfigUpdateRequest,
    OAuthAccountProbeResult,
    OAuthAccountTargetStatus,
    ProviderCreateRequest,
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
from app.api.admin.control_plane_snapshot_domain import ControlPlaneSnapshotDomainMixin
from app.api.admin.control_plane_truth_domain import ControlPlaneTruthDomainMixin
from app.control_plane import HealthConfig
from app.core.model_registry import ModelRegistry
from app.harness.service import HarnessService, get_harness_service
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
    ControlPlaneBetaDomainMixin,
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
        registry: ModelRegistry,
        providers: ProviderRegistry,
        analytics_store: UsageAnalyticsStore,
        harness: HarnessService,
        state_repository: ControlPlaneStateRepository | None = None,
        oauth_operations_repository: OAuthOperationsRepository | None = None,
    ):
        self._settings = settings
        self._default_tenant_id = normalize_tenant_id(settings.bootstrap_tenant_id)
        self._registry = registry
        self._providers = providers
        self._usage_accounting = UsageAccountingService(settings)
        self._analytics = analytics_store
        self._harness = harness
        self._state_repository = state_repository or get_control_plane_state_repository(settings)
        self._oauth_operations_repository = oauth_operations_repository or get_oauth_operations_repository(settings)

        stored_state = self._state_repository.load_state()
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
        self._persist_state()


@lru_cache(maxsize=1)
def get_control_plane_service() -> ControlPlaneService:
    settings = get_settings()
    harness = get_harness_service()
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings, harness_service=harness)
    analytics = get_usage_analytics_store()
    return ControlPlaneService(settings, registry, providers, analytics, harness)


__all__ = [
    "BetaProviderTarget",
    "ControlPlaneService",
    "HealthConfigUpdateRequest",
    "OAuthAccountProbeResult",
    "OAuthAccountTargetStatus",
    "ProviderCreateRequest",
    "ProviderSyncRequest",
    "ProviderUpdateRequest",
    "get_control_plane_service",
]
