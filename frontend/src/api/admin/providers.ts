/**
 * Provider management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type CapabilityEvidenceRecord,
  type ProviderCapabilityEvidenceRecord,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

/** A managed model within a provider. */
export type ManagedModel = {
  id: string;
  source: "static" | "discovered" | "manual" | "templated";
  discovery_status: string;
  active: boolean;
  health_status: string;
  runtime_status?: string;
  availability_status?: string;
  status_reason?: string | null;
  last_seen_at?: string | null;
  last_probe_at?: string | null;
  stale_since?: string | null;
};

/** Provider class key discriminator. */
export type ProviderClassKey = "openai_compatible" | "local_ollama" | "oauth_account" | "custom";

/** Descriptor for a supported provider class. */
export type ProviderClassDescriptor = {
  key: ProviderClassKey;
  label: string;
  description: string;
  integration_class: string;
  template_id?: string | null;
  default_config: Record<string, string>;
};

/** A provider control-plane item. */
export type ProviderControlItem = {
  provider: string;
  label: string;
  enabled: boolean;
  provider_class: ProviderClassKey | string;
  integration_class: string;
  template_id: string | null;
  config: Record<string, string>;
  ready: boolean;
  readiness_reason: string | null;
  contract_classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported";
  capabilities: Record<string, unknown>;
  tool_calling_level?: "none" | "partial" | "full";
  compatibility_depth?: "none" | "limited" | "constrained" | "validated";
  runtime_readiness: "planned" | "partial" | "ready";
  streaming_readiness: "planned" | "partial" | "ready";
  provider_axis?: string;
  auth_mechanism?: string;
  oauth_required: boolean;
  oauth_mode?: string | null;
  discovery_supported: boolean;
  model_count: number;
  models: ManagedModel[];
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error?: string | null;
  harness_profile_count?: number;
  harness_run_count?: number;
  harness_needs_attention_count?: number;
  harness_proof_status: "none" | "partial" | "proven";
  harness_proven_profile_keys: string[];
  oauth_failure_count?: number;
  oauth_last_probe?: Record<string, unknown> | null;
  oauth_last_bridge_sync?: Record<string, unknown> | null;
  oauth_connect_required: boolean;
  target_count: number;
  enabled_target_count: number;
  ready_target_count: number;
  health_status: string;
  healthy_model_count: number;
  attention_model_count: number;
  last_health_check_at?: string | null;
  last_probe_at?: string | null;
  next_action: string;
  next_action_kind: string;
};

/** Health check configuration. */
export type HealthConfig = {
  provider_health_enabled: boolean;
  model_health_enabled: boolean;
  interval_seconds: number;
  probe_mode: "provider" | "discovery" | "synthetic_probe";
  selected_models: string[];
};

/** Provider control-plane API response. */
export type ProviderControlPlaneResponse = {
  status: "ok";
  object: "provider_control_plane";
  instance?: InstanceRecord;
  providers: ProviderControlItem[];
  supported_provider_classes?: ProviderClassDescriptor[];
  provider_catalog?: ProviderCatalogEntry[];
  provider_catalog_summary?: ProviderCatalogSummary;
  openai_compatibility_signoff?: OpenAICompatibilitySignoffResponse;
  bootstrap_readiness?: {
    ready: boolean;
    checked_at?: string | null;
    checks: Array<{
      id: string;
      ok: boolean;
      details: string;
    }>;
    next_steps: string[];
  } | null;
  health_config: HealthConfig;
  notes: Record<string, unknown>;
};

/** Model register record. */
export type AdminModelRegisterRecord = {
  provider: string;
  provider_label: string;
  provider_enabled: boolean;
  provider_integration_class: string;
  provider_last_sync_status: string;
  provider_last_sync_at?: string | null;
  provider_last_sync_error?: string | null;
  model_id: string;
  display_name: string;
  owned_by: string;
  category: string;
  routing_key: string;
  capabilities: Record<string, unknown>;
  execution_traits: Record<string, unknown>;
  policy_flags: Record<string, unknown>;
  economic_profile: Record<string, unknown>;
  declared_capability_keys: string[];
  source: string;
  discovery_status: string;
  runtime_status: string;
  availability_status: string;
  health_status: string;
  status_reason?: string | null;
  active: boolean;
  target_count: number;
  active_target_count: number;
  routing_target_count: number;
  target_keys: string[];
  linked_targets: Array<{
    target_key: string;
    label: string;
    enabled: boolean;
    readiness_status: string;
    availability_status: string;
    priority: number;
    provider_enabled: boolean;
    model_active: boolean;
    routing_eligible: boolean;
  }>;
  routing_policy_classes: string[];
  routing_status: "routable" | "degraded" | "no_target_coverage" | "stale" | "removed" | "disabled";
  routing_ready: boolean;
  routing_reason: string;
  trust_status: "tested" | "observed" | "declared_only" | "verification_failed";
  trust_reason: string;
  evidence: {
    runtime: {
      status: string;
      source: string;
      recorded_at?: string | null;
      details: string;
    };
    streaming: {
      status: string;
      source: string;
      recorded_at?: string | null;
      details: string;
    };
    tool_calling: {
      status: string;
      source: string;
      recorded_at?: string | null;
      details: string;
    };
    live_probe: {
      status: string;
      source: string;
      recorded_at?: string | null;
      details: string;
    };
  };
  tested_evidence: Record<string, {
    status: "missing" | "observed" | "failed" | "not_applicable";
    source: string;
    recorded_at?: string | null;
    details: string;
  }>;
  sync: {
    available: boolean;
    mode: "provider_sync" | "not_ready";
    detail: string;
  };
  last_seen_at?: string | null;
  last_probe_at?: string | null;
  stale_since?: string | null;
};

/** Model register API response. */
export type AdminModelRegisterResponse = {
  status: "ok";
  object: "model_register";
  instance?: InstanceRecord;
  models: AdminModelRegisterRecord[];
  summary: Record<string, number>;
};

/** Provider target record. */
export type ProviderTargetRecord = {
  target_key: string;
  provider: string;
  model_id: string;
  model_routing_key: string;
  label: string;
  instance_id: string;
  product_axis: string;
  auth_type: string;
  credential_type: string;
  capability_profile: Record<string, unknown>;
  technical_capabilities: Record<string, unknown>;
  execution_traits: Record<string, unknown>;
  policy_flags: Record<string, unknown>;
  economic_profile: Record<string, unknown>;
  cost_class: string;
  latency_class: string;
  enabled: boolean;
  priority: number;
  queue_eligible: boolean;
  stream_capable: boolean;
  tool_capable: boolean;
  vision_capable: boolean;
  fallback_allowed: boolean;
  fallback_target_keys: string[];
  escalation_allowed: boolean;
  escalation_target_keys: string[];
  health_status: string;
  availability_status: string;
  readiness_status: string;
  status_reason?: string | null;
  last_seen_at?: string | null;
  last_probe_at?: string | null;
  stale_since?: string | null;
  provider_label?: string | null;
  model_display_name?: string | null;
  model_owned_by?: string | null;
  runtime_ready: boolean;
  runtime_readiness_reason?: string | null;
  provider_enabled: boolean;
  model_active: boolean;
};

/** Provider target register response. */
export type ProviderTargetRegisterResponse = {
  status: "ok";
  object: "provider_target_register";
  instance?: InstanceRecord;
  targets: ProviderTargetRecord[];
  summary: Record<string, number>;
};

/** Product axis target for provider classes. */
export type ProductAxisTarget = {
  provider_key: string;
  provider_type: "oauth_account" | "openai_compatible" | "local";
  product_axis: "oauth_account_providers" | "openai_compatible_providers" | "local_providers" | "openai_compatible_clients";
  auth_model: string;
  runtime_path: string;
  contract_classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported";
  classification_reason: string;
  technical_requirements: string[];
  operator_surface: string;
  readiness: "planned" | "partial" | "ready";
  readiness_score: number;
  runtime_readiness: "planned" | "partial" | "ready";
  streaming_readiness: "planned" | "partial" | "ready";
  verify_probe_readiness: "planned" | "partial" | "ready";
  ui_readiness: "planned" | "partial" | "ready";
  evidence: ProviderCapabilityEvidenceRecord;
  health_semantics: string;
  verify_probe_axis: string;
  observability_axis: string;
  ui_axis: string;
  status_summary: string;
  oauth_account_provider: boolean;
  notes: string;
};

export type { CapabilityEvidenceRecord, ProviderCapabilityEvidenceRecord };

/** Provider catalog evidence status. */
export type ProviderCatalogEvidenceStatus =
  | "missing"
  | "observed"
  | "failed"
  | "skipped"
  | "blocked-by-live-evidence";

/** Provider catalog signoff status. */
export type ProviderCatalogSignoffStatus =
  | "not-requested"
  | "blocked-by-live-evidence"
  | "pending-review"
  | "signed-off"
  | "skipped";

/** Provider catalog evidence class. */
export type ProviderCatalogEvidenceClass =
  | "docs_declared"
  | "repo_observed"
  | "unit_tested"
  | "contract_tested"
  | "live_probe_verified"
  | "streaming_verified"
  | "tool_calling_verified"
  | "error_fidelity_verified"
  | "credential_refresh_verified"
  | "ui_operator_verified";

/** Provider catalog evidence record. */
export type ProviderCatalogEvidenceRecord = {
  provider_id: string;
  target_key?: string | null;
  evidence_class: ProviderCatalogEvidenceClass;
  status: ProviderCatalogEvidenceStatus;
  source_kind: string;
  source_ref?: string | null;
  recorded_at?: string | null;
  details: string;
};

/** Provider catalog signoff record. */
export type ProviderCatalogSignoffRecord = {
  provider_id: string;
  target_key?: string | null;
  status: ProviderCatalogSignoffStatus;
  recorded_at?: string | null;
  details: string;
  evidence_basis: ProviderCatalogEvidenceClass[];
};

/** Provider catalog entry. */
export type ProviderCatalogEntry = {
  provider_id: string;
  display_name: string;
  raw_class: string;
  provider_class:
    | "openai_compatible"
    | "openai_compatible_aggregator"
    | "openai_compatible_local"
    | "anthropic_messages"
    | "gemini_native"
    | "bedrock_converse"
    | "oauth_account_runtime"
    | "oauth_cli_bridge"
    | "external_process"
    | "agent_endpoint_compat"
    | "client_config_reference"
    | "unsupported_documented";
  source_kind: "api_matrix" | "oauth_matrix" | "reference_only" | "runtime_surface";
  source_docs: string[];
  local_reference_paths: string[];
  auth_modes_supported: string[];
  api_modes_supported: string[];
  primary_contracts: string[];
  base_url_default?: string | null;
  base_url_override_env?: string | null;
  token_env_vars: string[];
  model_name_policy: string;
  streaming_support_claim: string;
  tools_support_claim: string;
  responses_support_claim: string;
  product_axis: string;
  runtime_provider_binding?: string | null;
  oauth_target_binding?: string | null;
  product_axis_binding?: string | null;
  evidence_status: string;
  maturity_status:
    | "documented-only"
    | "contract-ready"
    | "adapter-ready-without-live-proof"
    | "onboarding-only"
    | "bridge-only"
    | "partial-runtime"
    | "runtime-ready"
    | "fully-integrated";
  live_signoff_status: ProviderCatalogSignoffStatus;
  last_probe_at?: string | null;
  live_signoff_at?: string | null;
  signoff_notes?: string | null;
  missing_evidence: string[];
  safe_next_action: string;
  evidence_log: ProviderCatalogEvidenceRecord[];
  signoff_history: ProviderCatalogSignoffRecord[];
};

/** Provider catalog summary statistics. */
export type ProviderCatalogSummary = {
  total_providers: number;
  documented_only: number;
  contract_ready: number;
  adapter_ready_without_live_proof: number;
  onboarding_only: number;
  bridge_only: number;
  partial_runtime: number;
  runtime_ready: number;
  fully_integrated: number;
  blocked_live_signoffs: number;
  pending_live_signoffs: number;
  signed_off: number;
};

/** OpenAI compatibility corpus class. */
export type OpenAICompatibilityCorpusClass =
  | "chat_simple"
  | "chat_multimodal"
  | "responses_simple"
  | "responses_input_items"
  | "streaming_chat"
  | "streaming_responses"
  | "tool_calling"
  | "structured_output"
  | "error_semantics"
  | "unsupported_partial_fields"
  | "model_listing"
  | "files"
  | "embeddings";

/** OpenAI compatibility status. */
export type OpenAICompatibilityStatus =
  | "supported"
  | "partial"
  | "unsupported"
  | "skipped"
  | "blocked-by-live-evidence";

/** OpenAI compatibility signoff row. */
export type OpenAICompatibilitySignoffRow = {
  corpus_class: OpenAICompatibilityCorpusClass;
  label: string;
  status: OpenAICompatibilityStatus;
  route?: string | null;
  provider_axis?: string | null;
  live_evidence_required: boolean;
  deviation_reason?: string | null;
  evidence_source: string;
  last_verified_at?: string | null;
  sample_request_id?: string | null;
  raw_diff_summary?: string | null;
  notes?: string | null;
};

/** OpenAI compatibility summary. */
export type OpenAICompatibilitySummary = {
  total_checks: number;
  supported: number;
  partial: number;
  unsupported: number;
  skipped: number;
  blocked_by_live_evidence: number;
  signoff_claimable: boolean;
  overall_status: "supported" | "partial" | "unsupported";
};

/** OpenAI compatibility signoff response. */
export type OpenAICompatibilitySignoffResponse = {
  summary: OpenAICompatibilitySummary;
  rows: OpenAICompatibilitySignoffRow[];
  notes: string[];
};

/** Compatibility matrix row (provider vs capability). */
export type CompatibilityMatrixRow = {
  provider: string;
  label: string;
  compatibility_depth: "none" | "limited" | "constrained" | "validated";
  contract_classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported";
  ready: boolean;
  runtime_readiness: "planned" | "partial" | "ready";
  streaming_readiness: "planned" | "partial" | "ready";
  provider_axis: string;
  streaming: string;
  tool_calling: string;
  vision: string;
  discovery: string;
  oauth_required: boolean;
  ui_models: number;
  proof_status: "none" | "partial" | "proven";
  proven_profile_keys: string[];
  evidence: ProviderCapabilityEvidenceRecord;
  notes: string;
};

/** Harness template. */
export type HarnessTemplate = {
  id: string;
  label: string;
  integration_class: string;
  description: string;
  profile_defaults?: {
    provider_key: string;
    label: string;
    template_id?: string | null;
    integration_class: "openai_compatible" | "templated_http" | "static_catalog";
    endpoint_base_url: string;
    auth_scheme: "none" | "bearer" | "api_key_header";
    auth_header: string;
    model_slug_policy?: "verbatim" | "prepend_prefix_if_missing";
    model_prefix?: string;
    models: string[];
    request_mapping?: {
      path: string;
      path_join_policy?: "append" | "dedupe_openai_v1";
      headers?: Record<string, string>;
    };
    capabilities?: {
      streaming?: boolean;
      tool_calling?: boolean;
      vision?: boolean;
      responses?: boolean;
      embeddings?: boolean;
      unsupported_features?: string[];
    };
  };
};

/** Harness request mapping. */
export type HarnessRequestMapping = {
  method?: "POST" | "GET";
  path: string;
  path_join_policy?: "append" | "dedupe_openai_v1";
  headers?: Record<string, string>;
  body_template?: Record<string, unknown>;
};

/** Harness response mapping. */
export type HarnessResponseMapping = {
  text_path?: string;
  finish_reason_path?: string;
  model_path?: string;
  prompt_tokens_path?: string;
  completion_tokens_path?: string;
  total_tokens_path?: string;
  tool_calls_path?: string;
};

/** Harness error mapping. */
export type HarnessErrorMapping = {
  message_path?: string;
  type_path?: string;
};

/** Harness stream mapping. */
export type HarnessStreamMapping = {
  enabled: boolean;
  data_prefix?: string;
  done_marker?: string;
  delta_path?: string;
  tool_calls_path?: string;
  finish_reason_path?: string;
  usage_prompt_tokens_path?: string;
  usage_completion_tokens_path?: string;
  usage_total_tokens_path?: string;
};

/** Harness capability profile. */
export type HarnessCapabilityProfile = {
  streaming?: boolean;
  tool_calling?: boolean;
  vision?: boolean;
  responses?: boolean;
  embeddings?: boolean;
  discovery_support?: boolean;
  model_source?: "static" | "manual" | "discovered" | "templated";
  unsupported_features?: string[];
};

/** Harness run record. */
export type HarnessRun = {
  run_id?: string | null;
  provider_key: string;
  instance_id?: string | null;
  integration_class?: string;
  model?: string | null;
  mode: string;
  status: string;
  success: boolean;
  steps: Array<Record<string, unknown>>;
  error?: string | null;
  executed_at: string;
  duration_ms?: number | null;
  client_id?: string | null;
  consumer?: string | null;
  integration?: string | null;
};

/** Harness verification result. */
export type HarnessVerificationResult = {
  provider_key: string;
  integration_class: string;
  steps: Array<Record<string, unknown>>;
  preview_request?: Record<string, unknown> | null;
  preview_response?: Record<string, unknown> | null;
  success: boolean;
  run?: HarnessRun | null;
};

/** Harness profile (provider adapter config). */
export type HarnessProfile = {
  provider_key: string;
  instance_id?: string | null;
  label: string;
  integration_class: "openai_compatible" | "templated_http" | "static_catalog";
  endpoint_base_url: string;
  auth_scheme: "none" | "bearer" | "api_key_header";
  auth_value: string;
  auth_header: string;
  template_id: string | null;
  model_slug_policy?: string;
  model_prefix?: string;
  enabled: boolean;
  models: string[];
  discovery_enabled: boolean;
  request_mapping?: HarnessRequestMapping;
  response_mapping?: HarnessResponseMapping;
  error_mapping?: HarnessErrorMapping;
  stream_mapping?: HarnessStreamMapping;
  capabilities?: HarnessCapabilityProfile;
  created_at?: string;
  updated_at?: string;
  last_exported_at?: string | null;
  last_imported_at?: string | null;
  lifecycle_status?: string;
  last_verified_at?: string | null;
  last_verify_status?: string;
  last_probe_at?: string | null;
  last_probe_status?: string;
  last_sync_at?: string | null;
  last_sync_status?: string;
  last_sync_error?: string | null;
  last_error?: string | null;
  model_inventory?: Array<Record<string, string | boolean | null>>;
  last_used_at?: string | null;
  last_used_model?: string | null;
  verify_success_count?: number;
  verify_failure_count?: number;
  probe_success_count?: number;
  probe_failure_count?: number;
  request_count?: number;
  stream_request_count?: number;
  total_tokens?: number;
  total_actual_cost?: number;
  total_hypothetical_cost?: number;
  total_avoided_cost?: number;
  needs_attention?: boolean;
  config_revision?: number;
  config_revision_parent?: number | null;
  config_history?: Array<Record<string, unknown>>;
};

/** OAuth target status record. */
export type OauthTargetStatus = {
  provider_key: string;
  provider_label: string;
  configured: boolean;
  runtime_bridge_enabled: boolean;
  probe_enabled: boolean;
  harness_profile_enabled: boolean;
  contract_classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported";
  queue_lane: "sync_interactive" | "queued_background" | "bridge_probe_only" | "not_applicable";
  parallelism_mode: "not_enforced" | "single_flight" | "provider_managed" | "not_applicable";
  parallelism_limit?: number | null;
  session_reuse_strategy: string;
  escalation_support: string;
  cost_posture: string;
  operator_surface: string;
  operator_truth: string;
  readiness: "planned" | "partial" | "ready";
  readiness_reason: string;
  auth_kind: "oauth_account" | "api_key";
  oauth_mode?: string | null;
  oauth_flow_support?: string | null;
  connection_status: "not configured" | "token present" | "bridge-only" | "oauth unsupported" | "runtime-ready" | "probe failed" | "expired" | "needs refresh";
  connection_status_reason: string;
  connection_method: string;
  setup: {
    summary: string;
    required_env_vars: string[];
    optional_env_vars: string[];
    missing_env_vars: string[];
    steps: string[];
  };
  actions: Array<{
    action_key: "connect" | "manual_token" | "device_code" | "bridge_sync" | "probe" | "disconnect";
    label: string;
    mode: "api" | "manual" | "unsupported";
    supported: boolean;
    detail: string;
  }>;
  last_probe?: {
    action: string;
    status: string;
    details: string;
    executed_at?: string | null;
  } | null;
  last_bridge_sync?: {
    action: string;
    status: string;
    details: string;
    executed_at?: string | null;
  } | null;
  last_failed_operation?: {
    action: string;
    status: string;
    details: string;
    executed_at?: string | null;
  } | null;
  next_step: string;
  evidence: ProviderCapabilityEvidenceRecord;
};

/** OAuth onboarding target. */
export type OauthOnboardingTarget = OauthTargetStatus & {
  next_steps: string[];
  operational_depth: string;
};

/** Secret storage control info. */
export type SecretStorageControl = {
  credential_class: string;
  storage: string;
  plaintext_persisted: boolean;
  notes: string;
};

// ---------------------------------------------------------------------------
// Provider API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the provider control-plane data.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Provider control-plane response.
 */
export function fetchProviderControlPlane(instanceId?: string | null): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>(appendTenantScope("/admin/providers/", undefined, instanceId));
}

/**
 * Fetch the model register for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Model register response.
 */
export function fetchModelRegister(instanceId?: string | null): Promise<AdminModelRegisterResponse> {
  return fetchJson<AdminModelRegisterResponse>(appendTenantScope("/admin/models/", undefined, instanceId));
}

/**
 * Fetch the provider targets for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Provider target register response.
 */
export function fetchProviderTargets(instanceId?: string | null): Promise<ProviderTargetRegisterResponse> {
  return fetchJson<ProviderTargetRegisterResponse>(appendTenantScope("/admin/provider-targets/", undefined, instanceId));
}

/**
 * Update a specific provider target.
 * @param targetKey - The target key to update.
 * @param payload - Fields to update on the target.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated target.
 */
export function updateProviderTarget(
  targetKey: string,
  payload: {
    enabled?: boolean;
    priority?: number;
    queue_eligible?: boolean;
    fallback_allowed?: boolean;
    fallback_target_keys?: string[];
    escalation_allowed?: boolean;
    escalation_target_keys?: string[];
  },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; target: ProviderTargetRecord }>(
    appendTenantScope(`/admin/provider-targets/${encodeURIComponent(targetKey)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Fetch the compatibility matrix for the provider ecosystem.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the compatibility matrix.
 */
export function fetchCompatibilityMatrix(instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; matrix: CompatibilityMatrixRow[] }>(
    appendTenantScope("/admin/providers/compatibility-matrix", undefined, instanceId),
  );
}

/**
 * Fetch drilldown data for a specific provider.
 * @param provider - The provider name.
 * @param window - Time window for the drilldown.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Provider drilldown data.
 */
export function fetchProviderDrilldown(
  provider: string,
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/providers/${provider}?window=${window}`, undefined, instanceId),
  );
}

/**
 * Fetch product-axis targets for the provider ecosystem.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with product-axis targets.
 */
export function fetchProductAxisTargets(instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; targets: ProductAxisTarget[] }>(
    appendTenantScope("/admin/providers/product-axis-targets", undefined, instanceId),
  );
}

/**
 * Create a new provider.
 * @param payload - Provider creation parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the created provider.
 */
export function createProvider(
  payload: {
    provider: string;
    label: string;
    provider_class?: ProviderClassKey;
    integration_class?: string;
    template_id?: string | null;
    config: Record<string, string>;
  },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(
    appendTenantScope("/admin/providers/", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing provider.
 * @param provider - The provider name.
 * @param payload - Fields to update.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated provider.
 */
export function updateProvider(
  provider: string,
  payload: {
    label?: string;
    provider_class?: ProviderClassKey;
    integration_class?: string;
    template_id?: string | null;
    config?: Record<string, string>;
  },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(
    appendTenantScope(`/admin/providers/${provider}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Activate a provider.
 * @param provider - The provider name.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the activated provider.
 */
export function activateProvider(provider: string, instanceId?: string | null) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(
    appendTenantScope(`/admin/providers/${provider}/activate`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

/**
 * Deactivate a provider.
 * @param provider - The provider name.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the deactivated provider.
 */
export function deactivateProvider(provider: string, instanceId?: string | null) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(
    appendTenantScope(`/admin/providers/${provider}/deactivate`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

/**
 * Trigger a provider sync.
 * @param provider - Optional provider name to sync (syncs all if omitted).
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with sync results.
 */
export function syncProviders(provider?: string, instanceId?: string | null) {
  return fetchJson<{ status: string; synced_providers: string[]; sync_at: string; note: string }>(
    appendTenantScope("/admin/providers/sync", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify({ provider: provider ?? null }),
    },
  );
}

/**
 * Patch the health check configuration.
 * @param payload - Health config fields to update.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated health config.
 */
export function patchHealthConfig(payload: Partial<HealthConfig>, instanceId?: string | null) {
  return fetchJson<{ status: string; config: HealthConfig }>(
    appendTenantScope("/admin/providers/health/config", undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Run health checks for all providers.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with health check results.
 */
export function runHealthChecks(instanceId?: string | null) {
  return fetchJson<{ status: string; check_type: string; checked_at: string; health_records: Array<Record<string, string>> }>(
    appendTenantScope("/admin/providers/health/run", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

// ---------------------------------------------------------------------------
// Harness API functions
// ---------------------------------------------------------------------------

/**
 * Fetch available harness templates.
 * @returns Response with harness templates.
 */
export function fetchHarnessTemplates() {
  return fetchJson<{ status: string; templates: HarnessTemplate[] }>("/admin/providers/harness/templates");
}

/**
 * Fetch harness profiles for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with harness profiles.
 */
export function fetchHarnessProfiles(instanceId?: string | null) {
  return fetchJson<{ status: string; profiles: HarnessProfile[] }>(
    appendTenantScope("/admin/providers/harness/profiles", undefined, instanceId),
  );
}

/**
 * Upsert a harness profile for the given provider.
 * @param providerKey - The provider key.
 * @param payload - Profile data.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the upserted profile.
 */
export function upsertHarnessProfile(providerKey: string, payload: Record<string, unknown>, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(
    appendTenantScope(`/admin/providers/harness/profiles/${providerKey}`, undefined, instanceId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Delete a harness profile for the given provider.
 * @param providerKey - The provider key.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response confirming deletion.
 */
export function deleteHarnessProfile(providerKey: string, instanceId?: string | null) {
  return fetchJson<{ status: string; deleted: string }>(
    appendTenantScope(`/admin/providers/harness/profiles/${providerKey}`, undefined, instanceId),
    { method: "DELETE" },
  );
}

/**
 * Activate a harness profile.
 * @param providerKey - The provider key.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the activated profile.
 */
export function activateHarnessProfile(providerKey: string, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(
    appendTenantScope(`/admin/providers/harness/profiles/${providerKey}/activate`, undefined, instanceId),
    { method: "POST", body: "{}" },
  );
}

/**
 * Deactivate a harness profile.
 * @param providerKey - The provider key.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the deactivated profile.
 */
export function deactivateHarnessProfile(providerKey: string, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(
    appendTenantScope(`/admin/providers/harness/profiles/${providerKey}/deactivate`, undefined, instanceId),
    { method: "POST", body: "{}" },
  );
}

/**
 * Verify a harness profile with a live test call.
 * @param payload - Verification parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with verification results.
 */
export function verifyHarnessProfile(
  payload: { provider_key: string; model?: string; test_message?: string; include_preview?: boolean },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; verification: HarnessVerificationResult }>(
    appendTenantScope("/admin/providers/harness/verify", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Preview a harness profile call.
 * @param payload - Preview parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the preview result.
 */
export function previewHarness(
  payload: { provider_key: string; model: string; message: string; stream: boolean },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; preview: Record<string, unknown>; run?: HarnessRun | null }>(
    appendTenantScope("/admin/providers/harness/preview", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Dry-run a harness profile call (preview request/response mapping without sending).
 * @param payload - Dry-run parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with request/response mapping preview.
 */
export function dryRunHarness(
  payload: { provider_key: string; model: string; message: string; stream: boolean },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; preview_request: Record<string, unknown>; mapped_example: Record<string, unknown>; run: HarnessRun }>(
    appendTenantScope("/admin/providers/harness/dry-run", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Probe a harness profile (send a real request and capture raw response).
 * @param payload - Probe parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with probe results.
 */
export function probeHarness(
  payload: { provider_key: string; model: string; message: string; stream: boolean },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; status_code: number; parsed: Record<string, unknown>; raw: Record<string, unknown>; run: HarnessRun }>(
    appendTenantScope("/admin/providers/harness/probe", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Fetch a snapshot of all harness profiles.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the harness snapshot.
 */
export function fetchHarnessSnapshot(instanceId?: string | null) {
  return fetchJson<{ status: string; snapshot: Record<string, unknown> }>(
    appendTenantScope("/admin/providers/harness/snapshot", undefined, instanceId),
  );
}

/**
 * Fetch an export of harness configuration.
 * @param redactSecrets - Whether to redact secret values (default true).
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the harness export snapshot.
 */
export function fetchHarnessExport(redactSecrets = true, instanceId?: string | null) {
  return fetchJson<{ status: string; snapshot: Record<string, unknown> }>(
    appendTenantScope(`/admin/providers/harness/export?redact_secrets=${String(redactSecrets)}`, undefined, instanceId),
  );
}

/**
 * Import a harness configuration snapshot.
 * @param snapshot - The configuration snapshot to import.
 * @param dryRun - If true, validate without applying (default true).
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with import results.
 */
export function importHarnessConfig(snapshot: Record<string, unknown>, dryRun = true, instanceId?: string | null) {
  return fetchJson<Record<string, unknown>>(
    appendTenantScope("/admin/providers/harness/import", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify({ snapshot, dry_run: dryRun }),
    },
  );
}

/**
 * Roll back a harness profile to a previous revision.
 * @param providerKey - The provider key.
 * @param revision - The target revision number.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the rolled-back profile.
 */
export function rollbackHarnessProfile(providerKey: string, revision: number, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(
    appendTenantScope(`/admin/providers/harness/profiles/${providerKey}/rollback/${revision}`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Fetch harness run history.
 * @param providerKey - Optional provider key filter.
 * @param mode - Optional mode filter.
 * @param status - Optional status filter.
 * @param clientId - Optional client ID filter.
 * @param limit - Maximum number of runs (default 50).
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with harness runs.
 */
export function fetchHarnessRuns(
  providerKey?: string,
  mode?: string,
  status?: string,
  clientId?: string,
  limit = 50,
  instanceId?: string | null,
) {
  const params = new URLSearchParams();
  if (providerKey) params.set("provider_key", providerKey);
  if (mode) params.set("mode", mode);
  if (status) params.set("status", status);
  if (clientId) params.set("client_id", clientId);
  params.set("limit", String(limit));
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; runs: HarnessRun[]; summary: Record<string, number>; ops?: Record<string, unknown> }>(
    appendTenantScope(`/admin/providers/harness/runs${suffix}`, undefined, instanceId),
  );
}

// ---------------------------------------------------------------------------
// Client & usage API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the client operational view.
 * @param window - Time window (default "24h").
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with client operational data.
 */
export function fetchClientOperationalView(
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; window: string; clients: Array<Record<string, string | number | boolean>> }>(
    appendTenantScope(`/admin/usage/clients?window=${window}`, undefined, instanceId),
  );
}

/**
 * Fetch drilldown data for a specific client.
 * @param clientId - The client ID.
 * @param window - Time window (default "24h").
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with client drilldown data.
 */
export function fetchClientDrilldown(
  clientId: string,
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/clients/${encodeURIComponent(clientId)}?window=${window}`, undefined, instanceId),
  );
}

// ---------------------------------------------------------------------------
// OAuth account provider API functions
// ---------------------------------------------------------------------------

/**
 * Fetch OAuth account targets for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with OAuth target statuses.
 */
export function fetchOauthAccountTargets(instanceId?: string | null) {
  return fetchJson<{ status: string; targets: OauthTargetStatus[] }>(
    appendTenantScope("/admin/providers/oauth-account/targets", undefined, instanceId),
  );
}

/**
 * Fetch OAuth onboarding targets.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with OAuth onboarding targets.
 */
export function fetchOauthOnboarding(instanceId?: string | null) {
  return fetchJson<{ status: string; targets: OauthOnboardingTarget[] }>(
    appendTenantScope("/admin/providers/oauth-account/onboarding", undefined, instanceId),
  );
}

/**
 * Sync OAuth account bridge profiles.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with sync results.
 */
export function syncOauthAccountBridgeProfiles(instanceId?: string | null) {
  return fetchJson<{ status: string; upserted_profiles: string[]; skipped: string[] }>(
    appendTenantScope("/admin/providers/oauth-account/bridge-profiles/sync", undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Probe a specific OAuth account provider.
 * @param providerKey - The provider key to probe.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with probe results.
 */
export function probeOauthAccountProvider(providerKey: string, instanceId?: string | null) {
  return fetchJson<{ status: string; probe: Record<string, unknown> }>(
    appendTenantScope(`/admin/providers/oauth-account/probe/${providerKey}`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Probe all OAuth account providers.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with probe results for all providers.
 */
export function probeAllOauthAccountProviders(instanceId?: string | null) {
  return fetchJson<{ status: string; probes: Array<Record<string, unknown>> }>(
    appendTenantScope("/admin/providers/oauth-account/probe-all", undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Fetch OAuth account operations and recent activity.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with OAuth operations data.
 */
export function fetchOauthAccountOperations(instanceId?: string | null) {
  return fetchJson<{ status: string; operations: Array<Record<string, unknown>>; recent: Array<Record<string, unknown>>; total_operations: number }>(
    appendTenantScope("/admin/providers/oauth-account/operations", undefined, instanceId),
  );
}
