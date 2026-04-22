import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AdminApiError,
  fetchApprovals,
  fetchExecutionRunDetail,
  fetchExecutionRuns,
  type ApprovalSummary,
  replayExecutionRun,
  type AdminSessionUser,
  type ExecutionReplayResult,
  type ExecutionRunDetail,
  type ExecutionRunSummary,
} from "../api/admin";
import { buildAuditHistoryPath } from "../app/auditHistory";
import { normalizeExecutionCompanyId, normalizeExecutionState } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
type ReplayState = "idle" | "submitting" | "success" | "error";
type BadgeTone = "success" | "warning" | "danger" | "neutral";
type ExecutionScopeOption = {
  companyId: string;
  approvalCount: number;
  openApprovalCount: number;
  latestOpenedAt: string;
  latestIssueId: string | null;
};
type ExecutionAccessState = {
  badgeLabel: string;
  badgeTone: BadgeTone;
  summaryDetail: string;
  canReplay: boolean;
  mutationTitle: string;
  mutationDetail: string;
};

const DEFAULT_STATE_FILTER = "dead_lettered";
const STATE_OPTIONS = [
  { value: "all", label: "All states" },
  { value: "dead_lettered", label: "Dead-lettered" },
  { value: "waiting_on_approval", label: "Waiting on approval" },
  { value: "retry_backoff", label: "Retry backoff" },
  { value: "failed", label: "Failed" },
  { value: "cancel_requested", label: "Cancel requested" },
  { value: "queued", label: "Queued" },
  { value: "executing", label: "Executing" },
] as const;

function buildExecutionScopeOptions(approvals: ApprovalSummary[]): ExecutionScopeOption[] {
  const scopeIndex = new Map<string, ExecutionScopeOption>();

  approvals.forEach((approval) => {
    if (approval.source_kind !== "execution_run") {
      return;
    }
    const companyId = normalizeExecutionCompanyId(approval.company_id);
    if (!companyId) {
      return;
    }

    const existing = scopeIndex.get(companyId);
    const nextLatestOpenedAt =
      !existing || approval.opened_at > existing.latestOpenedAt ? approval.opened_at : existing.latestOpenedAt;
    const nextLatestIssueId =
      !existing || approval.opened_at > existing.latestOpenedAt ? approval.issue_id ?? null : existing.latestIssueId;

    scopeIndex.set(companyId, {
      companyId,
      approvalCount: (existing?.approvalCount ?? 0) + 1,
      openApprovalCount: (existing?.openApprovalCount ?? 0) + (approval.status === "open" ? 1 : 0),
      latestOpenedAt: nextLatestOpenedAt,
      latestIssueId: nextLatestIssueId,
    });
  });

  return Array.from(scopeIndex.values()).sort((left, right) => {
    if (right.openApprovalCount !== left.openApprovalCount) {
      return right.openApprovalCount - left.openApprovalCount;
    }
    if (right.latestOpenedAt !== left.latestOpenedAt) {
      return right.latestOpenedAt.localeCompare(left.latestOpenedAt);
    }
    return left.companyId.localeCompare(right.companyId);
  });
}

function describeExecutionScopeOption(option: ExecutionScopeOption): string {
  const approvalSummary = option.openApprovalCount > 0
    ? `${option.openApprovalCount} open approval${option.openApprovalCount === 1 ? "" : "s"}`
    : `${option.approvalCount} approval-linked run${option.approvalCount === 1 ? "" : "s"}`;
  const issueSummary = option.latestIssueId ? `Latest issue ${option.latestIssueId}` : "No linked issue recorded";
  return `${approvalSummary} · ${issueSummary}`;
}

function getExecutionAccess(session: AdminSessionUser | null, sessionReady: boolean): ExecutionAccessState {
  if (!sessionReady) {
    return {
      badgeLabel: "Checking session",
      badgeTone: "neutral",
      summaryDetail: "ForgeGate is still confirming whether this session can admit replay or only inspect execution truth.",
      canReplay: false,
      mutationTitle: "Checking replay permissions",
      mutationDetail: "Replay remains blocked until the current session role and read-only posture are confirmed.",
    };
  }

  if (!session || session.role === "viewer") {
    return {
      badgeLabel: "Operator or admin required",
      badgeTone: "warning",
      summaryDetail: "Execution review stays closed until the current session is operator or admin because the backend does not expose company-scoped execution truth to viewers.",
      canReplay: false,
      mutationTitle: "Replay unavailable",
      mutationDetail: "Viewer sessions cannot open the execution route, and replay remains blocked until an operator or admin session is active.",
    };
  }

  if (session?.read_only) {
    return {
      badgeLabel: "Read-only execution review",
      badgeTone: "warning",
      summaryDetail: "Read-only sessions can inspect run detail and company-scoped truth here, but replay is blocked to match impersonation and other read-only backend guards.",
      canReplay: false,
      mutationTitle: "Replay blocked by read-only session",
      mutationDetail: "ForgeGate treats this session as inspect-only, even if the underlying role is operator or admin.",
    };
  }

  return {
    badgeLabel: "Replay enabled",
    badgeTone: "success",
    summaryDetail: "Standard operator and admin sessions can inspect list/detail state and admit replay when the selected run state allows it.",
    canReplay: true,
    mutationTitle: "Replay available for eligible runs",
    mutationDetail: "Replay still depends on explicit company scope and the selected run's current state. Conflicts are surfaced directly from the backend.",
  };
}

function getStateTone(state: string): BadgeTone {
  if (["succeeded", "completed", "published"].includes(state)) {
    return "success";
  }
  if (["dead_lettered", "failed", "timed_out", "cancelled", "dead"].includes(state)) {
    return "danger";
  }
  if (["waiting_on_approval", "retry_backoff", "cancel_requested"].includes(state)) {
    return "warning";
  }
  return "neutral";
}

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return typeof value === "string" && value ? value : fallback;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function countReplayableRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => run.replayable).length;
}

function countTerminalRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => Boolean(run.terminal_at)).length;
}

function countAttentionRuns(runs: ExecutionRunSummary[]): number {
  return runs.filter((run) => ["dead_lettered", "waiting_on_approval", "failed", "timed_out"].includes(run.state)).length;
}

function describeReplayError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.code === "run_transition_conflict") {
      return `${error.message} The selected run changed state before replay could be admitted.`;
    }
    if (error.code === "idempotency_fingerprint_mismatch") {
      return `${error.message} Reuse the same replay reason for that key or provide a new idempotency key.`;
    }
    if (error.code === "run_not_found") {
      return `${error.message} Verify that the selected run still exists inside the current company scope.`;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Replay failed.";
}

export function ExecutionPage() {
  const { session, sessionReady } = useAppSession();
  const canReviewExecution = sessionReady && session !== null && session.role !== "viewer";
  const access = getExecutionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const stateFilter = normalizeExecutionState(searchParams.get("state")) ?? DEFAULT_STATE_FILTER;
  const selectedRunId = searchParams.get("runId")?.trim() ?? "";

  const [companyDraft, setCompanyDraft] = useState(companyId);
  const [stateDraft, setStateDraft] = useState(stateFilter);
  const [scopeOptionsState, setScopeOptionsState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeOptionsError, setScopeOptionsError] = useState("");
  const [runsState, setRunsState] = useState<LoadState>(companyId ? "loading" : "idle");
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
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setCompanyDraft(companyId);
  }, [companyId]);

  useEffect(() => {
    setStateDraft(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    if (!canReviewExecution || companyId) {
      return;
    }

    let cancelled = false;
    setScopeOptionsState("loading");
    setScopeOptionsError("");

    void fetchApprovals("all")
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setScopeOptions(buildExecutionScopeOptions(payload.approvals));
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
  }, [canReviewExecution, companyId]);

  useEffect(() => {
    if (!canReviewExecution || !companyId) {
      setRunsState("idle");
      setRuns([]);
      setRunsError("");
      return;
    }

    let cancelled = false;
    setRunsState("loading");
    setRunsError("");

    void fetchExecutionRuns({
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
  }, [canReviewExecution, companyId, stateFilter, refreshNonce]);

  useEffect(() => {
    if (!canReviewExecution || !companyId || runsState !== "success") {
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
  }, [canReviewExecution, companyId, runs, runsState, searchParams, selectedRunId, setSearchParams]);

  useEffect(() => {
    if (!canReviewExecution || !companyId || !selectedRunId) {
      setDetailState("idle");
      setDetail(null);
      setDetailError("");
      return;
    }

    let cancelled = false;
    setDetailState("loading");
    setDetailError("");

    void fetchExecutionRunDetail(selectedRunId, { companyId })
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
  }, [canReviewExecution, companyId, selectedRunId, refreshNonce]);

  useEffect(() => {
    setReplayState("idle");
    setReplayError("");
    setReplayResult(null);
  }, [selectedRunId, companyId]);

  const updateSearchParams = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  const handleScopeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCompany = companyDraft.trim();
    const normalizedState = stateDraft || DEFAULT_STATE_FILTER;

    updateSearchParams((next) => {
      if (normalizedCompany) {
        next.set("companyId", normalizedCompany);
      } else {
        next.delete("companyId");
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
    setCompanyDraft("");
    setStateDraft(DEFAULT_STATE_FILTER);
    updateSearchParams((next) => {
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

  const handleScopeChoice = (nextCompanyId: string) => {
    setCompanyDraft(nextCompanyId);
    setStateDraft("all");
    updateSearchParams((next) => {
      next.set("companyId", nextCompanyId);
      next.set("state", "all");
      next.delete("runId");
    });
  };

  const handleReplaySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !companyId) {
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

  const selectedSummary = runs.find((run) => run.run_id === selectedRunId) ?? null;
  const showReplayForm = Boolean(detail && access.canReplay && detail.replayable);
  const replayAuditHistoryPath = replayResult?.audit
    ? buildAuditHistoryPath({
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
          description="Company-scoped execution truth and replay admission stay hidden until ForgeGate confirms the current session role."
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
          note="ForgeGate verifies the session role before it opens company-scoped execution list/detail truth or replay admission."
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
          description="This route is reserved for operator and admin sessions because the shipped backend does not expose company-scoped execution truth to viewers."
          question="Which read-safe operations surface should you use when execution review is outside your current permission envelope?"
          links={[
            {
              label: "Errors & Activity",
              to: CONTROL_PLANE_ROUTES.logs,
              description: "Inspect alerts, runtime failures, and shared activity evidence without opening company-scoped execution APIs.",
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
          note="Viewer sessions can still inspect operational signals elsewhere, but ForgeGate blocks company-scoped execution list/detail APIs and replay on this route."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Execution Run Review"
        description="Inspect background execution truth, approval waits, dead-letter evidence, and replay admission without pretending the backend's explicit company scope is optional."
        question="Which execution scope are you reviewing, and has another control-plane route already identified the run you need?"
        links={[
          {
            label: "Execution Review",
            to: CONTROL_PLANE_ROUTES.execution,
            description: "Company-scoped list, detail, and replay workflow for execution runs.",
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
        note={`${access.summaryDetail} Company scope stays explicit, but approval-backed scope choices and scoped deep links now provide the normal operator path into this route.`}
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and Filter</h3>
            <p className="fg-muted">Execution runs stay company-scoped in the backend. Choose a recent execution scope from shared governance evidence or enter an exact company ID when you need a scope that is not already surfaced elsewhere.</p>
          </div>
          <span className="fg-pill" data-tone={companyId ? "success" : "warning"}>
            {companyId ? `Scope: ${companyId}` : "Company scope required"}
          </span>
        </div>
        {!companyId ? (
          <div className="fg-stack fg-mt-md">
            <div className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>Quick scope choices</h4>
                  <p className="fg-muted">These company scopes come from execution approvals already visible in the shared control plane.</p>
                </div>
                <span className="fg-pill" data-tone="neutral">
                  Approval-backed discovery
                </span>
              </div>

              {scopeOptionsState === "loading" ? (
                <p className="fg-muted">Loading recent execution scopes from the shared approvals queue.</p>
              ) : null}

              {scopeOptionsState === "error" ? <p className="fg-danger">{scopeOptionsError}</p> : null}

              {scopeOptionsState === "success" && scopeOptions.length > 0 ? (
                <div className="fg-stack">
                  {scopeOptions.map((option) => (
                    <button
                      key={option.companyId}
                      type="button"
                      className="fg-data-row"
                      onClick={() => handleScopeChoice(option.companyId)}
                    >
                      <div className="fg-panel-heading fg-data-row-heading">
                        <div className="fg-page-header">
                          <span className="fg-code">{option.companyId}</span>
                          <strong>Open execution scope</strong>
                        </div>
                        <div className="fg-actions">
                          {option.openApprovalCount > 0 ? (
                            <span className="fg-pill" data-tone="warning">
                              {option.openApprovalCount} waiting
                            </span>
                          ) : (
                            <span className="fg-pill" data-tone="neutral">
                              {option.approvalCount} linked
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="fg-detail-grid">
                        <span className="fg-muted">{describeExecutionScopeOption(option)}</span>
                        <span className="fg-muted">Latest approval opened {formatTimestamp(option.latestOpenedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {scopeOptionsState === "success" && scopeOptions.length === 0 ? (
                <p className="fg-muted">No approval-linked execution scopes are visible right now. Use the exact company ID field below when the run exists outside the current governance queue.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <form className="fg-inline-form" onSubmit={handleScopeSubmit}>
          <label>
            Exact company ID
            <input
              aria-label="Execution company ID"
              name="companyId"
              placeholder="forgegate"
              value={companyDraft}
              onChange={(event) => setCompanyDraft(event.target.value)}
            />
          </label>
          <label>
            Run state
            <select aria-label="Execution run state filter" value={stateDraft} onChange={(event) => setStateDraft(event.target.value)}>
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="fg-actions fg-actions-end">
            <button type="submit">Load execution runs</button>
            <button type="button" onClick={handleScopeClear}>
              Clear scope
            </button>
          </div>
        </form>
        <p className="fg-note">Deep links keep `companyId`, `state`, and `runId` when another route already knows the execution scope you need.</p>
      </article>

      {!companyId ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Choose execution scope</h3>
              <p className="fg-muted">Execution review stays honest about explicit company scope, but the route no longer assumes operators must hand-type raw query params as the default entry path.</p>
            </div>
            <span className="fg-pill" data-tone="warning">
              Scope missing
            </span>
          </div>
          <ul className="fg-list">
            <li>Start with a quick scope choice above when shared approvals already expose the company that owns the run.</li>
            <li>Use the exact `companyId` field when the required run lives outside the approval-linked scope list.</li>
            <li>Scoped deep links from approvals or audit evidence can preserve `companyId`, `state`, and `runId` so the route lands on the relevant run review path.</li>
            <li>Replay remains blocked for read-only sessions even after scope is supplied.</li>
            <li>Approval metadata that is not tied to an execution run still lives on governance routes, not here.</li>
          </ul>
        </article>
      ) : null}

      {companyId ? (
        <>
          {runsState === "loading" ? (
            <article className="fg-card">
              <h3>Loading execution runs</h3>
              <p className="fg-muted">ForgeGate is fetching the company-scoped execution list before exposing a selected run.</p>
            </article>
          ) : null}

          {runsState === "error" ? (
            <article className="fg-card">
              <h3>Execution list failed</h3>
              <p className="fg-danger">{runsError}</p>
            </article>
          ) : null}

          {runsState === "success" ? (
            <>
              <div className="fg-grid fg-grid-compact">
                <article className="fg-kpi">
                  <span className="fg-muted">Runs loaded</span>
                  <strong className="fg-kpi-value">{runs.length}</strong>
                </article>
                <article className="fg-kpi">
                  <span className="fg-muted">Replayable</span>
                  <strong className="fg-kpi-value">{countReplayableRuns(runs)}</strong>
                </article>
                <article className="fg-kpi">
                  <span className="fg-muted">Terminal</span>
                  <strong className="fg-kpi-value">{countTerminalRuns(runs)}</strong>
                </article>
                <article className="fg-kpi">
                  <span className="fg-muted">Needs attention</span>
                  <strong className="fg-kpi-value">{countAttentionRuns(runs)}</strong>
                </article>
              </div>

              <div className="fg-grid">
                <article className="fg-card">
                  <div className="fg-panel-heading">
                    <div>
                      <h3>Run Queue</h3>
                      <p className="fg-muted">The list reflects only the current company scope and selected state filter. No cross-company fallback is implied.</p>
                    </div>
                    <span className="fg-pill" data-tone="neutral">
                      Filter: {stateFilter === "all" ? "all states" : stateFilter}
                    </span>
                  </div>

                  {runs.length === 0 ? (
                    <p className="fg-muted">No execution runs matched the current filter. That means the backend returned an empty company-scoped result, not that the workflow is hidden elsewhere.</p>
                  ) : (
                    <div className="fg-stack">
                      {runs.map((run) => {
                        const isCurrent = run.run_id === selectedRunId;
                        return (
                          <button
                            key={run.run_id}
                            type="button"
                            className={`fg-data-row${isCurrent ? " is-current" : ""}`}
                            onClick={() => handleRunSelection(run.run_id)}
                          >
                            <div className="fg-panel-heading fg-data-row-heading">
                              <div className="fg-page-header">
                                <span className="fg-code">{run.run_id}</span>
                                <strong>{run.run_kind}</strong>
                              </div>
                              <div className="fg-actions">
                                <span className="fg-pill" data-tone={getStateTone(run.state)}>
                                  {run.state}
                                </span>
                                {run.replayable ? (
                                  <span className="fg-pill" data-tone="warning">
                                    Replayable
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="fg-detail-grid">
                              <span className="fg-muted">
                                attempt {run.active_attempt_no} · issue {run.issue_id ?? "unlinked"} · status reason {run.status_reason ?? "not provided"}
                              </span>
                              <span className="fg-muted">
                                updated {formatTimestamp(run.updated_at)} · terminal {formatTimestamp(run.terminal_at, "not terminal")}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>

                <article className="fg-card">
                  <div className="fg-panel-heading">
                    <div>
                      <h3>Run Detail</h3>
                      <p className="fg-muted">Run detail is URL-addressable through `runId` and stays separate from the queue list so operators can share or return to a specific run review.</p>
                    </div>
                    {selectedSummary ? (
                      <span className="fg-pill" data-tone={getStateTone(selectedSummary.state)}>
                        {selectedSummary.state}
                      </span>
                    ) : null}
                  </div>

                  {detailState === "idle" ? <p className="fg-muted">Select a run from the queue to inspect attempts, commands, outbox state, and replay eligibility.</p> : null}
                  {detailState === "loading" ? <p className="fg-muted">Loading the selected run detail.</p> : null}
                  {detailState === "error" ? <p className="fg-danger">{detailError}</p> : null}

                  {detail ? (
                    <div className="fg-stack">
                      <div className="fg-card-grid">
                        <article className="fg-subcard">
                          <h4>Run Summary</h4>
                          <ul className="fg-list">
                            <li>Run ID: <span className="fg-code">{detail.run_id}</span></li>
                            <li>Company scope: <span className="fg-code">{companyId}</span></li>
                            <li>Run kind: {detail.run_kind}</li>
                            <li>Issue link: {detail.issue_id ?? "No issue linked"}</li>
                            <li>Created at: {formatTimestamp(detail.created_at)}</li>
                            <li>Updated at: {formatTimestamp(detail.updated_at)}</li>
                          </ul>
                        </article>
                        <article className="fg-subcard">
                          <h4>Current State</h4>
                          <ul className="fg-list">
                            <li>Run state: {detail.state}</li>
                            <li>Status reason: {detail.status_reason ?? "Not provided"}</li>
                            <li>Failure class: {detail.failure_class ?? "None"}</li>
                            <li>Next wakeup: {formatTimestamp(detail.next_wakeup_at)}</li>
                            <li>Terminal at: {formatTimestamp(detail.terminal_at)}</li>
                            <li>Replayable: {detail.replayable ? "yes" : "no"}</li>
                          </ul>
                        </article>
                        <article className="fg-subcard">
                          <h4>{access.mutationTitle}</h4>
                          <p className="fg-muted">{access.mutationDetail}</p>
                          {detail.current_attempt ? (
                            <ul className="fg-list">
                              <li>Current attempt: {detail.current_attempt.attempt_no}</li>
                              <li>Attempt state: {detail.current_attempt.attempt_state}</li>
                              <li>Last error: {detail.current_attempt.last_error_code ?? "None"}</li>
                            </ul>
                          ) : (
                            <p className="fg-muted">No active attempt is attached to this run snapshot.</p>
                          )}
                        </article>
                      </div>

                      {detail.result_summary ? (
                        <details>
                          <summary>Result summary payload</summary>
                          <pre>{formatJson(detail.result_summary)}</pre>
                        </details>
                      ) : (
                        <p className="fg-muted">No result summary was recorded for this run.</p>
                      )}

                      <article className="fg-subcard">
                        <div className="fg-panel-heading">
                          <div>
                            <h4>Replay Admission</h4>
                            <p className="fg-muted">Replay writes a new retry command and the admin audit event. It does not bypass company scope, permission checks, or the run-state machine.</p>
                          </div>
                          <span className="fg-pill" data-tone={showReplayForm ? "success" : "warning"}>
                            {showReplayForm ? "Replay ready" : "Replay unavailable"}
                          </span>
                        </div>

                        {showReplayForm ? (
                          <form className="fg-stack" onSubmit={handleReplaySubmit}>
                            <label>
                              Replay reason
                              <textarea
                                aria-label="Execution replay reason"
                                rows={4}
                                placeholder="Replay after the provider secret was rotated and verified."
                                value={replayReason}
                                onChange={(event) => setReplayReason(event.target.value)}
                              />
                            </label>
                            <label>
                              Idempotency key (optional)
                              <input
                                aria-label="Execution replay idempotency key"
                                placeholder="idem_execution_retry_1"
                                value={idempotencyKey}
                                onChange={(event) => setIdempotencyKey(event.target.value)}
                              />
                            </label>
                            <div className="fg-actions">
                              <button type="submit" disabled={replayState === "submitting"}>
                                {replayState === "submitting" ? "Submitting replay" : "Replay run"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <p className="fg-muted">
                            {!access.canReplay
                              ? access.mutationDetail
                              : "The selected run is not replayable in its current state. Inspect the run detail and queue state instead of assuming replay is always possible."}
                          </p>
                        )}

                        {replayState === "error" ? <p className="fg-danger">{replayError}</p> : null}
                        {replayResult ? (
                          <div className="fg-note">
                            <p>
                              Replay admitted for <span className="fg-code">{replayResult.run_id}</span>.
                            </p>
                            <ul className="fg-list">
                              <li>Run state: {replayResult.run_state}</li>
                              <li>Attempt ID: {replayResult.attempt_id ?? "No attempt returned"}</li>
                              <li>Command ID: {replayResult.command_id}</li>
                              <li>Outbox event: {replayResult.outbox_event ?? "None"}</li>
                              <li>Deduplicated: {replayResult.deduplicated ? "yes" : "no"}</li>
                              <li>Audit event: {replayResult.audit?.event_id ?? "Not returned"}</li>
                            </ul>
                            {replayAuditHistoryPath ? (
                              <p>
                                <Link to={replayAuditHistoryPath}>Open Audit History</Link>
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </article>

                      <div className="fg-card-grid">
                        <article className="fg-subcard">
                          <h4>Attempts</h4>
                          <div className="fg-stack">
                            {detail.attempts.map((attempt) => (
                              <div key={attempt.id} className="fg-outline-row">
                                <div className="fg-panel-heading fg-data-row-heading">
                                  <strong>Attempt {attempt.attempt_no}</strong>
                                  <span className="fg-pill" data-tone={getStateTone(attempt.attempt_state)}>
                                    {attempt.attempt_state}
                                  </span>
                                </div>
                                <ul className="fg-list">
                                  <li>Scheduled: {formatTimestamp(attempt.scheduled_at)}</li>
                                  <li>Started: {formatTimestamp(attempt.started_at)}</li>
                                  <li>Finished: {formatTimestamp(attempt.finished_at)}</li>
                                  <li>Retry count: {attempt.retry_count}</li>
                                  <li>Last error: {attempt.last_error_code ?? "None"}{attempt.last_error_detail ? ` · ${attempt.last_error_detail}` : ""}</li>
                                </ul>
                              </div>
                            ))}
                          </div>
                        </article>

                        <article className="fg-subcard">
                          <h4>Commands</h4>
                          <div className="fg-stack">
                            {detail.commands.map((command) => (
                              <details key={command.id} className="fg-outline-row">
                                <summary>
                                  {command.command_type} · {command.command_status} · {formatTimestamp(command.issued_at)}
                                </summary>
                                <ul className="fg-list">
                                  <li>Actor: {command.actor_type} · {command.actor_id}</li>
                                  <li>Accepted transition: {command.accepted_transition ?? "Not recorded"}</li>
                                  <li>Completed at: {formatTimestamp(command.completed_at)}</li>
                                  <li>Idempotency key: <span className="fg-code">{command.idempotency_key}</span></li>
                                </ul>
                                <pre>{formatJson(command.response_snapshot)}</pre>
                              </details>
                            ))}
                          </div>
                        </article>

                        <article className="fg-subcard">
                          <h4>Outbox</h4>
                          <div className="fg-stack">
                            {detail.outbox.map((entry) => (
                              <details key={entry.id} className="fg-outline-row">
                                <summary>
                                  {entry.event_type} · {entry.publish_state} · available {formatTimestamp(entry.available_at)}
                                </summary>
                                <ul className="fg-list">
                                  <li>Publish attempts: {entry.publish_attempts}</li>
                                  <li>Published at: {formatTimestamp(entry.published_at)}</li>
                                  <li>Dead-lettered at: {formatTimestamp(entry.dead_lettered_at)}</li>
                                  <li>Last publish error: {entry.last_publish_error ?? "None"}</li>
                                </ul>
                                <pre>{formatJson(entry.payload)}</pre>
                              </details>
                            ))}
                          </div>
                        </article>
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
