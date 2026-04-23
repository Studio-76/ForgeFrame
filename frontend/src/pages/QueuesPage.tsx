import { startTransition, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchExecutionQueues, fetchInstances, type ExecutionQueueLaneSummary, type ExecutionQueueRunView } from "../api/admin";
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
  type ExecutionScopeOption,
  type LoadState,
} from "../features/execution/helpers";

export function QueuesPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const canReviewQueues = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);

  const [instanceDraft, setInstanceDraft] = useState(instanceId);
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

    void fetchExecutionQueues({ instanceId, companyId, limit: 100 })
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
  }, [canReviewQueues, companyId, instanceId]);

  const updateSearchParams = (nextInstanceId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      next.set("instanceId", nextInstanceId);
    } else {
      next.delete("instanceId");
    }
    startTransition(() => {
      setSearchParams(next);
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
        description="Inspect lane-backed queue pressure, runnable backlog, pauses, and quarantine without pretending the execution fabric is a single undifferentiated list."
        question="Which instance owns the queue pressure you are investigating?"
        links={[
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator controls for a selected execution run." },
          { label: "Dispatch", to: CONTROL_PLANE_ROUTES.dispatch, description: "Worker lease and outbox posture for the same execution fabric." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Approval backlog when runs are waiting on governance instead of queue capacity." },
          { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Operational evidence next to queue truth." },
        ]}
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note="Queue lanes are persisted execution truth, not a cosmetic grouping of the run list."
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Queue Scope</h3>
            <p className="fg-muted">Queue truth is keyed by real instance scope before ForgeFrame resolves the underlying company execution fabric.</p>
          </div>
          <span className="fg-pill" data-tone={instanceId ? "success" : "warning"}>
            {instanceId ? `Instance: ${instanceId}` : "Instance scope required"}
          </span>
        </div>

        {!instanceId ? (
          <div className="fg-stack">
            {scopeState === "loading" ? <p className="fg-muted">Loading active instances from the registry.</p> : null}
            {scopeState === "error" ? <p className="fg-danger">{scopeError}</p> : null}
            {scopeOptions.map((option) => (
              <button
                key={option.instanceId}
                type="button"
                className="fg-data-row"
                onClick={() => updateSearchParams(option.instanceId)}
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

        <form
          className="fg-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            updateSearchParams(instanceDraft.trim());
          }}
        >
          <label>
            Exact instance ID
            <input
              aria-label="Queue instance ID"
              value={instanceDraft}
              onChange={(event) => setInstanceDraft(event.target.value)}
            />
          </label>
          <div className="fg-actions fg-actions-end">
            <button type="submit">Load queues</button>
            <button type="button" onClick={() => updateSearchParams("")}>Clear scope</button>
          </div>
        </form>
      </article>

      {queueState === "loading" ? (
        <article className="fg-card">
          <h3>Loading queue truth</h3>
          <p className="fg-muted">ForgeFrame is loading lane counts and runnable backlog.</p>
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
            {laneSummaries.map((lane) => (
              <article key={lane.execution_lane} className="fg-kpi">
                <span className="fg-muted">{lane.display_name}</span>
                <strong className="fg-kpi-value">{lane.total_runs}</strong>
                <span className="fg-muted">
                  runnable {lane.runnable_runs} · paused {lane.paused_runs} · quarantined {lane.quarantined_runs}
                </span>
              </article>
            ))}
          </div>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Queue Backlog</h3>
                <p className="fg-muted">Runs are grouped by persisted execution lane and operator state, not inferred from UI-only badges.</p>
              </div>
              <span className="fg-pill" data-tone="neutral">{runs.length} runs</span>
            </div>

            {runs.length === 0 ? (
              <p className="fg-muted">No queued execution runs were returned for the current instance scope.</p>
            ) : (
              <div className="fg-stack">
                {runs.map((run) => (
                  <div key={run.run_id} className="fg-outline-row">
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <span className="fg-code">{run.run_id}</span>
                        <strong>{run.run_kind}</strong>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone={getStateTone(run.operator_state)}>{run.operator_state}</span>
                        <span className="fg-pill" data-tone="neutral">{run.execution_lane}</span>
                      </div>
                    </div>
                    <ul className="fg-list">
                      <li>Raw state: {run.state}</li>
                      <li>Attempt state: {run.attempt_state ?? "not loaded"} · lease {run.lease_status ?? "not leased"}</li>
                      <li>Next wakeup: {run.next_wakeup_at ?? "not scheduled"}</li>
                      <li>Status reason: {run.status_reason ?? "not provided"}</li>
                    </ul>
                    <p>
                      <Link to={buildExecutionReviewPath({ instanceId, companyId, runId: run.run_id })}>Open execution review</Link>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
