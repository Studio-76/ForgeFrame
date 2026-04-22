"""Request and response models for the admin control-plane service."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.control_plane import ProviderCapabilityEvidenceRecord


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


class HealthConfigUpdateRequest(BaseModel):
    provider_health_enabled: bool | None = None
    model_health_enabled: bool | None = None
    interval_seconds: int | None = None
    probe_mode: Literal["provider", "discovery", "synthetic_probe"] | None = None
    selected_models: list[str] | None = None


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
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
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
    auth_kind: Literal["oauth_account", "api_key"]
    oauth_mode: str | None = None
    oauth_flow_support: str | None = None
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)


__all__ = [
    "BetaProviderTarget",
    "HealthConfigUpdateRequest",
    "OAuthAccountProbeResult",
    "OAuthAccountTargetStatus",
    "ProviderCreateRequest",
    "ProviderSyncRequest",
    "ProviderUpdateRequest",
]
