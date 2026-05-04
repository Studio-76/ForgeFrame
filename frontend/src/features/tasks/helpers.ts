/**
 * Tasks feature module — helper functions.
 *
 * @packageDocumentation
 */

import type { TaskStatus } from "../../api/domain/tasks";
import type { TaskSummary } from "../../api/domain/tasks";

/**
 * Maps a task status to a display tone for badges.
 *
 * @param status - The task lifecycle status.
 * @returns The badge tone.
 */
export function taskStatusTone(status: TaskStatus): "success" | "danger" | "warning" | "neutral" {
  if (status === "done") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  if (status === "cancelled") {
    return "neutral";
  }
  if (status === "in_progress") {
    return "warning";
  }
  return "neutral";
}

/**
 * Returns a human-readable queue posture label for a task status.
 *
 * @param status - The task lifecycle status.
 * @returns The posture description.
 */
export function taskQueuePosture(status: TaskStatus): string {
  switch (status) {
    case "open":
      return "backlog";
    case "in_progress":
      return "active";
    case "blocked":
      return "blocked or waiting";
    case "done":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return status;
  }
}

/**
 * Returns a display label for a task owner ID.
 *
 * @param ownerId - The optional owner identifier.
 * @returns "unassigned" when falsy, otherwise the ID.
 */
export function ownerLabel(ownerId?: string | null): string {
  return ownerId?.trim() ? ownerId : "unassigned";
}

/**
 * Returns a compact linked-context label for a task.
 *
 * @param task - The task summary with optional context IDs.
 * @returns A joined string of linked context parts, or "bridge-only".
 */
export function linkedContextLabel(task: Pick<TaskSummary, "conversation_id" | "inbox_id" | "workspace_id">): string {
  const parts = [
    task.conversation_id ? `conversation ${task.conversation_id}` : null,
    task.inbox_id ? `inbox ${task.inbox_id}` : null,
    task.workspace_id ? `workspace ${task.workspace_id}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "bridge-only";
}
