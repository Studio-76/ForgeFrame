/**
 * Workspaces feature — helper functions.
 *
 * @packageDocumentation
 */

import type {
  WorkspaceDetail,
  WorkspaceSummary,
} from "../../api/domain/workspaces";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { StatusTone } from "../../components/ui/types";
import type {
  WorkspaceAction,
  WorkspaceActionState,
} from "./types";

// ─── Route builders ───────────────────────────────────────────────────────

/**
 * Build an execution review route for a run.
 * @param instanceId - The instance ID.
 * @param runId - The run ID.
 * @param state - Optional run state.
 * @returns Full URL path.
 */
export function buildExecutionRoute(instanceId: string, runId: string, state?: string | null): string {
  const params = new URLSearchParams({ instanceId, runId });
  if (state?.trim()) {
    params.set("state", state.trim());
  }
  return `${CONTROL_PLANE_ROUTES.execution}?${params.toString()}`;
}

/**
 * Build an approvals route for a specific approval.
 * @param instanceId - The instance ID.
 * @param approvalId - The approval ID.
 * @returns Full URL path.
 */
export function buildApprovalRoute(instanceId: string, approvalId: string): string {
  const params = new URLSearchParams({ instanceId, approvalId, status: "all" });
  return `${CONTROL_PLANE_ROUTES.approvals}?${params.toString()}`;
}

// ─── JSON / parsing helpers ──────────────────────────────────────────────

/**
 * Parse a JSON metadata string safely.
 * @param rawValue - The raw JSON string.
 * @param fieldLabel - Label for error messages.
 * @returns Parsed record.
 */
export function parseMetadata(rawValue: string, fieldLabel: string): Record<string, unknown> {
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

// ─── Display helpers ──────────────────────────────────────────────────────

/**
 * Map a status string to a StatusTone.
 * @param status - The status value.
 * @returns Corresponding StatusTone.
 */
export function statusTone(status: string): StatusTone {
  if (status === "handed_off" || status === "delivered" || status === "approved" || status === "ready") {
    return "success";
  }
  if (status === "archived" || status === "done") {
    return "neutral";
  }
  if (status === "rejected" || status === "missing") {
    return "danger";
  }
  return "warning";
}

/**
 * Map an action state to a StatusTone.
 * @param state - The action state.
 * @returns Corresponding StatusTone.
 */
export function actionTone(state: WorkspaceActionState): StatusTone {
  switch (state) {
    case "available":
      return "success";
    case "done":
      return "neutral";
    case "waiting":
      return "warning";
    case "not_ready":
      return "danger";
  }
}

/**
 * Format a timestamp for display.
 * @param value - Optional timestamp string.
 * @returns Formatted string or "Not recorded".
 */
export function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not recorded";
  }
  return new Date(value).toLocaleString();
}

// ─── Action logic ─────────────────────────────────────────────────────────

/**
 * Determine the next workspace action for a given workspace.
 * @param workspace - The workspace summary or detail.
 * @returns The workspace action descriptor.
 */
export function getWorkspaceAction(workspace: WorkspaceSummary | WorkspaceDetail): WorkspaceAction {
  const key = workspace.next_action_key;
  const state = workspace.next_action_state;
  const label = workspace.next_action_label;
  const reason = workspace.next_action_reason;

  if (key && state && label && reason) {
    const action: WorkspaceAction = {
      key,
      state,
      label,
      reason,
    };
    if (state === "available") {
      if (key === "start_preview") {
        action.payload = {
          preview_status: "ready",
          event_note: "Preview recorded from workspace surface after evidence was linked.",
        };
      } else if (key === "request_review") {
        action.payload = {
          review_status: "pending",
          event_note: "Review requested from workspace surface.",
        };
      } else if (key === "prepare_handoff") {
        action.payload = {
          handoff_status: "ready",
          event_note: "Handoff prepared from workspace surface.",
        };
      }
    }
    return action;
  }

  if (workspace.status === "archived") {
    return { key: "archived", label: "Archived", state: "done", reason: "Workspace is archived." };
  }
  if (workspace.handoff_status === "delivered") {
    return { key: "handoff_delivered", label: "Handoff delivered", state: "done", reason: "Handoff already left ForgeFrame." };
  }
  if (workspace.handoff_status === "ready") {
    return { key: "handoff_ready", label: "Handoff ready", state: "waiting", reason: "Delivery now depends on the downstream target." };
  }
  if (workspace.review_status === "pending") {
    return { key: "review_in_progress", label: "Review in progress", state: "waiting", reason: "Review is already pending." };
  }
  if (workspace.review_status === "approved") {
    if (workspace.handoff_artifact_id || workspace.handoff_reference || workspace.pr_reference) {
      return {
        key: "prepare_handoff",
        label: "Prepare handoff",
        state: "available",
        reason: "Handoff evidence is linked. Mark the workspace ready for delivery.",
        payload: {
          handoff_status: "ready",
          event_note: "Handoff prepared from workspace surface.",
        },
      };
    }
    return {
      key: "prepare_handoff",
      label: "Prepare handoff",
      state: "not_ready",
      reason: "No dedicated handoff API exists here. Link a handoff artifact, PR reference, or handoff reference first.",
    };
  }
  if (workspace.preview_status === "ready" || workspace.preview_status === "approved") {
    return {
      key: "request_review",
      label: "Request review",
      state: "available",
      reason: "Preview evidence is linked. Move the workspace into review.",
      payload: {
        review_status: "pending",
        event_note: "Review requested from workspace surface.",
      },
    };
  }
  if (workspace.active_run_id || workspace.preview_artifact_id) {
    return {
      key: "start_preview",
      label: "Start preview",
      state: "available",
      reason: "Execution or artifact evidence is linked. Record preview readiness from the workspace surface.",
      payload: {
        preview_status: "ready",
        event_note: "Preview recorded from workspace surface after evidence was linked.",
      },
    };
  }
  return {
    key: "start_preview",
    label: "Start preview",
    state: "not_ready",
    reason: "No dedicated preview-start API exists here. Link an execution run or preview artifact first.",
  };
}
