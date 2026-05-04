/**
 * Reminders feature module — helper functions.
 *
 * @packageDocumentation
 */

import type { ReminderStatus } from "../../api/domain/reminders";
import type { ReminderSummary } from "../../api/domain/reminders";
import type { ReminderGroupKey } from "./types";

/**
 * Maps a reminder status to a display tone for badges.
 *
 * @param status - The reminder lifecycle status.
 * @returns The badge tone.
 */
export function reminderStatusTone(status: ReminderStatus): "success" | "danger" | "warning" | "neutral" {
  if (status === "triggered" || status === "dismissed") {
    return "success";
  }
  if (status === "cancelled") {
    return "neutral";
  }
  if (status === "due") {
    return "danger";
  }
  return "warning";
}

/**
 * Determines the urgency group key for a reminder.
 *
 * @param reminder - The reminder with status and due_at.
 * @param nowMs - Current time in milliseconds.
 * @returns The group key the reminder belongs to.
 */
export function reminderGroupKey(
  reminder: Pick<ReminderSummary, "status" | "due_at">,
  nowMs: number,
): ReminderGroupKey {
  if (reminder.status === "triggered" || reminder.status === "dismissed" || reminder.status === "cancelled") {
    return "completed_cancelled";
  }

  const dueMs = Date.parse(reminder.due_at);
  if (Number.isNaN(dueMs)) {
    return "upcoming";
  }
  if (dueMs < nowMs) {
    return "overdue";
  }
  if (reminder.status === "due" || dueMs <= nowMs + (60 * 60 * 1000)) {
    return "due_now";
  }
  return "upcoming";
}

/**
 * Returns a human-readable heading for a reminder group key.
 *
 * @param group - The group key.
 * @returns The display heading.
 */
export function reminderGroupHeading(group: ReminderGroupKey): string {
  switch (group) {
    case "overdue":
      return "Overdue";
    case "due_now":
      return "Due now";
    case "upcoming":
      return "Upcoming";
    case "completed_cancelled":
      return "Completed / cancelled";
    default:
      return group;
  }
}

/**
 * Returns the urgency bucket label for a reminder detail.
 *
 * @param detail - The reminder with status and due_at.
 * @param nowMs - Current time in milliseconds.
 * @returns The bucket label.
 */
export function reminderDueBucket(
  detail: Pick<ReminderSummary, "status" | "due_at">,
  nowMs: number,
): string {
  return reminderGroupHeading(reminderGroupKey(detail, nowMs));
}

/**
 * Checks whether a reminder status represents a closed/terminal state.
 *
 * @param status - The reminder status.
 * @returns True if the reminder is triggered, dismissed, or cancelled.
 */
export function reminderIsClosed(status: ReminderStatus): boolean {
  return status === "triggered" || status === "dismissed" || status === "cancelled";
}
