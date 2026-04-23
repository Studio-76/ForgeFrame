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
} from "../../api/admin";
import { buildAuditHistoryPath } from "../../app/auditHistory";
import { normalizeExecutionCompanyId, normalizeExecutionInstanceId, normalizeExecutionState } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { PageIntro } from "../../components/PageIntro";
import {
  buildExecutionScopeOptions,
  DEFAULT_STATE_FILTER,
  describeReplayError,
  getExecutionAccess,
  type OperatorActionState,
  type ExecutionScopeOption,
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

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const stateFilter = normalizeExecutionState(searchParams.get("state")) ?? DEFAULT_STATE_FILTER;
  const selectedRunId = searchParams.get("runId")?.trim() ?? "";
  const canReviewExecution = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);

  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [stateDraft, setStateDraft] = useState(stateFilter);
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
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    setStateDraft(stateFilter);
  }, [stateFilter]);

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

    void fetchExecutionRuns({
      instanceId,
      companyId,
      state: stateFilter === "all" ? undefined : stateFilter,
      limit: 50,
    })
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
  }, [canReviewExecution, instanceId, companyId, stateFilter, refreshNonce]);

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
      next.delete("runId");
    });
  };

  const handleScopeClear = () => {
    setInstanceDraft("");
    setStateDraft(DEFAULT_STATE_FILTER);
    updateSearchParams((next) => {
      next.delete("instanceId");
      next.delete("companyId");
      next.delete("state");
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

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Execution Run Review"
          description="Instance-scoped execution truth and replay admission stay hidden until ForgeFrame confirms the current session role."
          question="Which operations surface should you open while execution access is still being checked?"
          links={[
            {
              label: "Errors & Activity",
              to: CONTROL_PLANE_ROUTES.logs,
              description: "Current alerts, error shape, and runtime activity while the execution route confirms access.",
            },
            {
              label: "Provider Health & Runs",
              to: CONTROL_PLANE_ROUTES.providerHealthRuns,
              description: "Provider readiness and run posture when the incident belongs to provider truth.",
            },
            {
              label: "Usage & Costs",
              to: CONTROL_PLANE_ROUTES.usage,
              description: "Traffic, client impact, and cost pressure while execution review remains gated.",
            },
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard and branch into the right operator workflow once access is known.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="ForgeFrame verifies the session role before it opens instance-scoped execution list/detail truth or replay admission."
        />
      </section>
    );
  }

  if (!canReviewExecution) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Execution Run Review"
          description="This route is reserved for operator and admin sessions because the shipped backend does not expose instance-scoped execution truth to viewers."
          question="Which read-safe operations surface should you use when execution review is outside your current permission envelope?"
          links={[
            {
              label: "Errors & Activity",
              to: CONTROL_PLANE_ROUTES.logs,
              description: "Inspect alerts, runtime failures, and shared activity evidence without opening instance-scoped execution APIs.",
            },
            {
              label: "Provider Health & Runs",
              to: CONTROL_PLANE_ROUTES.providerHealthRuns,
              description: "Review provider readiness and run posture on the viewer-safe operations surface.",
            },
            {
              label: "Usage & Costs",
              to: CONTROL_PLANE_ROUTES.usage,
              description: "Check traffic, cost, and client impact when execution review is unavailable to this session.",
            },
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard and open a route that matches the current permission envelope.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewer sessions can still inspect operational signals elsewhere, but ForgeFrame blocks instance-scoped execution list/detail APIs and replay on this route."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Execution Run Review"
        description="Inspect background execution truth, approval waits, dead-letter evidence, and replay admission without pretending the backend's explicit instance scope is optional."
        question="Which instance are you reviewing, and has another control-plane route already identified the run you need?"
        links={[
          {
            label: "Execution Review",
            to: CONTROL_PLANE_ROUTES.execution,
            description: "Instance-scoped list, detail, and replay workflow for execution runs.",
          },
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Governance framing for approvals that are broader than one execution run.",
          },
          {
            label: "Errors & Activity",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Cross-check runtime incidents and audit evidence before deciding whether the run needs replay.",
          },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Return to provider truth when the failure belongs to readiness or harness state instead of the execution worker path.",
          },
        ]} 
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note={`${access.summaryDetail} Instance scope stays explicit, and the route now starts from the real instance registry instead of inferred approval scope.`}
      />

      <ScopeFilterCard
        instanceId={instanceId}
        companyId={companyId}
        scopeOptionsState={scopeOptionsState}
        scopeOptions={scopeOptions}
        scopeOptionsError={scopeOptionsError}
        instanceDraft={instanceDraft}
        stateDraft={stateDraft}
        onInstanceDraftChange={setInstanceDraft}
        onStateDraftChange={setStateDraft}
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
          onRunSelection={handleRunSelection}
          onReplayReasonChange={setReplayReason}
          onIdempotencyKeyChange={setIdempotencyKey}
          onReplaySubmit={handleReplaySubmit}
          onOperatorReasonChange={setOperatorReason}
          onOperatorLaneChange={setOperatorLane}
          onOperatorAction={handleOperatorAction}
        />
      ) : null}
    </section>
  );
}
