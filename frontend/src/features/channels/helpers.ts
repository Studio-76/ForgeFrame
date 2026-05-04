/**
 * Channels helper functions — formatting and tone mapping.
 *
 * @packageDocumentation
 */

import type { DeliveryChannelStatus } from "../../api/domain/channels";

/**
 * Format a timestamp string with a fallback value.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Map channel status to a visual pill tone.
 */
export function channelStatusTone(status: DeliveryChannelStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "degraded":
      return "warning";
    case "disabled":
      return "danger";
    default:
      return "warning";
  }
}

/**
 * Format a fallback rank into a human-readable label.
 */
export function fallbackRankLabel(rank: number): string {
  if (rank <= 0) {
    return "primary / standalone";
  }
  return `fallback #${rank}`;
}
