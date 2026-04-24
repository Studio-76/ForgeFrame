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
    routing_key: str | None = None
    capabilities: dict[str, object] = Field(default_factory=dict)
    execution_traits: dict[str, object] = Field(default_factory=dict)
    policy_flags: dict[str, object] = Field(default_factory=dict)
    economic_profile: dict[str, object] = Field(default_factory=dict)
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


class ManagedProviderTargetRecord(BaseModel):
    target_key: str
    provider: str
    model_id: str
    model_routing_key: str
    label: str
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    product_axis: str = "unknown"
    auth_type: str = "unknown"
    credential_type: str = "unknown"
    capability_profile: dict[str, object] = Field(default_factory=dict)
    technical_capabilities: dict[str, object] = Field(default_factory=dict)
    execution_traits: dict[str, object] = Field(default_factory=dict)
    policy_flags: dict[str, object] = Field(default_factory=dict)
    economic_profile: dict[str, object] = Field(default_factory=dict)
    cost_class: str = "medium"
    latency_class: str = "medium"
    enabled: bool = True
    priority: int = 100
    queue_eligible: bool = False
    stream_capable: bool = False
    tool_capable: bool = False
    vision_capable: bool = False
    fallback_allowed: bool = True
    fallback_target_keys: list[str] = Field(default_factory=list)
    escalation_allowed: bool = True
    escalation_target_keys: list[str] = Field(default_factory=list)
    health_status: str = "unknown"
    availability_status: str = "unknown"
    readiness_status: str = "planned"
    status_reason: str | None = None
    last_seen_at: str | None = None
    last_probe_at: str | None = None
    stale_since: str | None = None


ProviderCatalogClass = Literal[
    "openai_compatible",
    "openai_compatible_aggregator",
    "openai_compatible_local",
    "anthropic_messages",
    "gemini_native",
    "bedrock_converse",
    "oauth_account_runtime",
    "oauth_cli_bridge",
    "external_process",
    "agent_endpoint_compat",
    "client_config_reference",
    "unsupported_documented",
]

ProviderCatalogMaturityStatus = Literal[
    "documented-only",
    "contract-ready",
    "adapter-ready-without-live-proof",
    "onboarding-only",
    "bridge-only",
    "partial-runtime",
    "runtime-ready",
    "fully-integrated",
]

ProviderCatalogEvidenceClass = Literal[
    "docs_declared",
    "repo_observed",
    "unit_tested",
    "contract_tested",
    "live_probe_verified",
    "streaming_verified",
    "tool_calling_verified",
    "error_fidelity_verified",
    "credential_refresh_verified",
    "ui_operator_verified",
]

ProviderCatalogEvidenceStatus = Literal[
    "missing",
    "observed",
    "failed",
    "skipped",
    "blocked-by-live-evidence",
]

ProviderCatalogSignoffStatus = Literal[
    "not-requested",
    "blocked-by-live-evidence",
    "pending-review",
    "signed-off",
    "skipped",
]

ProviderCatalogSourceKind = Literal["api_matrix", "oauth_matrix", "reference_only", "runtime_surface"]


class ProviderCatalogEvidenceRecord(BaseModel):
    provider_id: str
    target_key: str | None = None
    evidence_class: ProviderCatalogEvidenceClass
    status: ProviderCatalogEvidenceStatus = "missing"
    source_kind: str = "unknown"
    source_ref: str | None = None
    recorded_at: str | None = None
    details: str = ""


class ProviderCatalogSignoffRecord(BaseModel):
    provider_id: str
    target_key: str | None = None
    status: ProviderCatalogSignoffStatus = "not-requested"
    recorded_at: str | None = None
    details: str = ""
    evidence_basis: list[ProviderCatalogEvidenceClass] = Field(default_factory=list)


class ProviderCatalogRecord(BaseModel):
    provider_id: str
    display_name: str
    raw_class: str
    provider_class: ProviderCatalogClass
    source_kind: ProviderCatalogSourceKind
    source_docs: list[str] = Field(default_factory=list)
    local_reference_paths: list[str] = Field(default_factory=list)
    auth_modes_supported: list[str] = Field(default_factory=list)
    api_modes_supported: list[str] = Field(default_factory=list)
    primary_contracts: list[str] = Field(default_factory=list)
    base_url_default: str | None = None
    base_url_override_env: str | None = None
    token_env_vars: list[str] = Field(default_factory=list)
    model_name_policy: str = "provider-defined"
    streaming_support_claim: str = "unknown"
    tools_support_claim: str = "unknown"
    responses_support_claim: str = "unknown"
    product_axis: str = "unknown"
    runtime_provider_binding: str | None = None
    oauth_target_binding: str | None = None
    product_axis_binding: str | None = None
    evidence_status: str = "none"
    maturity_status: ProviderCatalogMaturityStatus = "documented-only"
    live_signoff_status: ProviderCatalogSignoffStatus = "not-requested"
    last_probe_at: str | None = None
    live_signoff_at: str | None = None
    signoff_notes: str | None = None
    missing_evidence: list[str] = Field(default_factory=list)
    safe_next_action: str = "No action calculated yet."
    evidence_log: list[ProviderCatalogEvidenceRecord] = Field(default_factory=list)
    signoff_history: list[ProviderCatalogSignoffRecord] = Field(default_factory=list)


class ProviderCatalogSummaryRecord(BaseModel):
    total_providers: int = 0
    documented_only: int = 0
    contract_ready: int = 0
    adapter_ready_without_live_proof: int = 0
    onboarding_only: int = 0
    bridge_only: int = 0
    partial_runtime: int = 0
    runtime_ready: int = 0
    fully_integrated: int = 0
    blocked_live_signoffs: int = 0
    pending_live_signoffs: int = 0
    signed_off: int = 0


OpenAICompatibilityCorpusClass = Literal[
    "chat_simple",
    "chat_multimodal",
    "responses_simple",
    "responses_input_items",
    "streaming_chat",
    "streaming_responses",
    "tool_calling",
    "structured_output",
    "error_semantics",
    "unsupported_partial_fields",
    "model_listing",
    "files",
    "embeddings",
]

OpenAICompatibilityStatus = Literal[
    "supported",
    "partial",
    "unsupported",
    "skipped",
    "blocked-by-live-evidence",
]


class OpenAICompatibilitySignoffRecord(BaseModel):
    corpus_class: OpenAICompatibilityCorpusClass
    label: str
    status: OpenAICompatibilityStatus = "unsupported"
    route: str | None = None
    provider_axis: str | None = None
    live_evidence_required: bool = False
    deviation_reason: str | None = None
    evidence_source: str = "repo_gap"
    last_verified_at: str | None = None
    sample_request_id: str | None = None
    raw_diff_summary: str | None = None
    notes: str | None = None


class OpenAICompatibilitySummaryRecord(BaseModel):
    total_checks: int = 0
    supported: int = 0
    partial: int = 0
    unsupported: int = 0
    skipped: int = 0
    blocked_by_live_evidence: int = 0
    signoff_claimable: bool = False
    overall_status: Literal["supported", "partial", "unsupported"] = "unsupported"


RoutingClassificationLabel = Literal["simple", "non_simple"]
RoutingExecutionLane = Literal["sync_interactive", "queued_background"]
RoutingPolicyStage = Literal["preferred", "fallback", "escalation", "requested_model", "blocked"]
RoutingDecisionSource = Literal["runtime_dispatch", "admin_simulation"]
RoutingBudgetScopeType = Literal["instance", "agent", "task"]
RoutingBudgetWindow = Literal["1h", "24h", "7d", "30d"]
RoutingBudgetAnomalyType = Literal["soft_limit_exceeded", "hard_limit_exceeded", "cost_spike", "token_spike"]
RoutingBudgetAnomalySeverity = Literal["warning", "critical"]


class RoutingPolicyRecord(BaseModel):
    classification: RoutingClassificationLabel
    display_name: str
    description: str
    execution_lane: RoutingExecutionLane = "sync_interactive"
    prefer_local: bool = False
    prefer_low_latency: bool = False
    allow_premium: bool = False
    allow_fallback: bool = True
    allow_escalation: bool = True
    require_queue_eligible: bool = False
    preferred_target_keys: list[str] = Field(default_factory=list)
    fallback_target_keys: list[str] = Field(default_factory=list)
    escalation_target_keys: list[str] = Field(default_factory=list)


class RoutingBudgetScopeRecord(BaseModel):
    scope_type: RoutingBudgetScopeType = "instance"
    scope_key: str = DEFAULT_BOOTSTRAP_TENANT_ID
    window: RoutingBudgetWindow = "24h"
    enabled: bool = True
    soft_cost_limit: float | None = None
    hard_cost_limit: float | None = None
    soft_token_limit: int | None = None
    hard_token_limit: int | None = None
    soft_blocked_cost_classes: list[str] = Field(default_factory=list)
    note: str | None = None
    observed_cost: float | None = None
    observed_tokens: int | None = None
    previous_window_cost: float | None = None
    previous_window_tokens: int | None = None
    soft_limit_exceeded: bool = False
    hard_limit_exceeded: bool = False
    last_evaluated_at: str | None = None


class RoutingBudgetAnomalyRecord(BaseModel):
    scope_type: RoutingBudgetScopeType = "instance"
    scope_key: str = DEFAULT_BOOTSTRAP_TENANT_ID
    window: RoutingBudgetWindow = "24h"
    anomaly_type: RoutingBudgetAnomalyType = "soft_limit_exceeded"
    severity: RoutingBudgetAnomalySeverity = "warning"
    observed_cost: float | None = None
    observed_tokens: int | None = None
    threshold_cost: float | None = None
    threshold_tokens: int | None = None
    details: str = ""
    detected_at: str


class RoutingBudgetStateRecord(BaseModel):
    hard_blocked: bool = False
    blocked_cost_classes: list[str] = Field(default_factory=list)
    reason: str | None = None
    scopes: list[RoutingBudgetScopeRecord] = Field(default_factory=list)
    anomalies: list[RoutingBudgetAnomalyRecord] = Field(default_factory=list)
    last_evaluated_at: str | None = None
    updated_at: str | None = None


class RoutingCircuitStateRecord(BaseModel):
    target_key: str
    state: Literal["closed", "open"] = "closed"
    reason: str | None = None
    updated_at: str | None = None


class RoutingDecisionCandidateRecord(BaseModel):
    target_key: str
    provider: str
    model_id: str
    label: str
    stage_eligible: bool = False
    selected: bool = False
    priority: int = 0
    cost_class: str = "medium"
    latency_class: str = "medium"
    availability_status: str = "unknown"
    health_status: str = "unknown"
    queue_eligible: bool = False
    capability_match: bool = True
    exclusion_reasons: list[str] = Field(default_factory=list)
    selection_reasons: list[str] = Field(default_factory=list)


class RoutingDecisionRecord(BaseModel):
    decision_id: str
    source: RoutingDecisionSource = "runtime_dispatch"
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    requested_model: str | None = None
    selected_target_key: str | None = None
    classification: RoutingClassificationLabel = "simple"
    classification_summary: str = ""
    classification_rules: list[str] = Field(default_factory=list)
    policy_stage: RoutingPolicyStage = "blocked"
    execution_lane: RoutingExecutionLane = "sync_interactive"
    summary: str = ""
    structured_details: dict[str, object] = Field(default_factory=dict)
    raw_details: dict[str, object] = Field(default_factory=dict)
    candidates: list[RoutingDecisionCandidateRecord] = Field(default_factory=list)
    error_type: str | None = None
    created_at: str


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
    contract_classification: Literal["runtime-ready", "partial-runtime", "bridge-only", "onboarding-only", "unsupported"] = "unsupported"
    runtime_readiness: Literal["planned", "partial", "ready"] = "planned"
    streaming_readiness: Literal["planned", "partial", "ready"] = "planned"
    capabilities: dict[str, object] = Field(default_factory=dict)
    tool_calling_level: str = "none"
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
    compatibility_depth: Literal["none", "limited", "constrained", "validated"] = "none"
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


class ManagedProviderTargetUiRecord(ManagedProviderTargetRecord):
    provider_label: str | None = None
    model_display_name: str | None = None
    model_owned_by: str | None = None
    runtime_ready: bool = False
    runtime_readiness_reason: str | None = None
    provider_enabled: bool = True
    model_active: bool = True


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
    contract_classification: Literal["runtime-ready", "partial-runtime", "bridge-only", "onboarding-only", "unsupported"] = "unsupported"
    runtime_readiness: Literal["planned", "partial", "ready"] = "planned"
    streaming_readiness: Literal["planned", "partial", "ready"] = "planned"
    capabilities: dict[str, object] = Field(default_factory=dict)
    tool_calling_level: str = "none"
    evidence: ProviderCapabilityEvidenceRecord = Field(default_factory=ProviderCapabilityEvidenceRecord)
    compatibility_depth: Literal["none", "limited", "constrained", "validated"] = "none"
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
    schema_version: int = 6
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    providers: list[ManagedProviderRecord] = Field(default_factory=list)
    provider_targets: list[ManagedProviderTargetRecord] = Field(default_factory=list)
    provider_catalog: list[ProviderCatalogRecord] = Field(default_factory=list)
    routing_policies: list[RoutingPolicyRecord] = Field(default_factory=list)
    routing_budget_state: RoutingBudgetStateRecord = Field(default_factory=RoutingBudgetStateRecord)
    routing_circuits: list[RoutingCircuitStateRecord] = Field(default_factory=list)
    routing_decisions: list[RoutingDecisionRecord] = Field(default_factory=list)
    health_config: HealthConfig = Field(default_factory=HealthConfig)
    health_records: list[HealthStatusRecord] = Field(default_factory=list)
    last_bootstrap_readiness: ControlPlaneBootstrapReadinessReport | None = None
    updated_at: str = ""
