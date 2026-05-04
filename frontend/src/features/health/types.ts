/**
 * Health feature types — shared types for the health & readiness surface.
 *
 * @packageDocumentation
 */

// ── Core types ──────────────────────────────────────────────────────────

/** Data loading state. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Health status tone. */
export type HealthStatus = "healthy" | "warning" | "failed";

/** A single health check record. */
export type CheckRecord = {
  id: string;
  ok: boolean;
  severity?: string;
  details?: string | null;
};

/** A route associated with a health check. */
export type HealthRoute = {
  label: string;
  to: string;
};

/** A health group summarising a set of checks. */
export type HealthGroup = {
  title: string;
  status: HealthStatus;
  summary: string;
  lastChecked: string;
  evidence: string[];
  error: string;
  nextRoute: HealthRoute;
};

/** A signal path row (logs, usage, costs, audit). */
export type SignalPathRow = {
  label: string;
  status: HealthStatus;
  evidence: string;
  route: HealthRoute;
};

// ── Constants ───────────────────────────────────────────────────────────

/** Maps health status to UI tone values. */
export const TONE_MAP: Record<HealthStatus, "success" | "warning" | "danger"> = {
  healthy: "success",
  warning: "warning",
  failed: "danger",
};
