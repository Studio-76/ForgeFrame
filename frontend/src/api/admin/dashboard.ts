/**
 * Dashboard API function and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

/** Dashboard primary action. */
export type DashboardPrimaryAction = {
  kind: "go_live_blocker" | "provider_configuration" | "security_closure" | "runtime_stability" | "routing_queue_pressure" | "cost_pressure" | "all_stable";
  title: string;
  description: string;
  status: string;
  to: string;
  action_label: string;
};

/** Dashboard attention item. */
export type DashboardAttentionItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  cause: string;
  axis: string;
  to: string;
  action_label: string;
  status: string;
};

/** Dashboard section. */
export type DashboardSection = {
  key: "readiness" | "security" | "runtime" | "routing_queue" | "cost";
  title: string;
  status: string;
  reason: string;
  to: string;
  action_label: string;
  details: string[];
};

/** Dashboard summary item. */
export type DashboardSummaryItem = {
  key: string;
  label: string;
  value: string;
  meta: string;
  status: string;
};

/** Dashboard empty state. */
export type DashboardEmptyState = {
  status: string;
  title: string;
  description: string;
  action_label: string;
  to: string;
};

/** Dashboard response. */
export type DashboardResponse = {
  status: "ok";
  object: "dashboard_command_center";
  generated_at: string;
  kpis: Record<string, number>;
  alerts: Array<Record<string, string | number>>;
  needs_attention: string[];
  primary_action: DashboardPrimaryAction;
  attention: DashboardAttentionItem[];
  sections: DashboardSection[];
  summary: DashboardSummaryItem[];
  empty_state?: DashboardEmptyState | null;
  instance?: Pick<InstanceRecord, "instance_id" | "tenant_id" | "company_id" | "display_name">;
  security?: Record<string, string | number | boolean>;
};

// ---------------------------------------------------------------------------
// Dashboard API function
// ---------------------------------------------------------------------------

/**
 * Fetch the dashboard command center data.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Dashboard response.
 */
export function fetchDashboard(instanceId?: string | null) {
  return fetchJson<DashboardResponse>(appendTenantScope("/admin/dashboard/", undefined, instanceId));
}
