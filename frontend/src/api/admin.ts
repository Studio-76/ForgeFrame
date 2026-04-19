export type ManagedModel = {
  id: string;
  source: "static" | "discovered" | "manual" | "templated";
  discovery_status: string;
  active: boolean;
  health_status: string;
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
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
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

export function fetchProviderControlPlane(): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>("/admin/providers/");
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
