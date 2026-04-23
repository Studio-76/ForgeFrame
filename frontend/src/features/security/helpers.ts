import type {
  AdminSecuritySession,
  ElevatedAccessApproverPosture,
  ElevatedAccessRequest,
} from "../../api/admin";
import { AdminApiError } from "../../api/admin";
import { buildAuditHistoryPath } from "../../app/auditHistory";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { formatTimestamp } from "../approvals/presentation";

export type Tone = "success" | "warning" | "danger" | "neutral";

export type RequestBanner = {
  tone: Tone;
  title: string;
  body: string;
};

export function buildApprovalDetailPath(approvalId: string): string {
  const searchParams = new URLSearchParams({
    status: "all",
    approvalId,
  });
  return `${CONTROL_PLANE_ROUTES.approvals}?${searchParams.toString()}`;
}

export function buildRequestAuditHistoryPath(requestId: string): string {
  return buildAuditHistoryPath({
    window: "all",
    targetType: "elevated_access_request",
    targetId: requestId,
  });
}

export function approvalTone(status: ElevatedAccessRequest["gate_status"]): Tone {
  switch (status) {
    case "approved":
      return "success";
    case "open":
    case "timed_out":
      return "warning";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatRequestActor(
  displayName?: string | null,
  username?: string | null,
  fallbackId?: string | null,
): string {
  if (displayName && username) {
    return `${displayName} (${username})`;
  }
  return displayName ?? username ?? fallbackId ?? "Not recorded";
}

export function formatRequestTarget(request: ElevatedAccessRequest): string {
  if (request.request_type === "break_glass") {
    return "Self";
  }
  return formatRequestActor(
    request.target_display_name,
    request.target_username,
    request.target_user_id,
  );
}

export function describeRequestBanner(
  request: ElevatedAccessRequest,
  linkedSession: AdminSecuritySession | null,
): RequestBanner {
  if (request.session_status === "active") {
    return {
      tone: "success",
      title: "Elevated session active",
      body: linkedSession?.expires_at
        ? `Elevated session active until ${formatTimestamp(linkedSession.expires_at)}.`
        : "An elevated session is active for this request.",
    };
  }

  if (request.ready_to_issue) {
    return {
      tone: "success",
      title: "Access approved and ready to start",
      body: "Access approved. Start the elevated session to receive the temporary token.",
    };
  }

  if (request.session_status === "expired") {
    return {
      tone: "warning",
      title: "Elevated session expired",
      body: "Approval completed, but the elevated session has expired.",
    };
  }

  if (request.session_status === "revoked") {
    return {
      tone: "neutral",
      title: "Elevated session revoked",
      body: "Approval completed, but the elevated session was revoked.",
    };
  }

  switch (request.gate_status) {
    case "open":
      return {
        tone: "warning",
        title: "Approval request submitted",
        body: "Approval request submitted. No elevated session is active until this request is approved.",
      };
    case "approved":
      return {
        tone: "success",
        title: "Access approved",
        body: "The approval decision is recorded. Review whether the requester still needs to issue the session.",
      };
    case "rejected":
      return {
        tone: "danger",
        title: "Request rejected",
        body: "Request rejected. No elevated session was issued.",
      };
    case "timed_out":
      return {
        tone: "warning",
        title: "Request expired before approval",
        body: "Request expired before approval. Submit a new request if elevated access is still required.",
      };
    case "cancelled":
      return {
        tone: "neutral",
        title: "Request cancelled",
        body: "Request cancelled. No elevated session will be issued.",
      };
    default:
      return {
        tone: "neutral",
        title: "Request recorded",
        body: "Review the linked approval and session state for the latest status.",
      };
  }
}

export function extractApproverPosture(error: unknown): ElevatedAccessApproverPosture | null {
  if (!(error instanceof AdminApiError) || !error.details || typeof error.details !== "object") {
    return null;
  }

  const details = error.details as Partial<ElevatedAccessApproverPosture>;
  if (
    typeof details.state !== "string"
    || typeof details.label !== "string"
    || typeof details.primary_message !== "string"
    || typeof details.secondary_message !== "string"
    || typeof details.approval_requires_distinct_admin !== "boolean"
    || typeof details.eligible_admin_approver_count !== "number"
  ) {
    return null;
  }

  return {
    state: details.state,
    label: details.label,
    primary_message: details.primary_message,
    secondary_message: details.secondary_message,
    approval_requires_distinct_admin: details.approval_requires_distinct_admin,
    eligible_admin_approver_count: details.eligible_admin_approver_count,
    blocked_reason: typeof details.blocked_reason === "string" ? details.blocked_reason : null,
  };
}
