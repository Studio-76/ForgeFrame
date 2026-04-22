"""Control-plane state models shared by admin API and storage."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


class ManagedModelRecord(BaseModel):
    id: str
    source: str
    discovery_status: str
    active: bool
    owned_by: str | None = None
    display_name: str | None = None
    category: str = "general"
    runtime_status: Literal["planned", "partial", "ready", "failed", "stale", "unavailable"] = "planned"
    availability_status: Literal["unknown", "healthy", "degraded", "unavailable", "stale"] = "unknown"
    status_reason: str | None = None
    last_seen_at: str | None = None
    last_probe_at: str | None = None
    stale_since: str | None = None


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


class ManagedProviderTruthRecord(BaseModel):
    provider: str
    label: str
    enabled: bool
    integration_class: str = "native"
    template_id: str | None = None
    config: dict[str, str] = Field(default_factory=dict)
    last_sync_at: str | None = None
    last_sync_status: str = "never"
    last_sync_error: str | None = None
    model_count: int = 0
    managed_models: list[ManagedModelRecord] = Field(default_factory=list)


class HealthConfig(BaseModel):
    provider_health_enabled: bool = True
    model_health_enabled: bool = True
    interval_seconds: int = 300
    probe_mode: Literal["provider", "discovery", "synthetic_probe"] = "discovery"
    selected_models: list[str] = Field(default_factory=list)


class HealthStatusRecord(BaseModel):
    provider: str
    model: str
    check_type: Literal["provider", "discovery", "synthetic_probe"]
    status: Literal["healthy", "degraded", "unavailable", "auth_failed", "not_configured", "discovery_only", "probe_failed", "unknown"]
    readiness_reason: str | None = None
    last_check_at: str | None = None
    last_success_at: str | None = None
    last_error: str | None = None


class ControlPlaneBootstrapCheck(BaseModel):
    id: str
    ok: bool
    details: str


class ControlPlaneBootstrapReadinessReport(BaseModel):
    ready: bool
    checks: list[ControlPlaneBootstrapCheck]
    next_steps: list[str]
    checked_at: str


class OAuthOperationRecord(BaseModel):
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    provider_key: str
    action: Literal["probe", "bridge_sync"]
    status: Literal["ok", "warning", "failed", "skipped"]
    details: str
    executed_at: str


class CapabilityEvidenceRecord(BaseModel):
    status: Literal["missing", "observed", "failed"] = "missing"
    source: Literal["none", "oauth_probe", "runtime_non_stream", "runtime_stream", "runtime_tool_call"] = "none"
    recorded_at: str | None = None
    details: str = "No evidence recorded yet."


class ProviderCapabilityEvidenceRecord(BaseModel):
    runtime: CapabilityEvidenceRecord = Field(default_factory=lambda: CapabilityEvidenceRecord(details="No successful non-stream runtime traffic recorded yet."))
    streaming: CapabilityEvidenceRecord = Field(default_factory=lambda: CapabilityEvidenceRecord(details="No successful streaming runtime traffic recorded yet."))
    tool_calling: CapabilityEvidenceRecord = Field(default_factory=lambda: CapabilityEvidenceRecord(details="No successful tool-calling runtime traffic recorded yet."))
    live_probe: CapabilityEvidenceRecord = Field(default_factory=lambda: CapabilityEvidenceRecord(details="No successful live probe recorded yet."))


class RuntimeProviderTruthRecord(BaseModel):
    provider: str
    wired: bool = False
    ready: bool = False
    readiness_reason: str = "provider_not_wired"
    runtime_readiness: Literal["planned", "partial", "ready"] = "planned"
    streaming_readiness: Literal["planned", "partial", "ready"] = "planned"
    capabilities: dict[str, object] = Field(default_factory=dict)
    tool_calling_level: str = "none"
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
    compatibility_tier: Literal["planned", "beta", "beta_plus"] = "planned"
    provider_axis: str = "unknown"
    auth_mechanism: str = "unknown"
    oauth_required: bool = False
    oauth_mode: str | None = None
    discovery_supported: bool = False


class HarnessProviderTruthRecord(BaseModel):
    provider: str
    profile_count: int = 0
    enabled_profile_count: int = 0
    runtime_profile_count: int = 0
    model_less_enabled_profile_count: int = 0
    profiles_needing_attention: int = 0
    run_count: int = 0
    profile_keys: list[str] = Field(default_factory=list)
    proof_status: Literal["none", "partial", "proven"] = "none"
    successful_modes: list[str] = Field(default_factory=list)
    proven_profile_keys: list[str] = Field(default_factory=list)
    last_failed_run: dict[str, object] | None = None


class ManagedModelUiRecord(ManagedModelRecord):
    health_status: str = "unknown"


class ProviderUiTruthRecord(BaseModel):
    provider: str
    label: str
    enabled: bool
    integration_class: str = "native"
    template_id: str | None = None
    config: dict[str, str] = Field(default_factory=dict)
    last_sync_at: str | None = None
    last_sync_status: str = "never"
    last_sync_error: str | None = None
    ready: bool = False
    readiness_reason: str = "provider_not_wired"
    runtime_readiness: Literal["planned", "partial", "ready"] = "planned"
    streaming_readiness: Literal["planned", "partial", "ready"] = "planned"
    capabilities: dict[str, object] = Field(default_factory=dict)
    tool_calling_level: str = "none"
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
    compatibility_tier: str = "planned"
    provider_axis: str = "unknown"
    auth_mechanism: str = "unknown"
    oauth_required: bool = False
    oauth_mode: str | None = None
    discovery_supported: bool = False
    model_count: int = 0
    models: list[ManagedModelUiRecord] = Field(default_factory=list)
    harness_profile_count: int = 0
    harness_enabled_profile_count: int = 0
    harness_needs_attention_count: int = 0
    harness_run_count: int = 0
    harness_proof_status: Literal["none", "partial", "proven"] = "none"
    harness_proven_profile_keys: list[str] = Field(default_factory=list)
    oauth_failure_count: int = 0
    oauth_last_probe: dict[str, object] | None = None
    oauth_last_bridge_sync: dict[str, object] | None = None


class ProviderTruthAxesRecord(BaseModel):
    provider: ManagedProviderTruthRecord
    runtime: RuntimeProviderTruthRecord
    harness: HarnessProviderTruthRecord
    ui: ProviderUiTruthRecord


class ControlPlaneStateRecord(BaseModel):
    schema_version: int = 2
    providers: list[ManagedProviderRecord] = Field(default_factory=list)
    health_config: HealthConfig = Field(default_factory=HealthConfig)
    health_records: list[HealthStatusRecord] = Field(default_factory=list)
    last_bootstrap_readiness: ControlPlaneBootstrapReadinessReport | None = None
    updated_at: str = ""
