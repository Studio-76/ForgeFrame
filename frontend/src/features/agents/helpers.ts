/**
 * Agents feature — helper functions for status tones, display labels,
 * and participation mode utilities.
 *
 * @packageDocumentation
 */

import type { AgentParticipationMode, AgentStatus } from "../../api/domain/agents";
import { PARTICIPATION_OPTIONS } from "./types";

// ─── Status / tone helpers ────────────────────────────────

/**
 * Map agent status to a display tone.
 * @param status - The agent status.
 * @returns Status tone name.
 */
export function agentStatusTone(status: AgentStatus): "success" | "warning" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Format a timestamp string for display with a fallback.
 * @param value - The timestamp string.
 * @param fallback - Fallback text when value is missing.
 * @returns Formatted timestamp or fallback.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Return the human-readable label for a participation mode.
 * @param mode - The participation mode value.
 * @returns Human-readable label.
 */
export function participationLabel(mode: AgentParticipationMode): string {
  return PARTICIPATION_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

/**
 * Return the description for a participation mode.
 * @param mode - The participation mode value.
 * @returns Human-readable description.
 */
export function participationDescription(mode: AgentParticipationMode): string {
  return PARTICIPATION_OPTIONS.find((option) => option.value === mode)?.description ?? mode;
}

/**
 * Map addressability combined with status to a display tone.
 * @param addressable - Whether the agent is addressable.
 * @param status - The agent status.
 * @returns Status tone name.
 */
export function addressabilityTone(
  addressable: boolean,
  status: AgentStatus,
): "success" | "warning" | "neutral" {
  if (!addressable && status === "paused") {
    return "warning";
  }
  return addressable ? "success" : "neutral";
}
