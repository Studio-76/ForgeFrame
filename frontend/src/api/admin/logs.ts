/**
 * Logs and observability API function and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendAuditScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Audit types (used by LogsResponse)
// ---------------------------------------------------------------------------

/** Audit history status. */
export type AuditHistoryStatus = "ok" | "warning" | "failed";

/** Audit history actor summary. */
export type AuditHistoryActorSummary = {
  type: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

/** Audit history target summary. */
export type AuditHistoryTargetSummary = {
  type: string;
  typeLabel: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

/** Audit history correlation summary. */
export type AuditHistoryCorrelationSummary = {
  label: string;
  value: string;
};

/** Audit history row. */
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
  correlation?: AuditHistoryCorrelationSummary | null;
  detailAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Logs types
// ---------------------------------------------------------------------------

/** Logs and observability response. */
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
  incident_review?: {
    axes: Array<{
      incident_id: string;
      axis: "runtime" | "provider" | "oauth" | "routing" | "queue_dispatch" | "security" | "tls" | "work_interaction";
      axis_label: string;
      title: string;
      severity: "critical" | "warning" | "info" | "clear" | "unsupported";
      count: number;
      first_seen_at?: string | null;
      last_seen_at?: string | null;
      current_effect: string;
      next_step: string;
      summary: string;
      links: Array<{
        label: string;
        href: string;
      }>;
      raw_evidence: Record<string, unknown>;
    }>;
    blocked_routing_failures: Array<{
      decision_id: string;
      error_type: string;
      summary: string;
      policy_stage?: string | null;
      created_at: string;
      reason_category: string;
      current_effect: string;
      next_step: string;
      links: Array<{
        label: string;
        href: string;
      }>;
      raw_evidence: Record<string, unknown>;
    }>;
  };
  operability: {
    ready: boolean;
    checks: Array<Record<string, unknown>>;
    metrics: Record<string, unknown>;
    logging: Record<string, unknown>;
    tracing: Record<string, unknown>;
  };
};

// ---------------------------------------------------------------------------
// Logs API function
// ---------------------------------------------------------------------------

/**
 * Fetch logs and observability data.
 * @param instanceId - Optional instance ID for scoping.
 * @param tenantId - Optional tenant ID for scoping.
 * @param companyId - Optional company ID for scoping.
 * @returns Logs response.
 */
export function fetchLogs(instanceId?: string | null, tenantId?: string | null, companyId?: string | null) {
  return fetchJson<LogsResponse>(appendAuditScope("/admin/logs/", tenantId, companyId, instanceId));
}
