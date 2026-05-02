/**
 * Utility helpers for the Logs feature module.
 *
 * @packageDocumentation
 */

import type { AuditHistoryRow, FilterPreset, LogsResponse, SummaryCardEntry } from "./types";

/**
 * Build summary cards from logs response data.
 * @param logs - Logs API response.
 * @returns Array of summary card entries.
 */
export function buildSummaryCards(logs: {
  incident_review?: {
    axes: Array<{ severity: string; count: number }>;
    blocked_routing_failures: Array<unknown>;
  } | null;
  alerts: Array<unknown>;
  operability: { ready: boolean };
  audit_preview: Array<unknown>;
  audit_retention: { eventLimit: number; retentionLimited: boolean };
} | null): SummaryCardEntry[] {
  if (!logs) {
    return [];
  }

  const axes = logs.incident_review?.axes ?? [];
  const criticalCount = axes.filter((a) => a.severity === "critical").length;
  const warningCount = axes.filter((a) => a.severity === "warning").length;
  const blockedCount = logs.incident_review?.blocked_routing_failures.length ?? 0;
  const alertCount = logs.alerts.length;
  const auditPreviewCount = logs.audit_preview.length;
  const operabilityReady = logs.operability.ready;

  return [
    {
      key: "critical",
      label: "Active errors",
      value: String(criticalCount),
      meta: criticalCount > 0
        ? "Requires immediate operator action."
        : "No critical errors detected.",
      tone: criticalCount > 0 ? "danger" : "success",
    },
    {
      key: "incidents",
      label: "Open incidents",
      value: String(warningCount),
      meta: warningCount > 0
        ? "Warning-level incidents require review."
        : "No open warning incidents.",
      tone: warningCount > 0 ? "warning" : "success",
    },
    {
      key: "blocked",
      label: "Blocked routing",
      value: String(blockedCount),
      meta: blockedCount > 0
        ? "Policy or capability failures need attention."
        : "No blocked routing failures.",
      tone: blockedCount > 0 ? "warning" : "success",
    },
    {
      key: "alerts",
      label: "Alert pressure",
      value: String(alertCount),
      meta: alertCount > 0
        ? `${alertCount} active alert${alertCount === 1 ? "" : "s"}.`
        : "No active alerts.",
      tone: alertCount > 0 ? "warning" : "success",
    },
    {
      key: "audit",
      label: "Audit events",
      value: String(auditPreviewCount),
      meta: auditPreviewCount > 0
        ? "Governance events in current window."
        : "No recent audit events.",
      tone: "neutral",
    },
    {
      key: "operability",
      label: "Signal health",
      value: operabilityReady ? "Ready" : "Review",
      meta: operabilityReady
        ? "All observability signal paths are green."
        : "One or more signal paths need review.",
      tone: operabilityReady ? "success" : "warning",
    },
  ];
}

/**
 * Map a filter preset to URL search param overrides.
 * @param preset - Filter preset identifier.
 * @returns Partial search param overrides.
 */
export function presetToParams(preset: FilterPreset): Record<string, string | null> {
  switch (preset) {
    case "needsAttention":
      return { auditStatus: "warning" };
    case "errorsOnly":
      return { auditStatus: "failed" };
    case "warnings":
      return { auditStatus: "warning" };
    case "adminMutations":
      return { auditAction: "admin_" };
    case "runtimeEvents":
      return { auditAction: "runtime_" };
    case "last24h":
      return { auditWindow: "24h" };
    case "last7d":
      return { auditWindow: "7d" };
    default:
      return {};
  }
}

/**
 * Human-readable label for a filter preset.
 * @param preset - Filter preset identifier.
 * @returns Display label.
 */
export function presetLabel(preset: FilterPreset): string {
  const labels: Record<FilterPreset, string> = {
    needsAttention: "Needs attention",
    errorsOnly: "Failed events",
    warnings: "Warnings",
    adminMutations: "Admin mutations",
    runtimeEvents: "Runtime events",
    last24h: "Last 24 hours",
    last7d: "Last 7 days",
  };
  return labels[preset];
}

/** Row or incident tone used by compact status elements. */
export type LogsTone = "success" | "warning" | "danger" | "neutral" | "info";

/** A normalized primary remediation link. */
export interface RemediationLink {
  /** Operator-facing label. */
  label: string;
  /** Route href. */
  href: string;
}

const ACTION_LABELS: Record<string, string> = {
  "Open Queues": "Review queue pressure",
  "Open Dispatch": "Review dispatch backlog",
  "Open Execution Review": "Inspect execution failures",
  "Open Health": "Review runtime health",
  "Open Provider Targets": "Review provider targets",
  "Open Logs": "Review logs evidence",
  "Open Raw Logs Evidence": "View diagnostics",
  "Raw evidence": "View diagnostics",
};

/**
 * Convert generic route labels into operator remediation labels.
 * @param label - Backend or legacy route label.
 * @returns Operator-facing action label.
 */
export function remediationLabel(label: string): string {
  return ACTION_LABELS[label] ?? label.replace(/^Open\s+/, "Review ");
}

/**
 * Pick one primary remediation link for an incident row.
 * @param links - Candidate route links from the API.
 * @returns The primary link, if one exists.
 */
export function getPrimaryRemediationLink(
  links: Array<{ label: string; href: string }>,
): RemediationLink | null {
  const preferred = links.find((link) => !/logs|raw/i.test(link.label)) ?? links[0];
  if (!preferred) {
    return null;
  }
  return {
    label: remediationLabel(preferred.label),
    href: preferred.href,
  };
}

/**
 * Format a timestamp as relative time with a compact fallback.
 * @param value - Timestamp string.
 * @returns Relative time label.
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "No recent evidence";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  const diffMs = Date.now() - timestamp;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return diffMs >= 0 ? `${minutes}m ago` : `in ${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return diffMs >= 0 ? `${hours}h ago` : `in ${hours}h`;
  }
  const days = Math.round(hours / 24);
  return diffMs >= 0 ? `${days}d ago` : `in ${days}d`;
}

/**
 * Format an exact timestamp for details and tooltips.
 * @param value - Timestamp string.
 * @returns Exact timestamp label.
 */
export function formatExactTime(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
}

/**
 * Resolve audit status to a ForgeFrame tone.
 * @param status - Audit status value.
 * @returns Status tone.
 */
export function auditStatusTone(status: AuditHistoryRow["status"]): LogsTone {
  if (status === "ok") {
    return "success";
  }
  if (status === "warning") {
    return "warning";
  }
  return "danger";
}

/** Group of repeated audit or activity events. */
export interface EventGroup {
  /** Stable group identifier. */
  key: string;
  /** Grouped rows. */
  rows: AuditHistoryRow[];
  /** Primary row used for labels and actions. */
  representative: AuditHistoryRow;
  /** Whether any row requires attention. */
  needsAttention: boolean;
  /** Latest event timestamp. */
  latestAt: string | null;
}

/**
 * Group repeated audit rows by actor, action, target type, and status.
 * @param rows - Audit rows to group.
 * @returns Grouped rows sorted by latest event first.
 */
export function groupEventRows(rows: AuditHistoryRow[]): EventGroup[] {
  const groups = new Map<string, AuditHistoryRow[]>();
  rows.forEach((row) => {
    const key = [row.actionKey, row.actor.label, row.target.type, row.status].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const sortedRows = [...groupRows].sort((left, right) => (
      String(right.createdAt).localeCompare(String(left.createdAt))
    ));
    return {
      key,
      rows: sortedRows,
      representative: sortedRows[0],
      needsAttention: sortedRows.some((row) => row.status !== "ok"),
      latestAt: sortedRows[0]?.createdAt ?? null,
    };
  }).sort((left, right) => (
    Number(right.needsAttention) - Number(left.needsAttention)
    || String(right.latestAt).localeCompare(String(left.latestAt))
  ));
}

/**
 * Detect routine session events that should not dominate investigation views.
 * @param row - Audit row.
 * @returns True when the event is routine and successful.
 */
export function isRoutineSessionEvent(row: AuditHistoryRow): boolean {
  const action = row.actionKey.toLowerCase();
  return row.status === "ok" && (
    action.includes("login")
    || action.includes("session")
    || row.actionLabel.toLowerCase().includes("admin login")
  );
}

/**
 * Count critical incidents by their reported error count.
 * @param logs - Logs response.
 * @returns Total critical active error count.
 */
export function countActiveErrors(logs: LogsResponse | null): number {
  const criticalAxes = logs?.incident_review?.axes.filter((axis) => axis.severity === "critical") ?? [];
  const counted = criticalAxes.reduce((total, axis) => total + Math.max(0, axis.count), 0);
  return counted > 0 ? counted : criticalAxes.length;
}

/**
 * Format a value for display, safely handling null/undefined.
 * @param value - The raw value.
 * @returns Formatted string.
 */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Format bytes into a human-readable string.
 * @param sizeBytes - Size in bytes.
 * @returns Formatted size string.
 */
export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get the next recommended action for the operator.
 * @param logs - Logs API response.
 * @returns A next-action string.
 */
export function getNextAction(logs: {
  incident_review?: {
    axes: Array<{ severity: string; next_step: string }>;
  } | null;
  alerts: Array<unknown>;
  operability: { ready: boolean };
} | null): string {
  if (!logs) {
    return "Loading operational context.";
  }

  const axes = logs.incident_review?.axes ?? [];
  const critical = axes.find((a) => a.severity === "critical");
  if (critical) {
    return critical.next_step;
  }
  const warning = axes.find((a) => a.severity === "warning");
  if (warning) {
    return warning.next_step;
  }
  if (!logs.operability.ready) {
    return "Review signal-path checks in Diagnostics.";
  }
  if (logs.alerts.length > 0) {
    return "Review active alerts in Activity.";
  }
  return "No action required. Monitor as needed.";
}
