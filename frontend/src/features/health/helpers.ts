/**
 * Helper functions for the Health feature module.
 *
 * @packageDocumentation
 */

import type {
  HealthStatus,
  CheckRecord,
  HealthRoute,
  HealthGroup,
  SignalPathRow,
} from "./types";
import type { ProviderControlPlaneResponse } from "../../api/domain/providers";

/**
 * Determines whether a provider needs an OAuth handoff.
 * @param provider - The provider to check.
 * @returns True if the provider requires OAuth configuration.
 */
export function providerNeedsOauthHandoff(
  provider: ProviderControlPlaneResponse["providers"][number],
): boolean {
  return provider.oauth_connect_required || provider.next_action_kind === "connect_oauth";
}

/**
 * Type guard that filters null/undefined values.
 * @param value - The value to check.
 * @returns True if the value is defined (not null or undefined).
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Formats a timestamp string with a fallback value.
 * @param value - The timestamp string (nullable).
 * @param fallback - Fallback text when value is empty. Defaults to "n/a".
 * @returns The formatted timestamp or fallback.
 */
export function formatTimestamp(
  value: string | null | undefined,
  fallback = "n/a",
): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Maps HealthStatus to a StatusBadge tone.
 * @param status - The health status.
 * @returns The tone value: "success" | "warning" | "danger".
 */
export function toneForStatus(
  status: HealthStatus,
): "success" | "warning" | "danger" {
  if (status === "healthy") {
    return "success";
  }
  if (status === "warning") {
    return "warning";
  }
  return "danger";
}

/**
 * Maps HealthStatus to a human-readable label.
 * @param status - The health status.
 * @returns A display label string.
 */
export function labelForStatus(status: HealthStatus): string {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "warning") {
    return "Needs review";
  }
  return "Blocked";
}

/**
 * Converts a dashboard status string to HealthStatus.
 * @param status - The dashboard status (e.g. "ready", "degraded").
 * @returns The equivalent HealthStatus.
 */
export function dashboardStatusToHealth(
  status: string | null | undefined,
): HealthStatus {
  switch ((status ?? "").trim().toLowerCase()) {
    case "ready":
      return "healthy";
    case "degraded":
      return "warning";
    default:
      return "failed";
  }
}

/**
 * Summarises runtime checks into an overall health status.
 * Critical failures produce "failed", any failure produces "warning".
 * @param checks - The check records to evaluate.
 * @returns The overall HealthStatus.
 */
export function summarizeChecks(checks: CheckRecord[]): HealthStatus {
  if (
    checks.some(
      (check) => !check.ok && (check.severity ?? "").toLowerCase() === "critical",
    )
  ) {
    return "failed";
  }
  if (checks.some((check) => !check.ok)) {
    return "warning";
  }
  return "healthy";
}

/**
 * Summarises bootstrap checks into an overall health status.
 * Any failure produces "failed" (bootstrap is all-or-nothing).
 * @param checks - The check records to evaluate.
 * @returns The overall HealthStatus.
 */
export function summarizeBootstrapChecks(checks: CheckRecord[]): HealthStatus {
  return checks.some((check) => !check.ok) ? "failed" : "healthy";
}

/**
 * Summarises signal path rows into an overall health status.
 * @param rows - The signal path rows to evaluate.
 * @returns The overall HealthStatus.
 */
export function summarizeSignals(rows: SignalPathRow[]): HealthStatus {
  if (rows.some((row) => row.status === "failed")) {
    return "failed";
  }
  if (rows.some((row) => row.status === "warning")) {
    return "warning";
  }
  return "healthy";
}

/**
 * Builds a HealthGroup from a set of checks.
 * @param params - Configuration for the group.
 * @returns A fully-formed HealthGroup.
 */
export function buildGroup(params: {
  title: string;
  checks: CheckRecord[];
  mode: "runtime" | "bootstrap";
  checkedAt: string | null | undefined;
  fallbackSummary: string;
  successSummary: string;
  nextRoute: HealthRoute;
}): HealthGroup {
  const status =
    params.mode === "bootstrap"
      ? summarizeBootstrapChecks(params.checks)
      : summarizeChecks(params.checks);
  const failingChecks = params.checks.filter((check) => !check.ok);
  const evidence =
    params.checks.length > 0
      ? params.checks.map((check) =>
          `${check.id}: ${check.ok ? "ok" : "failed"}${check.details ? ` · ${check.details}` : ""}`,
        )
      : [params.fallbackSummary];
  const error =
    failingChecks.length > 0
      ? failingChecks
          .map(
            (check) => `${check.id}${check.details ? ` · ${check.details}` : ""}`,
          )
          .join(" | ")
      : "No open blockers recorded.";
  return {
    title: params.title,
    status,
    summary:
      status === "healthy" ? params.successSummary : params.fallbackSummary,
    lastChecked: formatTimestamp(params.checkedAt),
    evidence,
    error,
    nextRoute: params.nextRoute,
  };
}
