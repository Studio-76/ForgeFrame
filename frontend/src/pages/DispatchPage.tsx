import { startTransition, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AdminApiError, fetchExecutionDispatch, fetchInstances, reconcileExecutionLeases, type ExecutionDispatchSnapshot } from "../api/admin";
import {
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { buildExecutionReviewPath, normalizeExecutionCompanyId, normalizeExecutionInstanceId } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import {
  buildExecutionScopeOptions,
  describeExecutionScopeOption,
  getExecutionAccess,
  getStateTone,
  type ExecutionScopeOption,
  type LoadState,
} from "../features/execution/helpers";

export function DispatchPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const canReviewDispatch = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);
  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [scopeState, setScopeState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [dispatchState, setDispatchState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [snapshot, setSnapshot] = useState<ExecutionDispatchSnapshot | null>(null);
  const [dispatchError, setDispatchError] = useState("");
  const [reconcileState, setReconcileState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reconcileMessage, setReconcileMessage] = useState("");

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    if (!canReviewDispatch || instanceId) {
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
        setScopeError(error instanceof Error ? error.message : "Execution dispatch could not load active instances.");
        setScopeState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewDispatch, instanceId]);

  useEffect(() => {
    if (!canReviewDispatch || !instanceId) {
      setDispatchState("idle");
      setSnapshot(null);
      setDispatchError("");
      return;
    }

    let cancelled = false;
    setDispatchState("loading");
    setDispatchError("");

    void fetchExecutionDispatch({ instanceId, companyId })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSnapshot(payload.dispatch);
        setDispatchState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setSnapshot(null);
        setDispatchError(error instanceof Error ? error.message : "Dispatch truth could not be loaded.");
        setDispatchState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewDispatch, companyId, instanceId, reconcileState]);

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

  const canMutate = sessionCanMutateScopedOrAnyInstance(session, instanceId, "execution.operate");

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Dispatch"
        description="Inspect worker leases, outbox pressure, stalled attempts, and reconciliation instead of hiding execution dispatch behind a generic run list."
        question="Is the problem a blocked queue, a stuck worker lease, or dead-letter pressure on the dispatch fabric?"
        links={[
          { label: "Queues", to: CONTROL_PLANE_ROUTES.queues, description: "Lane-backed queue pressure and runnable backlog." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator controls for a specific run." },
          { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Cross-check dispatch incidents against operational evidence." },
        ]}
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note="Dispatch truth stays on the same instance scope as queues and execution review."
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Dispatch Scope</h3>
            <p className="fg-muted">Dispatch truth uses the same instance boundary as execution review and queues.</p>
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
              <button key={option.instanceId} type="button" className="fg-data-row" onClick={() => updateSearchParams(option.instanceId)}>
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
            <input aria-label="Dispatch instance ID" value={instanceDraft} onChange={(event) => setInstanceDraft(event.target.value)} />
          </label>
          <div className="fg-actions fg-actions-end">
            <button type="submit">Load dispatch</button>
            <button type="button" onClick={() => updateSearchParams("")}>Clear scope</button>
          </div>
        </form>
      </article>

      {dispatchState === "loading" ? (
        <article className="fg-card">
          <h3>Loading dispatch truth</h3>
          <p className="fg-muted">ForgeFrame is loading worker leases, outbox pressure, and stalled attempts.</p>
        </article>
      ) : null}

      {dispatchState === "error" ? (
        <article className="fg-card">
          <h3>Dispatch load failed</h3>
          <p className="fg-danger">{dispatchError}</p>
        </article>
      ) : null}

      {snapshot ? (
        <>
          <div className="fg-grid fg-grid-compact">
            <article className="fg-kpi">
              <span className="fg-muted">Leased attempts</span>
              <strong className="fg-kpi-value">{snapshot.leased_attempts.length}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Stalled attempts</span>
              <strong className="fg-kpi-value">{snapshot.stalled_attempts.length}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Paused runs</span>
              <strong className="fg-kpi-value">{snapshot.paused_runs}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Quarantined runs</span>
              <strong className="fg-kpi-value">{snapshot.quarantined_runs}</strong>
            </article>
          </div>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Lease Reconciliation</h3>
                <p className="fg-muted">Expired worker leases are not silently ignored. Reconcile them into explicit quarantined dispatch truth.</p>
              </div>
              <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>
                {canMutate ? "Mutations enabled" : "Read-only"}
              </span>
            </div>
            <div className="fg-actions">
              <button
                type="button"
                disabled={!canMutate || reconcileState === "submitting"}
                onClick={() => {
                  setReconcileState("submitting");
                  setReconcileMessage("");
                  void reconcileExecutionLeases({ instanceId, companyId })
                    .then((payload) => {
                      setReconcileState("success");
                      setReconcileMessage(`Reconciled ${payload.reconciled.length} expired lease(s).`);
                    })
                    .catch((error: unknown) => {
                      const message =
                        error instanceof AdminApiError
                          ? error.message
                          : error instanceof Error
                            ? error.message
                            : "Lease reconciliation failed.";
                      setReconcileState("error");
                      setReconcileMessage(message);
                    });
                }}
              >
                {reconcileState === "submitting" ? "Reconciling leases" : "Reconcile expired leases"}
              </button>
            </div>
            {reconcileMessage ? <p className={reconcileState === "error" ? "fg-danger" : "fg-note"}>{reconcileMessage}</p> : null}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Outbox Pressure</h3>
                <p className="fg-muted">Pending and dead publish states come from the real outbox table, not inferred worker logs.</p>
              </div>
            </div>
            <div className="fg-grid fg-grid-compact">
              {Object.entries(snapshot.outbox_counts).map(([state, count]) => (
                <article key={state} className="fg-kpi">
                  <span className="fg-muted">{state}</span>
                  <strong className="fg-kpi-value">{count}</strong>
                </article>
              ))}
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Worker Leases</h3>
                <p className="fg-muted">Each row is grounded in persisted worker lease data on the current attempt.</p>
              </div>
            </div>
            {snapshot.workers.length === 0 ? (
              <p className="fg-muted">No active workers are currently holding leases.</p>
            ) : (
              <div className="fg-stack">
                {snapshot.workers.map((worker) => (
                  <div key={worker.worker_key} className="fg-outline-row">
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <strong>{worker.worker_key}</strong>
                        <span className="fg-pill" data-tone={getStateTone(worker.worker_state)}>{worker.worker_state}</span>
                      </div>
                      <span className="fg-pill" data-tone="neutral">{worker.active_attempts} active</span>
                    </div>
                    <ul className="fg-list">
                      <li>Instance: {worker.instance_id}</li>
                      <li>Execution lane: {worker.execution_lane}</li>
                      <li>Leased runs: {worker.leased_runs.join(", ")}</li>
                      <li>Current run: {worker.current_run_id ?? "none"}</li>
                      <li>Current attempt: {worker.current_attempt_id ?? "none"}</li>
                      <li>Oldest lease expiry: {worker.oldest_lease_expires_at ?? "not recorded"}</li>
                      <li>Heartbeat expires: {worker.heartbeat_expires_at ?? "not recorded"}</li>
                      <li>Last heartbeat: {worker.last_heartbeat_at ?? "not recorded"}</li>
                      <li>Last claim: {worker.last_claimed_at ?? "not recorded"}</li>
                      <li>Last completion: {worker.last_completed_at ?? "not recorded"}</li>
                      <li>Last error: {worker.last_error_code ? `${worker.last_error_code} · ${worker.last_error_detail ?? "no detail"}` : "none"}</li>
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Leased Attempts</h3>
                <p className="fg-muted">The dispatch surface shows current in-flight lease truth and flags stalled rows separately.</p>
              </div>
            </div>
            {snapshot.leased_attempts.length === 0 ? (
              <p className="fg-muted">No leased attempts are active for the current scope.</p>
            ) : (
              <div className="fg-stack">
                {snapshot.leased_attempts.map((attempt) => (
                  <div key={attempt.attempt_id} className="fg-outline-row">
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <span className="fg-code">{attempt.attempt_id}</span>
                        <strong>{attempt.run_kind}</strong>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone={getStateTone(attempt.operator_state)}>{attempt.operator_state}</span>
                        <span className="fg-pill" data-tone="neutral">{attempt.execution_lane}</span>
                      </div>
                    </div>
                    <ul className="fg-list">
                      <li>Run ID: {attempt.run_id}</li>
                      <li>Lease status: {attempt.lease_status} · worker {attempt.worker_key ?? "unassigned"}</li>
                      <li>Lease expires: {attempt.lease_expires_at ?? "not recorded"}</li>
                      <li>Last heartbeat: {attempt.last_heartbeat_at ?? "not recorded"}</li>
                      <li>Status reason: {attempt.status_reason ?? "not provided"}</li>
                    </ul>
                    <p>
                      <Link to={buildExecutionReviewPath({ instanceId, companyId, runId: attempt.run_id })}>Open execution review</Link>
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
