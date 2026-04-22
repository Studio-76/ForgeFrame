import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  approveApproval,
  fetchApprovalDetail,
  fetchApprovals,
  rejectApproval,
  type AuditHistoryQuery,
  type ApprovalDetail,
  type ApprovalStatus,
  type ApprovalSummary,
  type ApprovalType,
} from "../api/admin";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPath } from "../app/auditHistory";
import { buildExecutionReviewPath } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import {
  describeApprovalBanner,
  describeApprovalDecisionConfirmation,
  describeApprovalMutationMessage,
  describeDecisionBlockedReason,
  formatApprovalActor,
  formatApprovalSourceKind,
  formatApprovalStatus,
  formatApprovalType,
  type ApprovalDecisionIntent,
  formatDetailValue,
  formatSessionStatus,
  formatTimestamp,
  humanizeApprovalField,
} from "../features/approvals/presentation";

type ApprovalTypeFilter = ApprovalType | "all";
type ApprovalRequesterFilter = "all" | string;
type OpenedAtFilter = "all" | "24h" | "7d" | "30d";
type ApprovalQueueTone = "success" | "warning" | "danger" | "neutral";
type ApprovalQueueUrgency = "expiring_soon" | "needs_decision_now" | "requester_follow_up" | "live_session" | "recorded_outcome";
type ApprovalQueueSection = {
  key: string;
  approval_type: ApprovalType;
  urgency: ApprovalQueueUrgency;
  tone: ApprovalQueueTone;
  items: ApprovalSummary[];
};

type RequesterFilterOption = {
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

function parseStatusFilter(value: string | null): ApprovalStatus | "all" | null {
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

function approvalRequesterFilterValue(item: ApprovalSummary): string | null {
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

function matchesRequesterFilter(item: ApprovalSummary, requesterFilter: ApprovalRequesterFilter): boolean {
  if (requesterFilter === "all") {
    return true;
  }

  return approvalRequesterFilterValue(item) === requesterFilter;
}

function matchesOpenedAtFilter(item: ApprovalSummary, openedAtFilter: OpenedAtFilter): boolean {
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

function matchesApprovalSearch(item: ApprovalSummary, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase();
  if (!search) {
    return true;
  }

  const haystack = [
    item.title,
    item.approval_id,
    item.native_approval_id,
    item.issue_id ?? "",
    item.company_id ?? "",
    item.target?.display_name ?? "",
    item.target?.username ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function formatOpenedAtFilter(value: OpenedAtFilter): string {
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

function formatStatusFilterLabel(value: ApprovalStatus | "all"): string {
  return value === "all" ? "All statuses" : formatApprovalStatus(value);
}

function describeEmptyQueueState({
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
    return "No approval items have been recorded yet. Execution-run and elevated-access requests appear here only when ForgeGate has created a real approval item.";
  }

  if (statusFilter !== "open") {
    return `${formatStatusFilterLabel(statusFilter)} slice is empty right now. Switch status or clear filters to review a different approval state.`;
  }

  return "No approvals waiting. Execution-run and elevated-access requests appear here only when ForgeGate has created a real approval item.";
}

function approvalTone(status: ApprovalStatus): ApprovalQueueTone {
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
      return "success";
    case "live_session":
      return "success";
    case "recorded_outcome":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatApprovalQueueUrgency(urgency: ApprovalQueueUrgency): string {
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

function describeApprovalQueueSection(urgency: ApprovalQueueUrgency, approvalType: ApprovalType): string {
  switch (urgency) {
    case "expiring_soon":
      return "Decision window is closing. Review these requests before ForgeGate times them out.";
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

function groupApprovalsForQueue(items: ApprovalSummary[], now: number): ApprovalQueueSection[] {
  const sections = new Map<string, ApprovalQueueSection>();

  items.forEach((item) => {
    const urgency = approvalQueueUrgency(item, now);
    const key = `${urgency}:${item.approval_type}`;
    const existing = sections.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    sections.set(
      key,
      {
        key,
        approval_type: item.approval_type,
        urgency,
        tone: approvalQueueTone(urgency),
        items: [item],
      },
    );
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

function describeApprovalQueueItem(item: ApprovalSummary): string {
  const context = [
    item.source_kind === "execution_run" ? "Execution queue item" : "Elevated-access queue item",
    item.issue_id ? `Issue ${item.issue_id}` : null,
    item.company_id ? `Company ${item.company_id}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return context.join(" · ");
}

function approvalAuditCandidates(approval: ApprovalSummary | ApprovalDetail | null): Array<{ query: AuditHistoryQuery }> {
  if (!approval) {
    return [
      { query: { window: "all", targetType: "execution_approval" as const } },
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
        window: "all",
        targetType: "execution_approval" as const,
        targetId: approval.approval_id,
      },
    },
  ];
}

function buildApprovalAuditHistoryFallback(approval: ApprovalSummary | ApprovalDetail | null) {
  if (!approval) {
    return { window: "all" as const };
  }

  if (approval.source_kind === "elevated_access") {
    return {
      window: "all" as const,
      targetType: "elevated_access_request" as const,
      targetId: approval.native_approval_id,
    };
  }

  return {
    window: "all" as const,
    targetType: "execution_approval" as const,
    targetId: approval.approval_id,
  };
}

function renderMetadataGrid(entries: Array<[string, unknown]>) {
  return (
    <div className="fg-card-grid">
      {entries.map(([key, value]) => {
        const isStructuredObject = typeof value === "object" && value !== null && !Array.isArray(value);

        return (
          <article key={key} className="fg-subcard">
            <span className="fg-section-label">{humanizeApprovalField(key)}</span>
            {isStructuredObject ? <pre>{formatDetailValue(value)}</pre> : <p>{formatDetailValue(value)}</p>}
          </article>
        );
      })}
    </div>
  );
}

export function ApprovalsPage() {
  const location = useLocation();
  const { session, sessionReady } = useAppSession();
  const searchParams = new URLSearchParams(location.search);
  const requestedApprovalId = searchParams.get("approvalId")?.trim() || null;
  const requestedStatusFilter = parseStatusFilter(searchParams.get("status")) ?? (requestedApprovalId ? "all" : "open");

  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">(requestedStatusFilter);
  const [typeFilter, setTypeFilter] = useState<ApprovalTypeFilter>("all");
  const [requesterFilter, setRequesterFilter] = useState<ApprovalRequesterFilter>("all");
  const [openedAtFilter, setOpenedAtFilter] = useState<OpenedAtFilter>("all");
  const [search, setSearch] = useState("");
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(requestedApprovalId);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionConfirmation, setDecisionConfirmation] = useState<ApprovalDecisionIntent | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [reloadSequence, setReloadSequence] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => buildAuditHistoryPath({ window: "all" }));
  const [detailAuditHistoryRoute, setDetailAuditHistoryRoute] = useState<string>(() => buildAuditHistoryPath({ window: "all" }));

  const canReview = sessionReady && (session?.role === "admin" || session?.role === "operator");
  const canOpenSecurity = sessionReady && session !== null && session.role !== "viewer";
  const canDecide = session?.role === "admin" && session.read_only !== true;

  useEffect(() => {
    setStatusFilter((current) => (current === requestedStatusFilter ? current : requestedStatusFilter));
  }, [requestedStatusFilter]);

  useEffect(() => {
    if (!requestedApprovalId) {
      return;
    }
    setSelectedApprovalId((current) => (current === requestedApprovalId ? current : requestedApprovalId));
  }, [requestedApprovalId]);

  useEffect(() => {
    if (!canReview) {
      setApprovals([]);
      setSelectedApprovalId(null);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListLoading(true);

    void fetchApprovals(statusFilter)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setApprovals(payload.approvals);
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setApprovals([]);
        setSelectedApprovalId(null);
        setDetail(null);
        setError(loadError instanceof Error ? loadError.message : "Approvals loading failed.");
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReview, reloadSequence, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    if (!canReview) {
      setAuditHistoryRoute(buildAuditHistoryPath({ window: "all" }));
      return () => {
        cancelled = true;
      };
    }

    void resolveNewestAuditHistoryPath(
      approvalAuditCandidates(null),
      buildApprovalAuditHistoryFallback(null),
    ).then((route) => {
      if (!cancelled) {
        setAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canReview, reloadSequence]);

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

  useEffect(() => {
    if (requesterFilter === "all") {
      return;
    }
    if (requesterOptions.some((option) => option.value === requesterFilter)) {
      return;
    }
    setRequesterFilter("all");
  }, [requesterFilter, requesterOptions]);

  const visibleApprovals = approvals.filter(
    (item) => (
      (typeFilter === "all" || item.approval_type === typeFilter)
      && matchesRequesterFilter(item, requesterFilter)
      && matchesOpenedAtFilter(item, openedAtFilter)
      && matchesApprovalSearch(item, search)
    ),
  );
  const queueSections = groupApprovalsForQueue(visibleApprovals, Date.now());
  const orderedVisibleApprovals = queueSections.flatMap((section) => section.items);

  const requesterFilterLabel = requesterFilter === "all"
    ? "All requesters"
    : requesterOptions.find((option) => option.value === requesterFilter)?.label ?? "Selected requester";
  const activeQueueFilters = [
    `Status: ${formatStatusFilterLabel(statusFilter)}`,
    typeFilter !== "all" ? `Approval type: ${formatApprovalType(typeFilter)}` : null,
    requesterFilter !== "all" ? `Requester: ${requesterFilterLabel}` : null,
    openedAtFilter !== "all" ? `Opened at: ${formatOpenedAtFilter(openedAtFilter)}` : null,
    search.trim() ? `Search: ${search.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasClientSideQueueFilters = typeFilter !== "all"
    || requesterFilter !== "all"
    || openedAtFilter !== "all"
    || search.trim().length > 0;

  useEffect(() => {
    if (!canReview) {
      return;
    }

    if (requestedApprovalId && selectedApprovalId === requestedApprovalId) {
      return;
    }

    if (orderedVisibleApprovals.length === 0) {
      if (selectedApprovalId !== null) {
        setSelectedApprovalId(null);
      }
      return;
    }

    if (!selectedApprovalId || !orderedVisibleApprovals.some((item) => item.approval_id === selectedApprovalId)) {
      setSelectedApprovalId(orderedVisibleApprovals[0].approval_id);
    }
  }, [canReview, orderedVisibleApprovals, requestedApprovalId, selectedApprovalId]);

  useEffect(() => {
    if (!canReview || !selectedApprovalId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void fetchApprovalDetail(selectedApprovalId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.approval);
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setError(loadError instanceof Error ? loadError.message : "Approval detail loading failed.");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReview, selectedApprovalId]);

  useEffect(() => {
    setDecisionConfirmation(null);
  }, [detail?.approval_id, detail?.status, selectedApprovalId]);

  useEffect(() => {
    let cancelled = false;

    if (!detail) {
      setDetailAuditHistoryRoute(auditHistoryRoute);
      return () => {
        cancelled = true;
      };
    }

    void resolveNewestAuditHistoryPath(
      approvalAuditCandidates(detail),
      buildApprovalAuditHistoryFallback(detail),
    ).then((route) => {
      if (!cancelled) {
        setDetailAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditHistoryRoute, detail]);

  const decisionReady = decisionNote.trim().length >= 8;
  const openCount = approvals.filter((item) => item.status === "open").length;
  const executionCount = approvals.filter((item) => item.source_kind === "execution_run").length;
  const elevatedCount = approvals.filter((item) => item.source_kind === "elevated_access").length;
  const readyToStartCount = approvals.filter((item) => item.ready_to_issue).length;

  const banner = detail ? describeApprovalBanner(detail) : null;
  const canApprove = canDecide && detail?.actions.can_approve === true;
  const canReject = canDecide && detail?.actions.can_reject === true;
  const hasDecisionAction = canApprove || canReject;
  const decisionBlockedReason =
    detail && (!canDecide || !detail.actions.can_approve || !detail.actions.can_reject)
      ? describeDecisionBlockedReason(detail.actions.decision_blocked_reason, session)
      : "";
  const approveBlockedReason =
    detail && !canApprove ? describeDecisionBlockedReason(detail.actions.approve_blocked_reason, session) : "";
  const rejectBlockedReason =
    detail && !canReject ? describeDecisionBlockedReason(detail.actions.reject_blocked_reason, session) : "";
  const approveDecisionFlow = detail ? describeApprovalDecisionConfirmation(detail, "approve") : null;
  const rejectDecisionFlow = detail ? describeApprovalDecisionConfirmation(detail, "reject") : null;
  const pendingDecisionFlow = detail && decisionConfirmation
    ? decisionConfirmation === "approve"
      ? approveDecisionFlow
      : rejectDecisionFlow
    : null;

  const primaryEvidenceEntries: Array<[string, unknown]> = detail
    ? [
        ["request_time", detail.opened_at],
        ["requester", formatApprovalActor(detail.requester)],
        ["target", formatApprovalActor(detail.target)],
        ["impact", banner?.body ?? detail.title],
      ]
    : [];

  const evidenceEntries: Array<[string, unknown]> = detail ? Object.entries(detail.evidence) : [];
  const decisionEntries: Array<[string, unknown]> = detail
    ? [
        ["decided_at", formatTimestamp(detail.decided_at)],
        ["expires_at", formatTimestamp(detail.expires_at)],
        ["session_status", formatSessionStatus(detail.session_status, detail.ready_to_issue) ?? "Not applicable"],
        ["decision_actor", formatApprovalActor(detail.decision_actor)],
      ]
    : [];
  const referenceEntries: Array<[string, unknown]> = detail
    ? [
        ["approval_id", detail.approval_id],
        ["native_approval_id", detail.native_approval_id],
        ["approval_type", formatApprovalType(detail.approval_type)],
        ["source_kind", formatApprovalSourceKind(detail.source_kind)],
        ["company_id", detail.company_id ?? "Not recorded"],
        ["issue_id", detail.issue_id ?? "Not recorded"],
      ]
    : [];
  const sourceEntries: Array<[string, unknown]> = detail ? Object.entries(detail.source) : [];
  const executionReviewRoute = detail?.source_kind === "execution_run"
    ? buildExecutionReviewPath({
        companyId: detail.company_id ?? (typeof detail.source.company_id === "string" ? detail.source.company_id : null),
        runId: typeof detail.source.run_id === "string" ? detail.source.run_id : null,
        state: typeof detail.evidence.run_state === "string" ? detail.evidence.run_state : null,
      })
    : null;
  const auditScopeLabel = detail
    ? detail.source_kind === "elevated_access"
      ? "Elevated-access request history"
      : "Execution approval history"
    : "";
  const auditNextActorLabel = detail
    ? detail.status === "open"
      ? hasDecisionAction
        ? "After reviewing the retained audit trail, record the decision note and confirm the approval outcome."
        : "After reviewing the retained audit trail, hand the item to an eligible admin instead of relying on raw metadata alone."
      : detail.source_kind === "elevated_access" && detail.ready_to_issue
        ? "The requester is next. They must open Security & Policies to start the approved elevated session."
        : detail.source_kind === "execution_run"
          ? "Use the audit trail, then return to Execution Review to confirm the downstream run state."
          : "Use the audit trail, then return to Security & Policies to confirm the downstream session posture."
    : "";

  const startDecisionConfirmation = (intent: ApprovalDecisionIntent) => {
    if (!detail || !canDecide) {
      return;
    }

    if ((intent === "approve" && !canApprove) || (intent === "reject" && !canReject)) {
      return;
    }

    setDecisionConfirmation(intent);
    setError("");
    setMessage("");
  };

  const onDecision = async (approved: boolean) => {
    if (!detail || !canDecide) {
      return;
    }

    try {
      setDecisionPending(true);
      setError("");
      setMessage("");
      const response = approved
        ? await approveApproval(detail.approval_id, decisionNote.trim())
        : await rejectApproval(detail.approval_id, decisionNote.trim());
      setApprovals((current) =>
        current.map((item) => (item.approval_id === response.approval.approval_id ? { ...item, ...response.approval } : item)),
      );
      setDetail(response.approval);
      setDecisionNote("");
      setDecisionConfirmation(null);
      setMessage(describeApprovalMutationMessage(response.approval));
      const auditRoute = await resolveNewestAuditHistoryPath(
        approvalAuditCandidates(response.approval),
        buildApprovalAuditHistoryFallback(response.approval),
      );
      setAuditHistoryRoute(auditRoute);
      setDetailAuditHistoryRoute(auditRoute);
      setReloadSequence((current) => current + 1);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Approval decision failed.");
    } finally {
      setDecisionPending(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Approvals"
          description="Shared queue for execution-run and elevated-access decisions, separated from downstream issuance."
          question="Which request needs a decision, and what system state changes if you approve or reject it?"
          links={[
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "The shared governance queue for pending, approved, rejected, expired, and cancelled approval items.",
            },
            {
              label: "Security & Policies",
              to: CONTROL_PLANE_ROUTES.security,
              description: "Open the elevated-access request/start surface once the current session role is known.",
              badge: "Operator or admin",
              disabled: true,
            },
            {
              label: "Audit History",
              to: auditHistoryRoute,
              description: "Cross-check approval outcomes against audit evidence.",
            },
            {
              label: "Provider Health & Runs",
              to: CONTROL_PLANE_ROUTES.providerHealthRuns,
              description: "Review downstream provider and run posture when execution approvals are waiting.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="ForgeGate keeps approval outcome separate from downstream session issuance. Elevated access does not become live until the requester starts it from Security & Policies."
        />
      </section>
    );
  }

  if (!canReview) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Approvals"
          description="This route is reserved for operators and admins who can inspect shared approval evidence and decision posture."
          question="Which governance surface should you use when approval review is outside your current permission envelope?"
          links={[
            {
              label: "Runtime Access Review",
              to: CONTROL_PLANE_ROUTES.accounts,
              description: "Inspect runtime account posture without entering the shared approvals queue.",
            },
            {
              label: "Audit History",
              to: auditHistoryRoute,
              description: "Review recent governance evidence without approval decision controls.",
            },
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard and branch into the right operator-safe workflow.",
            },
            {
              label: "Security & Policies",
              to: CONTROL_PLANE_ROUTES.security,
              description: "Operator/admin governance posture and elevated-session controls.",
              badge: "Operator or admin",
              disabled: true,
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers stay on audit and runtime-access surfaces. Approval review exposes request evidence and decision posture that this session cannot open."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="Approvals"
        description="Shared queue for execution-run and elevated-access decisions, with approval outcome kept separate from downstream issuance."
        question="Which request needs a decision now, and what changes in runtime or governance state if you act on it?"
        links={[
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Shared queue for pending and recently resolved approval items.",
          },
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: session?.role === "admin"
                  ? "Open live session posture, requester issuance state, and admin-only security modules."
                  : "Open the elevated-access request/start surface and your requester issuance state.",
                badge: session?.role === "admin" ? "Admin posture" : "Request flow",
              }
            : {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: "Reserved for operators and admins who can request elevated access or inspect security posture.",
                badge: "Operator or admin",
                disabled: true,
              },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Check downstream execution truth when a run is waiting on approval.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Cross-check approval decisions against audit evidence.",
          },
          {
            label: "Command Center",
            to: CONTROL_PLANE_ROUTES.dashboard,
            description: "Return to the dashboard when the issue spans multiple operator domains.",
          },
        ]}
        badges={[
          {
            label: canDecide ? "Admin decision mode" : "Review only",
            tone: canDecide ? "success" : "neutral",
          },
        ]}
        note="Approval state and session state stay separate here. Elevated-access approval never implies a live session until the original requester issues it from Security & Policies."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <div className="fg-card-grid">
        <article className="fg-kpi">
          <span className="fg-muted">Open approvals</span>
          <strong className="fg-kpi-value">{openCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Execution items</span>
          <strong className="fg-kpi-value">{executionCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Elevated-access items</span>
          <strong className="fg-kpi-value">{elevatedCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Ready to start</span>
          <strong className="fg-kpi-value">{readyToStartCount}</strong>
        </article>
      </div>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Queue filters</h3>
              <p className="fg-muted">Filter by status, approval type, requester, and opened-at window before using free search for targets, titles, runs, or IDs. Matching rows stay grouped by derived urgency so expiring and requester-ready work does not get buried.</p>
            </div>
          </div>
        <div className="fg-inline-form">
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ApprovalStatus | "all")}>
              <option value="open">Open only</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="timed_out">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label>
            Approval type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ApprovalTypeFilter)}>
              <option value="all">All approval types</option>
              <option value="execution_run">Execution run</option>
              <option value="break_glass">Break-glass</option>
              <option value="impersonation">Impersonation</option>
            </select>
          </label>
          <label>
            Requester
            <select value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)}>
              <option value="all">All requesters</option>
              {requesterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opened at
            <select value={openedAtFilter} onChange={(event) => setOpenedAtFilter(event.target.value as OpenedAtFilter)}>
              <option value="all">Any time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <label>
            Search
            <input
              placeholder="Search target, title, issue, or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <p className="fg-muted">
          Reviewing {orderedVisibleApprovals.length} matching item{orderedVisibleApprovals.length === 1 ? "" : "s"} in this queue slice. ForgeGate derives the queue urgency from current status, expiry, and issuance state in the live payload.
        </p>
        <div className="fg-actions">
          {activeQueueFilters.map((filter) => (
            <span key={filter} className="fg-pill">
              {filter}
            </span>
          ))}
        </div>
      </article>

      <div className="fg-approval-layout">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Approval queue</h3>
              <p className="fg-muted">
                {orderedVisibleApprovals.length} matching item{orderedVisibleApprovals.length === 1 ? "" : "s"}, grouped by urgency first and approval type second.
              </p>
            </div>
          </div>

          {listLoading ? <p className="fg-muted">Loading approvals queue…</p> : null}

          {!listLoading && orderedVisibleApprovals.length === 0 ? (
            <p className="fg-muted">
              {describeEmptyQueueState(
                {
                  statusFilter,
                  approvalsLoaded: approvals.length,
                  hasClientSideQueueFilters,
                },
              )}
            </p>
          ) : null}

          {orderedVisibleApprovals.length > 0 ? (
            <div className="fg-approval-queue-groups" aria-label="Approval queue">
              {queueSections.map((section) => (
                <section key={section.key} className="fg-approval-queue-group">
                  <div className="fg-wayfinding-label">
                    <div>
                      <h4>{formatApprovalQueueUrgency(section.urgency)} · {formatApprovalType(section.approval_type)}</h4>
                      <p className="fg-muted">{describeApprovalQueueSection(section.urgency, section.approval_type)}</p>
                    </div>
                    <span className="fg-pill" data-tone={section.tone}>
                      {section.items.length} item{section.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="fg-approval-list">
                    {section.items.map((item) => {
                      const isSelected = item.approval_id === selectedApprovalId;
                      const sessionLabel = formatSessionStatus(item.session_status, item.ready_to_issue);

                      return (
                        <button
                          key={item.approval_id}
                          type="button"
                          className={`fg-approval-item${isSelected ? " is-selected" : ""}`}
                          onClick={() => setSelectedApprovalId(item.approval_id)}
                        >
                          <div className="fg-approval-item-header">
                            <strong>{item.title}</strong>
                            <div className="fg-actions">
                              <span className="fg-pill" data-tone={section.tone}>
                                {formatApprovalQueueUrgency(section.urgency)}
                              </span>
                              <span className="fg-pill" data-tone={approvalTone(item.status)}>
                                {formatApprovalStatus(item.status)}
                              </span>
                            </div>
                          </div>
                          <p className="fg-muted">
                            {describeApprovalQueueItem(item)}
                          </p>
                          <div className="fg-approval-meta">
                            <span>Opened {formatTimestamp(item.opened_at)}</span>
                            {item.status === "open" && item.expires_at ? <span>Decision window {formatTimestamp(item.expires_at)}</span> : null}
                            <span>Requester {formatApprovalActor(item.requester)}</span>
                            <span>Target {formatApprovalActor(item.target)}</span>
                            <span>Source {formatApprovalSourceKind(item.source_kind)}</span>
                            {sessionLabel ? <span>Session {sessionLabel}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </article>

        <section className="fg-stack">
          <article className="fg-card">
            {detailLoading ? <p className="fg-muted">Loading approval detail…</p> : null}

            {!detailLoading && !detail ? (
              <p className="fg-muted">Select an approval item to review evidence, impact, and available actions.</p>
            ) : null}

            {!detailLoading && detail ? (
              <div className="fg-stack">
                <div className="fg-panel-heading">
                  <div>
                    <h3>{detail.title}</h3>
                    <p className="fg-muted">
                      Request opened {formatTimestamp(detail.opened_at)} · Requester {formatApprovalActor(detail.requester)} · Target {formatApprovalActor(detail.target)}
                    </p>
                  </div>
                  <div className="fg-actions">
                    <span className="fg-pill" data-tone={approvalTone(detail.status)}>
                      {formatApprovalStatus(detail.status)}
                    </span>
                    <span className="fg-pill">{formatApprovalType(detail.approval_type)}</span>
                    <span className="fg-pill">{formatApprovalSourceKind(detail.source_kind)}</span>
                    {formatSessionStatus(detail.session_status, detail.ready_to_issue) ? (
                      <span className="fg-pill">{formatSessionStatus(detail.session_status, detail.ready_to_issue)}</span>
                    ) : null}
                  </div>
                </div>

                {banner ? (
                  <div className="fg-approval-banner" data-tone={banner.tone}>
                    <strong>{banner.title}</strong>
                    <p>{banner.body}</p>
                  </div>
                ) : null}

                <div className="fg-actions">
                  {detail.source_kind === "execution_run"
                  && executionReviewRoute
                  && executionReviewRoute !== CONTROL_PLANE_ROUTES.execution ? (
                    <Link className="fg-nav-link" to={executionReviewRoute}>
                      Open Execution Review
                    </Link>
                  ) : null}
                  {detail.source_kind === "elevated_access" && canOpenSecurity ? (
                    <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.security}>
                      Open Security & Policies
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>

          {detail ? (
            <>
              <article className="fg-card">
                <h3>Evidence</h3>
                <p className="fg-muted">Review the operator-facing request facts first, then the recorded evidence payload before you inspect raw IDs or source metadata.</p>
                <div className="fg-stack">
                  {renderMetadataGrid(primaryEvidenceEntries)}
                  {evidenceEntries.length > 0 ? (
                    <div className="fg-stack">
                      <span className="fg-section-label">Recorded evidence</span>
                      {renderMetadataGrid(evidenceEntries)}
                    </div>
                  ) : (
                    <p className="fg-muted">No additional evidence fields were recorded for this approval item.</p>
                  )}
                </div>
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Audit history</h3>
                    <p className="fg-muted">
                      Open the scoped audit trail next. ForgeGate resolves the newest retained event for this approval when one exists, then leaves raw metadata below as secondary context.
                    </p>
                  </div>
                </div>
                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <span className="fg-section-label">Audit scope</span>
                    <p>{auditScopeLabel}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Next actor</span>
                    <p>{auditNextActorLabel}</p>
                  </article>
                </div>
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={detailAuditHistoryRoute}>
                    Open Audit History
                  </Link>
                </div>
              </article>

              <article className="fg-card">
                <h3>Secondary metadata</h3>
                <p className="fg-muted">Decision timing, raw IDs, and source payloads stay visible here after the evidence and audit pass.</p>
                <div className="fg-stack">
                  <div className="fg-stack">
                    <span className="fg-section-label">Decision record</span>
                    {renderMetadataGrid(decisionEntries)}
                  </div>
                  <div className="fg-stack">
                    <span className="fg-section-label">Identifiers</span>
                    {renderMetadataGrid(referenceEntries)}
                  </div>
                  <div className="fg-stack">
                    <span className="fg-section-label">System source</span>
                    {sourceEntries.length > 0 ? (
                      renderMetadataGrid(sourceEntries)
                    ) : (
                      <p className="fg-muted">No source metadata was recorded for this approval item.</p>
                    )}
                  </div>
                </div>
              </article>

              <article className="fg-card">
                <h3>Decision panel</h3>
                {detail.status === "open" ? (
                  hasDecisionAction ? (
                    <div className="fg-stack">
                      <label className="fg-stack">
                        Decision note
                        <textarea
                          rows={5}
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          placeholder="Record the decision rationale that should land in audit history."
                        />
                      </label>
                      <p className="fg-muted">A decision note is required. Use at least 8 characters so the audit trail carries real operator intent, then review the confirmation state before ForgeGate records the decision.</p>
                      <div className="fg-actions">
                        <button
                          type="button"
                          disabled={!decisionReady || decisionPending || !canApprove}
                          onClick={() => startDecisionConfirmation("approve")}
                        >
                          {approveDecisionFlow?.reviewLabel ?? "Review approval"}
                        </button>
                        <button
                          type="button"
                          disabled={!decisionReady || decisionPending || !canReject}
                          onClick={() => startDecisionConfirmation("reject")}
                        >
                          {rejectDecisionFlow?.reviewLabel ?? "Review rejection"}
                        </button>
                      </div>
                      {pendingDecisionFlow ? (
                        <div className="fg-stack">
                          <div className="fg-approval-banner" data-tone={pendingDecisionFlow.tone}>
                            <strong>{pendingDecisionFlow.title}</strong>
                            <p>{pendingDecisionFlow.body}</p>
                            <p><strong>Decision note:</strong> {decisionNote.trim()}</p>
                          </div>
                          <div className="fg-actions">
                            <button type="button" disabled={decisionPending} onClick={() => setDecisionConfirmation(null)}>
                              Back to edit
                            </button>
                            <button
                              type="button"
                              disabled={!decisionReady || decisionPending}
                              onClick={() => void onDecision(decisionConfirmation === "approve")}
                            >
                              {pendingDecisionFlow.confirmLabel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="fg-muted">Choose an action to review its confirmation state before ForgeGate records the decision.</p>
                      )}
                      {approveBlockedReason ? <p className="fg-muted">{approveBlockedReason}</p> : null}
                      {rejectBlockedReason ? <p className="fg-muted">{rejectBlockedReason}</p> : null}
                    </div>
                  ) : (
                    <p className="fg-muted">{decisionBlockedReason}</p>
                  )
                ) : (
                  <p className="fg-muted">This approval is already resolved. Review the recorded outcome, evidence, and linked source state instead of issuing another decision.</p>
                )}
              </article>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
