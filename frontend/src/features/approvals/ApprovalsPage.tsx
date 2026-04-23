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
} from "../../api/admin";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPath } from "../../app/auditHistory";
import {
  sessionCanMutateScopedOrAnyInstance,
  sessionHasAnyInstancePermission,
} from "../../app/adminAccess";
import { buildExecutionReviewPath } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { buildArtifactsPath, buildWorkspacePath } from "../../app/workInteractionRoutes";
import { PageIntro } from "../../components/PageIntro";
import {
  approvalAuditCandidates,
  approvalRequesterFilterValue,
  buildApprovalAuditHistoryFallback,
  buildRequesterOptions,
  formatOpenedAtFilter,
  formatStatusFilterLabel,
  groupApprovalsForQueue,
  matchesApprovalSearch,
  matchesOpenedAtFilter,
  matchesRequesterFilter,
  parseStatusFilter,
  type ApprovalRequesterFilter,
  type ApprovalTypeFilter,
  type OpenedAtFilter,
} from "./helpers";
import {
  describeApprovalBanner,
  describeApprovalDecisionConfirmation,
  describeApprovalMutationMessage,
  describeDecisionBlockedReason,
  formatApprovalActor,
  formatApprovalSourceKind,
  formatApprovalType,
  type ApprovalDecisionIntent,
  formatSessionStatus,
  formatTimestamp,
} from "./presentation";
import {
  ApprovalDetailSection,
  ApprovalFiltersCard,
  ApprovalQueueCard,
} from "./sections";

export function ApprovalsPage() {
  const location = useLocation();
  const { session, sessionReady } = useAppSession();
  const searchParams = new URLSearchParams(location.search);
  const instanceId = getInstanceIdFromSearchParams(searchParams);
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

  const canReview = sessionReady && sessionHasAnyInstancePermission(session, "approvals.read");
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");
  const canDecide = sessionCanMutateScopedOrAnyInstance(session, null, "approvals.decide");

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

    void fetchApprovals(statusFilter, instanceId)
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
  }, [canReview, instanceId, reloadSequence, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    if (!canReview) {
      setAuditHistoryRoute(buildAuditHistoryPath({ window: "all" }));
      return () => {
        cancelled = true;
      };
    }

    void resolveNewestAuditHistoryPath(
      approvalAuditCandidates(null, instanceId),
      buildApprovalAuditHistoryFallback(null, instanceId),
    ).then((route) => {
      if (!cancelled) {
        setAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canReview, instanceId, reloadSequence]);

  const requesterOptions = buildRequesterOptions(approvals);

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

    void fetchApprovalDetail(selectedApprovalId, instanceId)
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
  }, [canReview, instanceId, selectedApprovalId]);

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
      approvalAuditCandidates(detail, instanceId),
      buildApprovalAuditHistoryFallback(detail, instanceId),
    ).then((route) => {
      if (!cancelled) {
        setDetailAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditHistoryRoute, detail, instanceId]);

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
  const workspaceSummary = detail?.workspace && typeof detail.workspace.workspace_id === "string"
    ? detail.workspace
    : null;
  const workspaceRoute = workspaceSummary?.workspace_id
    ? buildWorkspacePath({ instanceId: workspaceSummary.instance_id ?? detail?.instance_id ?? instanceId, workspaceId: workspaceSummary.workspace_id })
    : null;
  const artifactRoute = detail
    ? buildArtifactsPath({
        instanceId: detail.instance_id ?? instanceId,
        workspaceId: workspaceSummary?.workspace_id ?? detail.workspace_id ?? undefined,
        targetKind: "approval",
        targetId: detail.approval_id,
      })
    : null;
  const workspaceEntries: Array<[string, unknown]> = workspaceSummary
    ? [
        ["workspace_id", workspaceSummary.workspace_id],
        ["status", workspaceSummary.status ?? "Not recorded"],
        ["preview_status", workspaceSummary.preview_status ?? "Not recorded"],
        ["review_status", workspaceSummary.review_status ?? "Not recorded"],
        ["handoff_status", workspaceSummary.handoff_status ?? "Not recorded"],
      ]
    : [];
  const executionReviewRoute = detail?.source_kind === "execution_run"
    ? buildExecutionReviewPath({
        instanceId: detail.instance_id ?? (typeof detail.source.instance_id === "string" ? detail.source.instance_id : null),
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

  const onDecision = async (intent: ApprovalDecisionIntent) => {
    if (!detail || !canDecide) {
      return;
    }

    try {
      setDecisionPending(true);
      setError("");
      setMessage("");
      const response = intent === "approve"
        ? await approveApproval(detail.approval_id, decisionNote.trim(), instanceId)
        : await rejectApproval(detail.approval_id, decisionNote.trim(), instanceId);
      setApprovals((current) =>
        current.map((item) => (item.approval_id === response.approval.approval_id ? { ...item, ...response.approval } : item)),
      );
      setDetail(response.approval);
      setDecisionNote("");
      setDecisionConfirmation(null);
      setMessage(describeApprovalMutationMessage(response.approval));
      const auditRoute = await resolveNewestAuditHistoryPath(
        approvalAuditCandidates(response.approval, instanceId),
        buildApprovalAuditHistoryFallback(response.approval, instanceId),
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
          note="ForgeFrame keeps approval outcome separate from downstream session issuance. Elevated access does not become live until the requester starts it from Security & Policies."
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
                description: canManageSecurity
                  ? "Open live session posture, requester issuance state, and admin-only security modules."
                  : "Open the elevated-access request/start surface and your requester issuance state.",
                badge: canManageSecurity ? "Admin posture" : "Request flow",
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
            label: canDecide ? "Decision mode" : "Review only",
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

      <ApprovalFiltersCard
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        requesterFilter={requesterFilter}
        requesterOptions={requesterOptions}
        openedAtFilter={openedAtFilter}
        search={search}
        orderedVisibleCount={orderedVisibleApprovals.length}
        activeQueueFilters={activeQueueFilters}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onRequesterFilterChange={setRequesterFilter}
        onOpenedAtFilterChange={setOpenedAtFilter}
        onSearchChange={setSearch}
      />

      <div className="fg-approval-layout">
        <ApprovalQueueCard
          listLoading={listLoading}
          orderedVisibleApprovals={orderedVisibleApprovals}
          queueSections={queueSections}
          selectedApprovalId={selectedApprovalId}
          statusFilter={statusFilter}
          approvalsLoaded={approvals.length}
          hasClientSideQueueFilters={hasClientSideQueueFilters}
          onSelectApproval={setSelectedApprovalId}
        />

        <ApprovalDetailSection
          detailLoading={detailLoading}
          detail={detail}
          banner={banner}
          executionReviewRoute={executionReviewRoute}
          canOpenSecurity={canOpenSecurity}
          primaryEvidenceEntries={primaryEvidenceEntries}
          evidenceEntries={evidenceEntries}
          auditScopeLabel={auditScopeLabel}
          auditNextActorLabel={auditNextActorLabel}
          detailAuditHistoryRoute={detailAuditHistoryRoute}
          decisionEntries={decisionEntries}
          referenceEntries={referenceEntries}
          sourceEntries={sourceEntries}
          workspaceEntries={workspaceEntries}
          workspaceRoute={workspaceRoute}
          artifactRoute={artifactRoute}
          artifacts={detail?.artifacts ?? []}
          hasDecisionAction={hasDecisionAction}
          decisionBlockedReason={decisionBlockedReason}
          decisionNote={decisionNote}
          decisionReady={decisionReady}
          decisionPending={decisionPending}
          canApprove={canApprove}
          canReject={canReject}
          approveDecisionFlow={approveDecisionFlow}
          rejectDecisionFlow={rejectDecisionFlow}
          pendingDecisionFlow={pendingDecisionFlow}
          pendingDecisionIntent={decisionConfirmation}
          hasPendingDecisionFlow={decisionConfirmation !== null}
          approveBlockedReason={approveBlockedReason}
          rejectBlockedReason={rejectBlockedReason}
          onDecisionNoteChange={setDecisionNote}
          onStartDecisionConfirmation={startDecisionConfirmation}
          onCancelDecisionConfirmation={() => setDecisionConfirmation(null)}
          onDecision={(intent) => void onDecision(intent)}
        />
      </div>
    </section>
  );
}
