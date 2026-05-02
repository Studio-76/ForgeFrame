import type {
  ApprovalClass,
  ApprovalDetail,
  ApprovalDueState,
  ApprovalRiskLevel,
  ApprovalStatus,
  ApprovalSummary,
  ApprovalType,
  AuditHistoryQuery,
} from "../../api/domain";

import {
  formatApprovalActor,
  formatApprovalClass,
  formatApprovalDueState,
  formatApprovalRiskLevel,
  formatApprovalStatus,
  formatApprovalTarget,
  formatApprovalType,
} from "./presentation";

export type ApprovalTypeFilter = ApprovalType | "all";
export type ApprovalClassFilter = ApprovalClass | "all";
export type ApprovalRiskFilter = ApprovalRiskLevel | "all";
export type ApprovalDueFilter = ApprovalDueState | "all";
export type ApprovalInstanceFilter = "all" | string;
export type InstanceFilterOption = {
  value: string;
  label: string;
};

const STATUS_ORDER: Record<ApprovalStatus, number> = {
  open: 0,
  approved: 1,
  rejected: 2,
  timed_out: 3,
  cancelled: 4,
};
const RISK_ORDER: Record<ApprovalRiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const DUE_ORDER: Record<ApprovalDueState, number> = {
  due_now: 0,
  due_soon: 1,
  later: 2,
  no_deadline: 3,
  resolved: 4,
};

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

export function normalizeInstanceFilterValue(item: ApprovalSummary): string {
  return item.instance_id?.trim() || "";
}

export function matchesInstanceFilter(item: ApprovalSummary, instanceFilter: ApprovalInstanceFilter): boolean {
  if (instanceFilter === "all") {
    return true;
  }
  return normalizeInstanceFilterValue(item) === instanceFilter;
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
    item.risk_label,
    item.next_step,
    item.consequence_summary,
    formatApprovalActor(item.requester),
    formatApprovalTarget(item),
    formatApprovalType(item.approval_type),
    formatApprovalClass(item.approval_class),
    formatApprovalStatus(item.status),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export function matchesRiskFilter(item: ApprovalSummary, riskFilter: ApprovalRiskFilter): boolean {
  return riskFilter === "all" || item.risk_level === riskFilter;
}

export function matchesDueFilter(item: ApprovalSummary, dueFilter: ApprovalDueFilter): boolean {
  return dueFilter === "all" || item.due_state === dueFilter;
}

export function matchesClassFilter(item: ApprovalSummary, approvalClassFilter: ApprovalClassFilter): boolean {
  return approvalClassFilter === "all" || item.approval_class === approvalClassFilter;
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
    return "No approvals match the current decision filters. Widen risk, due, class, or instance scope to review more items.";
  }
  if (statusFilter === "all") {
    return "No approval items are recorded yet. ForgeFrame only shows real execution or elevated-access requests here.";
  }
  if (statusFilter !== "open") {
    return `${formatStatusFilterLabel(statusFilter)} slice is empty right now.`;
  }
  return "No approvals are currently waiting for a decision.";
}

export function formatStatusFilterLabel(value: ApprovalStatus | "all"): string {
  return value === "all" ? "All statuses" : formatApprovalStatus(value);
}

export function sortApprovalsForDecisionSurface(items: ApprovalSummary[]): ApprovalSummary[] {
  return [...items].sort((left, right) => {
    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusOrder !== 0) {
      return statusOrder;
    }
    const riskOrder = RISK_ORDER[left.risk_level] - RISK_ORDER[right.risk_level];
    if (riskOrder !== 0) {
      return riskOrder;
    }
    const dueOrder = DUE_ORDER[left.due_state] - DUE_ORDER[right.due_state];
    if (dueOrder !== 0) {
      return dueOrder;
    }
    return Date.parse(right.opened_at) - Date.parse(left.opened_at);
  });
}

export function buildInstanceOptions(approvals: ApprovalSummary[]): InstanceFilterOption[] {
  const options = new Map<string, string>();
  approvals.forEach((item) => {
    const value = item.instance_id?.trim();
    if (!value || options.has(value)) {
      return;
    }
    options.set(value, value);
  });
  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function formatDueFilterLabel(value: ApprovalDueFilter): string {
  return value === "all" ? "All due states" : formatApprovalDueState(value);
}

export function formatRiskFilterLabel(value: ApprovalRiskFilter): string {
  return value === "all" ? "All risk bands" : formatApprovalRiskLevel(value);
}

export function formatClassFilterLabel(value: ApprovalClassFilter): string {
  return value === "all" ? "All approval classes" : formatApprovalClass(value);
}

export function formatInstanceFilterLabel(value: ApprovalInstanceFilter, options: InstanceFilterOption[]): string {
  if (value === "all") {
    return "All instances";
  }
  return options.find((option) => option.value === value)?.label ?? value;
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
