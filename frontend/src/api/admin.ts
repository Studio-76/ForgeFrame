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

export type ProviderControlItem = {
  provider: string;
  label: string;
  enabled: boolean;
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
};

export type HealthConfig = {
  provider_health_enabled: boolean;
  model_health_enabled: boolean;
  interval_seconds: number;
  probe_mode: "provider" | "discovery" | "synthetic_probe";
  selected_models: string[];
};

export type InstanceRecord = {
  instance_id: string;
  slug: string;
  display_name: string;
  description: string;
  status: "active" | "disabled";
  tenant_id: string;
  company_id: string;
  deployment_mode: "linux_host_native" | "restricted_eval" | "container_optional";
  exposure_mode: "same_origin" | "local_only" | "edge_admission";
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PluginSecurityPosture = {
  allowed_roles: Array<"viewer" | "operator" | "admin" | "owner">;
  admin_approval_required: boolean;
  network_access: boolean;
  writes_external_state: boolean;
  secret_refs: string[];
};

export type PluginInstanceBinding = {
  plugin_id: string;
  instance_id: string;
  company_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  enabled_capabilities: string[];
  enabled_ui_slots: string[];
  enabled_api_mounts: string[];
  notes: string;
  created_at: string;
  updated_at: string;
};

export type PluginCatalogEntry = {
  plugin_id: string;
  display_name: string;
  summary: string;
  vendor: string;
  version: string;
  status: "active" | "disabled";
  capabilities: string[];
  ui_slots: string[];
  api_mounts: string[];
  runtime_surfaces: string[];
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  security_posture: PluginSecurityPosture;
  metadata: Record<string, unknown>;
  binding?: PluginInstanceBinding | null;
  effective_status: "available" | "enabled" | "disabled";
  status_summary: string;
  effective_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PluginCatalogSummary = {
  registered_plugins: number;
  active_plugins: number;
  disabled_plugins: number;
  bound_plugins: number;
  enabled_bindings: number;
  capability_keys: string[];
  ui_slots: string[];
  api_mounts: string[];
};

export type PluginCatalogResponse = {
  status: "ok";
  instance?: InstanceRecord;
  summary: PluginCatalogSummary;
  plugins: PluginCatalogEntry[];
};

export type ProviderControlPlaneResponse = {
  status: "ok";
  object: "provider_control_plane";
  instance?: InstanceRecord;
  providers: ProviderControlItem[];
  health_config: HealthConfig;
  notes: Record<string, unknown>;
};

export type AdminModelRegisterRecord = {
  provider: string;
  provider_label: string;
  model_id: string;
  display_name: string;
  owned_by: string;
  category: string;
  routing_key: string;
  capabilities: Record<string, unknown>;
  source: string;
  discovery_status: string;
  runtime_status: string;
  availability_status: string;
  health_status: string;
  status_reason?: string | null;
  active: boolean;
  target_count: number;
  active_target_count: number;
  target_keys: string[];
  last_seen_at?: string | null;
  last_probe_at?: string | null;
  stale_since?: string | null;
};

export type AdminRole = "owner" | "admin" | "operator" | "viewer";

export type AdminPermissionKey =
  | "instance.read"
  | "instance.write"
  | "providers.read"
  | "providers.write"
  | "provider_targets.read"
  | "provider_targets.write"
  | "routing.read"
  | "routing.write"
  | "approvals.read"
  | "approvals.decide"
  | "execution.read"
  | "execution.operate"
  | "security.read"
  | "security.write"
  | "audit.read"
  | "settings.read"
  | "settings.write";

export type AdminInstanceMembership = {
  membership_id: string;
  user_id: string;
  instance_id: string;
  tenant_id: string;
  company_id: string;
  role: AdminRole;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

export type AdminModelRegisterResponse = {
  status: "ok";
  object: "model_register";
  instance?: InstanceRecord;
  models: AdminModelRegisterRecord[];
  summary: Record<string, number>;
};

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

export type ProviderTargetRegisterResponse = {
  status: "ok";
  object: "provider_target_register";
  instance?: InstanceRecord;
  targets: ProviderTargetRecord[];
  summary: Record<string, number>;
};

export type RoutingPolicyRecord = {
  classification: "simple" | "non_simple";
  display_name: string;
  description: string;
  execution_lane: "sync_interactive" | "queued_background";
  prefer_local: boolean;
  prefer_low_latency: boolean;
  allow_premium: boolean;
  allow_fallback: boolean;
  allow_escalation: boolean;
  require_queue_eligible: boolean;
  preferred_target_keys: string[];
  fallback_target_keys: string[];
  escalation_target_keys: string[];
};

export type RoutingBudgetRecord = {
  hard_blocked: boolean;
  blocked_cost_classes: string[];
  reason?: string | null;
  updated_at?: string | null;
  scopes: RoutingBudgetScopeRecord[];
  anomalies: RoutingBudgetAnomalyRecord[];
  last_evaluated_at?: string | null;
};

export type RoutingBudgetScopeRecord = {
  scope_type: "instance" | "agent" | "task";
  scope_key: string;
  window: "1h" | "24h" | "7d" | "30d";
  enabled: boolean;
  soft_cost_limit?: number | null;
  hard_cost_limit?: number | null;
  soft_token_limit?: number | null;
  hard_token_limit?: number | null;
  soft_blocked_cost_classes: string[];
  note?: string | null;
  observed_cost?: number;
  observed_tokens?: number;
  previous_window_cost?: number | null;
  previous_window_tokens?: number | null;
  soft_limit_exceeded: boolean;
  hard_limit_exceeded: boolean;
  last_evaluated_at?: string | null;
};

export type RoutingBudgetAnomalyRecord = {
  scope_type: "instance" | "agent" | "task";
  scope_key: string;
  window: "1h" | "24h" | "7d" | "30d";
  anomaly_type: "soft_limit_exceeded" | "hard_limit_exceeded" | "cost_spike" | "token_spike";
  severity: "warning" | "critical";
  observed_cost?: number;
  observed_tokens?: number;
  threshold_cost?: number | null;
  threshold_tokens?: number | null;
  details: Record<string, unknown>;
  detected_at: string;
};

export type RoutingBudgetUpdatePayload = Partial<
  Pick<RoutingBudgetRecord, "hard_blocked" | "blocked_cost_classes" | "reason">
> & {
  scopes?: RoutingBudgetScopeRecord[];
};

export type RoutingCircuitRecord = {
  target_key: string;
  state: "closed" | "open";
  reason?: string | null;
  updated_at?: string | null;
};

export type RoutingDecisionCandidateRecord = {
  target_key: string;
  provider: string;
  model_id: string;
  label: string;
  stage_eligible: boolean;
  selected: boolean;
  priority: number;
  cost_class: string;
  latency_class: string;
  availability_status: string;
  health_status: string;
  queue_eligible: boolean;
  capability_match: boolean;
  exclusion_reasons: string[];
  selection_reasons: string[];
};

export type RoutingDecisionRecord = {
  decision_id: string;
  source: "runtime_dispatch" | "admin_simulation";
  instance_id: string;
  requested_model?: string | null;
  selected_target_key?: string | null;
  classification: "simple" | "non_simple";
  classification_summary: string;
  classification_rules: string[];
  policy_stage: string;
  execution_lane: string;
  summary: string;
  structured_details: Record<string, unknown>;
  raw_details: Record<string, unknown>;
  candidates: RoutingDecisionCandidateRecord[];
  error_type?: string | null;
  created_at: string;
};

export type RoutingControlPlaneResponse = {
  status: "ok";
  object: "routing_control_plane";
  instance?: InstanceRecord;
  policies: RoutingPolicyRecord[];
  budget: RoutingBudgetRecord;
  circuits: RoutingCircuitRecord[];
  targets: ProviderTargetRecord[];
  recent_decisions: RoutingDecisionRecord[];
  summary: Record<string, unknown>;
};

export type UsageSummaryResponse = {
  status: "ok";
  object: "usage_summary";
  metrics: Record<string, number>;
  aggregations: {
    by_provider: Array<Record<string, string | number>>;
    by_model: Array<Record<string, string | number>>;
    by_auth: Array<Record<string, string | number>>;
    by_client: Array<Record<string, string | number>>;
    by_traffic_type: Array<Record<string, string | number>>;
    errors_by_provider: Array<Record<string, string | number>>;
    errors_by_model: Array<Record<string, string | number>>;
    errors_by_client: Array<Record<string, string | number>>;
    errors_by_traffic_type: Array<Record<string, string | number>>;
    errors_by_type: Array<Record<string, string | number>>;
    errors_by_integration: Array<Record<string, string | number>>;
    errors_by_profile: Array<Record<string, string | number>>;
  };
  traffic_split: {
    runtime: Record<string, string | number>;
    health_check: Record<string, string | number>;
  };
  cost_axes: Record<string, string>;
  window: "1h" | "24h" | "7d" | "all";
  instance?: Pick<InstanceRecord, "instance_id" | "tenant_id" | "company_id">;
  latest_health: Array<Record<string, string | number | null>>;
  timeline_24h: Array<Record<string, string | number>>;
  alerts: Array<Record<string, string | number>>;
  pricing_snapshot: Record<string, number>;
};

export type RuntimeHealthResponse = {
  status: string;
  app: string;
  version: string;
  api_base: string;
  readiness: {
    state: string;
    accepting_traffic: boolean;
    checked_at?: string;
    checks: Array<{
      id: string;
      ok: boolean;
      severity: string;
    }>;
    warning_count: number;
    critical_count: number;
  };
};

export type IngressTlsCertificateStatus = {
  present: boolean;
  certificate_path: string;
  key_path: string;
  issuer?: string | null;
  subject?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  last_issued_at?: string | null;
  last_renewed_at?: string | null;
  renewal_due_at?: string | null;
  days_remaining?: number | null;
  last_error?: string | null;
};

export type IngressTlsStatusResponse = {
  status: "ok";
  fqdn?: string | null;
  public_origin?: string | null;
  frontend_root_path: string;
  runtime_api_base: string;
  admin_api_base: string;
  public_https_host: string;
  public_https_port: number;
  public_http_helper_host: string;
  public_http_helper_port: number;
  tls_mode: string;
  acme_directory_url: string;
  acme_webroot_path: string;
  integrated_tls_automation: boolean;
  dns_resolves: boolean;
  resolved_addresses: string[];
  certificate: IngressTlsCertificateStatus;
  mode_classification: "normative_public_https" | "limited_exception";
  blockers: string[];
  checked_at: string;
};


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
  health_semantics: string;
  verify_probe_axis: string;
  observability_axis: string;
  ui_axis: string;
  status_summary: string;
  oauth_account_provider: boolean;
  notes: string;
};

export type HarnessTemplate = {
  id: string;
  label: string;
  integration_class: string;
  description: string;
};

export type HarnessProfile = {
  provider_key: string;
  label: string;
  integration_class: "openai_compatible" | "templated_http" | "static_catalog";
  endpoint_base_url: string;
  auth_scheme: "none" | "bearer" | "api_key_header";
  auth_value: string;
  auth_header: string;
  template_id: string | null;
  enabled: boolean;
  models: string[];
  discovery_enabled: boolean;
  lifecycle_status?: string;
  last_verified_at?: string | null;
  last_verify_status?: string;
  last_probe_at?: string | null;
  last_probe_status?: string;
  last_sync_at?: string | null;
  last_sync_status?: string;
  last_sync_error?: string | null;
  model_inventory?: Array<Record<string, string | boolean | null>>;
  last_used_at?: string | null;
  last_used_model?: string | null;
  request_count?: number;
  stream_request_count?: number;
  total_tokens?: number;
  needs_attention?: boolean;
  config_revision?: number;
  config_revision_parent?: number | null;
  config_history?: Array<Record<string, unknown>>;
};

export type AdminUser = {
  user_id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  status: "active" | "disabled";
  must_rotate_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  created_by?: string | null;
};

export type AdminPasswordRotationPayload = {
  new_password: string;
  must_rotate_password?: true;
};

export type AdminSecuritySession = {
  session_id: string;
  user_id: string;
  role: AdminRole;
  membership_id?: string | null;
  instance_id?: string | null;
  tenant_id?: string | null;
  session_type: "standard" | "impersonation" | "break_glass";
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  username: string;
  display_name: string;
  user_status: string;
  active: boolean;
  expired?: boolean;
  elevated?: boolean;
  read_only?: boolean;
  issued_by_user_id?: string | null;
  issued_by_username?: string | null;
  approved_by_user_id?: string | null;
  approved_by_username?: string | null;
  approval_request_id?: string | null;
  approval_reference?: string | null;
  justification?: string | null;
  notification_targets?: string[];
};

export type ElevatedAccessApproverPosture = {
  state: "approval_available" | "recovery_required";
  label: string;
  approval_requires_distinct_admin: boolean;
  eligible_admin_approver_count: number;
  blocked_reason?: string | null;
  primary_message: string;
  secondary_message: string;
};

export type SecurityCredentialPolicy = {
  human_sessions?: Record<string, unknown>;
  elevated_access_requests?: {
    approval_ttl_minutes: number;
    gate_statuses: string[];
    issuance_states: string[];
    requester_claim_required: boolean;
    self_approval_allowed: boolean;
    approver_availability: ElevatedAccessApproverPosture;
  };
  service_account_keys?: Record<string, unknown>;
  impersonation_sessions?: {
    max_ttl_minutes: number;
    approval_reference_required: boolean;
    notification_targets_required: boolean;
    approval_required_before_issue: boolean;
    read_only: boolean;
    write_capable_admin_routes: boolean;
  };
  break_glass_sessions?: {
    max_ttl_minutes: number;
    approval_reference_required: boolean;
    notification_targets_required: boolean;
    approval_required_before_issue: boolean;
    eligible_roles: string[];
  };
  audit?: Record<string, unknown>;
  rate_limits?: Record<string, unknown>;
  observability?: Record<string, unknown>;
};

export type SecurityBootstrapResponse = {
  status: "ok";
  credential_policy: SecurityCredentialPolicy;
  elevated_access_approver_posture: ElevatedAccessApproverPosture;
  bootstrap?: Record<string, string | number | boolean>;
  secret_posture?: Array<Record<string, string | number | boolean>>;
  harness_profiles?: Array<Record<string, string | number | boolean>>;
  recent_rotations?: Array<Record<string, unknown>>;
  secret_storage_controls?: Array<Record<string, unknown>>;
};

export type AdminSessionUser = {
  session_id: string;
  user_id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  membership_id?: string | null;
  active_instance_id?: string | null;
  active_tenant_id?: string | null;
  session_type?: "standard" | "impersonation" | "break_glass";
  read_only?: boolean;
  must_rotate_password?: boolean;
  instance_memberships?: AdminInstanceMembership[];
  instance_permissions?: Partial<Record<string, AdminPermissionKey[]>>;
};

export type GatewayAccount = {
  account_id: string;
  instance_id?: string | null;
  tenant_id?: string | null;
  label: string;
  status: "active" | "suspended" | "disabled";
  provider_bindings: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  runtime_key_count?: number;
};

export type RuntimeKey = {
  key_id: string;
  account_id: string | null;
  instance_id?: string | null;
  tenant_id?: string | null;
  label: string;
  prefix: string;
  scopes: string[];
  status: "active" | "disabled" | "revoked";
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  rotated_from?: string | null;
};

export type MutableSettingEntry = {
  key: string;
  label: string;
  category: string;
  value_type: "str" | "bool" | "float";
  description: string;
  default_value: string | number | boolean;
  effective_value: string | number | boolean;
  overridden: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type DashboardResponse = {
  status: "ok";
  kpis: Record<string, number>;
  alerts: Array<Record<string, string | number>>;
  needs_attention: string[];
  instance?: Pick<InstanceRecord, "instance_id" | "tenant_id" | "company_id" | "display_name">;
  security?: Record<string, string | number | boolean>;
};

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
  notes: string;
};

export type OauthTargetStatus = {
  provider_key: string;
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
  evidence: Record<string, unknown>;
};

export type OauthOnboardingTarget = OauthTargetStatus & {
  next_steps: string[];
  operational_depth: string;
};

export type LogsResponse = {
  status: "ok";
  instance?: InstanceRecord;
  audit_preview: AuditHistoryRow[];
  audit_retention: {
    eventLimit: number;
    oldestAvailableAt?: string | null;
    retentionLimited: boolean;
    latestEventAt?: string | null;
  };
  alerts: Array<Record<string, string | number>>;
  error_summary: Record<string, unknown>;
  operability: {
    ready: boolean;
    checks: Array<Record<string, unknown>>;
    metrics: Record<string, unknown>;
    logging: Record<string, unknown>;
    tracing: Record<string, unknown>;
  };
};

export type AuditHistoryWindow = "24h" | "7d" | "30d" | "all";

export type AuditHistoryStatus = "ok" | "warning" | "failed";

export type AuditHistoryActorSummary = {
  type: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

export type AuditHistoryTargetSummary = {
  type: string;
  typeLabel: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

export type AuditHistoryRow = {
  eventId: string;
  createdAt: string;
  tenantId?: string | null;
  companyId?: string | null;
  actionKey: string;
  actionLabel: string;
  status: AuditHistoryStatus;
  statusLabel: string;
  actor: AuditHistoryActorSummary;
  target: AuditHistoryTargetSummary;
  summary: string;
  detailAvailable: boolean;
};

export type AuditHistoryFilterOption = {
  value: string;
  label: string;
};

export type AuditHistoryResponse = {
  status: "ok";
  instance?: InstanceRecord;
  items: AuditHistoryRow[];
  page: {
    limit: number;
    nextCursor?: string | null;
    hasMore: boolean;
  };
  retention: {
    eventLimit: number;
    oldestAvailableAt?: string | null;
    retentionLimited: boolean;
  };
  filters: {
    applied: {
      window: AuditHistoryWindow;
      action?: string | null;
      actor?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      status?: AuditHistoryStatus | null;
    };
    available: {
      actions: AuditHistoryFilterOption[];
      statuses: AuditHistoryFilterOption[];
      targetTypes: AuditHistoryFilterOption[];
    };
  };
  summary: {
    totalInScope: number;
    totalMatchingFilters: number;
    latestEventAt?: string | null;
  };
};

export type AuditHistoryDetailResponse = {
  status: "ok";
  instance?: InstanceRecord;
  event: {
    eventId: string;
    createdAt: string;
    tenantId?: string | null;
    companyId?: string | null;
    actionKey: string;
    actionLabel: string;
    status: AuditHistoryStatus;
    statusLabel: string;
  };
  actor: AuditHistoryActorSummary;
  target: AuditHistoryTargetSummary;
  summary: string;
  outcome: string;
  changeContext: Array<{ label: string; value: string }>;
  changeContextUnavailable: boolean;
  rawMetadata: Record<string, unknown>;
  redactions: Array<{ path: string; reason: string }>;
  relatedLinks: Array<{ label: string; href: string; kind: string }>;
};

export type AuditHistoryQuery = {
  instanceId?: string | null;
  tenantId?: string | null;
  companyId?: string | null;
  window?: AuditHistoryWindow;
  action?: string | null;
  actor?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  status?: AuditHistoryStatus | null;
  cursor?: string | null;
  limit?: number | null;
};

export type AuditExportFormat = "csv" | "json";

export type AuditExportWindow = "24h" | "7d" | "30d" | "all";

export type AuditExportStatus = "ok" | "warning" | "failed";

export type AuditExportRequest = {
  format: AuditExportFormat;
  window: AuditExportWindow;
  action?: string | null;
  status?: AuditExportStatus | null;
  subject?: string | null;
  limit?: number;
};

export type AuditExportResult = {
  exportId: string;
  filename: string;
  status: "ready";
  rowCount: number;
  generatedAt: string | null;
  blob: Blob;
};

export type ArtifactType =
  | "file"
  | "download"
  | "preview_link"
  | "log"
  | "pr_link"
  | "json"
  | "csv"
  | "pdf"
  | "handoff_note"
  | "external_action_preview";

export type ArtifactStatus = "active" | "superseded" | "archived";

export type ArtifactAttachmentTargetKind = "workspace" | "run" | "approval" | "instance" | "decision";

export type ArtifactWorkspaceRole = "artifact" | "preview" | "handoff";

export type ArtifactAttachmentRecord = {
  attachment_id: string;
  artifact_id: string;
  target_kind: ArtifactAttachmentTargetKind;
  target_id: string;
  role: string;
  created_at: string;
};

export type ArtifactRecord = {
  artifact_id: string;
  instance_id: string;
  company_id: string;
  workspace_id?: string | null;
  artifact_type: ArtifactType;
  label: string;
  uri: string;
  media_type?: string | null;
  preview_url?: string | null;
  size_bytes?: number | null;
  status: ArtifactStatus;
  created_by_type: string;
  created_by_id?: string | null;
  metadata: Record<string, unknown>;
  attachments: ArtifactAttachmentRecord[];
  created_at: string;
  updated_at: string;
};

export type WorkspaceStatus = "draft" | "previewing" | "in_review" | "handoff_ready" | "handed_off" | "archived";

export type WorkspacePreviewStatus = "missing" | "draft" | "ready" | "approved" | "rejected";

export type WorkspaceReviewStatus = "not_requested" | "pending" | "approved" | "rejected";

export type WorkspaceHandoffStatus = "not_ready" | "ready" | "delivered";

export type WorkspaceEventKind =
  | "created"
  | "updated"
  | "preview_ready"
  | "review_requested"
  | "review_approved"
  | "review_rejected"
  | "handoff_prepared"
  | "handoff_delivered";

export type WorkspaceRunSummary = {
  run_id: string;
  run_kind: string;
  state: string;
  execution_lane: string;
  issue_id?: string | null;
  updated_at: string;
};

export type WorkspaceApprovalSummary = {
  approval_id: string;
  shared_approval_id: string;
  gate_status: string;
  gate_key: string;
  opened_at: string;
  decided_at?: string | null;
};

export type WorkspaceEventRecord = {
  event_id: string;
  workspace_id: string;
  event_kind: WorkspaceEventKind;
  note?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  run_id?: string | null;
  actor_type: string;
  actor_id?: string | null;
  created_at: string;
};

export type WorkspaceSummary = {
  workspace_id: string;
  instance_id: string;
  company_id: string;
  issue_id?: string | null;
  title: string;
  summary: string;
  status: WorkspaceStatus;
  preview_status: WorkspacePreviewStatus;
  review_status: WorkspaceReviewStatus;
  handoff_status: WorkspaceHandoffStatus;
  owner_type: string;
  owner_id?: string | null;
  active_run_id?: string | null;
  latest_approval_id?: string | null;
  preview_artifact_id?: string | null;
  handoff_artifact_id?: string | null;
  pr_reference?: string | null;
  handoff_reference?: string | null;
  metadata: Record<string, unknown>;
  run_count: number;
  approval_count: number;
  artifact_count: number;
  latest_event_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDetail = WorkspaceSummary & {
  runs: WorkspaceRunSummary[];
  approvals: WorkspaceApprovalSummary[];
  artifacts: ArtifactRecord[];
  events: WorkspaceEventRecord[];
};

export type ConversationStatus = "open" | "paused" | "closed" | "archived";

export type TriageStatus = "new" | "relevant" | "delegated" | "blocked" | "done";

export type WorkItemPriority = "low" | "normal" | "high" | "critical";

export type ConversationThreadStatus = "open" | "closed" | "archived";

export type ConversationSessionKind = "runtime" | "operator" | "assistant" | "external";

export type ConversationMessageRole = "user" | "assistant" | "system" | "operator" | "tool";

export type InboxStatus = "open" | "snoozed" | "closed" | "archived";

export type ConversationThreadSummary = {
  thread_id: string;
  conversation_id: string;
  title: string;
  status: ConversationThreadStatus;
  latest_message_at?: string | null;
  message_count: number;
  session_count: number;
  created_at: string;
  updated_at: string;
};

export type ConversationSessionRecord = {
  session_id: string;
  conversation_id: string;
  thread_id: string;
  session_kind: ConversationSessionKind;
  continuity_key?: string | null;
  started_by_type: string;
  started_by_id?: string | null;
  message_count: number;
  metadata: Record<string, unknown>;
  started_at: string;
  ended_at?: string | null;
};

export type ConversationMessageRecord = {
  message_id: string;
  conversation_id: string;
  thread_id: string;
  session_id?: string | null;
  message_role: ConversationMessageRole;
  author_type: string;
  author_id?: string | null;
  body: string;
  structured_payload: Record<string, unknown>;
  created_at: string;
};

export type InboxSummary = {
  inbox_id: string;
  instance_id: string;
  company_id: string;
  conversation_id?: string | null;
  thread_id?: string | null;
  workspace_id?: string | null;
  title: string;
  summary: string;
  triage_status: TriageStatus;
  priority: WorkItemPriority;
  status: InboxStatus;
  contact_ref?: string | null;
  run_id?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  decision_id?: string | null;
  metadata: Record<string, unknown>;
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationSummary = {
  conversation_id: string;
  instance_id: string;
  company_id: string;
  workspace_id?: string | null;
  subject: string;
  summary: string;
  status: ConversationStatus;
  triage_status: TriageStatus;
  priority: WorkItemPriority;
  contact_ref?: string | null;
  run_id?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  decision_id?: string | null;
  metadata: Record<string, unknown>;
  active_thread_id?: string | null;
  thread_count: number;
  session_count: number;
  message_count: number;
  inbox_count: number;
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationDetail = ConversationSummary & {
  threads: ConversationThreadSummary[];
  sessions: ConversationSessionRecord[];
  messages: ConversationMessageRecord[];
  inbox_items: InboxSummary[];
};

export type InboxDetail = InboxSummary & {
  conversation?: ConversationSummary | null;
};

export type TaskKind = "task" | "follow_up";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type ReminderStatus = "scheduled" | "due" | "triggered" | "dismissed" | "cancelled";

export type DeliveryChannelKind = "in_app" | "email" | "webhook" | "slack";

export type DeliveryChannelStatus = "active" | "disabled" | "degraded";

export type NotificationDeliveryStatus =
  | "draft"
  | "preview"
  | "confirmed"
  | "queued"
  | "delivering"
  | "delivered"
  | "failed"
  | "fallback_queued"
  | "rejected"
  | "cancelled";

export type AutomationStatus = "active" | "paused" | "archived";

export type AutomationActionKind = "create_follow_up" | "create_reminder" | "create_notification";

export type ReminderSummary = {
  reminder_id: string;
  instance_id: string;
  company_id: string;
  task_id?: string | null;
  automation_id?: string | null;
  notification_id?: string | null;
  title: string;
  summary: string;
  status: ReminderStatus;
  due_at: string;
  triggered_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DeliveryChannelSummary = {
  channel_id: string;
  instance_id: string;
  company_id: string;
  channel_kind: DeliveryChannelKind;
  label: string;
  target: string;
  status: DeliveryChannelStatus;
  fallback_channel_id?: string | null;
  metadata: Record<string, unknown>;
  notification_count: number;
  created_at: string;
  updated_at: string;
};

export type NotificationSummary = {
  notification_id: string;
  instance_id: string;
  company_id: string;
  task_id?: string | null;
  reminder_id?: string | null;
  conversation_id?: string | null;
  inbox_id?: string | null;
  workspace_id?: string | null;
  channel_id?: string | null;
  fallback_channel_id?: string | null;
  title: string;
  body: string;
  delivery_status: NotificationDeliveryStatus;
  priority: WorkItemPriority;
  preview_required: boolean;
  retry_count: number;
  max_retries: number;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  rejected_at?: string | null;
  last_error?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AutomationSummary = {
  automation_id: string;
  instance_id: string;
  company_id: string;
  title: string;
  summary: string;
  status: AutomationStatus;
  action_kind: AutomationActionKind;
  cadence_minutes: number;
  next_run_at: string;
  last_run_at?: string | null;
  target_task_id?: string | null;
  target_conversation_id?: string | null;
  target_inbox_id?: string | null;
  target_workspace_id?: string | null;
  channel_id?: string | null;
  fallback_channel_id?: string | null;
  preview_required: boolean;
  last_task_id?: string | null;
  last_reminder_id?: string | null;
  last_notification_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TaskSummary = {
  task_id: string;
  instance_id: string;
  company_id: string;
  task_kind: TaskKind;
  title: string;
  summary: string;
  status: TaskStatus;
  priority: WorkItemPriority;
  owner_id?: string | null;
  conversation_id?: string | null;
  inbox_id?: string | null;
  workspace_id?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  metadata: Record<string, unknown>;
  reminder_count: number;
  notification_count: number;
  created_at: string;
  updated_at: string;
};

export type TaskDetail = TaskSummary & {
  reminders: ReminderSummary[];
  notifications: NotificationSummary[];
};

export type ReminderDetail = ReminderSummary & {
  task?: TaskSummary | null;
  notification?: NotificationSummary | null;
};

export type NotificationDetail = NotificationSummary & {
  task?: TaskSummary | null;
  reminder?: ReminderSummary | null;
  channel?: DeliveryChannelSummary | null;
};

export type ChannelDetail = DeliveryChannelSummary & {
  recent_notifications: NotificationSummary[];
};

export type AutomationDetail = AutomationSummary & {
  task?: TaskSummary | null;
  channel?: DeliveryChannelSummary | null;
};

export type ContactStatus = "active" | "snoozed" | "archived";

export type KnowledgeSourceKind = "mail" | "calendar" | "contacts" | "drive" | "knowledge_base";

export type KnowledgeSourceStatus = "active" | "paused" | "error";

export type VisibilityScope = "instance" | "team" | "personal" | "restricted";

export type MemoryKind = "fact" | "preference" | "constraint" | "summary";

export type MemoryStatus = "active" | "corrected" | "deleted";

export type MemorySensitivity = "normal" | "sensitive" | "restricted";

export type RecordLink = {
  record_id: string;
  label: string;
  status?: string | null;
};

export type ContactSummary = {
  contact_id: string;
  instance_id: string;
  company_id: string;
  contact_ref: string;
  source_id?: string | null;
  display_name: string;
  primary_email?: string | null;
  primary_phone?: string | null;
  organization?: string | null;
  title?: string | null;
  status: ContactStatus;
  visibility_scope: VisibilityScope;
  metadata: Record<string, unknown>;
  conversation_count: number;
  memory_count: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSourceSummary = {
  source_id: string;
  instance_id: string;
  company_id: string;
  source_kind: KnowledgeSourceKind;
  label: string;
  description: string;
  connection_target: string;
  status: KnowledgeSourceStatus;
  visibility_scope: VisibilityScope;
  last_synced_at?: string | null;
  last_error?: string | null;
  metadata: Record<string, unknown>;
  contact_count: number;
  memory_count: number;
  created_at: string;
  updated_at: string;
};

export type MemorySummary = {
  memory_id: string;
  instance_id: string;
  company_id: string;
  source_id?: string | null;
  contact_id?: string | null;
  conversation_id?: string | null;
  task_id?: string | null;
  notification_id?: string | null;
  workspace_id?: string | null;
  memory_kind: MemoryKind;
  title: string;
  body: string;
  status: MemoryStatus;
  visibility_scope: VisibilityScope;
  sensitivity: MemorySensitivity;
  correction_note?: string | null;
  supersedes_memory_id?: string | null;
  expires_at?: string | null;
  deleted_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ContactDetail = ContactSummary & {
  source?: KnowledgeSourceSummary | null;
  recent_conversations: RecordLink[];
  recent_memory: MemorySummary[];
};

export type KnowledgeSourceDetail = KnowledgeSourceSummary & {
  contacts: ContactSummary[];
  memory_entries: MemorySummary[];
};

export type MemoryDetail = MemorySummary & {
  source?: KnowledgeSourceSummary | null;
  contact?: ContactSummary | null;
  conversation?: RecordLink | null;
  task?: RecordLink | null;
  notification?: RecordLink | null;
  workspace?: RecordLink | null;
};

export type AssistantProfileStatus = "active" | "paused";

export type AssistantTone = "neutral" | "warm" | "direct" | "formal";

export type QuietHoursDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DirectActionPolicy = "never" | "preview_required" | "approval_required" | "allow";

export type AssistantActionMode = "suggest" | "ask" | "direct";

export type AssistantActionKind = "draft_message" | "send_notification" | "create_follow_up" | "schedule_calendar" | "delegate_follow_up";

export type AssistantActionDecision = "allow" | "requires_preview" | "requires_approval" | "blocked";

export type QuietHoursSettings = {
  enabled: boolean;
  timezone: string;
  start_minute: number;
  end_minute: number;
  days: QuietHoursDay[];
  allow_priority_override: boolean;
  override_min_priority: WorkItemPriority;
};

export type DeliveryPreferences = {
  primary_channel_id?: string | null;
  fallback_channel_id?: string | null;
  allowed_channel_ids: string[];
  preview_by_default: boolean;
  mute_during_quiet_hours: boolean;
};

export type CommunicationRules = {
  tone: AssistantTone;
  locale: string;
  signature?: string | null;
  style_notes?: string | null;
};

export type ActionPolicies = {
  suggestions_enabled: boolean;
  questions_enabled: boolean;
  direct_action_policy: DirectActionPolicy;
  allow_mail_actions: boolean;
  allow_calendar_actions: boolean;
  allow_task_actions: boolean;
  require_approval_reference: boolean;
  direct_channel_ids: string[];
};

export type DelegationRules = {
  delegate_contact_id?: string | null;
  escalation_contact_id?: string | null;
  allow_external_delegation: boolean;
  allow_auto_followups: boolean;
};

export type AssistantProfileSummary = {
  assistant_profile_id: string;
  instance_id: string;
  company_id: string;
  display_name: string;
  summary: string;
  status: AssistantProfileStatus;
  assistant_mode_enabled: boolean;
  is_default: boolean;
  timezone: string;
  locale: string;
  tone: AssistantTone;
  preferred_contact_id?: string | null;
  primary_channel_id?: string | null;
  fallback_channel_id?: string | null;
  mail_source_id?: string | null;
  calendar_source_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AssistantProfileDetail = AssistantProfileSummary & {
  preferred_contact?: RecordLink | null;
  delegate_contact?: RecordLink | null;
  escalation_contact?: RecordLink | null;
  primary_channel?: RecordLink | null;
  fallback_channel?: RecordLink | null;
  mail_source?: RecordLink | null;
  calendar_source?: RecordLink | null;
  preferences: Record<string, unknown>;
  communication_rules: CommunicationRules;
  quiet_hours: QuietHoursSettings;
  delivery_preferences: DeliveryPreferences;
  action_policies: ActionPolicies;
  delegation_rules: DelegationRules;
};

export type AssistantActionEvaluation = {
  assistant_profile_id: string;
  decision: AssistantActionDecision;
  action_mode: AssistantActionMode;
  action_kind: AssistantActionKind;
  priority: WorkItemPriority;
  evaluated_at: string;
  effective_channel_id?: string | null;
  fallback_channel_id?: string | null;
  quiet_hours_active: boolean;
  preview_required: boolean;
  approval_required: boolean;
  delegate_contact_id?: string | null;
  reasons: string[];
  metadata: Record<string, unknown>;
};

export type ApprovalStatus = "open" | "approved" | "rejected" | "timed_out" | "cancelled";

export type ApprovalSourceKind = "execution_run" | "elevated_access";

export type ApprovalType = "execution_run" | "break_glass" | "impersonation";

export type ApprovalSessionStatus = "not_issued" | "active" | "expired" | "revoked";

export type ApprovalDecisionBlockedReason =
  | "admin_role_required"
  | "elevated_access_self_approval_forbidden"
  | "approval_not_open"
  | "elevated_access_active_session_conflict"
  | string;

export type ElevatedAccessRequestType = "break_glass" | "impersonation";

export type ElevatedAccessRequest = {
  request_id: string;
  request_type: ElevatedAccessRequestType;
  gate_status: ApprovalStatus;
  issuance_status: "pending" | "issued";
  requested_by_user_id: string;
  target_user_id: string;
  target_role: AdminRole;
  session_role: AdminRole;
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
  approval_expires_at: string;
  decision_note?: string | null;
  decided_at?: string | null;
  decided_by_user_id?: string | null;
  decided_by_username?: string | null;
  issued_at?: string | null;
  issued_by_user_id?: string | null;
  issued_by_username?: string | null;
  issued_session_id?: string | null;
  created_at: string;
  updated_at: string;
  approval_id: string;
  requested_by_username?: string | null;
  requested_by_display_name?: string | null;
  target_username?: string | null;
  target_display_name?: string | null;
  ready_to_issue: boolean;
  session_status: ApprovalSessionStatus;
};

export type ApprovalActorSummary = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
};

export type ApprovalSummary = {
  approval_id: string;
  source_kind: ApprovalSourceKind;
  native_approval_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  title: string;
  opened_at: string;
  decided_at?: string | null;
  expires_at?: string | null;
  instance_id?: string | null;
  company_id?: string | null;
  issue_id?: string | null;
  workspace_id?: string | null;
  requester?: ApprovalActorSummary | null;
  target?: ApprovalActorSummary | null;
  decision_actor?: ApprovalActorSummary | null;
  ready_to_issue: boolean;
  session_status?: ApprovalSessionStatus | null;
};

export type ApprovalDetail = ApprovalSummary & {
  evidence: Record<string, unknown>;
  source: Record<string, unknown>;
  artifacts: ArtifactRecord[];
  workspace: Partial<WorkspaceSummary> | null;
  actions: {
    can_approve?: boolean;
    can_reject?: boolean;
    decision_blocked_reason?: ApprovalDecisionBlockedReason | null;
    approve_blocked_reason?: ApprovalDecisionBlockedReason | null;
    reject_blocked_reason?: ApprovalDecisionBlockedReason | null;
  };
};

export type ExecutionRunAttemptView = {
  id: string;
  attempt_no: number;
  attempt_state: string;
  operator_state: string;
  lease_status: string;
  worker_key?: string | null;
  retry_count: number;
  scheduled_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  backoff_until?: string | null;
  last_error_code?: string | null;
  last_error_detail?: string | null;
  version: number;
};

export type ExecutionRunCommandView = {
  id: string;
  command_type: string;
  command_status: string;
  actor_type: string;
  actor_id: string;
  idempotency_key: string;
  accepted_transition?: string | null;
  response_snapshot?: Record<string, unknown> | null;
  issued_at: string;
  completed_at?: string | null;
};

export type ExecutionRunOutboxView = {
  id: string;
  event_type: string;
  publish_state: string;
  available_at: string;
  publish_attempts: number;
  published_at?: string | null;
  dead_lettered_at?: string | null;
  last_publish_error?: string | null;
  payload: Record<string, unknown>;
};

export type ExecutionRunSummary = {
  run_id: string;
  instance_id?: string | null;
  workspace_id?: string | null;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  issue_id?: string | null;
  active_attempt_no: number;
  failure_class?: string | null;
  status_reason?: string | null;
  current_attempt?: ExecutionRunAttemptView | null;
  next_wakeup_at?: string | null;
  terminal_at?: string | null;
  result_summary?: Record<string, unknown> | null;
  replayable: boolean;
  created_at: string;
  updated_at: string;
};

export type ExecutionRunDetail = ExecutionRunSummary & {
  attempts: ExecutionRunAttemptView[];
  commands: ExecutionRunCommandView[];
  outbox: ExecutionRunOutboxView[];
  workspace?: WorkspaceSummary | null;
  artifacts: ArtifactRecord[];
};

export type ExecutionReplayAuditReference = {
  event_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  status: string;
  instance_id?: string | null;
  tenant_id: string;
  company_id?: string | null;
};

export type ExecutionReplayResult = {
  command_id: string;
  run_id: string;
  attempt_id?: string | null;
  run_state: string;
  operator_state?: string | null;
  execution_lane?: string | null;
  outbox_event?: string | null;
  deduplicated: boolean;
  replay_reason: string;
  audit?: ExecutionReplayAuditReference | null;
};

export type ExecutionOperatorActionResult = {
  command_id: string;
  run_id: string;
  attempt_id?: string | null;
  related_run_id?: string | null;
  run_state: string;
  operator_state?: string | null;
  execution_lane?: string | null;
  outbox_event?: string | null;
  reason: string;
};

export type ExecutionQueueLaneSummary = {
  execution_lane: string;
  display_name: string;
  total_runs: number;
  runnable_runs: number;
  paused_runs: number;
  waiting_on_approval_runs: number;
  retry_scheduled_runs: number;
  quarantined_runs: number;
  oldest_scheduled_at?: string | null;
  longest_wait_seconds?: number | null;
};

export type ExecutionQueueRunView = {
  run_id: string;
  workspace_id?: string | null;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  issue_id?: string | null;
  attempt_id?: string | null;
  attempt_state?: string | null;
  lease_status?: string | null;
  scheduled_at?: string | null;
  next_wakeup_at?: string | null;
  status_reason?: string | null;
  updated_at: string;
};

export type ExecutionDispatchWorkerView = {
  worker_key: string;
  worker_state: string;
  instance_id: string;
  execution_lane: string;
  active_attempts: number;
  leased_runs: string[];
  current_run_id?: string | null;
  current_attempt_id?: string | null;
  oldest_lease_expires_at?: string | null;
  heartbeat_expires_at?: string | null;
  last_heartbeat_at?: string | null;
  last_claimed_at?: string | null;
  last_completed_at?: string | null;
  last_error_code?: string | null;
  last_error_detail?: string | null;
};

export type ExecutionDispatchAttemptView = {
  run_id: string;
  attempt_id: string;
  run_kind: string;
  state: string;
  operator_state: string;
  execution_lane: string;
  worker_key?: string | null;
  lease_status: string;
  lease_expires_at?: string | null;
  last_heartbeat_at?: string | null;
  next_wakeup_at?: string | null;
  status_reason?: string | null;
  updated_at: string;
};

export type ExecutionDispatchSnapshot = {
  outbox_counts: Record<string, number>;
  event_counts: Record<string, number>;
  leased_attempts: ExecutionDispatchAttemptView[];
  stalled_attempts: ExecutionDispatchAttemptView[];
  workers: ExecutionDispatchWorkerView[];
  quarantined_runs: number;
  paused_runs: number;
  waiting_on_approval_runs: number;
};

export type ExecutionLeaseReconcileResult = {
  run_id: string;
  attempt_id: string;
  reconciled_to_state: string;
  dead_letter_reason: string;
};

export class AdminApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const ADMIN_TOKEN_STORAGE_KEY = "forgeframe_admin_token";
const LEGACY_ADMIN_TOKEN_STORAGE_KEY = "forgegate_admin_token";

function readStoredValue(primaryKey: string, legacyKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(primaryKey) ?? window.localStorage.getItem(legacyKey) ?? "";
}

export function getAdminToken(): string {
  return readStoredValue(ADMIN_TOKEN_STORAGE_KEY, LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

function getResponseHeader(headers: Headers, primary: string, legacy: string): string | null {
  return headers.get(primary) ?? headers.get(legacy);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = path.startsWith("/admin") ? getAdminToken() : "";
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(path, {
    headers,
    ...init,
  });

  if (!response.ok) {
    let message = `Failed to load ${path} (${response.status}).`;
    let code: string | undefined;
    let details: unknown;
    try {
      const payload = (await response.json()) as {
        error?: { type?: string; message?: string; details?: unknown };
        detail?: string | { code?: string; message?: string };
      };
      if (payload.error?.message) {
        message = payload.error.message;
        code = payload.error.type;
        details = payload.error.details;
      } else if (typeof payload.detail === "string") {
        message = payload.detail;
      } else if (payload.detail?.message) {
        message = payload.detail.message;
        code = payload.detail.code;
      }
    } catch {
      // noop
    }
    throw new AdminApiError(message, response.status, code, details);
  }

  return (await response.json()) as T;
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }
  const plainMatch = /filename=\"?([^\";]+)\"?/i.exec(header);
  return plainMatch?.[1] ?? null;
}

function appendTenantScope(path: string, tenantId?: string | null, instanceId?: string | null): string {
  const normalizedInstanceId = (instanceId ?? "").trim();
  const normalizedTenantId = (tenantId ?? "").trim();
  if (!normalizedTenantId && !normalizedInstanceId) {
    return path;
  }
  const url = new URL(path, "https://forgeframe.local");
  if (normalizedInstanceId) {
    url.searchParams.set("instanceId", normalizedInstanceId);
  }
  if (normalizedTenantId) {
    url.searchParams.set("tenantId", normalizedTenantId);
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function appendAuditScope(path: string, tenantId?: string | null, companyId?: string | null, instanceId?: string | null): string {
  const normalizedInstanceId = (instanceId ?? "").trim();
  const normalizedTenantId = (tenantId ?? "").trim();
  const normalizedCompanyId = (companyId ?? "").trim();
  if (!normalizedTenantId && !normalizedCompanyId && !normalizedInstanceId) {
    return path;
  }
  const url = new URL(path, "https://forgeframe.local");
  if (normalizedInstanceId) {
    url.searchParams.set("instanceId", normalizedInstanceId);
  }
  if (normalizedTenantId) {
    url.searchParams.set("tenantId", normalizedTenantId);
  }
  if (normalizedCompanyId) {
    url.searchParams.set("companyId", normalizedCompanyId);
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function appendQueryParams(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const url = new URL(path, "https://forgeframe.local");

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
      return;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      url.searchParams.delete(key);
      return;
    }

    url.searchParams.set(key, normalized);
  });

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function loginAdmin(payload: { username: string; password: string }) {
  return fetchJson<{ status: string; access_token: string; expires_at: string; user: AdminSessionUser }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminSession() {
  return fetchJson<{ status: string; user: AdminSessionUser }>("/admin/auth/me");
}

export function logoutAdmin() {
  return fetchJson<{ status: string; message: string }>("/admin/auth/logout", {
    method: "POST",
    body: "{}",
  });
}

export function rotateOwnPassword(payload: { current_password: string; new_password: string }) {
  return fetchJson<{ status: string; user: AdminUser }>("/admin/auth/rotate-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchDashboard(instanceId?: string | null) {
  return fetchJson<DashboardResponse>(appendTenantScope("/admin/dashboard/", undefined, instanceId));
}

export function fetchInstances() {
  return fetchJson<{ status: string; instances: InstanceRecord[] }>("/admin/instances/");
}

export function createInstance(payload: {
  instance_id?: string | null;
  display_name: string;
  description?: string;
  tenant_id?: string | null;
  company_id?: string | null;
  deployment_mode?: InstanceRecord["deployment_mode"];
  exposure_mode?: InstanceRecord["exposure_mode"];
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; instance: InstanceRecord }>("/admin/instances/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInstance(instanceId: string, payload: {
  display_name?: string;
  description?: string;
  tenant_id?: string;
  company_id?: string;
  status?: InstanceRecord["status"];
  deployment_mode?: InstanceRecord["deployment_mode"];
  exposure_mode?: InstanceRecord["exposure_mode"];
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; instance: InstanceRecord }>(`/admin/instances/${encodeURIComponent(instanceId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchPlugins(instanceId?: string | null) {
  return fetchJson<PluginCatalogResponse>(appendTenantScope("/admin/plugins", undefined, instanceId));
}

export function fetchPluginDetail(pluginId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; plugin: PluginCatalogEntry }>(
    appendTenantScope(`/admin/plugins/${encodeURIComponent(pluginId)}`, undefined, instanceId),
  );
}

export function createPlugin(payload: {
  plugin_id?: string | null;
  display_name: string;
  summary?: string;
  vendor?: string;
  version?: string;
  status?: PluginCatalogEntry["status"];
  capabilities?: string[];
  ui_slots?: string[];
  api_mounts?: string[];
  runtime_surfaces?: string[];
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  security_posture?: PluginSecurityPosture;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; plugin: PluginCatalogEntry }>("/admin/plugins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlugin(pluginId: string, payload: {
  display_name?: string;
  summary?: string;
  vendor?: string;
  version?: string;
  status?: PluginCatalogEntry["status"];
  capabilities?: string[];
  ui_slots?: string[];
  api_mounts?: string[];
  runtime_surfaces?: string[];
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  security_posture?: PluginSecurityPosture;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; plugin: PluginCatalogEntry }>(`/admin/plugins/${encodeURIComponent(pluginId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function upsertPluginBinding(instanceId: string | null | undefined, pluginId: string, payload: {
  enabled?: boolean;
  config?: Record<string, unknown>;
  enabled_capabilities?: string[];
  enabled_ui_slots?: string[];
  enabled_api_mounts?: string[];
  notes?: string;
}) {
  return fetchJson<{ status: string; instance?: InstanceRecord; plugin: PluginCatalogEntry }>(
    appendTenantScope(`/admin/plugins/${encodeURIComponent(pluginId)}/binding`, undefined, instanceId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchAccounts(instanceId?: string | null) {
  return fetchJson<{ status: string; accounts: GatewayAccount[] }>(appendTenantScope("/admin/accounts/", undefined, instanceId));
}

export function createAccount(instanceId: string | null | undefined, payload: { label: string; provider_bindings?: string[]; notes?: string }) {
  return fetchJson<{ status: string; account: GatewayAccount }>(appendTenantScope("/admin/accounts/", undefined, instanceId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAccount(instanceId: string | null | undefined, accountId: string, payload: { label?: string; provider_bindings?: string[]; notes?: string; status?: string }) {
  return fetchJson<{ status: string; account: GatewayAccount }>(
    appendTenantScope(`/admin/accounts/${accountId}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchRuntimeKeys(instanceId?: string | null) {
  return fetchJson<{ status: string; keys: RuntimeKey[] }>(appendTenantScope("/admin/keys/", undefined, instanceId));
}

export function createRuntimeKey(instanceId: string | null | undefined, payload: { label: string; account_id?: string | null; scopes?: string[] }) {
  return fetchJson<{ status: string; issued: { key_id: string; instance_id?: string | null; tenant_id?: string | null; token: string; prefix: string; account_id: string | null; label: string; scopes: string[]; created_at: string } }>(
    appendTenantScope("/admin/keys/", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function rotateRuntimeKey(instanceId: string | null | undefined, keyId: string) {
  return fetchJson<{ status: string; issued: { key_id: string; instance_id?: string | null; tenant_id?: string | null; token: string; prefix: string; account_id: string | null; label: string; scopes: string[]; created_at: string } }>(
    appendTenantScope(`/admin/keys/${keyId}/rotate`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function setRuntimeKeyStatus(instanceId: string | null | undefined, keyId: string, action: "activate" | "disable" | "revoke") {
  return fetchJson<{ status: string; key: RuntimeKey }>(appendTenantScope(`/admin/keys/${keyId}/${action}`, undefined, instanceId), {
    method: "POST",
    body: "{}",
  });
}

export function fetchMutableSettings() {
  return fetchJson<{ status: string; settings: MutableSettingEntry[] }>("/admin/settings/");
}

export function patchMutableSettings(updates: Record<string, unknown>) {
  return fetchJson<{ status: string; updated: string[]; settings: MutableSettingEntry[] }>("/admin/settings/", {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}

export function resetMutableSetting(key: string) {
  return fetchJson<{ status: string; reset: string }>(`/admin/settings/${key}`, {
    method: "DELETE",
  });
}

export function fetchLogs(instanceId?: string | null, tenantId?: string | null, companyId?: string | null) {
  return fetchJson<LogsResponse>(appendAuditScope("/admin/logs/", tenantId, companyId, instanceId));
}

export async function fetchRuntimeHealth(): Promise<RuntimeHealthResponse> {
  const response = await fetch("/health", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  let payload: RuntimeHealthResponse | null = null;
  try {
    payload = (await response.json()) as RuntimeHealthResponse;
  } catch {
    payload = null;
  }

  if (payload && (response.ok || response.status === 503)) {
    return payload;
  }

  if (payload) {
    throw new AdminApiError(
      typeof payload.status === "string"
        ? `Runtime health request failed with status '${payload.status}'.`
        : `Failed to load /health (${response.status}).`,
      response.status,
    );
  }

  throw new AdminApiError(`Failed to load /health (${response.status}).`, response.status);
}

export function fetchAuditHistory(query: AuditHistoryQuery = {}) {
  return fetchJson<AuditHistoryResponse>(appendQueryParams("/admin/logs/audit-events", {
    instanceId: query.instanceId,
    tenantId: query.tenantId,
    companyId: query.companyId,
    window: query.window ?? "7d",
    action: query.action,
    actor: query.actor,
    targetType: query.targetType,
    targetId: query.targetId,
    status: query.status,
    cursor: query.cursor,
    limit: query.limit,
  }));
}

export function fetchAuditHistoryDetail(eventId: string, instanceId?: string | null, tenantId?: string | null, companyId?: string | null) {
  return fetchJson<AuditHistoryDetailResponse>(appendQueryParams(`/admin/logs/audit-events/${encodeURIComponent(eventId)}`, {
    instanceId,
    tenantId,
    companyId,
  }));
}

export async function generateAuditExport(
  payload: AuditExportRequest,
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
): Promise<AuditExportResult> {
  const path = appendAuditScope("/admin/logs/audit-export", tenantId, companyId, instanceId);
  const token = getAdminToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      action: payload.action?.trim() ? payload.action.trim() : null,
      status: payload.status ?? null,
      subject: payload.subject?.trim() ? payload.subject.trim() : null,
      limit: payload.limit ?? 250,
    }),
  });

  if (!response.ok) {
    let message = `Failed to generate audit export (${response.status}).`;
    let code: string | undefined;
    try {
      const errorPayload = (await response.json()) as {
        error?: { type?: string; message?: string };
        detail?: string | { message?: string };
      };
      if (errorPayload.error?.message) {
        message = errorPayload.error.message;
        code = errorPayload.error.type;
      } else if (typeof errorPayload.detail === "string") {
        message = errorPayload.detail;
      } else if (errorPayload.detail?.message) {
        message = errorPayload.detail.message;
      }
    } catch {
      // noop
    }
    throw new AdminApiError(message, response.status, code);
  }

  const blob = await response.blob();
  return {
    exportId: getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Id", "X-ForgeGate-Audit-Export-Id") ?? "",
    filename: parseContentDispositionFilename(response.headers.get("Content-Disposition"))
      ?? `forgeframe-audit-export.${payload.format}`,
    status: "ready",
    rowCount: Number(getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Row-Count", "X-ForgeGate-Audit-Export-Row-Count") ?? "0"),
    generatedAt: getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Generated-At", "X-ForgeGate-Audit-Export-Generated-At"),
    blob,
  };
}

export function fetchApprovals(status: ApprovalStatus | "all" = "open", instanceId?: string | null) {
  const params = new URLSearchParams();
  if (status !== "all") {
    params.set("status", status);
  }
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approvals: ApprovalSummary[] }>(`/admin/approvals${suffix}`);
}

export function fetchApprovalDetail(approvalId: string, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}${suffix}`);
}

export function approveApproval(approvalId: string, decisionNote: string, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/approve${suffix}`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote }),
  });
}

export function rejectApproval(approvalId: string, decisionNote: string, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/reject${suffix}`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote }),
  });
}

export function fetchExecutionRuns(options: { instanceId?: string | null; companyId?: string | null; state?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  if (options.state && options.state !== "all") {
    params.set("state", options.state);
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  return fetchJson<{ status: string; runs: ExecutionRunSummary[] }>(`/admin/execution/runs?${params.toString()}`);
}

export function fetchExecutionQueues(options: { instanceId?: string | null; companyId?: string | null; limit?: number }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  return fetchJson<{ status: string; lanes: ExecutionQueueLaneSummary[]; runs: ExecutionQueueRunView[] }>(`/admin/execution/queues?${params.toString()}`);
}

export function fetchExecutionDispatch(options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; dispatch: ExecutionDispatchSnapshot }>(`/admin/execution/dispatch?${params.toString()}`);
}

export function fetchExecutionRunDetail(runId: string, options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; run: ExecutionRunDetail }>(`/admin/execution/runs/${encodeURIComponent(runId)}?${params.toString()}`);
}

export function fetchWorkspaces(
  instanceId?: string | null,
  status?: WorkspaceStatus | "all",
  limit = 100,
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; workspaces: WorkspaceSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/workspaces", undefined, instanceId), {
      status: status && status !== "all" ? status : null,
      limit,
    }),
  );
}

export function fetchWorkspaceDetail(workspaceId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope(`/admin/workspaces/${encodeURIComponent(workspaceId)}`, undefined, instanceId),
  );
}

export function createWorkspace(
  instanceId: string | null | undefined,
  payload: {
    workspace_id?: string | null;
    issue_id?: string | null;
    title: string;
    summary?: string;
    preview_status?: WorkspacePreviewStatus;
    review_status?: WorkspaceReviewStatus;
    handoff_status?: WorkspaceHandoffStatus;
    owner_type?: string;
    owner_id?: string | null;
    active_run_id?: string | null;
    latest_approval_id?: string | null;
    pr_reference?: string | null;
    handoff_reference?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope("/admin/workspaces", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateWorkspace(
  instanceId: string | null | undefined,
  workspaceId: string,
  payload: {
    title?: string;
    summary?: string;
    issue_id?: string | null;
    preview_status?: WorkspacePreviewStatus;
    review_status?: WorkspaceReviewStatus;
    handoff_status?: WorkspaceHandoffStatus;
    owner_type?: string;
    owner_id?: string | null;
    active_run_id?: string | null;
    latest_approval_id?: string | null;
    preview_artifact_id?: string | null;
    handoff_artifact_id?: string | null;
    pr_reference?: string | null;
    handoff_reference?: string | null;
    metadata?: Record<string, unknown>;
    archive?: boolean;
    event_note?: string | null;
  },
) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope(`/admin/workspaces/${encodeURIComponent(workspaceId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchArtifacts(options: {
  instanceId?: string | null;
  workspaceId?: string | null;
  targetKind?: ArtifactAttachmentTargetKind | "" | null;
  targetId?: string | null;
  limit?: number;
}) {
  return fetchJson<{ status: string; instance?: InstanceRecord; artifacts: ArtifactRecord[] }>(
    appendQueryParams(appendTenantScope("/admin/artifacts", undefined, options.instanceId), {
      workspaceId: options.workspaceId,
      targetKind: options.targetKind,
      targetId: options.targetId,
      limit: options.limit ?? 100,
    }),
  );
}

export function fetchArtifactDetail(artifactId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope(`/admin/artifacts/${encodeURIComponent(artifactId)}`, undefined, instanceId),
  );
}

export function createArtifact(
  instanceId: string | null | undefined,
  payload: {
    workspace_id?: string | null;
    workspace_role?: ArtifactWorkspaceRole | null;
    artifact_type: ArtifactType;
    label: string;
    uri: string;
    media_type?: string | null;
    preview_url?: string | null;
    size_bytes?: number | null;
    status?: ArtifactStatus;
    attachments?: Array<{
      target_kind: ArtifactAttachmentTargetKind;
      target_id: string;
      role?: string;
    }>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope("/admin/artifacts", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateArtifact(
  instanceId: string | null | undefined,
  artifactId: string,
  payload: {
    label?: string;
    uri?: string;
    media_type?: string | null;
    preview_url?: string | null;
    size_bytes?: number | null;
    status?: ArtifactStatus;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope(`/admin/artifacts/${encodeURIComponent(artifactId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchConversations(
  instanceId?: string | null,
  filters: {
    status?: ConversationStatus | "all";
    triageStatus?: TriageStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; conversations: ConversationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/conversations", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      triageStatus: filters.triageStatus && filters.triageStatus !== "all" ? filters.triageStatus : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchConversationDetail(conversationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}`, undefined, instanceId),
  );
}

export function createConversation(
  instanceId: string | null | undefined,
  payload: {
    conversation_id?: string | null;
    workspace_id?: string | null;
    subject: string;
    summary?: string;
    status?: ConversationStatus;
    triage_status?: TriageStatus;
    priority?: WorkItemPriority;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
    initial_thread_title?: string;
    initial_session_kind?: ConversationSessionKind;
    initial_continuity_key?: string | null;
    initial_message_role?: ConversationMessageRole;
    initial_message_body: string;
    create_inbox_entry?: boolean;
    inbox_title?: string | null;
    inbox_summary?: string | null;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope("/admin/conversations", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateConversation(
  instanceId: string | null | undefined,
  conversationId: string,
  payload: {
    subject?: string;
    summary?: string;
    workspace_id?: string | null;
    status?: ConversationStatus | null;
    triage_status?: TriageStatus | null;
    priority?: WorkItemPriority | null;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
    active_thread_id?: string | null;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function appendConversationMessage(
  instanceId: string | null | undefined,
  conversationId: string,
  payload: {
    thread_id?: string | null;
    session_id?: string | null;
    thread_title?: string | null;
    start_new_session?: boolean;
    session_kind?: ConversationSessionKind;
    continuity_key?: string | null;
    message_role?: ConversationMessageRole;
    body: string;
    structured_payload?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}/messages`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchInboxItems(
  instanceId?: string | null,
  filters: {
    triageStatus?: TriageStatus | "all";
    status?: InboxStatus | "all";
    priority?: WorkItemPriority | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; items: InboxSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/inbox", undefined, instanceId), {
      triageStatus: filters.triageStatus && filters.triageStatus !== "all" ? filters.triageStatus : null,
      status: filters.status && filters.status !== "all" ? filters.status : null,
      priority: filters.priority && filters.priority !== "all" ? filters.priority : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchInboxItemDetail(inboxId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope(`/admin/inbox/${encodeURIComponent(inboxId)}`, undefined, instanceId),
  );
}

export function createInboxItem(
  instanceId: string | null | undefined,
  payload: {
    inbox_id?: string | null;
    conversation_id?: string | null;
    thread_id?: string | null;
    workspace_id?: string | null;
    title: string;
    summary?: string;
    triage_status?: TriageStatus;
    priority?: WorkItemPriority;
    status?: InboxStatus;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope("/admin/inbox", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateInboxItem(
  instanceId: string | null | undefined,
  inboxId: string,
  payload: {
    conversation_id?: string | null;
    thread_id?: string | null;
    workspace_id?: string | null;
    title?: string;
    summary?: string;
    triage_status?: TriageStatus | null;
    priority?: WorkItemPriority | null;
    status?: InboxStatus | null;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope(`/admin/inbox/${encodeURIComponent(inboxId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchTasks(
  instanceId?: string | null,
  filters: {
    status?: TaskStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; tasks: TaskSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/tasks", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchTaskDetail(taskId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope(`/admin/tasks/${encodeURIComponent(taskId)}`, undefined, instanceId),
  );
}

export function createTask(
  instanceId: string | null | undefined,
  payload: {
    task_id?: string | null;
    task_kind?: TaskKind;
    title: string;
    summary?: string;
    status?: TaskStatus;
    priority?: WorkItemPriority;
    owner_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    due_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope("/admin/tasks", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateTask(
  instanceId: string | null | undefined,
  taskId: string,
  payload: {
    title?: string;
    summary?: string;
    status?: TaskStatus | null;
    priority?: WorkItemPriority | null;
    owner_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    due_at?: string | null;
    completed_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope(`/admin/tasks/${encodeURIComponent(taskId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchReminders(
  instanceId?: string | null,
  filters: {
    status?: ReminderStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; reminders: ReminderSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/reminders", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchReminderDetail(reminderId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope(`/admin/reminders/${encodeURIComponent(reminderId)}`, undefined, instanceId),
  );
}

export function createReminder(
  instanceId: string | null | undefined,
  payload: {
    reminder_id?: string | null;
    task_id?: string | null;
    automation_id?: string | null;
    title: string;
    summary?: string;
    due_at: string;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope("/admin/reminders", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateReminder(
  instanceId: string | null | undefined,
  reminderId: string,
  payload: {
    task_id?: string | null;
    title?: string;
    summary?: string;
    status?: ReminderStatus | null;
    due_at?: string | null;
    triggered_at?: string | null;
    notification_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope(`/admin/reminders/${encodeURIComponent(reminderId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchChannels(
  instanceId?: string | null,
  filters: {
    status?: DeliveryChannelStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; channels: DeliveryChannelSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/channels", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchChannelDetail(channelId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope(`/admin/channels/${encodeURIComponent(channelId)}`, undefined, instanceId),
  );
}

export function createChannel(
  instanceId: string | null | undefined,
  payload: {
    channel_id?: string | null;
    channel_kind: DeliveryChannelKind;
    label: string;
    target: string;
    status?: DeliveryChannelStatus;
    fallback_channel_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope("/admin/channels", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateChannel(
  instanceId: string | null | undefined,
  channelId: string,
  payload: {
    label?: string;
    target?: string;
    status?: DeliveryChannelStatus | null;
    fallback_channel_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope(`/admin/channels/${encodeURIComponent(channelId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchNotifications(
  instanceId?: string | null,
  filters: {
    deliveryStatus?: NotificationDeliveryStatus | "all";
    priority?: WorkItemPriority | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; notifications: NotificationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/notifications", undefined, instanceId), {
      deliveryStatus: filters.deliveryStatus && filters.deliveryStatus !== "all" ? filters.deliveryStatus : null,
      priority: filters.priority && filters.priority !== "all" ? filters.priority : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchNotificationDetail(notificationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}`, undefined, instanceId),
  );
}

export function createNotification(
  instanceId: string | null | undefined,
  payload: {
    notification_id?: string | null;
    task_id?: string | null;
    reminder_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    title: string;
    body: string;
    priority?: WorkItemPriority;
    preview_required?: boolean;
    max_retries?: number;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope("/admin/notifications", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateNotification(
  instanceId: string | null | undefined,
  notificationId: string,
  payload: {
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    title?: string;
    body?: string;
    delivery_status?: NotificationDeliveryStatus | null;
    priority?: WorkItemPriority | null;
    preview_required?: boolean | null;
    max_retries?: number | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function confirmNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/confirm`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function rejectNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/reject`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function retryNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/retry`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function fetchAutomations(
  instanceId?: string | null,
  filters: {
    status?: AutomationStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; automations: AutomationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/automations", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchAutomationDetail(automationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}`, undefined, instanceId),
  );
}

export function createAutomation(
  instanceId: string | null | undefined,
  payload: {
    automation_id?: string | null;
    title: string;
    summary?: string;
    action_kind: AutomationActionKind;
    cadence_minutes: number;
    next_run_at: string;
    target_task_id?: string | null;
    target_conversation_id?: string | null;
    target_inbox_id?: string | null;
    target_workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    preview_required?: boolean;
    task_template_title?: string | null;
    task_template_summary?: string | null;
    notification_title?: string | null;
    notification_body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope("/admin/automations", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateAutomation(
  instanceId: string | null | undefined,
  automationId: string,
  payload: {
    title?: string;
    summary?: string;
    status?: AutomationStatus | null;
    cadence_minutes?: number | null;
    next_run_at?: string | null;
    target_task_id?: string | null;
    target_conversation_id?: string | null;
    target_inbox_id?: string | null;
    target_workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    preview_required?: boolean | null;
    task_template_title?: string | null;
    task_template_summary?: string | null;
    notification_title?: string | null;
    notification_body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function triggerAutomation(instanceId: string | null | undefined, automationId: string) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}/trigger`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function fetchContacts(
  instanceId?: string | null,
  filters: {
    status?: ContactStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; contacts: ContactSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/contacts", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchContactDetail(contactId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope(`/admin/contacts/${encodeURIComponent(contactId)}`, undefined, instanceId),
  );
}

export function createContact(
  instanceId: string | null | undefined,
  payload: {
    contact_id?: string | null;
    contact_ref?: string | null;
    source_id?: string | null;
    display_name: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    organization?: string | null;
    title?: string | null;
    status?: ContactStatus;
    visibility_scope?: VisibilityScope;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope("/admin/contacts", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateContact(
  instanceId: string | null | undefined,
  contactId: string,
  payload: {
    contact_ref?: string | null;
    source_id?: string | null;
    display_name?: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    organization?: string | null;
    title?: string | null;
    status?: ContactStatus;
    visibility_scope?: VisibilityScope;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope(`/admin/contacts/${encodeURIComponent(contactId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchKnowledgeSources(
  instanceId?: string | null,
  filters: {
    sourceKind?: KnowledgeSourceKind | "all";
    status?: KnowledgeSourceStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; sources: KnowledgeSourceSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/knowledge-sources", undefined, instanceId), {
      sourceKind: filters.sourceKind && filters.sourceKind !== "all" ? filters.sourceKind : null,
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchKnowledgeSourceDetail(sourceId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope(`/admin/knowledge-sources/${encodeURIComponent(sourceId)}`, undefined, instanceId),
  );
}

export function createKnowledgeSource(
  instanceId: string | null | undefined,
  payload: {
    source_id?: string | null;
    source_kind: KnowledgeSourceKind;
    label: string;
    description?: string;
    connection_target: string;
    status?: KnowledgeSourceStatus;
    visibility_scope?: VisibilityScope;
    last_synced_at?: string | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope("/admin/knowledge-sources", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateKnowledgeSource(
  instanceId: string | null | undefined,
  sourceId: string,
  payload: {
    label?: string;
    description?: string;
    connection_target?: string;
    status?: KnowledgeSourceStatus;
    visibility_scope?: VisibilityScope;
    last_synced_at?: string | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope(`/admin/knowledge-sources/${encodeURIComponent(sourceId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchMemoryEntries(
  instanceId?: string | null,
  filters: {
    status?: MemoryStatus | "all";
    visibilityScope?: VisibilityScope | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; memory: MemorySummary[] }>(
    appendQueryParams(appendTenantScope("/admin/memory", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      visibilityScope: filters.visibilityScope && filters.visibilityScope !== "all" ? filters.visibilityScope : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchMemoryDetail(memoryId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}`, undefined, instanceId),
  );
}

export function createMemoryEntry(
  instanceId: string | null | undefined,
  payload: {
    memory_id?: string | null;
    source_id?: string | null;
    contact_id?: string | null;
    conversation_id?: string | null;
    task_id?: string | null;
    notification_id?: string | null;
    workspace_id?: string | null;
    memory_kind: MemoryKind;
    title: string;
    body: string;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    correction_note?: string | null;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope("/admin/memory", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: {
    source_id?: string | null;
    contact_id?: string | null;
    conversation_id?: string | null;
    task_id?: string | null;
    notification_id?: string | null;
    workspace_id?: string | null;
    memory_kind?: MemoryKind;
    title?: string;
    body?: string;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    correction_note?: string | null;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function correctMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: {
    title: string;
    body: string;
    correction_note: string;
    memory_kind?: MemoryKind;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; action: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}/correct`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: { deletion_note?: string | null } = {},
) {
  return fetchJson<{ status: string; action: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}/delete`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchAssistantProfiles(
  instanceId?: string | null,
  filters: {
    status?: AssistantProfileStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; profiles: AssistantProfileSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/assistant-profiles", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

export function fetchAssistantProfileDetail(assistantProfileId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}`, undefined, instanceId),
  );
}

export function createAssistantProfile(
  instanceId: string | null | undefined,
  payload: {
    assistant_profile_id?: string | null;
    display_name: string;
    summary?: string;
    status?: AssistantProfileStatus;
    assistant_mode_enabled?: boolean;
    is_default?: boolean;
    timezone?: string;
    locale?: string;
    tone?: AssistantTone;
    preferred_contact_id?: string | null;
    mail_source_id?: string | null;
    calendar_source_id?: string | null;
    preferences?: Record<string, unknown>;
    communication_rules?: Partial<CommunicationRules>;
    quiet_hours?: Partial<QuietHoursSettings>;
    delivery_preferences?: Partial<DeliveryPreferences>;
    action_policies?: Partial<ActionPolicies>;
    delegation_rules?: Partial<DelegationRules>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope("/admin/assistant-profiles", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateAssistantProfile(
  instanceId: string | null | undefined,
  assistantProfileId: string,
  payload: {
    display_name?: string;
    summary?: string;
    status?: AssistantProfileStatus;
    assistant_mode_enabled?: boolean;
    is_default?: boolean;
    timezone?: string;
    locale?: string;
    tone?: AssistantTone;
    preferred_contact_id?: string | null;
    mail_source_id?: string | null;
    calendar_source_id?: string | null;
    preferences?: Record<string, unknown>;
    communication_rules?: Partial<CommunicationRules>;
    quiet_hours?: Partial<QuietHoursSettings>;
    delivery_preferences?: Partial<DeliveryPreferences>;
    action_policies?: Partial<ActionPolicies>;
    delegation_rules?: Partial<DelegationRules>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function evaluateAssistantAction(
  instanceId: string | null | undefined,
  assistantProfileId: string,
  payload: {
    action_mode: AssistantActionMode;
    action_kind: AssistantActionKind;
    priority?: WorkItemPriority;
    channel_id?: string | null;
    target_contact_id?: string | null;
    occurred_at?: string | null;
    requires_external_delivery?: boolean;
    approval_reference?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; evaluation: AssistantActionEvaluation }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}/evaluate-action`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function replayExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  const params = new URLSearchParams();
  if (payload.instanceId?.trim()) {
    params.set("instanceId", payload.instanceId.trim());
  }
  if (payload.companyId?.trim()) {
    params.set("companyId", payload.companyId.trim());
  }
  return fetchJson<{ status: string; replay: ExecutionReplayResult }>(`/admin/execution/runs/${encodeURIComponent(runId)}/replay?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      reason: payload.reason,
      idempotency_key: payload.idempotencyKey?.trim() ? payload.idempotencyKey.trim() : null,
    }),
  });
}

export function fetchSecurityBootstrap() {
  return fetchJson<SecurityBootstrapResponse>("/admin/security/bootstrap");
}

export function fetchElevatedAccessRequests(gateStatus: ApprovalStatus | "all" = "all") {
  return fetchJson<{ status: string; requests: ElevatedAccessRequest[] }>(
    appendQueryParams("/admin/security/elevated-access-requests", {
      gate_status: gateStatus === "all" ? null : gateStatus,
    }),
  );
}

export function createBreakGlassRequest(payload: {
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
}) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>("/admin/security/break-glass", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createImpersonationRequest(payload: {
  target_user_id: string;
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
}) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>("/admin/security/impersonations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelElevatedAccessRequest(requestId: string) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>(
    `/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/cancel`,
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function issueElevatedAccessRequest(requestId: string) {
  return fetchJson<{
    status: string;
    request: ElevatedAccessRequest;
    access_token: string;
    token_type: string;
    expires_at: string;
    user: AdminSessionUser;
  }>(`/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/issue`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchAdminUsers() {
  return fetchJson<{ status: string; users: AdminUser[] }>("/admin/security/users");
}

export function createAdminUser(payload: { username: string; display_name: string; role: string; password: string }) {
  return fetchJson<{ status: string; user: AdminUser }>("/admin/security/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(userId: string, payload: { display_name?: string; role?: string; status?: string; must_rotate_password?: true }) {
  return fetchJson<{ status: string; user: AdminUser }>(`/admin/security/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function rotateAdminPassword(userId: string, payload: AdminPasswordRotationPayload) {
  return fetchJson<{ status: string; user: AdminUser }>(`/admin/security/users/${userId}/rotate-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminSessions() {
  return fetchJson<{ status: string; sessions: AdminSecuritySession[] }>("/admin/security/sessions");
}

export function revokeAdminSession(sessionId: string) {
  return fetchJson<{ status: string; session: AdminSecuritySession }>(`/admin/security/sessions/${sessionId}/revoke`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchProviderSecretPosture() {
  return fetchJson<{ status: string; providers: Array<Record<string, string | number | boolean>> }>("/admin/security/secret-posture");
}

export function fetchProviderControlPlane(instanceId?: string | null): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>(appendTenantScope("/admin/providers/", undefined, instanceId));
}

export function fetchModelRegister(instanceId?: string | null): Promise<AdminModelRegisterResponse> {
  return fetchJson<AdminModelRegisterResponse>(appendTenantScope("/admin/models/", undefined, instanceId));
}

export function fetchProviderTargets(instanceId?: string | null): Promise<ProviderTargetRegisterResponse> {
  return fetchJson<ProviderTargetRegisterResponse>(appendTenantScope("/admin/provider-targets/", undefined, instanceId));
}

export function fetchRoutingControlPlane(instanceId?: string | null): Promise<RoutingControlPlaneResponse> {
  return fetchJson<RoutingControlPlaneResponse>(appendTenantScope("/admin/routing/", undefined, instanceId));
}

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
  return fetchJson<{ status: string; target: ProviderTargetRecord }>(appendTenantScope(`/admin/provider-targets/${encodeURIComponent(targetKey)}`, undefined, instanceId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

function postExecutionOperatorAction(
  runId: string,
  action: "pause" | "resume" | "interrupt" | "quarantine" | "restart" | "escalate",
  payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane?: string | null; idempotencyKey?: string },
) {
  const params = new URLSearchParams();
  if (payload.instanceId?.trim()) {
    params.set("instanceId", payload.instanceId.trim());
  }
  if (payload.companyId?.trim()) {
    params.set("companyId", payload.companyId.trim());
  }
  return fetchJson<{ status: string; action: ExecutionOperatorActionResult }>(`/admin/execution/runs/${encodeURIComponent(runId)}/${action}?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      reason: payload.reason,
      execution_lane: payload.executionLane?.trim() ? payload.executionLane.trim() : null,
      idempotency_key: payload.idempotencyKey?.trim() ? payload.idempotencyKey.trim() : null,
    }),
  });
}

export function pauseExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "pause", payload);
}

export function resumeExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "resume", payload);
}

export function interruptExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "interrupt", payload);
}

export function quarantineExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "quarantine", payload);
}

export function restartExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane?: string | null; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "restart", payload);
}

export function escalateExecutionRun(runId: string, payload: { instanceId?: string | null; companyId?: string | null; reason: string; executionLane: string; idempotencyKey?: string }) {
  return postExecutionOperatorAction(runId, "escalate", payload);
}

export function reconcileExecutionLeases(options: { instanceId?: string | null; companyId?: string | null }) {
  const params = new URLSearchParams();
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    params.set("companyId", options.companyId.trim());
  }
  return fetchJson<{ status: string; reconciled: ExecutionLeaseReconcileResult[] }>(`/admin/execution/dispatch/reconcile-leases?${params.toString()}`, {
    method: "POST",
    body: "{}",
  });
}

export function updateRoutingPolicy(
  classification: "simple" | "non_simple",
  payload: Partial<RoutingPolicyRecord>,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; policy: RoutingPolicyRecord }>(
    appendTenantScope(`/admin/routing/policies/${classification}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function updateRoutingBudget(
  payload: RoutingBudgetUpdatePayload,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; budget: RoutingBudgetRecord }>(
    appendTenantScope("/admin/routing/budget", undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function updateRoutingCircuit(
  targetKey: string,
  payload: Pick<RoutingCircuitRecord, "state" | "reason">,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; circuit: RoutingCircuitRecord }>(
    appendTenantScope(`/admin/routing/circuits/${encodeURIComponent(targetKey)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function simulateRouting(
  payload: {
    requested_model?: string | null;
    prompt?: string | null;
    messages?: Array<Record<string, unknown>>;
    stream?: boolean;
    tools?: Array<Record<string, unknown>>;
    require_vision?: boolean;
    max_output_tokens?: number | null;
  },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; decision?: RoutingDecisionRecord; error?: { type: string; message: string } }>(
    appendTenantScope("/admin/routing/simulate", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchCompatibilityMatrix(instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; matrix: CompatibilityMatrixRow[] }>(
    appendTenantScope("/admin/providers/compatibility-matrix", undefined, instanceId),
  );
}

export function createProvider(payload: { provider: string; label: string; integration_class?: string; template_id?: string | null; config: Record<string, string> }) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>("/admin/providers/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProvider(provider: string, payload: { label?: string; integration_class?: string; template_id?: string | null; config?: Record<string, string> }) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(`/admin/providers/${provider}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function activateProvider(provider: string) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(`/admin/providers/${provider}/activate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deactivateProvider(provider: string) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>(`/admin/providers/${provider}/deactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function syncProviders(provider?: string) {
  return fetchJson<{ status: string; synced_providers: string[]; sync_at: string; note: string }>("/admin/providers/sync", {
    method: "POST",
    body: JSON.stringify({ provider: provider ?? null }),
  });
}

export function patchHealthConfig(payload: Partial<HealthConfig>) {
  return fetchJson<{ status: string; config: HealthConfig }>("/admin/providers/health/config", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function runHealthChecks() {
  return fetchJson<{ status: string; check_type: string; checked_at: string; health_records: Array<Record<string, string>> }>("/admin/providers/health/run", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchUsageSummary(window: "1h" | "24h" | "7d" | "all" = "24h", instanceId?: string | null): Promise<UsageSummaryResponse> {
  return fetchJson<UsageSummaryResponse>(appendTenantScope(`/admin/usage/?window=${window}`, undefined, instanceId));
}

export function fetchHarnessTemplates() {
  return fetchJson<{ status: string; templates: HarnessTemplate[] }>("/admin/providers/harness/templates");
}

export function fetchHarnessProfiles() {
  return fetchJson<{ status: string; profiles: HarnessProfile[] }>("/admin/providers/harness/profiles");
}

export function upsertHarnessProfile(providerKey: string, payload: Record<string, unknown>) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(`/admin/providers/harness/profiles/${providerKey}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteHarnessProfile(providerKey: string) {
  return fetchJson<{ status: string; deleted: string }>(`/admin/providers/harness/profiles/${providerKey}`, { method: "DELETE" });
}

export function activateHarnessProfile(providerKey: string) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(`/admin/providers/harness/profiles/${providerKey}/activate`, { method: "POST", body: "{}" });
}

export function deactivateHarnessProfile(providerKey: string) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(`/admin/providers/harness/profiles/${providerKey}/deactivate`, { method: "POST", body: "{}" });
}

export function verifyHarnessProfile(payload: { provider_key: string; model?: string; test_message?: string; include_preview?: boolean }) {
  return fetchJson<{ status: string; verification: Record<string, unknown> }>("/admin/providers/harness/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function previewHarness(payload: { provider_key: string; model: string; message: string; stream: boolean }) {
  return fetchJson<{ status: string; preview: Record<string, unknown> }>("/admin/providers/harness/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function dryRunHarness(payload: { provider_key: string; model: string; message: string; stream: boolean }) {
  return fetchJson<{ status: string; preview_request: Record<string, unknown>; mapped_example: Record<string, unknown>; run: Record<string, unknown> }>("/admin/providers/harness/dry-run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function probeHarness(payload: { provider_key: string; model: string; message: string; stream: boolean }) {
  return fetchJson<{ status: string; status_code: number; parsed: Record<string, unknown>; raw: Record<string, unknown>; run: Record<string, unknown> }>("/admin/providers/harness/probe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchHarnessSnapshot() {
  return fetchJson<{ status: string; snapshot: Record<string, unknown> }>("/admin/providers/harness/snapshot");
}

export function fetchHarnessExport(redactSecrets = true) {
  return fetchJson<{ status: string; snapshot: Record<string, unknown> }>(`/admin/providers/harness/export?redact_secrets=${String(redactSecrets)}`);
}

export function importHarnessConfig(snapshot: Record<string, unknown>, dryRun = true) {
  return fetchJson<Record<string, unknown>>("/admin/providers/harness/import", {
    method: "POST",
    body: JSON.stringify({ snapshot, dry_run: dryRun }),
  });
}

export function rollbackHarnessProfile(providerKey: string, revision: number) {
  return fetchJson<{ status: string; profile: HarnessProfile }>(`/admin/providers/harness/profiles/${providerKey}/rollback/${revision}`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchHarnessRuns(providerKey?: string, mode?: string, status?: string, clientId?: string, limit = 50) {
  const params = new URLSearchParams();
  if (providerKey) params.set("provider_key", providerKey);
  if (mode) params.set("mode", mode);
  if (status) params.set("status", status);
  if (clientId) params.set("client_id", clientId);
  params.set("limit", String(limit));
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; runs: Array<Record<string, unknown>>; summary: Record<string, number>; ops?: Record<string, unknown> }>(`/admin/providers/harness/runs${suffix}`);
}


export function fetchClientOperationalView(window: "1h" | "24h" | "7d" | "all" = "24h", instanceId?: string | null) {
  return fetchJson<{ status: string; window: string; clients: Array<Record<string, string | number | boolean>> }>(
    appendTenantScope(`/admin/usage/clients?window=${window}`, undefined, instanceId),
  );
}

export function fetchProviderDrilldown(provider: string, window: "1h" | "24h" | "7d" | "all" = "24h", instanceId?: string | null) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/providers/${provider}?window=${window}`, undefined, instanceId),
  );
}

export function fetchClientDrilldown(clientId: string, window: "1h" | "24h" | "7d" | "all" = "24h", instanceId?: string | null) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/clients/${encodeURIComponent(clientId)}?window=${window}`, undefined, instanceId),
  );
}


export function fetchProductAxisTargets(instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; targets: ProductAxisTarget[] }>(
    appendTenantScope("/admin/providers/product-axis-targets", undefined, instanceId),
  );
}

export function probeOauthAccountProvider(providerKey: string) {
  return fetchJson<{ status: string; probe: Record<string, unknown> }>(`/admin/providers/oauth-account/probe/${providerKey}`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchOauthAccountTargets(instanceId?: string | null) {
  return fetchJson<{ status: string; targets: OauthTargetStatus[] }>(
    appendTenantScope("/admin/providers/oauth-account/targets", undefined, instanceId),
  );
}

export function fetchOauthOnboarding(instanceId?: string | null) {
  return fetchJson<{ status: string; targets: OauthOnboardingTarget[] }>(
    appendTenantScope("/admin/providers/oauth-account/onboarding", undefined, instanceId),
  );
}

export function syncOauthAccountBridgeProfiles() {
  return fetchJson<{ status: string; upserted_profiles: string[]; skipped: string[] }>("/admin/providers/oauth-account/bridge-profiles/sync", {
    method: "POST",
    body: "{}",
  });
}

export function probeAllOauthAccountProviders() {
  return fetchJson<{ status: string; probes: Array<Record<string, unknown>> }>("/admin/providers/oauth-account/probe-all", {
    method: "POST",
    body: "{}",
  });
}

export function fetchOauthAccountOperations(instanceId?: string | null) {
  return fetchJson<{ status: string; operations: Array<Record<string, unknown>>; recent: Array<Record<string, unknown>>; total_operations: number }>(
    appendTenantScope("/admin/providers/oauth-account/operations", undefined, instanceId),
  );
}

export function fetchBootstrapReadiness() {
  return fetchJson<{ status: string; ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[]; checked_at?: string }>("/admin/providers/bootstrap/readiness");
}

export function fetchIngressTlsStatus(): Promise<IngressTlsStatusResponse> {
  return fetchJson<IngressTlsStatusResponse>("/admin/ingress/tls");
}

export function renewIngressTls() {
  return fetchJson<{ status: string; renewal: Record<string, unknown> }>("/admin/ingress/tls/renew", {
    method: "POST",
    body: "{}",
  });
}
