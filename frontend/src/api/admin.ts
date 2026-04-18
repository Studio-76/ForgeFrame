export type ProviderControlItem = {
  provider: string;
  ready: boolean;
  readiness_reason: string | null;
  capabilities: Record<string, boolean>;
  oauth_required: boolean;
  discovery_supported: boolean;
  model_count: number;
  models: Array<{
    id: string;
    source: "static" | "discovered";
    discovery_status: string;
    active: boolean;
  }>;
};

export type ProviderControlPlaneResponse = {
  status: "ok";
  object: "provider_control_plane";
  providers: ProviderControlItem[];
  notes: {
    sync_action: string;
    ui_first: boolean;
  };
};

export type UsageSummaryResponse = {
  status: "ok";
  object: "usage_summary";
  metrics: {
    active_model_count: number;
    ready_model_count: number;
    stream_capable_model_count: number;
  };
  cost_axes: {
    actual: string;
    hypothetical: string;
    avoided: string;
  };
  pricing_snapshot: Record<string, number>;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function fetchProviderControlPlane(): Promise<ProviderControlPlaneResponse> {
  return fetchJson<ProviderControlPlaneResponse>("/admin/providers/");
}

export function fetchUsageSummary(): Promise<UsageSummaryResponse> {
  return fetchJson<UsageSummaryResponse>("/admin/usage/");
}
