/**
 * Utility helpers for the Errors & Incident Review feature.
 *
 * @packageDocumentation
 */

import type { LogsResponse } from "../../api/domain/logs";
import { withInstanceScope } from "../../app/tenantScope";
import type { StatusTone } from "../../components/ui/types";
import { remediationLabel } from "../logs/utils";
import type { AXIS_ORDER, BlockedRoutingFailureRow, IncidentAxisRow, IncidentReview } from "./types";

// ── Type coercion helpers ───────────────────────────────────────────────

/**
 * Safely cast a value to a Record, returning `null` on failure.
 * @param value - The raw value.
 * @returns A Record or null.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Safely cast a value to an array of Records, returning an empty array on failure.
 * @param value - The raw value.
 * @returns Array of Records.
 */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

/**
 * Parse a value to a finite number, defaulting to 0.
 * @param value - The raw value.
 * @returns A finite number.
 */
export function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Display formatting ──────────────────────────────────────────────────

/**
 * Render a value as a display string, with null/undefined/empty shown as "n/a".
 * @param value - The raw value.
 * @returns A display-safe string.
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
 * Format a numeric value as a locale-aware string.
 * @param value - The raw value.
 * @returns A formatted metric string.
 */
export function formatMetric(value: unknown): string {
  return numberValue(value).toLocaleString();
}

/**
 * Format a timestamp string for display.
 * @param value - The timestamp string.
 * @returns A formatted timestamp or "No recent evidence".
 */
export function formatTimestamp(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "No recent evidence";
}

// ── Severity type mappings ──────────────────────────────────────────────

/**
 * Map an incident severity to a StatusTone for UI rendering.
 * @param severity - The incident severity level.
 * @returns The matching status tone.
 */
export function severityTone(severity: IncidentAxisRow["severity"]): StatusTone {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "unsupported") {
    return "info";
  }
  if (severity === "clear") {
    return "success";
  }
  return "neutral";
}

/**
 * Map an incident severity to a status key for badges.
 * @param severity - The incident severity level.
 * @returns The matching status key.
 */
export function severityStatusKey(severity: IncidentAxisRow["severity"]): string {
  if (severity === "critical") {
    return "blocked";
  }
  if (severity === "warning") {
    return "degraded";
  }
  if (severity === "unsupported") {
    return "unsupported";
  }
  if (severity === "clear") {
    return "ready";
  }
  return "partial";
}

/**
 * Rank severity for sorting (lower = more urgent).
 * @param severity - The incident severity level.
 * @returns Numeric rank (0 = most urgent).
 */
export function severityRank(severity: IncidentAxisRow["severity"]): number {
  if (severity === "critical") {
    return 0;
  }
  if (severity === "warning") {
    return 1;
  }
  if (severity === "info") {
    return 2;
  }
  if (severity === "clear") {
    return 3;
  }
  return 4;
}

// ── Fallback incident review ────────────────────────────────────────────

/**
 * Build a synthetic incident review from unstructured logs data when the
 * backend does not provide a structured incident_review payload.
 * @param logs - Full logs response.
 * @returns A constructed incident review with fallback axis rows.
 */
export function fallbackIncidentReview(logs: LogsResponse): IncidentReview {
  const routingMetrics = asRecord(logs.operability.metrics?.routing_metrics);
  const recentFailures = Array.isArray(routingMetrics?.recent_failures)
    ? routingMetrics.recent_failures as Array<Record<string, unknown>>
    : [];
  const runtimeErrorCount = numberValue(logs.error_summary.errors_24h);

  const axes: IncidentAxisRow[] = (["runtime", "provider", "oauth", "routing", "queue_dispatch", "security", "tls", "work_interaction"] as const).map((axis) => {
    if (axis === "runtime") {
      return {
        incident_id: "runtime:fallback",
        axis,
        axis_label: "Runtime",
        title: "Runtime execution failures",
        severity: runtimeErrorCount > 0 ? "warning" : "clear",
        count: runtimeErrorCount,
        first_seen_at: null,
        last_seen_at: null,
        current_effect: runtimeErrorCount > 0
          ? "Runtime errors are present, but this backend has not yet provided structured incident grouping."
          : "No runtime error evidence is visible.",
        next_step: runtimeErrorCount > 0 ? "Open Logs or Execution Review." : "Monitor only.",
        summary: runtimeErrorCount > 0
          ? "Fallback incident grouping is active because the backend incident review payload is missing."
          : "No runtime incident is visible.",
        links: [
          { label: "Open Logs", href: "/logs" },
          { label: "Open Execution Review", href: "/execution" },
        ],
        raw_evidence: {
          error_summary: logs.error_summary,
        },
      };
    }

    if (axis === "routing") {
      return {
        incident_id: "routing:fallback",
        axis,
        axis_label: "Routing",
        title: "Routing and policy failures",
        severity: recentFailures.length > 0 ? "warning" : "clear",
        count: recentFailures.length,
        first_seen_at: recentFailures.at(-1)?.created_at as string | null ?? null,
        last_seen_at: recentFailures[0]?.created_at as string | null ?? null,
        current_effect: recentFailures.length > 0
          ? "Blocked routing decisions are visible, but only fallback incident grouping is available."
          : "No blocked routing failure is visible.",
        next_step: recentFailures.length > 0 ? "Open Routing." : "Monitor only.",
        summary: recentFailures.length > 0
          ? "Fallback incident grouping is active because the backend incident review payload is missing."
          : "No routing incident is visible.",
        links: [
          { label: "Open Routing", href: "/routing" },
        ],
        raw_evidence: {
          recent_failures: recentFailures,
        },
      };
    }

    return {
      incident_id: `${axis}:unsupported`,
      axis,
      axis_label: axis === "queue_dispatch"
        ? "Queue / Dispatch"
        : axis.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()),
      title: `${axis.replace(/_/g, " ")} incident review`,
      severity: "unsupported",
      count: 0,
      first_seen_at: null,
      last_seen_at: null,
      current_effect: "The backend has not provided structured incident grouping for this axis on the errors surface.",
      next_step: "Open Logs for raw evidence or the linked product route for follow-up.",
      summary: "Structured incident review is unavailable on this axis without backend support.",
      links: [{ label: "Open Logs", href: "/logs" }],
      raw_evidence: { supported: false },
    };
  });

  return {
    axes,
    blocked_routing_failures: recentFailures.map((failure) => ({
      decision_id: String(failure.decision_id ?? ""),
      error_type: String(failure.error_type ?? "routing_failure"),
      summary: String(failure.summary ?? ""),
      policy_stage: failure.policy_stage ? String(failure.policy_stage) : null,
      created_at: String(failure.created_at ?? ""),
      reason_category: "policy",
      current_effect: "Routing selected no admissible target and blocked the request.",
      next_step: "Open Routing to inspect budget, policy, or capability posture.",
      links: [{ label: "Open Routing", href: "/routing" }],
      raw_evidence: failure,
    })),
  };
}

// ── Link helpers ────────────────────────────────────────────────────────

/**
 * Map backend incident links to scoped operator action links with
 * remediation labels.
 * @param links - Backend route links.
 * @param instanceId - Selected instance ID.
 * @returns Scoped links with remediation labels.
 */
export function routeLinkItems(
  links: Array<{ label: string; href: string }>,
  instanceId: string | null,
) {
  return links.map((link) => ({
    ...link,
    label: remediationLabel(link.label),
    to: withInstanceScope(link.href, instanceId),
  }));
}

// ── Filter helpers ──────────────────────────────────────────────────────

/**
 * Determine whether an incident axis needs primary triage visibility.
 * Critical axes always show; warning axes show when they have a non-zero
 * count; clear/unsupported axes stay hidden from the active table.
 * @param axis - Incident axis row.
 * @returns True when the axis should be shown in the active table.
 */
export function isActiveIncidentAxis(axis: IncidentAxisRow): boolean {
  if (axis.severity === "critical") {
    return true;
  }
  if (axis.severity === "warning") {
    return axis.count > 0;
  }
  return axis.count > 0 && axis.severity !== "clear";
}
