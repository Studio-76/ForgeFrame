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

export type AdminSecuritySession = {
  session_id: string;
  user_id: string;
  role: "admin" | "operator" | "viewer";
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  username: string;
  display_name: string;
  user_status: string;
  active: boolean;
};

export type SecurityBootstrapResponse = {
  status: "ok";
  bootstrap: Record<string, string | number | boolean>;
  secret_posture: Array<Record<string, string | number | boolean>>;
};

export type AdminSessionUser = {
  session_id: string;
  user_id: string;
  username: string;
  display_name: string;
  role: "admin" | "operator" | "viewer";
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
  security: Record<string, string | number | boolean>;
};

export type CompatibilityMatrixRow = {
  provider: string;
  label: string;
  tier: string;
  ready: boolean;
  provider_axis: string;
  streaming: string;
  tool_calling: string;
  vision: string;
  discovery: string;
  oauth_required: boolean;
  ui_models: number;
  notes: string;
};

export type LogsResponse = {
  status: "ok";
  audit_events: Array<Record<string, unknown>>;
  alerts: Array<Record<string, string | number>>;
  error_summary: Record<string, unknown>;
};

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
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function fetchAuthBootstrap() {
  return fetchJson<{ status: string; bootstrap: Record<string, string | boolean> }>("/admin/auth/bootstrap");
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

export function fetchDashboard() {
  return fetchJson<DashboardResponse>("/admin/dashboard/");
}

export function fetchAccounts() {
  return fetchJson<{ status: string; accounts: GatewayAccount[] }>("/admin/accounts/");
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

export function fetchRuntimeKeys() {
  return fetchJson<{ status: string; keys: RuntimeKey[] }>("/admin/keys/");
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

export function fetchLogs() {
  return fetchJson<LogsResponse>("/admin/logs/");
}

export function fetchSecurityBootstrap() {
  return fetchJson<SecurityBootstrapResponse>("/admin/security/bootstrap");
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

export function updateAdminUser(userId: string, payload: { display_name?: string; role?: string; status?: string; must_rotate_password?: boolean }) {
  return fetchJson<{ status: string; user: AdminUser }>(`/admin/security/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function rotateAdminPassword(userId: string, payload: { new_password: string; must_rotate_password?: boolean }) {
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

export function fetchProviderControlPlane(): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>("/admin/providers/");
}

export function fetchCompatibilityMatrix() {
  return fetchJson<{ status: string; matrix: CompatibilityMatrixRow[] }>("/admin/providers/compatibility-matrix");
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

export function fetchUsageSummary(window: "1h" | "24h" | "7d" | "all" = "24h"): Promise<UsageSummaryResponse> {
  return fetchJson<UsageSummaryResponse>(`/admin/usage/?window=${window}`);
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


export function fetchClientOperationalView(window: "1h" | "24h" | "7d" | "all" = "24h") {
  return fetchJson<{ status: string; window: string; clients: Array<Record<string, string | number | boolean>> }>(`/admin/usage/clients?window=${window}`);
}

export function fetchProviderDrilldown(provider: string, window: "1h" | "24h" | "7d" | "all" = "24h") {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(`/admin/usage/providers/${provider}?window=${window}`);
}

export function fetchClientDrilldown(clientId: string, window: "1h" | "24h" | "7d" | "all" = "24h") {
  return fetchJson<{ status: string; window: string; drilldown: Record<string, unknown> }>(`/admin/usage/clients/${encodeURIComponent(clientId)}?window=${window}`);
}


export function fetchBetaProviderTargets() {
  return fetchJson<{ status: string; targets: BetaProviderTarget[] }>("/admin/providers/beta-targets");
}

export function probeOauthAccountProvider(providerKey: string) {
  return fetchJson<{ status: string; probe: Record<string, unknown> }>(`/admin/providers/oauth-account/probe/${providerKey}`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchOauthAccountTargets() {
  return fetchJson<{ status: string; targets: Array<Record<string, string | boolean>> }>("/admin/providers/oauth-account/targets");
}

export function fetchOauthOnboarding() {
  return fetchJson<{ status: string; targets: Array<Record<string, unknown>> }>("/admin/providers/oauth-account/onboarding");
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

export function fetchOauthAccountOperations() {
  return fetchJson<{ status: string; operations: Array<Record<string, unknown>>; recent: Array<Record<string, unknown>>; total_operations: number }>("/admin/providers/oauth-account/operations");
}

export function fetchBootstrapReadiness() {
  return fetchJson<{ status: string; ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[] }>("/admin/providers/bootstrap/readiness");
}
