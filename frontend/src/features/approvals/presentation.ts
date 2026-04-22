import type {
  AdminSessionUser,
  ApprovalActorSummary,
  ApprovalDetail,
  ApprovalSessionStatus,
  ApprovalSourceKind,
  ApprovalStatus,
  ApprovalType,
} from "../../api/admin";

type BannerTone = "success" | "warning" | "danger" | "neutral";
type ExecutionResumeDisposition = "resume" | "fail" | "compensate" | "cancel";

export type ApprovalBanner = {
  tone: BannerTone;
  title: string;
  body: string;
};

export type ApprovalDecisionIntent = "approve" | "reject";

export type ApprovalDecisionConfirmation = {
  tone: BannerTone;
  title: string;
  body: string;
  reviewLabel: string;
  confirmLabel: string;
};

const UTC_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${UTC_DATE_TIME.format(parsed)} UTC`;
}

export function formatApprovalType(value: ApprovalType): string {
  switch (value) {
    case "execution_run":
      return "Execution run";
    case "break_glass":
      return "Break-glass";
    case "impersonation":
      return "Impersonation";
    default:
      return value;
  }
}

export function formatApprovalSourceKind(value: ApprovalSourceKind): string {
  return value === "elevated_access" ? "Elevated access" : "Execution";
}

export function formatApprovalStatus(value: ApprovalStatus): string {
  switch (value) {
    case "open":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "timed_out":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return value;
  }
}

export function formatSessionStatus(value?: ApprovalSessionStatus | null, readyToIssue = false): string | null {
  if (readyToIssue) {
    return "Ready to start";
  }

  if (!value) {
    return null;
  }

  switch (value) {
    case "not_issued":
      return "Not issued";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    default:
      return value;
  }
}

export function formatApprovalActor(actor?: ApprovalActorSummary | null): string {
  if (!actor) {
    return "Not recorded";
  }

  if (actor.display_name && actor.username) {
    return `${actor.display_name} (${actor.username})`;
  }

  return actor.display_name ?? actor.username ?? actor.user_id ?? "Not recorded";
}

function formatConflictingSessionType(value: unknown): string {
  switch (value) {
    case "break_glass":
      return "break-glass";
    case "impersonation":
      return "impersonation";
    case "standard":
      return "standard";
    default:
      return "elevated";
  }
}

function isExecutionResumeDisposition(value: unknown): value is ExecutionResumeDisposition {
  return value === "resume" || value === "fail" || value === "compensate" || value === "cancel";
}

function getExecutionResumeDisposition(detail: ApprovalDetail): ExecutionResumeDisposition | null {
  const value = detail.evidence.resume_disposition;
  return isExecutionResumeDisposition(value) ? value : null;
}

function getExecutionRunState(detail: ApprovalDetail): string | null {
  const value = detail.evidence.run_state;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function describeExecutionDecision(detail: ApprovalDetail): ApprovalBanner & { message: string } {
  const disposition = getExecutionResumeDisposition(detail);
  const runState = getExecutionRunState(detail);

  switch (detail.status) {
    case "open":
      return {
        tone: "warning",
        title: "Execution is waiting on approval",
        body: "The execution path remains paused until an approver decides. Review run context, impact, and evidence before you resume or deny the waiting transition.",
        message: "Execution approval is still waiting on a decision.",
      };
    case "approved":
      return {
        tone: "success",
        title: "Execution run queued to resume",
        body: runState === "queued"
          ? "ForgeGate recorded the approve decision and moved the run back to queued so the resume path can continue."
          : "ForgeGate recorded the approve decision and resumed the waiting execution path.",
        message: "Execution run queued to resume.",
      };
    case "rejected":
      if (runState === "cancel_requested" || disposition === "cancel") {
        return {
          tone: "warning",
          title: "Execution run entered cancel flow",
          body: "ForgeGate recorded the reject decision and moved the run into cancel requested so the cancellation path can complete.",
          message: "Execution run entered cancel flow.",
        };
      }

      if (runState === "compensating" || disposition === "compensate") {
        return {
          tone: "warning",
          title: "Execution run entered compensating flow",
          body: "ForgeGate recorded the reject decision and moved the run into compensating so rollback or cleanup work can continue.",
          message: "Execution run entered compensating flow.",
        };
      }

      if (runState === "failed" || disposition === "fail") {
        return {
          tone: "danger",
          title: "Execution run moved to failed",
          body: "ForgeGate recorded the reject decision and closed the waiting execution path as failed.",
          message: "Execution run moved to failed.",
        };
      }

      return {
        tone: "danger",
        title: "Execution approval rejected",
        body: "The waiting execution path was denied. Review the linked run and audit trail for the recorded downstream state.",
        message: "Execution approval recorded as rejected.",
      };
    case "timed_out":
      return {
        tone: "warning",
        title: "Execution approval expired",
        body: "This run did not receive a decision before the approval window closed. Review the linked run before retrying or opening a new approval path.",
        message: "Execution approval expired before the run could continue.",
      };
    case "cancelled":
      return {
        tone: "neutral",
        title: "Execution approval cancelled",
        body: "This approval item no longer controls a live waiting transition. Review the linked run and audit evidence for the final reason.",
        message: "Execution approval cancelled.",
      };
  }
}

export function describeApprovalBanner(detail: ApprovalDetail): ApprovalBanner {
  if (detail.source_kind === "elevated_access") {
    if (detail.session_status === "active") {
      return {
        tone: "success",
        title: "Elevated session active",
        body: "The approval already resulted in a live elevated session. Review the current session in Security & Policies for expiry and revocation state.",
      };
    }

    if (detail.source.active_session_conflict === true) {
      const conflictType = formatConflictingSessionType(detail.source.conflicting_session_type);
      const conflictExpiry = typeof detail.source.conflicting_session_expires_at === "string"
        ? ` until ${formatTimestamp(detail.source.conflicting_session_expires_at)}`
        : "";

      return {
        tone: "danger",
        title: "Active elevated session already exists",
        body: `A ${conflictType} session is already active for this requester${conflictExpiry}. Approve stays blocked until that session ends or is revoked. You can still reject this request from the shared queue or review the live session in Security & Policies.`,
      };
    }

    if (detail.ready_to_issue) {
      return {
        tone: "success",
        title: "Access approved and ready to start",
        body: "The decision is complete, but no session is active yet. Only the original requester can start the elevated session from Security & Policies.",
      };
    }

    switch (detail.status) {
      case "open":
        return {
          tone: "warning",
          title: "Approval request submitted",
          body: "No elevated session is active until this request is approved. Review the evidence first, then decide whether access should move forward.",
        };
      case "approved":
        return {
          tone: "success",
          title: "Access approved",
          body: "The approval decision is recorded. Use Security & Policies to confirm whether the requester still needs to issue or review the resulting session.",
        };
      case "rejected":
        return {
          tone: "danger",
          title: "Request rejected",
          body: "No elevated session was issued. The audit trail should now carry the rejection rationale and decision actor.",
        };
      case "timed_out":
        return {
          tone: "warning",
          title: "Request expired before approval",
          body: "This elevated-access request timed out without a decision. Submit a new request if access is still required.",
        };
      case "cancelled":
        return {
          tone: "neutral",
          title: "Request cancelled",
          body: "The request was cancelled before issuance. No elevated session will be issued from this approval item.",
        };
    }
  }

  return describeExecutionDecision(detail);
}

export function describeApprovalMutationMessage(detail: ApprovalDetail): string {
  if (detail.source_kind === "execution_run") {
    return describeExecutionDecision(detail).message;
  }

  if (detail.status === "approved") {
    return `${formatApprovalType(detail.approval_type)} approval recorded as approved.`;
  }

  if (detail.status === "rejected") {
    return `${formatApprovalType(detail.approval_type)} approval recorded as rejected.`;
  }

  return `${formatApprovalType(detail.approval_type)} approval updated.`;
}

export function describeApprovalDecisionConfirmation(
  detail: ApprovalDetail,
  intent: ApprovalDecisionIntent,
): ApprovalDecisionConfirmation {
  if (intent === "approve") {
    if (detail.source_kind === "elevated_access") {
      return {
        tone: "warning",
        title: "Approve access request?",
        body: "The requester must start the elevated session separately from Security & Policies after this decision is recorded.",
        reviewLabel: "Review access approval",
        confirmLabel: "Approve access",
      };
    }

    return {
      tone: "warning",
      title: "Approve execution request?",
      body: "ForgeGate will record the approve decision and let the waiting execution path resume or re-queue according to the backend run disposition.",
      reviewLabel: "Review approval",
      confirmLabel: "Approve request",
    };
  }

  if (detail.source_kind === "elevated_access") {
    return {
      tone: "danger",
      title: "Reject request?",
      body: "ForgeGate will deny this access request. The rejection rationale below will be recorded in audit history, and no elevated session will be issued.",
      reviewLabel: "Review rejection",
      confirmLabel: "Reject request",
    };
  }

  return {
    tone: "danger",
    title: "Reject request?",
    body: "ForgeGate will record the reject decision and move the waiting execution path into its configured deny flow, such as failed, cancel, or compensating.",
    reviewLabel: "Review rejection",
    confirmLabel: "Reject request",
  };
}

export function describeDecisionBlockedReason(
  reason: string | null | undefined,
  session: AdminSessionUser | null,
): string {
  if (session?.read_only) {
    return "This admin session is read-only because it was issued through impersonation. Open a standard admin session to approve or reject requests.";
  }

  switch (reason) {
    case "admin_role_required":
      return "You can review this request, but you do not have permission to approve or reject it.";
    case "elevated_access_self_approval_forbidden":
      return "You requested this elevated access and cannot approve it. Another admin must decide.";
    case "elevated_access_active_session_conflict":
      return "Approve is blocked because another elevated session is already active for this requester. Review the live session in Security & Policies; you can still reject this request from the shared queue.";
    case "approval_not_open":
      return "This request is already resolved. Review the recorded outcome and linked evidence instead of attempting another decision.";
    default:
      return "Decision controls are unavailable for this request.";
  }
}

export function humanizeApprovalField(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    if (value.includes("T") && value.endsWith("Z")) {
      return formatTimestamp(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "None";
    }
    return value.map((entry) => formatDetailValue(entry)).join(", ");
  }

  return JSON.stringify(value, null, 2);
}
