/**
 * Dispatch helper functions — timestamp formatting, lease risk analysis,
 * outbox cause description, and reconciliation summary.
 *
 * @packageDocumentation
 */

import type {
  ExecutionDispatchAttemptView,
  ExecutionDispatchWorkerView,
  ExecutionLeaseReconcileResult,
} from "../../api/domain/execution";

import type { DispatchRisk, DispatchRiskTone } from "./types";

// ── UTC date formatter ──────────────────────────────────────────────────

const UTC_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// ── Timestamp helpers ───────────────────────────────────────────────────

/**
 * Parse an ISO-8601 timestamp string to a Unix timestamp in milliseconds.
 * Returns `null` for falsy or invalid values.
 */
export function parseUtcTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Format an ISO-8601 timestamp to a human-readable UTC string.
 * Falls back to `fallback` when the value is missing.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  const parsed = parseUtcTimestamp(value);
  if (parsed === null) {
    return fallback;
  }
  return UTC_DATE_TIME.format(new Date(parsed));
}

/**
 * Format a duration in seconds to a compact human-readable string (e.g. "30s", "5m", "2h", "3d").
 */
export function formatAgeSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not available";
  }
  const absolute = Math.abs(value);
  if (absolute < 60) {
    return `${absolute}s`;
  }
  if (absolute < 3600) {
    return `${Math.floor(absolute / 60)}m`;
  }
  if (absolute < 86400) {
    return `${Math.floor(absolute / 3600)}h`;
  }
  return `${Math.floor(absolute / 86400)}d`;
}

/**
 * Format a lease window timestamp as a human-readable relative string.
 */
export function formatLeaseWindow(
  target: string | null | undefined,
  options: { now: number; futureLabel: string; pastLabel: string },
): string {
  const parsed = parseUtcTimestamp(target);
  if (parsed === null) {
    return "Not recorded";
  }
  const deltaSeconds = Math.floor((parsed - options.now) / 1000);
  if (deltaSeconds >= 0) {
    return `${options.futureLabel} ${formatAgeSeconds(deltaSeconds)}`;
  }
  return `${options.pastLabel} ${formatAgeSeconds(deltaSeconds)} ago`;
}

// ── Target description ─────────────────────────────────────────────────

/**
 * Describe the dispatch target for an attempt, preferring selected_target_key
 * over issue_id or workspace_id.
 */
export function describeDispatchTarget(item: {
  selected_target_key?: string | null;
  issue_id?: string | null;
  workspace_id?: string | null;
}): string {
  if (item.selected_target_key?.trim()) {
    return item.selected_target_key.trim();
  }
  if (item.issue_id?.trim()) {
    return `Issue ${item.issue_id.trim()}`;
  }
  if (item.workspace_id?.trim()) {
    return `Workspace ${item.workspace_id.trim()}`;
  }
  return "Target not recorded";
}

// ── Risk analysis ───────────────────────────────────────────────────────

/**
 * Analyse lease risk for an individual attempt.
 */
export function describeAttemptLeaseRisk(attempt: ExecutionDispatchAttemptView, now: number): DispatchRisk {
  const leaseExpiresAt = parseUtcTimestamp(attempt.lease_expires_at);
  const lastHeartbeatAt = parseUtcTimestamp(attempt.last_heartbeat_at);
  if (leaseExpiresAt !== null && leaseExpiresAt <= now) {
    return {
      label: "Expired lease",
      tone: "danger",
      detail: "The attempt still reports a lease even though the lease deadline has already passed.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt - now <= 60_000) {
    return {
      label: "Expiring soon",
      tone: "warning",
      detail: "This lease is within one minute of expiry and should renew or finish immediately.",
    };
  }
  if (lastHeartbeatAt !== null && now - lastHeartbeatAt >= 120_000) {
    return {
      label: "Renewal lag",
      tone: "warning",
      detail: "The worker has not renewed this lease for more than two minutes.",
    };
  }
  if (attempt.lease_status !== "leased") {
    return {
      label: "Lease mismatch",
      tone: "warning",
      detail: "The attempt appears on the dispatch surface without a healthy active lease.",
    };
  }
  return {
    label: "Healthy lease",
    tone: "success",
    detail: "Lease expiry and recent heartbeats are consistent with an active worker.",
  };
}

/**
 * Analyse worker-level lease risk from heartbeat and lease evidence.
 */
export function describeWorkerLeaseRisk(worker: ExecutionDispatchWorkerView, now: number): DispatchRisk {
  const heartbeatExpiresAt = parseUtcTimestamp(worker.heartbeat_expires_at);
  const leaseExpiresAt = parseUtcTimestamp(worker.oldest_lease_expires_at);
  const lastHeartbeatAt = parseUtcTimestamp(worker.last_heartbeat_at);
  if (worker.worker_state === "stale" || (heartbeatExpiresAt !== null && heartbeatExpiresAt <= now)) {
    return {
      label: "Stale worker",
      tone: "danger",
      detail: "Worker heartbeats have expired while dispatch still expects this worker to exist.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt <= now) {
    return {
      label: "Expired lease",
      tone: "danger",
      detail: "At least one lease on this worker has already expired and now needs reconciliation.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt - now <= 60_000) {
    return {
      label: "Lease expiring soon",
      tone: "warning",
      detail: "The oldest active lease on this worker is close to expiry.",
    };
  }
  if (lastHeartbeatAt !== null && now - lastHeartbeatAt >= 120_000) {
    return {
      label: "Renewal lag",
      tone: "warning",
      detail: "The worker is still registered, but heartbeats have slowed enough to deserve attention.",
    };
  }
  if (worker.worker_state === "lease_only") {
    return {
      label: "Registry gap",
      tone: "danger",
      detail: "Dispatch sees an active lease but no matching persisted worker heartbeat.",
    };
  }
  return {
    label: "Healthy worker",
    tone: "success",
    detail: "Heartbeat and lease evidence remain aligned for this worker.",
  };
}

/**
 * Describe the operational cause behind an outbox state.
 */
export function describeOutboxCause(state: string): { tone: DispatchRiskTone; detail: string; executionState?: string } {
  switch (state) {
    case "dead":
      return {
        tone: "danger",
        detail: "Outbox events have dead-lettered after repeated publish failures and now require operator follow-up.",
        executionState: "dead_lettered",
      };
    case "leased":
      return {
        tone: "warning",
        detail: "A publisher has claimed these events, so pressure may come from a stuck notification or dispatch publisher.",
        executionState: "dispatching",
      };
    case "pending":
      return {
        tone: "warning",
        detail: "Events are queued but not yet published, which usually means worker capacity or downstream publish lag.",
        executionState: "dispatching",
      };
    case "published":
      return {
        tone: "success",
        detail: "These events cleared the outbox and are retained only as recent publish evidence.",
      };
    default:
      return {
        tone: "neutral",
        detail: "This outbox state exists in storage, but it is not one of the standard publish lifecycle states.",
      };
  }
}

// ── Route building ──────────────────────────────────────────────────────

/**
 * Build a scoped route URL preserving existing instanceId and companyId params.
 */
export function buildScopedRoute(
  basePath: string,
  options: { instanceId?: string | null; companyId?: string | null },
): string {
  const url = new URL(basePath, "https://forgeframe.local");
  if (options.instanceId?.trim()) {
    url.searchParams.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    url.searchParams.set("companyId", options.companyId.trim());
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

// ── Reconciliation summary ──────────────────────────────────────────────

/**
 * Summarise lease reconciliation results into corrected lease and attempt counts.
 */
export function summarizeReconcileResults(results: ExecutionLeaseReconcileResult[]): {
  correctedLeases: number;
  correctedAttempts: number;
} {
  return {
    correctedLeases: results.length,
    correctedAttempts: new Set(results.map((item) => item.attempt_id)).size,
  };
}
