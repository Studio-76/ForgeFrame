/**
 * Notifications feature helper functions.
 *
 * @packageDocumentation
 */

import type { NotificationDeliveryAttempt, NotificationDeliveryEffect, NotificationDeliveryStatus, NotificationSummary } from "../../api/domain/notifications";
import type { NotificationAction } from "./types";

/**
 * Format a timestamp string with a fallback.
 * @param value - The timestamp string.
 * @param fallback - Fallback text when the value is empty.
 * @returns The formatted timestamp or fallback.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Map a delivery status to a display tone.
 * @param status - The delivery status.
 * @returns The status tone.
 */
export function notificationStatusTone(status: NotificationDeliveryStatus): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "delivered":
      return "success";
    case "failed":
    case "rejected":
    case "cancelled":
      return "danger";
    case "draft":
    case "preview":
    case "confirmed":
    case "queued":
    case "delivering":
    case "fallback_queued":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Map a delivery effect to a display tone.
 * @param effect - The delivery effect.
 * @returns The status tone.
 */
export function effectTone(effect: NotificationDeliveryEffect | undefined): "success" | "warning" | "danger" | "neutral" {
  switch (effect) {
    case "sent":
      return "success";
    case "failed":
    case "rejected":
    case "cancelled":
      return "danger";
    case "preview_only":
    case "queued":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Get a human-readable mode label for a notification.
 * @param notification - The notification summary.
 * @returns A mode description.
 */
export function notificationModeLabel(notification: Pick<NotificationSummary, "preview_required" | "delivery_status">): string {
  if (notification.delivery_status === "draft" || notification.delivery_status === "preview" || notification.delivery_status === "rejected") {
    return "Preview only";
  }
  if (notification.delivery_status === "delivered") {
    return "Delivered";
  }
  if (notification.delivery_status === "failed" || notification.delivery_status === "cancelled") {
    return "Delivery blocked";
  }
  return notification.preview_required ? "Preview approved" : "Live delivery";
}

/**
 * Get a human-readable lane label for a notification.
 * @param notification - The notification summary.
 * @returns The lane description.
 */
export function notificationLaneLabel(notification: Pick<NotificationSummary, "channel_id" | "configured_channel_id" | "fallback_channel_id">): string {
  const configuredChannelId = notification.configured_channel_id ?? notification.channel_id;
  if (configuredChannelId && notification.fallback_channel_id) {
    return `${configuredChannelId} -> ${notification.fallback_channel_id}`;
  }
  if (configuredChannelId) {
    return configuredChannelId;
  }
  if (notification.fallback_channel_id) {
    return `fallback ${notification.fallback_channel_id}`;
  }
  return "No channel linked";
}

/**
 * Get a human-readable linked context label for a notification.
 * @param notification - The notification summary.
 * @returns The context description.
 */
export function linkedContextLabel(notification: Pick<NotificationSummary, "task_id" | "reminder_id" | "conversation_id" | "inbox_id" | "workspace_id">): string {
  if (notification.task_id) {
    return `task ${notification.task_id}`;
  }
  if (notification.reminder_id) {
    return `reminder ${notification.reminder_id}`;
  }
  if (notification.conversation_id) {
    return `conversation ${notification.conversation_id}`;
  }
  if (notification.inbox_id) {
    return `inbox ${notification.inbox_id}`;
  }
  if (notification.workspace_id) {
    return `workspace ${notification.workspace_id}`;
  }
  return "No linked work object";
}

/**
 * Get a human-readable attempt kind label.
 * @param attempt - The delivery attempt.
 * @returns The attempt kind label.
 */
export function attemptKindLabel(attempt: NotificationDeliveryAttempt): string {
  switch (attempt.attempt_kind) {
    case "preview":
      return "Preview capture";
    case "approval":
      return "Approval review";
    case "retry":
      return "Retry attempt";
    case "fallback":
      return "Fallback handoff";
    case "manual_override":
      return "Manual override";
    case "terminal":
      return "Terminal state";
    default:
      return attempt.attempt_kind;
  }
}

/**
 * Map a delivery attempt to a display tone.
 * @param attempt - The delivery attempt.
 * @returns The status tone.
 */
export function attemptTone(attempt: NotificationDeliveryAttempt): "success" | "warning" | "danger" | "neutral" {
  return notificationStatusTone(attempt.delivery_status);
}

/**
 * Get a descriptive message for a notification action.
 * @param action - The action performed.
 * @returns A human-readable description.
 */
export function actionMessage(action: NotificationAction): string {
  switch (action) {
    case "confirm":
      return "confirmed and queued";
    case "reject":
      return "rejected";
    case "retry":
      return "retried";
    default:
      return action;
  }
}
