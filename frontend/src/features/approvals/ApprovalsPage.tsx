import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  approveApproval,
  fetchApprovalDetail,
  fetchApprovals,
  rejectApproval,
  type ApprovalDetail,
  type ApprovalStatus,
  type ApprovalSummary,
} from "../../api/domain";
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
import { ContextNavStrip, PageHeader } from "../../components/ui";
import {
  approvalAuditCandidates,
  buildApprovalAuditHistoryFallback,
  buildInstanceOptions,
  formatClassFilterLabel,
  formatDueFilterLabel,
  formatInstanceFilterLabel,
  formatRiskFilterLabel,
  formatStatusFilterLabel,
  matchesApprovalSearch,
  matchesClassFilter,
  matchesDueFilter,
  matchesInstanceFilter,
  matchesRiskFilter,
  parseStatusFilter,
  sortApprovalsForDecisionSurface,
  type ApprovalClassFilter,
  type ApprovalDueFilter,
  type ApprovalInstanceFilter,
  type ApprovalRiskFilter,
  type ApprovalTypeFilter,
} from "./helpers";
import {
  describeApprovalBanner,
  describeApprovalDecisionConfirmation,
  describeApprovalMutationMessage,
  describeDecisionBlockedReason,
  formatApprovalType,
  type ApprovalDecisionIntent,
} from "./presentation";
import {
  ApprovalDetailSection,
  ApprovalFiltersCard,
  ApprovalQueueCard,
} from "./sections";

type DecisionOutcomeNotice = {
  approvalId: string;
  tone: "success" | "danger";
  title: string;
  body: string;
  comment: string;
};

export function ApprovalsPage() {
  const location = useLocation();
  const { session, sessionReady } = useAppSession();
  const searchParams = new URLSearchParams(location.search);
  const routeInstanceId = getInstanceIdFromSearchParams(searchParams);
  const requestedApprovalId = searchParams.get("approvalId")?.trim() || null;
  const requestedStatusFilter = parseStatusFilter(searchParams.get("status")) ?? (requestedApprovalId ? "all" : "open");

  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">(requestedStatusFilter);
  const [typeFilter, setTypeFilter] = useState<ApprovalTypeFilter>("all");
  const [riskFilter, setRiskFilter] = useState<ApprovalRiskFilter>("all");
  const [instanceFilter, setInstanceFilter] = useState<ApprovalInstanceFilter>(routeInstanceId?.trim() || "all");
  const [dueFilter, setDueFilter] = useState<ApprovalDueFilter>("all");
  const [approvalClassFilter, setApprovalClassFilter] = useState<ApprovalClassFilter>("all");
  const [search, setSearch] = useState("");
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(requestedApprovalId);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");
  const [decisionConfirmation, setDecisionConfirmation] = useState<ApprovalDecisionIntent | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionOutcome, setDecisionOutcome] = useState<DecisionOutcomeNotice | null>(null);
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
    const nextInstanceFilter = routeInstanceId?.trim() || "all";
    setInstanceFilter((current) => (current === nextInstanceFilter ? current : nextInstanceFilter));
  }, [routeInstanceId]);

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

    void fetchApprovals({
      status: statusFilter,
      approvalType: typeFilter,
      risk: riskFilter,
      due: dueFilter,
      approvalClass: approvalClassFilter,
      instanceId: instanceFilter === "all" ? null : instanceFilter,
      limit: 200,
    })
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
  }, [approvalClassFilter, canReview, dueFilter, instanceFilter, reloadSequence, riskFilter, statusFilter, typeFilter]);

  useEffect(() => {
    let cancelled = false;

    if (!canReview) {
      setAuditHistoryRoute(buildAuditHistoryPath({ window: "all" }));
      return () => {
        cancelled = true;
      };
    }

    void resolveNewestAuditHistoryPath(
      approvalAuditCandidates(null, routeInstanceId),
      buildApprovalAuditHistoryFallback(null, routeInstanceId),
    ).then((route) => {
      if (!cancelled) {
        setAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canReview, reloadSequence, routeInstanceId]);

  const instanceOptions = buildInstanceOptions(approvals);
  const visibleInstanceOptions = instanceFilter !== "all" && !instanceOptions.some((option) => option.value === instanceFilter)
    ? [{ value: instanceFilter, label: instanceFilter }, ...instanceOptions]
    : instanceOptions;

  const visibleApprovals = approvals.filter(
    (item) => (
      (typeFilter === "all" || item.approval_type === typeFilter)
      && matchesRiskFilter(item, riskFilter)
      && matchesInstanceFilter(item, instanceFilter)
      && matchesDueFilter(item, dueFilter)
      && matchesClassFilter(item, approvalClassFilter)
      && matchesApprovalSearch(item, search)
    ),
  );
  const orderedVisibleApprovals = sortApprovalsForDecisionSurface(visibleApprovals);
  const selectedApprovalSummary = approvals.find((item) => item.approval_id === selectedApprovalId) ?? null;

  const activeQueueFilters = [
    `Status: ${formatStatusFilterLabel(statusFilter)}`,
    typeFilter !== "all" ? `Type: ${formatApprovalType(typeFilter)}` : null,
    riskFilter !== "all" ? `Risk: ${formatRiskFilterLabel(riskFilter)}` : null,
    instanceFilter !== "all" ? `Instance: ${formatInstanceFilterLabel(instanceFilter, visibleInstanceOptions)}` : null,
    dueFilter !== "all" ? `Due: ${formatDueFilterLabel(dueFilter)}` : null,
    approvalClassFilter !== "all" ? `Class: ${formatClassFilterLabel(approvalClassFilter)}` : null,
    search.trim() ? `Search: ${search.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const hasClientSideQueueFilters = typeFilter !== "all"
    || riskFilter !== "all"
    || instanceFilter !== "all"
    || dueFilter !== "all"
    || approvalClassFilter !== "all"
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

    void fetchApprovalDetail(selectedApprovalId, selectedApprovalSummary?.instance_id ?? routeInstanceId)
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
  }, [canReview, routeInstanceId, selectedApprovalId, selectedApprovalSummary?.instance_id]);

  useEffect(() => {
    setDecisionConfirmation(null);
    setDecisionOutcome((current) => (current && current.approvalId !== selectedApprovalId ? null : current));
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
      approvalAuditCandidates(detail, detail.instance_id ?? routeInstanceId),
      buildApprovalAuditHistoryFallback(detail, detail.instance_id ?? routeInstanceId),
    ).then((route) => {
      if (!cancelled) {
        setDetailAuditHistoryRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditHistoryRoute, detail, routeInstanceId]);

  const openCount = approvals.filter((item) => item.status === "open").length;
  const highRiskCount = approvals.filter((item) => item.risk_level === "critical" || item.risk_level === "high" || item.irreversible).length;
  const executionCount = approvals.filter((item) => item.source_kind === "execution_run").length;
  const elevatedCount = approvals.filter((item) => item.source_kind === "elevated_access").length;

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
  const workspaceSummary = detail?.workspace && typeof detail.workspace.workspace_id === "string"
    ? detail.workspace
    : null;
  const workspaceRoute = workspaceSummary?.workspace_id
    ? buildWorkspacePath({ instanceId: workspaceSummary.instance_id ?? detail?.instance_id ?? routeInstanceId, workspaceId: workspaceSummary.workspace_id })
    : null;
  const artifactRoute = detail
    ? buildArtifactsPath({
        instanceId: detail.instance_id ?? routeInstanceId,
        workspaceId: workspaceSummary?.workspace_id ?? detail.workspace_id ?? undefined,
        targetKind: "approval",
        targetId: detail.approval_id,
      })
    : null;
  const executionReviewRoute = detail?.source_kind === "execution_run"
    ? buildExecutionReviewPath({
        instanceId: detail.instance_id ?? (typeof detail.source.instance_id === "string" ? detail.source.instance_id : null),
        companyId: detail.company_id ?? (typeof detail.source.company_id === "string" ? detail.source.company_id : null),
        runId: typeof detail.source.run_id === "string" ? detail.source.run_id : null,
        state: typeof detail.evidence.run_state === "string" ? detail.evidence.run_state : null,
      })
    : null;

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
      const trimmedComment = decisionComment.trim();
      setDecisionPending(true);
      setError("");
      setMessage("");
      setDecisionOutcome(null);
      const response = intent === "approve"
        ? await approveApproval(detail.approval_id, trimmedComment, detail.instance_id ?? routeInstanceId)
        : await rejectApproval(detail.approval_id, trimmedComment, detail.instance_id ?? routeInstanceId);
      setApprovals((current) =>
        current.map((item) => (item.approval_id === response.approval.approval_id ? { ...item, ...response.approval } : item)),
      );
      setDetail(response.approval);
      setDecisionComment("");
      setDecisionConfirmation(null);
      const mutationMessage = describeApprovalMutationMessage(response.approval);
      setMessage(mutationMessage);
      setDecisionOutcome({
        approvalId: response.approval.approval_id,
        tone: intent === "approve" ? "success" : "danger",
        title: intent === "approve" ? "Approval recorded" : "Rejection recorded",
        body: mutationMessage,
        comment: trimmedComment,
      });
      const auditRoute = await resolveNewestAuditHistoryPath(
        approvalAuditCandidates(response.approval, response.approval.instance_id ?? routeInstanceId),
        buildApprovalAuditHistoryFallback(response.approval, response.approval.instance_id ?? routeInstanceId),
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
        <PageHeader
          eyebrow="Governance"
          title="Approvals"
          description="Shared queue for execution-run and elevated-access decisions."
          badges={[{ label: "Checking access", tone: "neutral" }]}
        >
          <ContextNavStrip
            compact
            items={[
              { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals },
              { label: "Security & Policies", to: CONTROL_PLANE_ROUTES.security, badge: "Operator or admin", disabled: true },
              { label: "Audit History", to: auditHistoryRoute },
              { label: "Provider Health & Runs", to: CONTROL_PLANE_ROUTES.providerHealthRuns },
            ]}
          />
        </PageHeader>
      </section>
    );
  }

  if (!canReview) {
    return (
      <section className="fg-page">
        <PageHeader
          eyebrow="Governance"
          title="Approvals"
          description="Approval review is reserved for operator and admin sessions."
          badges={[{ label: "Operator required", tone: "warning" }]}
        >
          <ContextNavStrip
            compact
            items={[
              { label: "Runtime Access Review", to: CONTROL_PLANE_ROUTES.accounts },
              { label: "Audit History", to: auditHistoryRoute },
              { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard },
              { label: "Security & Policies", to: CONTROL_PLANE_ROUTES.security, badge: "Operator or admin", disabled: true },
            ]}
          />
        </PageHeader>
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow="Governance"
        title="Approvals"
        description="Execution-run and elevated-access decisions, with approval outcome kept separate from downstream issuance."
        badges={[
          {
            label: canDecide ? "Decision mode" : "Review only",
            tone: canDecide ? "success" : "neutral",
          },
        ]}
      >
        <ContextNavStrip
          compact
          items={[
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals },
            canOpenSecurity
              ? { label: "Security & Policies", to: CONTROL_PLANE_ROUTES.security, badge: canManageSecurity ? "Admin posture" : "Request flow" }
              : { label: "Security & Policies", to: CONTROL_PLANE_ROUTES.security, badge: "Operator or admin", disabled: true },
            { label: "Provider Health & Runs", to: CONTROL_PLANE_ROUTES.providerHealthRuns },
            { label: "Audit History", to: auditHistoryRoute },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard },
          ]}
        />
      </PageHeader>
      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <div className="flex flex-wrap gap-4 px-1 py-2 mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-meta text-muted font-medium uppercase tracking-wider text-xs">Open</span>
          <strong className="text-kpi tabular-nums">{openCount}</strong>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-meta text-muted font-medium uppercase tracking-wider text-xs">Execution</span>
          <strong className="text-kpi tabular-nums">{executionCount}</strong>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-meta text-muted font-medium uppercase tracking-wider text-xs">Elevated</span>
          <strong className="text-kpi tabular-nums">{elevatedCount}</strong>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-meta text-muted font-medium uppercase tracking-wider text-xs">High-risk</span>
          <strong className="text-kpi tabular-nums">{highRiskCount}</strong>
        </div>
      </div>

      <ApprovalFiltersCard
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        riskFilter={riskFilter}
        instanceFilter={instanceFilter}
        instanceOptions={visibleInstanceOptions}
        dueFilter={dueFilter}
        approvalClassFilter={approvalClassFilter}
        search={search}
        orderedVisibleCount={orderedVisibleApprovals.length}
        activeQueueFilters={activeQueueFilters}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onRiskFilterChange={setRiskFilter}
        onInstanceFilterChange={setInstanceFilter}
        onDueFilterChange={setDueFilter}
        onApprovalClassFilterChange={setApprovalClassFilter}
        onSearchChange={setSearch}
      />

      <div className="fg-approval-layout">
        <ApprovalQueueCard
          listLoading={listLoading}
          orderedVisibleApprovals={orderedVisibleApprovals}
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
          detailAuditHistoryRoute={detailAuditHistoryRoute}
          workspaceRoute={workspaceRoute}
          artifactRoute={artifactRoute}
          decisionOutcome={decisionOutcome}
          hasDecisionAction={hasDecisionAction}
          decisionBlockedReason={decisionBlockedReason}
          decisionComment={decisionComment}
          decisionPending={decisionPending}
          canApprove={canApprove}
          canReject={canReject}
          approveDecisionFlow={approveDecisionFlow}
          rejectDecisionFlow={rejectDecisionFlow}
          pendingDecisionFlow={pendingDecisionFlow}
          pendingDecisionIntent={decisionConfirmation}
          approveBlockedReason={approveBlockedReason}
          rejectBlockedReason={rejectBlockedReason}
          onDecisionCommentChange={setDecisionComment}
          onStartDecisionConfirmation={startDecisionConfirmation}
          onCancelDecisionConfirmation={() => setDecisionConfirmation(null)}
          onDecision={(intent) => void onDecision(intent)}
        />
      </div>
    </section>
  );
}
