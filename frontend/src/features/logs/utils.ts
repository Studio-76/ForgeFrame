/**
 * Utility helpers for the Logs feature module.
 *
 * @packageDocumentation
 */

import type { FilterPreset, SummaryCardEntry } from "./types";

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
    errorsOnly: "Errors only",
    warnings: "Warnings",
    adminMutations: "Admin mutations",
    runtimeEvents: "Runtime events",
    last24h: "Last 24 hours",
    last7d: "Last 7 days",
  };
  return labels[preset];
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
