import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchExecutionQueues, type ExecutionQueueLaneSummary, type ExecutionQueueRunView } from "../api/domain/execution";
import { fetchInstances } from "../api/domain/instances";
import { buildExecutionReviewPath, normalizeExecutionCompanyId, normalizeExecutionInstanceId } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { sessionHasScopedOrAnyInstancePermission } from "../app/adminAccess";
import { PageIntro } from "../components/PageIntro";
import {
  buildExecutionScopeOptions,
  describeExecutionScopeOption,
  getExecutionAccess,
  getStateTone,
  LANE_OPTIONS,
  type ExecutionScopeOption,
  type LoadState,
} from "../features/execution/helpers";

const QUEUE_STATE_OPTIONS = [
  { value: "all", label: "All states" },
  { value: "admitted", label: "Runnable" },
  { value: "waiting_external", label: "Running" },
  { value: "leased", label: "Leased" },
  { value: "paused", label: "Paused" },
  { value: "quarantined", label: "Quarantined" },
  { value: "waiting_on_approval", label: "Waiting on approval" },
  { value: "retry_scheduled", label: "Retry scheduled" },
  { value: "cancel_requested", label: "Cancel requested" },
  { value: "dead_lettered", label: "Dead-lettered" },
] as const;

const QUEUE_AGE_OPTIONS = [
  { value: "all", label: "Any age" },
  { value: "1h", label: "Older than 1 hour" },
  { value: "6h", label: "Older than 6 hours" },
  { value: "24h", label: "Older than 24 hours" },
  { value: "72h", label: "Older than 72 hours" },
  { value: "7d", label: "Older than 7 days" },
] as const;

function formatAgeSeconds(value: number | null | undefined, fallback = "Not waiting"): string {
  if (value === null || value === undefined || value <= 0) {
    return fallback;
  }
  if (value < 60) {
    return `${value}s`;
  }
  if (value < 3600) {
    return `${Math.floor(value / 60)}m`;
  }
  if (value < 86400) {
    return `${Math.floor(value / 3600)}h`;
  }
  return `${Math.floor(value / 86400)}d`;
}

function describeLaneSignal(lane: ExecutionQueueLaneSummary): { label: string; detail: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (lane.total_runs === 0) {
    return {
      label: "Clear",
      detail: "No backlog is waiting on this lane.",
      tone: "success",
    };
  }
  if (lane.runnable_runs > 0 && lane.running_runs === 0) {
    return {
      label: "Capacity starved",
      detail: "Runnable work exists but nothing is actively running on this lane.",
      tone: "danger",
    };
  }
  if ((lane.longest_wait_seconds ?? 0) >= 900) {
    return {
      label: "Fairness risk",
      detail: "The oldest queued work on this lane has been waiting long enough to signal queue aging.",
      tone: "warning",
    };
  }
  if (lane.quarantined_runs > 0) {
    return {
      label: "Incident pressure",
      detail: "Quarantined runs are accumulating on this lane.",
      tone: "warning",
    };
  }
  if (lane.paused_runs > 0 || lane.waiting_on_approval_runs > 0) {
    return {
      label: "Operator-held",
      detail: "The lane is blocked more by human gates than by worker capacity.",
      tone: "neutral",
    };
  }
  return {
    label: "Healthy throughput",
    detail: "The lane has backlog, but runnable work is actively moving.",
    tone: "success",
  };
}

function describeRunTarget(run: ExecutionQueueRunView): string {
  if (run.selected_target_key?.trim()) {
    return run.selected_target_key.trim();
  }
  if (run.issue_id?.trim()) {
    return `Issue ${run.issue_id.trim()}`;
  }
  if (run.workspace_id?.trim()) {
    return `Workspace ${run.workspace_id.trim()}`;
  }
  return "Target not recorded";
}

export function QueuesPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const laneFilter = searchParams.get("lane")?.trim() ?? "";
  const stateFilter = searchParams.get("state")?.trim() || "all";
  const targetFilter = searchParams.get("target")?.trim() ?? "";
  const ageFilter = searchParams.get("age")?.trim() || "all";
  const canReviewQueues = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);

  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [laneDraft, setLaneDraft] = useState(laneFilter);
  const [stateDraft, setStateDraft] = useState(stateFilter);
  const [targetDraft, setTargetDraft] = useState(targetFilter);
  const [ageDraft, setAgeDraft] = useState(ageFilter);
  const [scopeState, setScopeState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [queueState, setQueueState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [laneSummaries, setLaneSummaries] = useState<ExecutionQueueLaneSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionQueueRunView[]>([]);
  const [queueError, setQueueError] = useState("");

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    setLaneDraft(laneFilter);
  }, [laneFilter]);

  useEffect(() => {
    setStateDraft(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    setTargetDraft(targetFilter);
  }, [targetFilter]);

  useEffect(() => {
    setAgeDraft(ageFilter);
  }, [ageFilter]);

  useEffect(() => {
    if (!canReviewQueues || instanceId) {
      return;
    }

    let cancelled = false;
    setScopeState("loading");
    setScopeError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setScopeOptions(buildExecutionScopeOptions(payload.instances));
        setScopeState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setScopeOptions([]);
        setScopeError(error instanceof Error ? error.message : "Execution queues could not load active instances.");
        setScopeState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewQueues, instanceId]);

  useEffect(() => {
    if (!canReviewQueues || !instanceId) {
      setQueueState("idle");
      setLaneSummaries([]);
      setRuns([]);
      setQueueError("");
      return;
    }

    let cancelled = false;
    setQueueState("loading");
    setQueueError("");

    const query = {
      instanceId,
      companyId,
      limit: 100,
      ...(laneFilter ? { executionLane: laneFilter } : {}),
      ...(stateFilter !== "all" ? { state: stateFilter } : {}),
      ...(targetFilter ? { target: targetFilter } : {}),
      ...(ageFilter !== "all" ? { age: ageFilter } : {}),
    };

    void fetchExecutionQueues(query)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setLaneSummaries(payload.lanes);
        setRuns(payload.runs);
        setQueueState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLaneSummaries([]);
        setRuns([]);
        setQueueError(error instanceof Error ? error.message : "Queue truth could not be loaded.");
        setQueueState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewQueues, companyId, instanceId, laneFilter, stateFilter, targetFilter, ageFilter]);

  const updateSearchParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next);
    });
  };

  const handleScopeChoice = (nextInstanceId: string) => {
    updateSearchParams((next) => {
      next.set("instanceId", nextInstanceId);
      next.delete("companyId");
      next.delete("lane");
      next.delete("state");
      next.delete("target");
      next.delete("age");
    });
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSearchParams((next) => {
      const normalizedInstance = instanceDraft.trim();
      const normalizedLane = laneDraft.trim();
      const normalizedState = stateDraft.trim();
      const normalizedTarget = targetDraft.trim();
      const normalizedAge = ageDraft.trim();

      if (normalizedInstance) {
        next.set("instanceId", normalizedInstance);
      } else {
        next.delete("instanceId");
      }
      if (normalizedLane) {
        next.set("lane", normalizedLane);
      } else {
        next.delete("lane");
      }
      if (normalizedState && normalizedState !== "all") {
        next.set("state", normalizedState);
      } else {
        next.delete("state");
      }
      if (normalizedTarget) {
        next.set("target", normalizedTarget);
      } else {
        next.delete("target");
      }
      if (normalizedAge && normalizedAge !== "all") {
        next.set("age", normalizedAge);
      } else {
        next.delete("age");
      }
    });
  };

  const handleFilterClear = () => {
    setInstanceDraft("");
    setLaneDraft("");
    setStateDraft("all");
    setTargetDraft("");
    setAgeDraft("all");
    updateSearchParams((next) => {
      next.delete("instanceId");
      next.delete("companyId");
      next.delete("lane");
      next.delete("state");
      next.delete("target");
      next.delete("age");
    });
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Queues"
          description="ForgeFrame is still checking the current session before it opens lane-backed queue truth."
          question="Which execution surface should you keep open while queue access is being resolved?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator actions on the scoped execution surface." },
            { label: "Dispatch", to: CONTROL_PLANE_ROUTES.dispatch, description: "Worker leases and outbox pressure once access is confirmed." },
            { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Operational evidence while queue access stays gated." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Queue truth stays instance-scoped and operator-facing."
        />
      </section>
    );
  }

  if (!canReviewQueues) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Queues"
          description="Queue truth is reserved for operator and admin sessions because the backend does not expose execution orchestration to viewers."
          question="Which read-safe surface should you use instead?"
          links={[
            { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Shared operational evidence without queue mutation or queue truth." },
            { label: "Usage & Costs", to: CONTROL_PLANE_ROUTES.usage, description: "Traffic and cost pressure while queue review stays blocked." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and choose a viewer-safe route." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewer sessions cannot open queue lane truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Queues"
        description="Inspect lane-backed queue pressure, fairness drift, worker demand, and blocked backlog without turning queue review into a second run-control page."
        question="Which instance and lane own the backlog you are trying to explain?"
        links={[
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator controls for a selected execution run." },
          { label: "Dispatch", to: CONTROL_PLANE_ROUTES.dispatch, description: "Worker lease and outbox posture for the same execution fabric." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Approval backlog when runs are waiting on governance instead of queue capacity." },
          { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Operational evidence next to queue truth." },
        ]}
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note="Queues explains lane and backlog truth. Full run mutation still lives on Execution Review."
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Queue scope and filters</h3>
            <p className="fg-muted">Queues stays lane-first, but all backlog truth is still anchored to a real ForgeFrame instance boundary.</p>
          </div>
          <span className="fg-pill" data-tone={instanceId ? "success" : "warning"}>
            {instanceId ? `Instance: ${instanceId}` : "Instance scope required"}
          </span>
        </div>

        {!instanceId ? (
          <div className="fg-stack">
            {scopeState === "loading" ? <p className="fg-muted">Loading active instances from the registry.</p> : null}
            {scopeState === "error" ? <p className="fg-danger">{scopeError}</p> : null}
            {scopeState === "success" && scopeOptions.length === 0 ? <p className="fg-muted">No active instances are available for queue review.</p> : null}
            {scopeOptions.map((option) => (
              <button
                key={option.instanceId}
                type="button"
                className="fg-data-row"
                onClick={() => handleScopeChoice(option.instanceId)}
              >
                <div className="fg-panel-heading fg-data-row-heading">
                  <div className="fg-page-header">
                    <span className="fg-code">{option.instanceId}</span>
                    <strong>{option.displayName}</strong>
                  </div>
                  <span className="fg-pill" data-tone="neutral">{option.status}</span>
                </div>
                <span className="fg-muted">{describeExecutionScopeOption(option)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <form className="fg-stack" onSubmit={handleFilterSubmit}>
          <div className="fg-inline-form">
            <label>
              Exact instance ID
              <input
                aria-label="Queue instance ID"
                value={instanceDraft}
                onChange={(event) => setInstanceDraft(event.target.value)}
              />
            </label>
            <label>
              Lane
              <select aria-label="Queue lane filter" value={laneDraft} onChange={(event) => setLaneDraft(event.target.value)}>
                {LANE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.value === "" ? "All lanes" : option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              State
              <select aria-label="Queue state filter" value={stateDraft} onChange={(event) => setStateDraft(event.target.value)}>
                {QUEUE_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="fg-inline-form">
            <label>
              Target or issue
              <input
                aria-label="Queue target filter"
                placeholder="openai_api::gpt-4.1-mini"
                value={targetDraft}
                onChange={(event) => setTargetDraft(event.target.value)}
              />
            </label>
            <label>
              Age
              <select aria-label="Queue age filter" value={ageDraft} onChange={(event) => setAgeDraft(event.target.value)}>
                {QUEUE_AGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="fg-actions fg-actions-end">
              <button type="submit">Load queues</button>
              <button type="button" onClick={handleFilterClear}>Clear filters</button>
            </div>
          </div>
        </form>
      </article>

      {queueState === "loading" ? (
        <article className="fg-card">
          <h3>Loading queue truth</h3>
          <p className="fg-muted">ForgeFrame is loading lane summaries and backlog explanations.</p>
        </article>
      ) : null}

      {queueState === "error" ? (
        <article className="fg-card">
          <h3>Queue load failed</h3>
          <p className="fg-danger">{queueError}</p>
        </article>
      ) : null}

      {queueState === "success" ? (
        <>
          <div className="fg-grid fg-grid-compact">
            {laneSummaries.map((lane) => {
              const signal = describeLaneSignal(lane);
              return (
                <article key={lane.execution_lane} className="fg-card">
                  <div className="fg-panel-heading">
                    <div>
                      <h3>{lane.display_name}</h3>
                      <p className="fg-muted">{signal.detail}</p>
                    </div>
                    <span className="fg-pill" data-tone={signal.tone}>{signal.label}</span>
                  </div>
                  <div className="fg-detail-grid">
                    <span>Queue length: {lane.total_runs}</span>
                    <span>Runnable: {lane.runnable_runs}</span>
                    <span>Running: {lane.running_runs}</span>
                    <span>Paused: {lane.paused_runs}</span>
                    <span>Quarantined: {lane.quarantined_runs}</span>
                    <span>Oldest age: {formatAgeSeconds(lane.longest_wait_seconds, "No queued work")}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Backlog table</h3>
                <p className="fg-muted">Each queue row explains why the work is waiting, which lane owns it, and which compact action is allowed next.</p>
              </div>
              <span className="fg-pill" data-tone={runs.length === 0 ? "success" : "neutral"}>
                {runs.length === 0 ? "no backlog" : `${runs.length} rows`}
              </span>
            </div>

            {runs.length === 0 ? (
              <div className="fg-note">
                <p><strong>no backlog</strong></p>
                <p>The selected scope has no waiting queue entries. That is a healthy outcome, not a rendering gap.</p>
              </div>
            ) : (
              <div className="fg-table-wrap">
                <table className="fg-table">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Why waiting</th>
                      <th>State</th>
                      <th>Lane</th>
                      <th>Target</th>
                      <th>Age</th>
                      <th>Next allowed action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const executionLink = buildExecutionReviewPath({
                        instanceId,
                        companyId,
                        state: run.state,
                        runId: run.run_id,
                      });
                      return (
                        <tr key={run.run_id}>
                          <td>
                            <div className="fg-stack">
                              <span className="fg-code">{run.run_id}</span>
                              <Link className="fg-nav-link" to={executionLink}>Open execution review</Link>
                            </div>
                          </td>
                          <td>
                            <strong>{run.wait_reason}</strong>
                            <div className="fg-muted">{run.status_reason ?? "No additional blocker detail recorded."}</div>
                          </td>
                          <td>
                            <span className="fg-pill" data-tone={getStateTone(run.operator_state)}>{run.operator_state}</span>
                            <div className="fg-muted">raw {run.state}</div>
                          </td>
                          <td>{run.execution_lane}</td>
                          <td>{describeRunTarget(run)}</td>
                          <td>{formatAgeSeconds(run.wait_age_seconds)}</td>
                          <td>
                            <strong>{run.next_allowed_action}</strong>
                            {run.current_approval_id ? (
                              <div className="fg-muted">Approval wait: {run.current_approval_id}</div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
