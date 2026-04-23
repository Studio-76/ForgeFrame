import type {
  AuditHistoryQuery,
  ApprovalDetail,
  ApprovalStatus,
  ApprovalSummary,
  ApprovalType,
} from "../../api/admin";

import { formatApprovalActor, formatApprovalStatus, formatApprovalType } from "./presentation";

export type ApprovalTypeFilter = ApprovalType | "all";
export type ApprovalRequesterFilter = "all" | string;
export type OpenedAtFilter = "all" | "24h" | "7d" | "30d";
export type ApprovalQueueTone = "success" | "warning" | "danger" | "neutral";
export type ApprovalQueueUrgency = "expiring_soon" | "needs_decision_now" | "requester_follow_up" | "live_session" | "recorded_outcome";
export type ApprovalQueueSection = {
  key: string;
  approval_type: ApprovalType;
  urgency: ApprovalQueueUrgency;
  tone: ApprovalQueueTone;
  items: ApprovalSummary[];
};

export type RequesterFilterOption = {
  value: string;
  label: string;
};

const APPROVAL_EXPIRING_SOON_WINDOW_MS = 15 * 60 * 1000;
const APPROVAL_TYPE_ORDER: ApprovalType[] = ["execution_run", "break_glass", "impersonation"];
const APPROVAL_QUEUE_URGENCY_ORDER: ApprovalQueueUrgency[] = [
  "expiring_soon",
  "needs_decision_now",
  "requester_follow_up",
  "live_session",
  "recorded_outcome",
];

export function parseStatusFilter(value: string | null): ApprovalStatus | "all" | null {
  switch (value) {
    case "all":
    case "open":
    case "approved":
    case "rejected":
    case "timed_out":
    case "cancelled":
      return value;
    default:
      return null;
  }
}

export function approvalRequesterFilterValue(item: ApprovalSummary): string | null {
  const userId = item.requester?.user_id?.trim();
  if (userId) {
    return `user:${userId}`;
  }

  const username = item.requester?.username?.trim().toLowerCase();
  if (username) {
    return `username:${username}`;
  }

  const displayName = item.requester?.display_name?.trim().toLowerCase();
  if (displayName) {
    return `display:${displayName}`;
  }

  return null;
}

export function matchesRequesterFilter(item: ApprovalSummary, requesterFilter: ApprovalRequesterFilter): boolean {
  if (requesterFilter === "all") {
    return true;
  }

  return approvalRequesterFilterValue(item) === requesterFilter;
}

export function matchesOpenedAtFilter(item: ApprovalSummary, openedAtFilter: OpenedAtFilter): boolean {
  if (openedAtFilter === "all") {
    return true;
  }

  const openedAt = Date.parse(item.opened_at);
  if (Number.isNaN(openedAt)) {
    return false;
  }

  const now = Date.now();
  switch (openedAtFilter) {
    case "24h":
      return openedAt >= now - 24 * 60 * 60 * 1000;
    case "7d":
      return openedAt >= now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return openedAt >= now - 30 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

export function matchesApprovalSearch(item: ApprovalSummary, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase();
  if (!search) {
    return true;
  }

  const haystack = [
    item.title,
    item.approval_id,
    item.native_approval_id,
    item.instance_id ?? "",
    item.issue_id ?? "",
    item.company_id ?? "",
    item.target?.display_name ?? "",
    item.target?.username ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

export function formatOpenedAtFilter(value: OpenedAtFilter): string {
  switch (value) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "Any time";
  }
}

export function formatStatusFilterLabel(value: ApprovalStatus | "all"): string {
  return value === "all" ? "All statuses" : formatApprovalStatus(value);
}

export function describeEmptyQueueState({
  statusFilter,
  approvalsLoaded,
  hasClientSideQueueFilters,
}: {
  statusFilter: ApprovalStatus | "all";
  approvalsLoaded: number;
  hasClientSideQueueFilters: boolean;
}): string {
  if (approvalsLoaded > 0 && hasClientSideQueueFilters) {
    return "No approvals match the current requester, opened-at, type, or search filters. Clear or widen the filters to review more of the queue.";
  }

  if (statusFilter === "all") {
    return "No approval items have been recorded yet. Execution-run and elevated-access requests appear here only when ForgeFrame has created a real approval item.";
  }

  if (statusFilter !== "open") {
    return `${formatStatusFilterLabel(statusFilter)} slice is empty right now. Switch status or clear filters to review a different approval state.`;
  }

  return "No approvals waiting. Execution-run and elevated-access requests appear here only when ForgeFrame has created a real approval item.";
}

export function approvalTone(status: ApprovalStatus): ApprovalQueueTone {
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

function parseTimestampValue(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function approvalQueueUrgency(item: ApprovalSummary, now: number): ApprovalQueueUrgency {
  if (item.status === "open") {
    const expiresAt = parseTimestampValue(item.expires_at);
    if (expiresAt !== null && expiresAt <= now + APPROVAL_EXPIRING_SOON_WINDOW_MS) {
      return "expiring_soon";
    }
    return "needs_decision_now";
  }

  if (item.ready_to_issue) {
    return "requester_follow_up";
  }

  if (item.session_status === "active") {
    return "live_session";
  }

  return "recorded_outcome";
}

function approvalQueueTone(urgency: ApprovalQueueUrgency): ApprovalQueueTone {
  switch (urgency) {
    case "expiring_soon":
      return "danger";
    case "needs_decision_now":
      return "warning";
    case "requester_follow_up":
    case "live_session":
      return "success";
    case "recorded_outcome":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatApprovalQueueUrgency(urgency: ApprovalQueueUrgency): string {
  switch (urgency) {
    case "expiring_soon":
      return "Expiring soon";
    case "needs_decision_now":
      return "Needs decision now";
    case "requester_follow_up":
      return "Requester follow-up";
    case "live_session":
      return "Live session";
    case "recorded_outcome":
      return "Recorded outcome";
    default:
      return urgency;
  }
}

export function describeApprovalQueueSection(urgency: ApprovalQueueUrgency, approvalType: ApprovalType): string {
  switch (urgency) {
    case "expiring_soon":
      return "Decision window is closing. Review these requests before ForgeFrame times them out.";
    case "needs_decision_now":
      return approvalType === "execution_run"
        ? "These runs stay paused until an eligible admin records the approval outcome."
        : "These access requests cannot move forward until an eligible admin records the approval outcome.";
    case "requester_follow_up":
      return "The decision is done. The original requester must continue from Security & Policies.";
    case "live_session":
      return "Approval already produced a live elevated session. Review expiry or revocation state in Security & Policies.";
    case "recorded_outcome":
      return approvalType === "execution_run"
        ? "No live decision remains here. Use Execution Review or Audit History for downstream state."
        : "No live decision remains here. Use Security & Policies or Audit History for the recorded outcome.";
    default:
      return "Review the linked approval evidence and next operator action.";
  }
}

function approvalQueueSortTimestamp(item: ApprovalSummary, urgency: ApprovalQueueUrgency): number {
  if (urgency === "expiring_soon") {
    return parseTimestampValue(item.expires_at) ?? parseTimestampValue(item.opened_at) ?? Number.MAX_SAFE_INTEGER;
  }

  return parseTimestampValue(item.opened_at) ?? 0;
}

function compareApprovalQueueItems(
  left: ApprovalSummary,
  right: ApprovalSummary,
  urgency: ApprovalQueueUrgency,
): number {
  const leftStamp = approvalQueueSortTimestamp(left, urgency);
  const rightStamp = approvalQueueSortTimestamp(right, urgency);

  if (urgency === "expiring_soon") {
    return leftStamp - rightStamp;
  }

  return rightStamp - leftStamp;
}

export function groupApprovalsForQueue(items: ApprovalSummary[], now: number): ApprovalQueueSection[] {
  const sections = new Map<string, ApprovalQueueSection>();

  items.forEach((item) => {
    const urgency = approvalQueueUrgency(item, now);
    const key = `${urgency}:${item.approval_type}`;
    const existing = sections.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    sections.set(key, {
      key,
      approval_type: item.approval_type,
      urgency,
      tone: approvalQueueTone(urgency),
      items: [item],
    });
  });

  return Array.from(sections.values())
    .sort((left, right) => {
      const urgencyOrder = APPROVAL_QUEUE_URGENCY_ORDER.indexOf(left.urgency) - APPROVAL_QUEUE_URGENCY_ORDER.indexOf(right.urgency);
      if (urgencyOrder !== 0) {
        return urgencyOrder;
      }

      const typeOrder = APPROVAL_TYPE_ORDER.indexOf(left.approval_type) - APPROVAL_TYPE_ORDER.indexOf(right.approval_type);
      if (typeOrder !== 0) {
        return typeOrder;
      }

      return compareApprovalQueueItems(left.items[0], right.items[0], left.urgency);
    })
    .map((section) => ({
      ...section,
      items: [...section.items].sort((left, right) => compareApprovalQueueItems(left, right, section.urgency)),
    }));
}

export function describeApprovalQueueItem(item: ApprovalSummary): string {
  const context = [
    item.source_kind === "execution_run" ? "Execution queue item" : "Elevated-access queue item",
    item.instance_id ? `Instance ${item.instance_id}` : null,
    item.issue_id ? `Issue ${item.issue_id}` : null,
    item.company_id ? `Company ${item.company_id}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return context.join(" · ");
}

export function approvalAuditCandidates(
  approval: ApprovalSummary | ApprovalDetail | null,
  instanceId?: string | null,
): Array<{ query: AuditHistoryQuery }> {
  if (!approval) {
    return [
      { query: { instanceId: instanceId ?? null, window: "all", targetType: "execution_approval" as const } },
      { query: { window: "all", targetType: "elevated_access_request" as const } },
    ];
  }

  if (approval.source_kind === "elevated_access") {
    return [
      {
        query: {
          window: "all",
          targetType: "elevated_access_request" as const,
          targetId: approval.native_approval_id,
        },
      },
    ];
  }

  return [
      {
        query: {
          instanceId: approval.instance_id ?? instanceId ?? null,
          window: "all",
          targetType: "execution_approval" as const,
          targetId: approval.approval_id,
        },
      },
    ];
  }

export function buildApprovalAuditHistoryFallback(
  approval: ApprovalSummary | ApprovalDetail | null,
  instanceId?: string | null,
) {
  if (!approval) {
    return { instanceId: instanceId ?? null, window: "all" as const };
  }

  if (approval.source_kind === "elevated_access") {
    return {
      window: "all" as const,
      targetType: "elevated_access_request" as const,
      targetId: approval.native_approval_id,
    };
  }

  return {
    instanceId: approval.instance_id ?? instanceId ?? null,
    window: "all" as const,
    targetType: "execution_approval" as const,
    targetId: approval.approval_id,
  };
}

export function buildRequesterOptions(approvals: ApprovalSummary[]): RequesterFilterOption[] {
  const requesterOptions: RequesterFilterOption[] = [];
  const requesterOptionMap = new Map<string, string>();

  approvals.forEach((item) => {
    const value = approvalRequesterFilterValue(item);
    if (!value || requesterOptionMap.has(value)) {
      return;
    }
    requesterOptionMap.set(value, formatApprovalActor(item.requester));
  });

  requesterOptionMap.forEach((label, value) => {
    requesterOptions.push({ value, label });
  });
  requesterOptions.sort((left, right) => left.label.localeCompare(right.label));

  return requesterOptions;
}
