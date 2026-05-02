/**
 * Usage summary API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Usage types
// ---------------------------------------------------------------------------

/** Usage summary response. */
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
  cost_truths: Record<string, {
    label: string;
    status: "tracked" | "derived" | "unsupported";
    billing_truth: boolean;
    description: string;
    runtime_cost: number | null;
    health_check_cost: number | null;
    total_cost: number | null;
  }>;
  cost_axes: Record<string, string>;
  window: "1h" | "24h" | "7d" | "all";
  instance?: Pick<InstanceRecord, "instance_id" | "tenant_id" | "company_id">;
  latest_health: Array<Record<string, string | number | null>>;
  timeline_24h: Array<Record<string, string | number>>;
  alerts: Array<Record<string, string | number>>;
  runtime_duration_ms?: {
    sample_count: number;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
  };
  stream_mode_counts?: {
    stream: number;
    non_stream: number;
    runtime_request_count: number;
  };
  selected_filters?: {
    provider?: string | null;
    client_id?: string | null;
    model?: string | null;
  };
  pricing_snapshot: Record<string, number>;
};

/** Usage summary filters. */
export type UsageSummaryFilters = {
  provider?: string | null;
  clientId?: string | null;
  model?: string | null;
};

// ---------------------------------------------------------------------------
// Usage API functions
// ---------------------------------------------------------------------------

/**
 * Fetch usage summary for the given time window.
 * @param window - Time window (default "24h").
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (provider, clientId, model).
 * @returns Usage summary response.
 */
export function fetchUsageSummary(
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
  filters?: UsageSummaryFilters,
): Promise<UsageSummaryResponse> {
  const params = new URLSearchParams({ window });
  if (filters?.provider) {
    params.set("provider", filters.provider);
  }
  if (filters?.clientId) {
    params.set("client_id", filters.clientId);
  }
  if (filters?.model) {
    params.set("model", filters.model);
  }
  return fetchJson<UsageSummaryResponse>(appendTenantScope(`/admin/usage/?${params.toString()}`, undefined, instanceId));
}
