/**
 * Shared System Status model for ForgeFrame.
 *
 * Defines the canonical set of system-health states and provides
 * mapping functions to translate them into display tones, labels,
 * and visibility rules.
 *
 * @module
 */

import type { StatusTone } from "../types";

// ── System status values ───────────────────────────────────────────────

/**
 * Canonical system-health states understood across all ForgeFrame pages.
 *
 * - **ready**: Fully operational, no issues.
 * - **blocked**: A hard blocker prevents operation.
 * - **degraded**: Operating below nominal capacity.
 * - **warning**: Attention recommended, not yet degraded.
 * - **disabled**: Feature or component is turned off.
 * - **idle**: Running but not actively processing work.
 * - **empty**: No data, no items, no resources.
 * - **unknown**: State could not be determined.
 */
export type SystemStatus =
  | "ready"
  | "blocked"
  | "degraded"
  | "warning"
  | "disabled"
  | "idle"
  | "empty"
  | "unknown";

// ── Status-tone mapping ────────────────────────────────────────────────

/**
 * Maps every SystemStatus to its display StatusTone.
 *
 * Exported as a lookup so consumers can override individual entries
 * without reimplementing the whole switch.
 */
export const SYSTEM_STATUS_TONE: Record<SystemStatus, StatusTone> = {
  ready: "success",
  blocked: "danger",
  degraded: "warning",
  warning: "warning",
  disabled: "neutral",
  idle: "info",
  empty: "neutral",
  unknown: "neutral",
};

// ── Display helpers ────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a system status.
 *
 * @param status - The system status value.
 * @returns A display-friendly label string.
 */
export function statusLabel(status: SystemStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "degraded":
      return "Degraded";
    case "warning":
      return "Warning";
    case "disabled":
      return "Disabled";
    case "idle":
      return "Idle";
    case "empty":
      return "Empty";
    case "unknown":
      return "Unknown";
  }
}

/**
 * Returns a short imperative description for the system status.
 *
 * Useful for tooltips, aria-labels, and empty-state explanations.
 *
 * @param status - The system status.
 * @returns A short description of what the status means.
 */
export function statusDescription(status: SystemStatus): string {
  switch (status) {
    case "ready":
      return "All systems operational.";
    case "blocked":
      return "A blocker is preventing operation.";
    case "degraded":
      return "Running below nominal capacity.";
    case "warning":
      return "Action recommended to prevent degradation.";
    case "disabled":
      return "Feature is currently disabled.";
    case "idle":
      return "Online but not actively processing.";
    case "empty":
      return "No data available.";
    case "unknown":
      return "State could not be determined.";
  }
}

/**
 * Maps a Backend API status string to a canonical SystemStatus.
 *
 * Falls back to "unknown" for unrecognised values so that new statuses
 * from the API degrade gracefully instead of crashing.
 *
 * @param raw - The raw status string from the API.
 * @returns The canonical SystemStatus.
 */
export function normalizeSystemStatus(raw: string | null | undefined): SystemStatus {
  if (!raw) {
    return "unknown";
  }
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  const known: Record<string, SystemStatus> = {
    ready: "ready",
    ok: "ready",
    healthy: "ready",
    active: "ready",
    running: "ready",
    operational: "ready",
    blocked: "blocked",
    stuck: "blocked",
    degraded: "degraded",
    partial: "degraded",
    warning: "warning",
    degraded_warning: "warning",
    disabled: "disabled",
    off: "disabled",
    inactive: "disabled",
    idle: "idle",
    paused: "idle",
    empty: "empty",
    none: "empty",
  };
  return known[normalized] ?? "unknown";
}
