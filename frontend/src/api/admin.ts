export type ManagedModel = {
  id: string;
  source: "static" | "discovered";
  discovery_status: string;
  active: boolean;
  health_status: string;
};

export type ProviderControlItem = {
  provider: string;
  label: string;
  enabled: boolean;
  config: Record<string, string>;
  ready: boolean;
  readiness_reason: string | null;
  capabilities: Record<string, boolean>;
  oauth_required: boolean;
  discovery_supported: boolean;
  model_count: number;
  models: ManagedModel[];
  last_sync_at: string | null;
  last_sync_status: string;
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
  notes: {
    sync_action: string;
    health_action: string;
    ui_first: boolean;
    persistence: string;
  };
};

export type UsageSummaryResponse = {
  status: "ok";
  object: "usage_summary";
  metrics: {
    active_model_count: number;
    stream_capable_model_count: number;
    recorded_request_count: number;
    recorded_error_count: number;
    recorded_health_event_count: number;
  };
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
  };
  traffic_split: {
    runtime: Record<string, string | number>;
    health_check: Record<string, string | number>;
  };
  cost_axes: {
    actual: string;
    hypothetical: string;
    avoided: string;
  };
  window: "1h" | "24h" | "7d" | "all";
  latest_health: Array<Record<string, string | number | null>>;
  timeline_24h: Array<Record<string, string | number>>;
  alerts: Array<Record<string, string | number>>;
  pricing_snapshot: Record<string, number>;
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

export function createProvider(payload: { provider: string; label: string; config: Record<string, string> }) {
  return fetchJson<{ status: string; provider: ProviderControlItem }>("/admin/providers/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProvider(provider: string, payload: { label?: string; config?: Record<string, string> }) {
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

export function fetchHealthConfig() {
  return fetchJson<{ status: string; config: HealthConfig }>("/admin/providers/health/config");
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
