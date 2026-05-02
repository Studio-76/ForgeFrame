/**
 * Approval management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type ApprovalStatus,
  appendTenantScope,
  fetchJson,
} from "./_internal";

import type { ArtifactRecord } from "./artifacts";

// ---------------------------------------------------------------------------
// Approval types
// ---------------------------------------------------------------------------

/** Re-export ApprovalStatus from _internal for convenience. */
export type { ApprovalStatus };

/** Approval source kind. */
export type ApprovalSourceKind = "execution_run" | "elevated_access";
/** Approval type discriminator. */
export type ApprovalType = "execution_run" | "break_glass" | "impersonation";
/** Approval session status. */
export type ApprovalSessionStatus = "not_issued" | "active" | "expired" | "revoked";
/** Approval decision blocked reason. */
export type ApprovalDecisionBlockedReason =
  | "admin_role_required"
  | "elevated_access_self_approval_forbidden"
  | "approval_not_open"
  | "elevated_access_active_session_conflict"
  | string;
/** Approval class discriminator. */
export type ApprovalClass = "execution_control" | "elevated_access";
/** Approval risk level. */
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";
/** Approval due state. */
export type ApprovalDueState = "due_now" | "due_soon" | "later" | "no_deadline" | "resolved";

/** Summary of an approval actor (requester, target, decision). */
export type ApprovalActorSummary = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
};

// Re-export types used by ApprovalDetail
import type { WorkspaceSummary } from "./workspaces";

/** Summary view of an approval. */
export type ApprovalSummary = {
  approval_id: string;
  source_kind: ApprovalSourceKind;
  native_approval_id: string;
  approval_type: ApprovalType;
  approval_class: ApprovalClass;
  status: ApprovalStatus;
  title: string;
  opened_at: string;
  decided_at?: string | null;
  expires_at?: string | null;
  instance_id?: string | null;
  company_id?: string | null;
  issue_id?: string | null;
  workspace_id?: string | null;
  requester?: ApprovalActorSummary | null;
  target?: ApprovalActorSummary | null;
  decision_actor?: ApprovalActorSummary | null;
  ready_to_issue: boolean;
  session_status?: ApprovalSessionStatus | null;
  risk_level: ApprovalRiskLevel;
  risk_label: string;
  due_state: ApprovalDueState;
  next_step: string;
  consequence_summary: string;
  irreversible: boolean;
};

/** Detailed approval view. */
export type ApprovalDetail = ApprovalSummary & {
  evidence: Record<string, unknown>;
  source: Record<string, unknown>;
  artifacts: ArtifactRecord[];
  workspace: Partial<WorkspaceSummary> | null;
  actions: {
    can_approve?: boolean;
    can_reject?: boolean;
    decision_blocked_reason?: ApprovalDecisionBlockedReason | null;
    approve_blocked_reason?: ApprovalDecisionBlockedReason | null;
    reject_blocked_reason?: ApprovalDecisionBlockedReason | null;
  };
  action_preview: Record<string, unknown>;
  affected_identity: Record<string, unknown>;
  affected_scope: Record<string, unknown>;
  consequence: Record<string, unknown>;
  audit_history: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Approval API functions
// ---------------------------------------------------------------------------

/**
 * Fetch approvals with optional filters.
 * @param options - Filter options.
 * @returns Response with approvals list.
 */
export function fetchApprovals(options: {
  status?: ApprovalStatus | "all";
  approvalType?: ApprovalType | "all";
  risk?: ApprovalRiskLevel | "all";
  due?: ApprovalDueState | "all";
  approvalClass?: ApprovalClass | "all";
  instanceId?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 200));
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  if (options.approvalType && options.approvalType !== "all") {
    params.set("approvalType", options.approvalType);
  }
  if (options.risk && options.risk !== "all") {
    params.set("risk", options.risk);
  }
  if (options.due && options.due !== "all") {
    params.set("due", options.due);
  }
  if (options.approvalClass && options.approvalClass !== "all") {
    params.set("approvalClass", options.approvalClass);
  }
  if (options.instanceId?.trim()) {
    params.set("instanceId", options.instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approvals: ApprovalSummary[] }>(`/admin/approvals${suffix}`);
}

/**
 * Fetch approval detail by ID.
 * @param approvalId - The approval ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with approval detail.
 */
export function fetchApprovalDetail(approvalId: string, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}${suffix}`);
}

/**
 * Approve an approval.
 * @param approvalId - The approval ID.
 * @param decisionNote - Optional decision note.
 * @param instanceId - Optional instance ID.
 * @returns Response with the updated approval.
 */
export function approveApproval(approvalId: string, decisionNote?: string | null, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/approve${suffix}`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote?.trim() || null }),
  });
}

/**
 * Reject an approval.
 * @param approvalId - The approval ID.
 * @param decisionNote - Optional decision note.
 * @param instanceId - Optional instance ID.
 * @returns Response with the updated approval.
 */
export function rejectApproval(approvalId: string, decisionNote?: string | null, instanceId?: string | null) {
  const params = new URLSearchParams();
  if (instanceId?.trim()) {
    params.set("instanceId", instanceId.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ status: string; approval: ApprovalDetail }>(`/admin/approvals/${encodeURIComponent(approvalId)}/reject${suffix}`, {
    method: "POST",
    body: JSON.stringify({ decision_note: decisionNote?.trim() || null }),
  });
}
