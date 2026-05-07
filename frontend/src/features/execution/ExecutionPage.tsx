import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  escalateExecutionRun,
  fetchInstances,
  interruptExecutionRun,
  pauseExecutionRun,
  quarantineExecutionRun,
  restartExecutionRun,
  resumeExecutionRun,
  fetchExecutionRunDetail,
  fetchExecutionRuns,
  replayExecutionRun,
  type ExecutionOperatorActionResult,
  type ExecutionReplayResult,
  type ExecutionRunDetail,
  type ExecutionRunSummary,
} from "../../api/domain";
import { buildAuditHistoryPath } from "../../app/auditHistory";
import { normalizeExecutionCompanyId, normalizeExecutionInstanceId, normalizeExecutionState } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { IncidentResponsePage } from "../../components/page-templates";
import type { AttentionPayload } from "../../components/ui/models/attention";
import type { SummaryStripItem } from "../../components/ui/SummaryStrip";
import {
  DEFAULT_APPROVAL_WAIT_FILTER,
  DEFAULT_ERROR_FILTER,
  DEFAULT_LANE_FILTER,
  buildExecutionScopeOptions,
  DEFAULT_STATE_FILTER,
  DEFAULT_TARGET_FILTER,
  DEFAULT_WINDOW_FILTER,
  buildExecutionStatusSummary,
  describeReplayError,
  getExecutionAccess,
  type OperatorActionState,
  type ExecutionApprovalWaitFilter,
  type ExecutionErrorFilter,
  type ExecutionScopeOption,
  type ExecutionTab,
  type ExecutionWindowFilter,
  type LoadState,
  type ReplayState,
} from "./helpers";
import { sessionHasScopedOrAnyInstancePermission } from "../../app/adminAccess";
import {
  ExecutionRunsSection,
  MissingExecutionScopeCard,
  ScopeFilterCard,
} from "./sections";

export function ExecutionPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const approvalWaitParam = searchParams.get("approvalWait")?.trim() === "waiting_only" ? "waiting_only" : DEFAULT_APPROVAL_WAIT_FILTER;
  const errorParam = searchParams.get("error")?.trim() === "with_error" ? "with_error" : DEFAULT_ERROR_FILTER;
  const windowParam = (() => {
    const value = searchParams.get("window")?.trim() ?? DEFAULT_WINDOW_FILTER;
    return ["all", "24h", "72h", "7d", "30d"].includes(value) ? (value as ExecutionWindowFilter) : DEFAULT_WINDOW_FILTER;
  })();
  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const stateFilter = normalizeExecutionState(searchParams.get("state")) ?? DEFAULT_STATE_FILTER;
  const laneFilter = searchParams.get("lane")?.trim() ?? DEFAULT_LANE_FILTER;
  const targetFilter = searchParams.get("target")?.trim() ?? DEFAULT_TARGET_FILTER;
  const approvalWaitFilter = approvalWaitParam as ExecutionApprovalWaitFilter;
  const errorFilter = errorParam as ExecutionErrorFilter;
  const windowFilter = windowParam;
  const selectedRunId = searchParams.get("runId")?.trim() ?? "";
  const canReviewExecution = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);

  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [stateDraft, setStateDraft] = useState(stateFilter);
  const [laneDraft, setLaneDraft] = useState(laneFilter);
  const [targetDraft, setTargetDraft] = useState(targetFilter);
  const [approvalWaitDraft, setApprovalWaitDraft] = useState<ExecutionApprovalWaitFilter>(approvalWaitFilter);
  const [errorDraft, setErrorDraft] = useState<ExecutionErrorFilter>(errorFilter);
  const [windowDraft, setWindowDraft] = useState<ExecutionWindowFilter>(windowFilter);
  const [scopeOptionsState, setScopeOptionsState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeOptionsError, setScopeOptionsError] = useState("");
  const [runsState, setRunsState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [runs, setRuns] = useState<ExecutionRunSummary[]>([]);
  const [runsError, setRunsError] = useState("");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [detail, setDetail] = useState<ExecutionRunDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [replayReason, setReplayReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [replayState, setReplayState] = useState<ReplayState>("idle");
  const [replayError, setReplayError] = useState("");
  const [replayResult, setReplayResult] = useState<ExecutionReplayResult | null>(null);
  const [operatorReason, setOperatorReason] = useState("");
  const [operatorLane, setOperatorLane] = useState("");
  const [operatorActionState, setOperatorActionState] = useState<OperatorActionState>("idle");
  const [operatorActionError, setOperatorActionError] = useState("");
  const [operatorActionResult, setOperatorActionResult] = useState<ExecutionOperatorActionResult | null>(null);
  const [activeTab, setActiveTab] = useState<ExecutionTab>("runs");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    setStateDraft(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    setLaneDraft(laneFilter);
  }, [laneFilter]);

  useEffect(() => {
    setTargetDraft(targetFilter);
  }, [targetFilter]);

  useEffect(() => {
    setApprovalWaitDraft(approvalWaitFilter);
  }, [approvalWaitFilter]);

  useEffect(() => {
    setErrorDraft(errorFilter);
  }, [errorFilter]);

  useEffect(() => {
    setWindowDraft(windowFilter);
  }, [windowFilter]);

  useEffect(() => {
    if (!canReviewExecution || instanceId) {
      return;
    }

    let cancelled = false;
    setScopeOptionsState("loading");
    setScopeOptionsError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setScopeOptions(buildExecutionScopeOptions(payload.instances));
        setScopeOptionsState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setScopeOptions([]);
        setScopeOptionsError(error instanceof Error ? error.message : "Recent execution scopes could not be loaded.");
        setScopeOptionsState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewExecution, instanceId]);

  useEffect(() => {
    if (!canReviewExecution || !instanceId) {
      setRunsState("idle");
      setRuns([]);
      setRunsError("");
      return;
    }

    let cancelled = false;
    setRunsState("loading");
    setRunsError("");

    const runQuery = {
      instanceId,
      companyId,
      limit: 50,
      ...(stateFilter === "all" ? {} : { state: stateFilter }),
      ...(laneFilter ? { executionLane: laneFilter } : {}),
      ...(targetFilter ? { target: targetFilter } : {}),
      ...(approvalWaitFilter === "waiting_only" ? { approvalWait: true } : {}),
      ...(errorFilter === "with_error" ? { hasError: true } : {}),
      ...(windowFilter === "all" ? {} : { window: windowFilter }),
    };

    void fetchExecutionRuns(runQuery)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setRuns(payload.runs);
        setRunsState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setRuns([]);
        setRunsError(error instanceof Error ? error.message : "Execution runs could not be loaded.");
        setRunsState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewExecution, instanceId, companyId, stateFilter, laneFilter, targetFilter, approvalWaitFilter, errorFilter, windowFilter, refreshNonce]);

  useEffect(() => {
    if (!canReviewExecution || !instanceId || runsState !== "success") {
      return;
    }

    const selectedExists = selectedRunId ? runs.some((run) => run.run_id === selectedRunId) : false;
    if (selectedExists) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (runs[0]?.run_id) {
      next.set("runId", runs[0].run_id);
    } else {
      next.delete("runId");
    }

    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  }, [canReviewExecution, instanceId, runs, runsState, searchParams, selectedRunId, setSearchParams]);

  useEffect(() => {
    if (!canReviewExecution || !instanceId || !selectedRunId) {
      setDetailState("idle");
      setDetail(null);
      setDetailError("");
      return;
    }

    let cancelled = false;
    setDetailState("loading");
    setDetailError("");

    void fetchExecutionRunDetail(selectedRunId, { instanceId, companyId })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.run);
        setDetailState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailError(error instanceof Error ? error.message : "Execution run detail could not be loaded.");
        setDetailState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewExecution, instanceId, companyId, selectedRunId, refreshNonce]);

  useEffect(() => {
    setReplayState("idle");
    setReplayError("");
    setReplayResult(null);
    setOperatorActionState("idle");
    setOperatorActionError("");
    setOperatorActionResult(null);
  }, [selectedRunId, instanceId, companyId]);

  const updateSearchParams = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  const handleScopeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedInstance = instanceDraft.trim();
    const normalizedState = stateDraft || DEFAULT_STATE_FILTER;
    const normalizedLane = laneDraft.trim();
    const normalizedTarget = targetDraft.trim();

    updateSearchParams((next) => {
      if (normalizedInstance) {
        next.set("instanceId", normalizedInstance);
      } else {
        next.delete("instanceId");
      }
      if (!normalizedState || normalizedState === "all") {
        next.delete("state");
      } else {
        next.set("state", normalizedState);
      }
      if (normalizedLane) {
        next.set("lane", normalizedLane);
      } else {
        next.delete("lane");
      }
      if (normalizedTarget) {
        next.set("target", normalizedTarget);
      } else {
        next.delete("target");
      }
      if (approvalWaitDraft === "waiting_only") {
        next.set("approvalWait", approvalWaitDraft);
      } else {
        next.delete("approvalWait");
      }
      if (errorDraft === "with_error") {
        next.set("error", errorDraft);
      } else {
        next.delete("error");
      }
      if (windowDraft === "all") {
        next.delete("window");
      } else {
        next.set("window", windowDraft);
      }
      next.delete("runId");
    });
  };

  const handleScopeClear = () => {
    setInstanceDraft("");
    setStateDraft(DEFAULT_STATE_FILTER);
    setLaneDraft(DEFAULT_LANE_FILTER);
    setTargetDraft(DEFAULT_TARGET_FILTER);
    setApprovalWaitDraft(DEFAULT_APPROVAL_WAIT_FILTER);
    setErrorDraft(DEFAULT_ERROR_FILTER);
    setWindowDraft(DEFAULT_WINDOW_FILTER);
    updateSearchParams((next) => {
      next.delete("instanceId");
      next.delete("companyId");
      next.delete("state");
      next.delete("lane");
      next.delete("target");
      next.delete("approvalWait");
      next.delete("error");
      next.delete("window");
      next.delete("runId");
    });
  };

  const handleRunSelection = (runId: string) => {
    updateSearchParams((next) => {
      next.set("runId", runId);
    });
  };

  const handleScopeChoice = (nextInstanceId: string) => {
    setInstanceDraft(nextInstanceId);
    setStateDraft("all");
    updateSearchParams((next) => {
      next.set("instanceId", nextInstanceId);
      next.delete("companyId");
      next.delete("state");
      next.delete("lane");
      next.delete("target");
      next.delete("approvalWait");
      next.delete("error");
      next.delete("window");
      next.delete("runId");
    });
  };

  const handleReplaySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !instanceId) {
      return;
    }

    const normalizedReason = replayReason.trim();
    if (normalizedReason.length < 8) {
      setReplayState("error");
      setReplayError("Replay reason must be at least 8 characters so the audit trail stays meaningful.");
      return;
    }

    setReplayState("submitting");
    setReplayError("");
    setReplayResult(null);

    try {
      const payload = await replayExecutionRun(detail.run_id, {
        instanceId,
        companyId,
        reason: normalizedReason,
        idempotencyKey,
      });
      setReplayResult(payload.replay);
      setReplayState("success");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      setReplayState("error");
      setReplayError(describeReplayError(error));
    }
  };

  const handleOperatorAction = async (
    action: "pause" | "resume" | "interrupt" | "quarantine" | "restart" | "escalate",
  ) => {
    if (!detail || !instanceId) {
      return;
    }
    const normalizedReason = operatorReason.trim();
    if (normalizedReason.length < 4) {
      setOperatorActionState("error");
      setOperatorActionError("Operator reason must be at least 4 characters.");
      return;
    }

    setOperatorActionState("submitting");
    setOperatorActionError("");
    setOperatorActionResult(null);

    try {
      const payload = {
        instanceId,
        companyId,
        reason: normalizedReason,
        executionLane: operatorLane,
      };
      const response =
        action === "pause"
          ? await pauseExecutionRun(detail.run_id, payload)
          : action === "resume"
            ? await resumeExecutionRun(detail.run_id, payload)
            : action === "interrupt"
              ? await interruptExecutionRun(detail.run_id, payload)
              : action === "quarantine"
                ? await quarantineExecutionRun(detail.run_id, payload)
                : action === "restart"
                  ? await restartExecutionRun(detail.run_id, payload)
                  : await escalateExecutionRun(detail.run_id, {
                      ...payload,
                      executionLane: operatorLane.trim(),
                    });
      setOperatorActionResult(response.action);
      setOperatorActionState("success");
      if (response.action.run_id && response.action.run_id !== detail.run_id) {
        updateSearchParams((next) => {
          next.set("runId", response.action.run_id);
        });
      }
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      setOperatorActionState("error");
      setOperatorActionError(describeReplayError(error));
    }
  };

  const selectedSummary = runs.find((run) => run.run_id === selectedRunId) ?? null;
  const showReplayForm = Boolean(detail && access.canReplay && detail.replayable);
  const replayAuditHistoryPath = replayResult?.audit
    ? buildAuditHistoryPath({
        instanceId: replayResult.audit.instance_id ?? instanceId,
        companyId: replayResult.audit.company_id ?? companyId,
        window: "all",
        action: replayResult.audit.action,
        targetType: replayResult.audit.target_type,
        targetId: replayResult.audit.target_id ?? replayResult.run_id,
        status:
          replayResult.audit.status === "ok"
          || replayResult.audit.status === "warning"
          || replayResult.audit.status === "failed"
            ? replayResult.audit.status
            : null,
        eventId: replayResult.audit.event_id,
      })
    : null;

  // ── Session gates ─────────────────────────────────────
  if (!sessionReady) {
    return (
      <IncidentResponsePage
        eyebrow="Operations"
        title="Execution Run Review"
        description="Checking session role before exposing execution data."
        noIncidents
        noIncidentsConfig={{
          title: "Checking access",
          description: "Verifying session role for execution list/detail and replay access.",
        }}
      />
    );
  }

  if (!canReviewExecution) {
    return (
      <IncidentResponsePage
        eyebrow="Operations"
        title="Execution Run Review"
        description="Operator or admin access required."
        noIncidents
        noIncidentsConfig={{
          title: "Operator or admin required",
          description: "Viewer sessions cannot access execution list/detail APIs.",
        }}
      />
    );
  }

  // ── Derive attention items from run data ──────────────
  const runSummary = runs.length > 0 ? buildExecutionStatusSummary(runs) : null;

  const attentionItems: AttentionPayload[] = [];
  if (runSummary && runSummary.deadLetteredCount > 0) {
    attentionItems.push({
      key: "dead-lettered",
      level: "primary_blocker",
      title: `${runSummary.deadLetteredCount} dead-lettered run${runSummary.deadLetteredCount > 1 ? "s" : ""}`,
      description: "Runs that reached a terminal error state and cannot proceed. Review and determine replay or recovery path.",
    });
  }
  if (runSummary && runSummary.approvalWaitCount > 0) {
    attentionItems.push({
      key: "approval-waits",
      level: "warning",
      title: `${runSummary.approvalWaitCount} run${runSummary.approvalWaitCount > 1 ? "s" : ""} waiting on approval`,
      description: "Runs paused at an approval gate. Review pending approvals to unblock execution.",
    });
  }
  if (runSummary && runSummary.errorCount > 0) {
    attentionItems.push({
      key: "errors",
      level: "needs_action",
      title: `${runSummary.errorCount} run${runSummary.errorCount > 1 ? "s" : ""} with errors`,
    });
  }
  if (runSummary && runSummary.attentionCount === 0 && runs.length > 0) {
    attentionItems.push({
      key: "all-clear",
      level: "healthy",
      title: "All runs accounted for",
    });
  }

  const summaryItems: SummaryStripItem[] | undefined = runSummary
    ? [
        {
          key: "total",
          label: "Total runs",
          value: String(runSummary.totalRuns),
          tone: "neutral",
          status: "info",
        },
        ...(runSummary.deadLetteredCount > 0
          ? [{
              key: "dead-lettered" as const,
              label: "Dead-lettered" as const,
              value: String(runSummary.deadLetteredCount) as string,
              tone: "danger" as const,
              status: "blocked" as const,
            }]
          : []),
        ...(runSummary.approvalWaitCount > 0
          ? [{
              key: "approval-waits" as const,
              label: "Approval waits" as const,
              value: String(runSummary.approvalWaitCount) as string,
              tone: "warning" as const,
              status: "partial" as const,
            }]
          : []),
        ...(runSummary.errorCount > 0
          ? [{
              key: "errors" as const,
              label: "With errors" as const,
              value: String(runSummary.errorCount) as string,
              tone: "danger" as const,
              status: "blocked" as const,
            }]
          : []),
        ...(runSummary.replayableCount > 0
          ? [{
              key: "replayable" as const,
              label: "Replayable" as const,
              value: String(runSummary.replayableCount) as string,
              tone: "success" as const,
              status: "ready" as const,
            }]
          : []),
      ]
    : undefined;

  return (
    <IncidentResponsePage
      eyebrow="Operations"
      title="Execution Run Review"
      description="Execution truth, approval waits, dead-letter evidence, and replay admission."
      attentionItems={attentionItems}
      summaryItems={instanceId && summaryItems ? summaryItems : undefined}
      diagnostics={
        <div className="fg-stack">
          <p className="text-muted">Execution scope: {companyId || "not resolved"}</p>
          {runsError ? <p className="fg-danger">{runsError}</p> : null}
          {detailError ? <p className="fg-danger">{detailError}</p> : null}
        </div>
      }
      diagnosticsTitle="Execution diagnostics"
    >
      <ScopeFilterCard
        instanceId={instanceId}
        companyId={companyId}
        scopeOptionsState={scopeOptionsState}
        scopeOptions={scopeOptions}
        scopeOptionsError={scopeOptionsError}
        instanceDraft={instanceDraft}
        stateDraft={stateDraft}
        laneDraft={laneDraft}
        targetDraft={targetDraft}
        approvalWaitDraft={approvalWaitDraft}
        errorDraft={errorDraft}
        windowDraft={windowDraft}
        onInstanceDraftChange={setInstanceDraft}
        onStateDraftChange={setStateDraft}
        onLaneDraftChange={setLaneDraft}
        onTargetDraftChange={setTargetDraft}
        onApprovalWaitDraftChange={setApprovalWaitDraft}
        onErrorDraftChange={setErrorDraft}
        onWindowDraftChange={setWindowDraft}
        onScopeSubmit={handleScopeSubmit}
        onScopeClear={handleScopeClear}
        onScopeChoice={handleScopeChoice}
      />

      {!instanceId ? <MissingExecutionScopeCard /> : null}

      {instanceId ? (
        <ExecutionRunsSection
          instanceId={instanceId}
          companyId={companyId}
          stateFilter={stateFilter}
          laneFilter={laneFilter}
          targetFilter={targetFilter}
          approvalWaitFilter={approvalWaitFilter}
          errorFilter={errorFilter}
          windowFilter={windowFilter}
          runsState={runsState}
          runs={runs}
          runsError={runsError}
          selectedRunId={selectedRunId}
          selectedSummary={selectedSummary}
          detailState={detailState}
          detail={detail}
          detailError={detailError}
          access={access}
          showReplayForm={showReplayForm}
          replayReason={replayReason}
          idempotencyKey={idempotencyKey}
          replayState={replayState}
          replayError={replayError}
          replayResult={replayResult}
          replayAuditHistoryPath={replayAuditHistoryPath}
          operatorReason={operatorReason}
          operatorLane={operatorLane}
          operatorActionState={operatorActionState}
          operatorActionError={operatorActionError}
          operatorActionResult={operatorActionResult}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onScopeClear={handleScopeClear}
          onRunSelection={handleRunSelection}
          onReplayReasonChange={setReplayReason}
          onIdempotencyKeyChange={setIdempotencyKey}
          onReplaySubmit={handleReplaySubmit}
          onReplayConfirm={() => {}}
          onReplayCancel={() => {}}
          onOperatorReasonChange={setOperatorReason}
          onOperatorLaneChange={setOperatorLane}
          onOperatorAction={handleOperatorAction}
        />
      ) : null}
    </IncidentResponsePage>
  );
}
