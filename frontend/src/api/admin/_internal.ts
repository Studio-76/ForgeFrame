/**
 * Shared internal helpers and cross-cutting types for admin API domain modules.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// AdminApiError
// ---------------------------------------------------------------------------

/**
 * Error class for admin API failures.
 * Carries HTTP status, optional error code, and optional details payload.
 */
export class AdminApiError extends Error {
  /** HTTP status code. */
  status: number;
  /** Optional machine-readable error code. */
  code?: string;
  /** Optional error detail payload. */
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Storage helpers (token management)
// ---------------------------------------------------------------------------

const ADMIN_TOKEN_STORAGE_KEY = "forgeframe_admin_token";
const LEGACY_ADMIN_TOKEN_STORAGE_KEY = "forgegate_admin_token";

function readStoredValue(primaryKey: string, legacyKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(primaryKey) ?? window.localStorage.getItem(legacyKey) ?? "";
}

/**
 * Read the stored admin authentication token.
 * @returns The current admin token or an empty string.
 */
export function getAdminToken(): string {
  return readStoredValue(ADMIN_TOKEN_STORAGE_KEY, LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

/**
 * Persist an admin authentication token to local storage.
 * @param token - The token to store.
 */
export function setAdminToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

/**
 * Remove the admin authentication token from local storage.
 */
export function clearAdminToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Internal fetch wrapper that injects auth token and parses JSON responses.
 * @typeParam T - The expected response body shape.
 * @param path - The API path to fetch.
 * @param init - Optional fetch options.
 * @returns The parsed response body.
 * @throws {AdminApiError} On non-OK responses.
 */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
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

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Append tenant-scoped query parameters (instanceId, tenantId) to a path.
 * @param path - The base API path.
 * @param tenantId - Optional tenant ID.
 * @param instanceId - Optional instance ID.
 * @returns The path with query parameters appended.
 */
export function appendTenantScope(
  path: string,
  tenantId?: string | null,
  instanceId?: string | null,
): string {
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

/**
 * Append audit-scoped query parameters (instanceId, tenantId, companyId) to a path.
 * @param path - The base API path.
 * @param tenantId - Optional tenant ID.
 * @param companyId - Optional company ID.
 * @param instanceId - Optional instance ID.
 * @returns The path with query parameters appended.
 */
export function appendAuditScope(
  path: string,
  tenantId?: string | null,
  companyId?: string | null,
  instanceId?: string | null,
): string {
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

/**
 * Append arbitrary query parameters to a path, skipping null/undefined/empty values.
 * @param path - The base API path.
 * @param params - A record of key-value pairs to append.
 * @returns The path with query parameters appended.
 */
export function appendQueryParams(
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

// ---------------------------------------------------------------------------
// Cross-cutting types (used by multiple domain modules)
// ---------------------------------------------------------------------------

/** Administrative role within an instance. */
export type AdminRole = "owner" | "admin" | "operator" | "viewer";

/** Available admin permission keys for access control. */
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

/** Membership binding an admin user to an instance with a role. */
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

/** Current admin session user info. */
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

/** Generic record link reference. */
export type RecordLink = {
  record_id: string;
  label: string;
  status?: string | null;
};

/** Agent role classification. */
export type AgentRoleKind = "operator" | "specialist" | "reviewer" | "worker" | "observer";

/** Agent operational status. */
export type AgentStatus = "active" | "paused" | "archived";

/** Agent participation mode in conversations. */
export type AgentParticipationMode = "direct" | "mentioned_only" | "roundtable" | "handoff_only";

/** Summary view of an agent record. */
export type AgentSummary = {
  agent_id: string;
  instance_id: string;
  company_id: string;
  display_name: string;
  default_name: string;
  role_kind: AgentRoleKind;
  status: AgentStatus;
  participation_mode: AgentParticipationMode;
  allowed_targets: string[];
  assistant_profile_id?: string | null;
  is_default_operator: boolean;
  conversation_count: number;
  mention_count: number;
  last_activity_at?: string | null;
  addressable_in_conversations: boolean;
  addressability_reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Detailed agent view including linked profile. */
export type AgentDetail = AgentSummary & {
  assistant_profile?: RecordLink | null;
};

/** Instance setup readiness status. */
export type InstanceSetupStatus =
  | "ready"
  | "not-ready"
  | "bridge-only"
  | "onboarding-only"
  | "unsupported";

/** Summary of the operator agent for an instance. */
export type InstanceOperatorAgentSummary = {
  status: InstanceSetupStatus;
  reason: string;
  agent_id: string | null;
  display_name: string | null;
  role_kind: AgentRoleKind | null;
  agent_status: AgentStatus | null;
  auto_created: boolean;
  allowed_targets: string[];
  updated_at: string | null;
};

/** Summary of provider targets for an instance. */
export type InstanceProviderTargetSummary = {
  status: InstanceSetupStatus;
  reason: string;
  configured_provider_count: number;
  total_targets: number;
  enabled_targets: number;
  ready_targets: number;
  primary_targets: Array<{
    target_key: string | null;
    label: string | null;
    provider: string | null;
    readiness_status: string | null;
    priority: number | null;
  }>;
  last_activity_at: string | null;
};

/** Summary of routing state for an instance. */
export type InstanceRoutingSummary = {
  status: InstanceSetupStatus;
  reason: string;
  policy_count: number;
  open_circuits: number;
  hard_budget_blocked: boolean;
  blocked_cost_classes: string[];
  simple_preferred_target_keys: string[];
  non_simple_preferred_target_keys: string[];
  last_activity_at: string | null;
};

/** Summary of runtime access for an instance. */
export type InstanceRuntimeAccessSummary = {
  status: InstanceSetupStatus;
  reason: string;
  total_accounts: number;
  active_accounts: number;
  total_keys: number;
  active_keys: number;
  last_activity_at: string | null;
};

/** Summary of work interaction features for an instance. */
export type InstanceWorkInteractionSummary = {
  status: InstanceSetupStatus;
  reason: string;
  mode: string;
  inbox_enabled: boolean;
  tasks_enabled: boolean;
  notifications_enabled: boolean;
  conversation_count: number;
  open_conversation_count: number;
  latest_conversation_id: string | null;
  latest_conversation_subject: string | null;
  latest_activity_at: string | null;
};

/** A single readiness check for an instance. */
export type InstanceReadinessCheck = {
  id: string;
  label: string;
  status: InstanceSetupStatus;
  detail: string;
};

/** Aggregate readiness summary for an instance. */
export type InstanceReadinessSummary = {
  status: InstanceSetupStatus;
  reason: string;
  ready_check_count: number;
  check_count: number;
  checks: InstanceReadinessCheck[];
};

/** Top-level instance record. */
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
  operator_agent?: InstanceOperatorAgentSummary | null;
  provider_targets?: InstanceProviderTargetSummary | null;
  routing?: InstanceRoutingSummary | null;
  runtime_access?: InstanceRuntimeAccessSummary | null;
  work_interaction?: InstanceWorkInteractionSummary | null;
  readiness?: InstanceReadinessSummary | null;
  last_activity_at?: string | null;
};

/** Triage status for inbox/conversation items. */
export type TriageStatus = "new" | "relevant" | "delegated" | "blocked" | "done";

/** Work item priority. */
export type WorkItemPriority = "low" | "normal" | "high" | "critical";

/** Inbox item status. */
export type InboxStatus = "open" | "snoozed" | "closed" | "archived";

/** Inbox item summary view. */
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

/** Visibility scope for access control. */
export type VisibilityScope = "instance" | "team" | "personal" | "restricted";

/** Conversation status. */
export type ConversationStatus = "open" | "paused" | "closed" | "archived";

/** Approval lifecycle status. */
export type ApprovalStatus = "open" | "approved" | "rejected" | "timed_out" | "cancelled";

/** Capability evidence record. */
export type CapabilityEvidenceRecord = {
  status: "missing" | "observed" | "failed";
  source: "none" | "oauth_probe" | "runtime_non_stream" | "runtime_stream" | "runtime_tool_call";
  recorded_at?: string | null;
  details: string;
};

/** Provider capability evidence record (4 evidence dimensions). */
export type ProviderCapabilityEvidenceRecord = {
  runtime: CapabilityEvidenceRecord;
  streaming: CapabilityEvidenceRecord;
  tool_calling: CapabilityEvidenceRecord;
  live_probe: CapabilityEvidenceRecord;
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
