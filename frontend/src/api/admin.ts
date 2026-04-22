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
  capabilities: Record<string, unknown>;
  tool_calling_level?: "none" | "partial" | "full";
  compatibility_tier?: "planned" | "beta" | "beta_plus";
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

export type ProviderControlPlaneResponse = {
  status: "ok";
  object: "provider_control_plane";
  providers: ProviderControlItem[];
  health_config: HealthConfig;
  notes: Record<string, unknown>;
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
  latest_health: Array<Record<string, string | number | null>>;
  timeline_24h: Array<Record<string, string | number>>;
  alerts: Array<Record<string, string | number>>;
  pricing_snapshot: Record<string, number>;
};


export type BetaProviderTarget = {
  provider_key: string;
  provider_type: "oauth_account" | "openai_compatible" | "local";
  product_axis: "oauth_account_providers" | "openai_compatible_providers" | "local_providers" | "openai_compatible_clients";
  auth_model: string;
  runtime_path: string;
  readiness: "planned" | "partial" | "ready";
  readiness_score: number;
  runtime_readiness: "planned" | "partial" | "ready";
  streaming_readiness: "planned" | "partial" | "ready";
  verify_probe_readiness: "planned" | "partial" | "ready";
  ui_readiness: "planned" | "partial" | "ready";
  beta_tier: "concept" | "beta" | "beta_plus";
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
  role: "admin" | "operator" | "viewer";
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
  role: "admin" | "operator" | "viewer";
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
  role: "admin" | "operator" | "viewer";
  session_type?: "standard" | "impersonation" | "break_glass";
  read_only?: boolean;
  must_rotate_password?: boolean;
};

export type GatewayAccount = {
  account_id: string;
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
  security?: Record<string, string | number | boolean>;
};

export type CompatibilityMatrixRow = {
  provider: string;
  label: string;
  tier: string;
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

export type LogsResponse = {
  status: "ok";
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
  target_role: "admin" | "operator" | "viewer";
  session_role: "admin" | "operator" | "viewer";
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
  company_id?: string | null;
  issue_id?: string | null;
  requester?: ApprovalActorSummary | null;
  target?: ApprovalActorSummary | null;
  decision_actor?: ApprovalActorSummary | null;
  ready_to_issue: boolean;
  session_status?: ApprovalSessionStatus | null;
};

export type ApprovalDetail = ApprovalSummary & {
  evidence: Record<string, unknown>;
  source: Record<string, unknown>;
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
  run_kind: string;
  state: string;
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
};

export type ExecutionReplayAuditReference = {
  event_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  status: string;
  tenant_id: string;
  company_id?: string | null;
};

export type ExecutionReplayResult = {
  command_id: string;
  run_id: string;
  attempt_id?: string | null;
  run_state: string;
  outbox_event?: string | null;
  deduplicated: boolean;
  replay_reason: string;
  audit?: ExecutionReplayAuditReference | null;
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

const ADMIN_TOKEN_STORAGE_KEY = "forgegate_admin_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
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

function appendTenantScope(path: string, tenantId?: string | null): string {
  const normalizedTenantId = (tenantId ?? "").trim();
  if (!normalizedTenantId) {
    return path;
  }
  const url = new URL(path, "https://forgegate.local");
  url.searchParams.set("tenantId", normalizedTenantId);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function appendAuditScope(path: string, tenantId?: string | null, companyId?: string | null): string {
  const normalizedTenantId = (tenantId ?? "").trim();
  const normalizedCompanyId = (companyId ?? "").trim();
  if (!normalizedTenantId && !normalizedCompanyId) {
    return path;
  }
  const url = new URL(path, "https://forgegate.local");
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
  const url = new URL(path, "https://forgegate.local");

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

export function fetchDashboard(tenantId?: string | null) {
  return fetchJson<DashboardResponse>(appendTenantScope("/admin/dashboard/", tenantId));
}

export function fetchAccounts(tenantId?: string | null) {
  return fetchJson<{ status: string; accounts: GatewayAccount[] }>(appendTenantScope("/admin/accounts/", tenantId));
}

export function createAccount(payload: { label: string; provider_bindings?: string[]; notes?: string }) {
  return fetchJson<{ status: string; account: GatewayAccount }>("/admin/accounts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAccount(accountId: string, payload: { label?: string; provider_bindings?: string[]; notes?: string; status?: string }) {
  return fetchJson<{ status: string; account: GatewayAccount }>(`/admin/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchRuntimeKeys(tenantId?: string | null) {
  return fetchJson<{ status: string; keys: RuntimeKey[] }>(appendTenantScope("/admin/keys/", tenantId));
}

export function createRuntimeKey(payload: { label: string; account_id?: string | null; scopes?: string[] }) {
  return fetchJson<{ status: string; issued: { key_id: string; token: string; prefix: string; account_id: string | null; label: string; scopes: string[]; created_at: string } }>("/admin/keys/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rotateRuntimeKey(keyId: string) {
  return fetchJson<{ status: string; issued: { key_id: string; token: string; prefix: string; account_id: string | null; label: string; scopes: string[]; created_at: string } }>(`/admin/keys/${keyId}/rotate`, {
    method: "POST",
    body: "{}",
  });
}

export function setRuntimeKeyStatus(keyId: string, action: "activate" | "disable" | "revoke") {
  return fetchJson<{ status: string; key: RuntimeKey }>(`/admin/keys/${keyId}/${action}`, {
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

export function fetchLogs(tenantId?: string | null, companyId?: string | null) {
  return fetchJson<LogsResponse>(appendAuditScope("/admin/logs/", tenantId, companyId));
}

export function fetchAuditHistory(query: AuditHistoryQuery = {}) {
  return fetchJson<AuditHistoryResponse>(appendQueryParams("/admin/logs/audit-events", {
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

export function fetchAuditHistoryDetail(eventId: string, tenantId?: string | null, companyId?: string | null) {
  return fetchJson<AuditHistoryDetailResponse>(appendQueryParams(`/admin/logs/audit-events/${encodeURIComponent(eventId)}`, {
    tenantId,
    companyId,
  }));
}

export async function generateAuditExport(
  payload: AuditExportRequest,
  tenantId?: string | null,
  companyId?: string | null,
): Promise<AuditExportResult> {
  const path = appendAuditScope("/admin/logs/audit-export", tenantId, companyId);
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
    exportId: response.headers.get("X-ForgeGate-Audit-Export-Id") ?? "",
    filename: parseContentDispositionFilename(response.headers.get("Content-Disposition"))
      ?? `forgegate-audit-export.${payload.format}`,
    status: "ready",
    rowCount: Number(response.headers.get("X-ForgeGate-Audit-Export-Row-Count") ?? "0"),
    generatedAt: response.headers.get("X-ForgeGate-Audit-Export-Generated-At"),
    blob,
  };
}

export function fetchApprovals(status: ApprovalStatus | "all" = "open") {
  const params = new URLSearchParams();
  if (status !== "all") {
    params.set("status", status);
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approvals: ApprovalSummary[] }>(`/admin/approvals${suffix}`);
}

export function fetchApprovalDetail(approvalId: string) {
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}`);
}

export function approveApproval(approvalId: string, decisionNote: string) {
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote }),
  });
}

export function rejectApproval(approvalId: string, decisionNote: string) {
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote }),
  });
}

export function fetchExecutionRuns(options: { companyId: string; state?: string; limit?: number }) {
  const params = new URLSearchParams({ companyId: options.companyId });
  if (options.state && options.state !== "all") {
    params.set("state", options.state);
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  return fetchJson<{ status: string; runs: ExecutionRunSummary[] }>(`/admin/execution/runs?${params.toString()}`);
}

export function fetchExecutionRunDetail(runId: string, options: { companyId: string }) {
  const params = new URLSearchParams({ companyId: options.companyId });
  return fetchJson<{ status: string; run: ExecutionRunDetail }>(`/admin/execution/runs/${encodeURIComponent(runId)}?${params.toString()}`);
}

export function replayExecutionRun(runId: string, payload: { companyId: string; reason: string; idempotencyKey?: string }) {
  const params = new URLSearchParams({ companyId: payload.companyId });
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

export function fetchProviderControlPlane(tenantId?: string | null): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>(appendTenantScope("/admin/providers/", tenantId));
}

export function fetchCompatibilityMatrix(tenantId?: string | null) {
  return fetchJson<{ status: string; matrix: CompatibilityMatrixRow[] }>(appendTenantScope("/admin/providers/compatibility-matrix", tenantId));
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

export function fetchUsageSummary(window: "1h" | "24h" | "7d" | "all" = "24h", tenantId?: string | null): Promise<UsageSummaryResponse> {
  return fetchJson<UsageSummaryResponse>(appendTenantScope(`/admin/usage/?window=${window}`, tenantId));
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


export function fetchClientOperationalView(window: "1h" | "24h" | "7d" | "all" = "24h", tenantId?: string | null) {
  return fetchJson<{ status: string; window: string; clients: Array<Record<string, string | number | boolean>> }>(
    appendTenantScope(`/admin/usage/clients?window=${window}`, tenantId),
  );
}

export function fetchProviderDrilldown(provider: string, window: "1h" | "24h" | "7d" | "all" = "24h", tenantId?: string | null) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/providers/${provider}?window=${window}`, tenantId),
  );
}

export function fetchClientDrilldown(clientId: string, window: "1h" | "24h" | "7d" | "all" = "24h", tenantId?: string | null) {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(
    appendTenantScope(`/admin/usage/clients/${encodeURIComponent(clientId)}?window=${window}`, tenantId),
  );
}


export function fetchBetaProviderTargets(tenantId?: string | null) {
  return fetchJson<{ status: string; targets: BetaProviderTarget[] }>(appendTenantScope("/admin/providers/beta-targets", tenantId));
}

export function probeOauthAccountProvider(providerKey: string) {
  return fetchJson<{ status: string; probe: Record<string, unknown> }>(`/admin/providers/oauth-account/probe/${providerKey}`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchOauthAccountTargets(tenantId?: string | null) {
  return fetchJson<{ status: string; targets: Array<Record<string, string | boolean>> }>(
    appendTenantScope("/admin/providers/oauth-account/targets", tenantId),
  );
}

export function fetchOauthOnboarding(tenantId?: string | null) {
  return fetchJson<{ status: string; targets: Array<Record<string, unknown>> }>(
    appendTenantScope("/admin/providers/oauth-account/onboarding", tenantId),
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

export function fetchOauthAccountOperations(tenantId?: string | null) {
  return fetchJson<{ status: string; operations: Array<Record<string, unknown>>; recent: Array<Record<string, unknown>>; total_operations: number }>(
    appendTenantScope("/admin/providers/oauth-account/operations", tenantId),
  );
}

export function fetchBootstrapReadiness() {
  return fetchJson<{ status: string; ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[]; checked_at?: string }>("/admin/providers/bootstrap/readiness");
}
