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


class ProviderTargetUpdateRequest(BaseModel):
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    queue_eligible: bool | None = None
    fallback_allowed: bool | None = None
    fallback_target_keys: list[str] | None = None
    escalation_allowed: bool | None = None
    escalation_target_keys: list[str] | None = None


class RoutingPolicyUpdateRequest(BaseModel):
    execution_lane: Literal["sync_interactive", "queued_background"] | None = None
    prefer_local: bool | None = None
    prefer_low_latency: bool | None = None
    allow_premium: bool | None = None
    allow_fallback: bool | None = None
    allow_escalation: bool | None = None
    require_queue_eligible: bool | None = None
    preferred_target_keys: list[str] | None = None
    fallback_target_keys: list[str] | None = None
    escalation_target_keys: list[str] | None = None


class RoutingBudgetUpdateRequest(BaseModel):
    hard_blocked: bool | None = None
    blocked_cost_classes: list[str] | None = None
    reason: str | None = None
    scopes: list["RoutingBudgetScopeUpdateRequest"] | None = None


class RoutingBudgetScopeUpdateRequest(BaseModel):
    scope_type: Literal["instance", "agent", "task"]
    scope_key: str
    window: Literal["1h", "24h", "7d", "30d"] = "24h"
    enabled: bool = True
    soft_cost_limit: float | None = Field(default=None, ge=0)
    hard_cost_limit: float | None = Field(default=None, ge=0)
    soft_token_limit: int | None = Field(default=None, ge=0)
    hard_token_limit: int | None = Field(default=None, ge=0)
    soft_blocked_cost_classes: list[str] = Field(default_factory=list)
    note: str | None = None


class RoutingCircuitUpdateRequest(BaseModel):
    state: Literal["closed", "open"]
    reason: str | None = None


class RoutingSimulationRequest(BaseModel):
    requested_model: str | None = None
    prompt: str | None = None
    messages: list[dict] | None = None
    stream: bool = False
    tools: list[dict] | None = None
    require_vision: bool = False
    max_output_tokens: int | None = Field(default=None, gt=0)


class ProviderSyncRequest(BaseModel):
    provider: str | None = None


class HealthConfigUpdateRequest(BaseModel):
    provider_health_enabled: bool | None = None
    model_health_enabled: bool | None = None
    interval_seconds: int | None = None
    probe_mode: Literal["provider", "discovery", "synthetic_probe"] | None = None
    selected_models: list[str] | None = None


class ProductAxisTarget(BaseModel):
    provider_key: str
    provider_type: Literal["oauth_account", "openai_compatible", "local"]
    product_axis: Literal["oauth_account_providers", "openai_compatible_providers", "local_providers", "openai_compatible_clients"]
    auth_model: str
    runtime_path: str
    contract_classification: Literal["runtime-ready", "partial-runtime", "bridge-only", "onboarding-only", "unsupported"]
    classification_reason: str
    technical_requirements: list[str] = Field(default_factory=list)
    operator_surface: str
    readiness: Literal["planned", "partial", "ready"]
    readiness_score: int = Field(ge=0, le=100)
    runtime_readiness: Literal["planned", "partial", "ready"]
    streaming_readiness: Literal["planned", "partial", "ready"]
    verify_probe_readiness: Literal["planned", "partial", "ready"]
    ui_readiness: Literal["planned", "partial", "ready"]
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
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
    contract_classification: Literal["runtime-ready", "partial-runtime", "bridge-only", "onboarding-only", "unsupported"]
    queue_lane: Literal["sync_interactive", "queued_background", "bridge_probe_only", "not_applicable"]
    parallelism_mode: Literal["not_enforced", "single_flight", "provider_managed", "not_applicable"]
    parallelism_limit: int | None = None
    session_reuse_strategy: str
    escalation_support: str
    cost_posture: str
    operator_surface: str
    operator_truth: str
    readiness: Literal["planned", "partial", "ready"]
    readiness_reason: str
    auth_kind: Literal["oauth_account", "api_key"]
    oauth_mode: str | None = None
    oauth_flow_support: str | None = None
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)


__all__ = [
    "ProductAxisTarget",
    "HealthConfigUpdateRequest",
    "OAuthAccountProbeResult",
    "OAuthAccountTargetStatus",
    "ProviderCreateRequest",
    "ProviderSyncRequest",
    "ProviderTargetUpdateRequest",
    "ProviderUpdateRequest",
    "RoutingBudgetScopeUpdateRequest",
    "RoutingBudgetUpdateRequest",
    "RoutingCircuitUpdateRequest",
    "RoutingPolicyUpdateRequest",
    "RoutingSimulationRequest",
]
