/**
 * Inbox feature helper functions.
 *
 * @packageDocumentation
 */

import type { InboxStatus, InboxSummary, TriageStatus } from "../../api/domain/inbox";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { InboxSourceFilter } from "./types";

/**
 * Parse a JSON string into a Record, validating it is an object.
 * @param rawValue - The raw JSON string.
 * @param fieldLabel - Human-readable field name for error messages.
 * @returns The parsed object.
 */
export function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Build an execution review route from instance and run IDs.
 * @param instanceId - The instance ID.
 * @param runId - The run ID.
 * @returns The execution review path with query params.
 */
export function buildExecutionRoute(instanceId: string, runId: string): string {
  return `${CONTROL_PLANE_ROUTES.execution}?${new URLSearchParams({ instanceId, runId }).toString()}`;
}

/**
 * Build an approvals route from instance and approval IDs.
 * @param instanceId - The instance ID.
 * @param approvalId - The approval ID.
 * @returns The approvals path with query params.
 */
export function buildApprovalRoute(instanceId: string, approvalId: string): string {
  return `${CONTROL_PLANE_ROUTES.approvals}?${new URLSearchParams({ instanceId, approvalId, status: "all" }).toString()}`;
}

/**
 * Determine the source label for an inbox item.
 * @param item - The inbox summary item.
 * @returns The source type label.
 */
export function inboxSourceLabel(item: InboxSummary): Exclude<InboxSourceFilter, "all"> {
  if (item.conversation_id) {
    return "conversation";
  }
  if (item.workspace_id) {
    return "workspace";
  }
  if (item.run_id) {
    return "run";
  }
  if (item.approval_id) {
    return "approval";
  }
  if (item.artifact_id) {
    return "artifact";
  }
  return "manual";
}

/**
 * Determine the queue posture for an inbox item.
 * @param item - The inbox summary item (or detail).
 * @returns A label and tone describing the posture.
 */
export function inboxQueuePosture(item: Pick<InboxSummary, "triage_status" | "status">): {
  label: string;
  tone: "success" | "danger" | "warning" | "neutral";
} {
  if (item.status === "archived") {
    return { label: "archived", tone: "neutral" };
  }
  if (item.triage_status === "done" || item.status === "closed") {
    return { label: "done", tone: "success" };
  }
  if (item.triage_status === "blocked") {
    return { label: "blocked", tone: "danger" };
  }
  if (item.status === "snoozed") {
    return { label: "waiting", tone: "warning" };
  }
  if (item.triage_status === "delegated") {
    return { label: "delegated", tone: "warning" };
  }
  if (item.triage_status === "relevant") {
    return { label: "relevant", tone: "success" };
  }
  return { label: "new", tone: "neutral" };
}
