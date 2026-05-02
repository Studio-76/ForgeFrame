/**
 * Workspace management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { ArtifactRecord } from "./artifacts";

// ---------------------------------------------------------------------------
// Workspace types
// ---------------------------------------------------------------------------

/** Workspace lifecycle status. */
export type WorkspaceStatus = "draft" | "previewing" | "in_review" | "handoff_ready" | "handed_off" | "archived";
/** Workspace preview status. */
export type WorkspacePreviewStatus = "missing" | "draft" | "ready" | "approved" | "rejected";
/** Workspace review status. */
export type WorkspaceReviewStatus = "not_requested" | "pending" | "approved" | "rejected";
/** Workspace handoff status. */
export type WorkspaceHandoffStatus = "not_ready" | "ready" | "delivered";
/** Workspace event kind. */
export type WorkspaceEventKind =
  | "created"
  | "updated"
  | "preview_ready"
  | "review_requested"
  | "review_approved"
  | "review_rejected"
  | "handoff_prepared"
  | "handoff_delivered";

/** Workspace run summary. */
export type WorkspaceRunSummary = {
  run_id: string;
  run_kind: string;
  state: string;
  execution_lane: string;
  issue_id?: string | null;
  updated_at: string;
};

/** Workspace approval summary. */
export type WorkspaceApprovalSummary = {
  approval_id: string;
  shared_approval_id: string;
  gate_status: string;
  gate_key: string;
  opened_at: string;
  decided_at?: string | null;
};

/** Workspace conversation summary. */
export type WorkspaceConversationSummary = {
  conversation_id: string;
  subject: string;
  status: string;
  triage_status: string;
  priority: string;
  latest_message_at?: string | null;
  updated_at: string;
};

/** Workspace task summary. */
export type WorkspaceTaskSummary = {
  task_id: string;
  title: string;
  status: string;
  priority: string;
  owner_id?: string | null;
  due_at?: string | null;
  updated_at: string;
};

/** Workspace event record. */
export type WorkspaceEventRecord = {
  event_id: string;
  workspace_id: string;
  event_kind: WorkspaceEventKind;
  note?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  run_id?: string | null;
  actor_type: string;
  actor_id?: string | null;
  created_at: string;
};

/** Workspace summary. */
export type WorkspaceSummary = {
  workspace_id: string;
  instance_id: string;
  company_id: string;
  issue_id?: string | null;
  title: string;
  summary: string;
  status: WorkspaceStatus;
  preview_status: WorkspacePreviewStatus;
  review_status: WorkspaceReviewStatus;
  handoff_status: WorkspaceHandoffStatus;
  owner_type: string;
  owner_id?: string | null;
  active_run_id?: string | null;
  latest_approval_id?: string | null;
  preview_artifact_id?: string | null;
  handoff_artifact_id?: string | null;
  pr_reference?: string | null;
  handoff_reference?: string | null;
  metadata: Record<string, unknown>;
  run_count: number;
  conversation_count?: number;
  task_count?: number;
  approval_count: number;
  artifact_count: number;
  latest_conversation_id?: string | null;
  latest_conversation_subject?: string | null;
  next_action_key?: "start_preview" | "request_review" | "prepare_handoff" | "review_in_progress" | "handoff_ready" | "handoff_delivered" | "archived";
  next_action_label?: string;
  next_action_state?: "available" | "not_ready" | "waiting" | "done";
  next_action_reason?: string;
  last_activity_at?: string | null;
  latest_event_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Workspace detail. */
export type WorkspaceDetail = WorkspaceSummary & {
  runs: WorkspaceRunSummary[];
  conversations?: WorkspaceConversationSummary[];
  tasks?: WorkspaceTaskSummary[];
  approvals: WorkspaceApprovalSummary[];
  artifacts: ArtifactRecord[];
  events: WorkspaceEventRecord[];
};

// ---------------------------------------------------------------------------
// Workspace API functions
// ---------------------------------------------------------------------------

/**
 * Fetch workspaces for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param status - Optional status filter.
 * @param limit - Maximum number of workspaces (default 100).
 * @returns Response with workspaces list.
 */
export function fetchWorkspaces(
  instanceId?: string | null,
  status?: WorkspaceStatus | "all",
  limit = 100,
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; workspaces: WorkspaceSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/workspaces", undefined, instanceId), {
      status: status && status !== "all" ? status : null,
      limit,
    }),
  );
}

/**
 * Fetch workspace detail by ID.
 * @param workspaceId - The workspace ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with workspace detail.
 */
export function fetchWorkspaceDetail(workspaceId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope(`/admin/workspaces/${encodeURIComponent(workspaceId)}`, undefined, instanceId),
  );
}

/**
 * Create a new workspace.
 * @param instanceId - The instance ID or null.
 * @param payload - Workspace creation parameters.
 * @returns Response with the created workspace.
 */
export function createWorkspace(
  instanceId: string | null | undefined,
  payload: {
    workspace_id?: string | null;
    issue_id?: string | null;
    title: string;
    summary?: string;
    preview_status?: WorkspacePreviewStatus;
    review_status?: WorkspaceReviewStatus;
    handoff_status?: WorkspaceHandoffStatus;
    owner_type?: string;
    owner_id?: string | null;
    active_run_id?: string | null;
    latest_approval_id?: string | null;
    pr_reference?: string | null;
    handoff_reference?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope("/admin/workspaces", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing workspace.
 * @param instanceId - The instance ID or null.
 * @param workspaceId - The workspace ID.
 * @param payload - Fields to update.
 * @returns Response with the updated workspace.
 */
export function updateWorkspace(
  instanceId: string | null | undefined,
  workspaceId: string,
  payload: {
    title?: string;
    summary?: string;
    issue_id?: string | null;
    preview_status?: WorkspacePreviewStatus;
    review_status?: WorkspaceReviewStatus;
    handoff_status?: WorkspaceHandoffStatus;
    owner_type?: string;
    owner_id?: string | null;
    active_run_id?: string | null;
    latest_approval_id?: string | null;
    preview_artifact_id?: string | null;
    handoff_artifact_id?: string | null;
    pr_reference?: string | null;
    handoff_reference?: string | null;
    metadata?: Record<string, unknown>;
    archive?: boolean;
    event_note?: string | null;
  },
) {
  return fetchJson<{ status: string; workspace: WorkspaceDetail }>(
    appendTenantScope(`/admin/workspaces/${encodeURIComponent(workspaceId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
