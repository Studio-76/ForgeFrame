import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AdminApiError } from "../api/admin";
import {
  fetchExecutionDispatch,
  reconcileExecutionLeases,
  type ExecutionDispatchAttemptView,
  type ExecutionDispatchSnapshot,
  type ExecutionDispatchWorkerView,
  type ExecutionLeaseReconcileResult,
} from "../api/domain/execution";
import { fetchInstances } from "../api/domain/instances";
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

const UTC_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type DispatchRiskTone = "success" | "warning" | "danger" | "neutral";
type DispatchRisk = {
  label: string;
  tone: DispatchRiskTone;
  detail: string;
};

function parseUtcTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  const parsed = parseUtcTimestamp(value);
  if (parsed === null) {
    return fallback;
  }
  return UTC_DATE_TIME.format(new Date(parsed));
}

function formatAgeSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not available";
  }
  const absolute = Math.abs(value);
  if (absolute < 60) {
    return `${absolute}s`;
  }
  if (absolute < 3600) {
    return `${Math.floor(absolute / 60)}m`;
  }
  if (absolute < 86400) {
    return `${Math.floor(absolute / 3600)}h`;
  }
  return `${Math.floor(absolute / 86400)}d`;
}

function formatLeaseWindow(
  target: string | null | undefined,
  options: { now: number; futureLabel: string; pastLabel: string },
): string {
  const parsed = parseUtcTimestamp(target);
  if (parsed === null) {
    return "Not recorded";
  }
  const deltaSeconds = Math.floor((parsed - options.now) / 1000);
  if (deltaSeconds >= 0) {
    return `${options.futureLabel} ${formatAgeSeconds(deltaSeconds)}`;
  }
  return `${options.pastLabel} ${formatAgeSeconds(deltaSeconds)} ago`;
}

function describeDispatchTarget(item: {
  selected_target_key?: string | null;
  issue_id?: string | null;
  workspace_id?: string | null;
}): string {
  if (item.selected_target_key?.trim()) {
    return item.selected_target_key.trim();
  }
  if (item.issue_id?.trim()) {
    return `Issue ${item.issue_id.trim()}`;
  }
  if (item.workspace_id?.trim()) {
    return `Workspace ${item.workspace_id.trim()}`;
  }
  return "Target not recorded";
}

function describeAttemptLeaseRisk(attempt: ExecutionDispatchAttemptView, now: number): DispatchRisk {
  const leaseExpiresAt = parseUtcTimestamp(attempt.lease_expires_at);
  const lastHeartbeatAt = parseUtcTimestamp(attempt.last_heartbeat_at);
  if (leaseExpiresAt !== null && leaseExpiresAt <= now) {
    return {
      label: "Expired lease",
      tone: "danger",
      detail: "The attempt still reports a lease even though the lease deadline has already passed.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt - now <= 60_000) {
    return {
      label: "Expiring soon",
      tone: "warning",
      detail: "This lease is within one minute of expiry and should renew or finish immediately.",
    };
  }
  if (lastHeartbeatAt !== null && now - lastHeartbeatAt >= 120_000) {
    return {
      label: "Renewal lag",
      tone: "warning",
      detail: "The worker has not renewed this lease for more than two minutes.",
    };
  }
  if (attempt.lease_status !== "leased") {
    return {
      label: "Lease mismatch",
      tone: "warning",
      detail: "The attempt appears on the dispatch surface without a healthy active lease.",
    };
  }
  return {
    label: "Healthy lease",
    tone: "success",
    detail: "Lease expiry and recent heartbeats are consistent with an active worker.",
  };
}

function describeWorkerLeaseRisk(worker: ExecutionDispatchWorkerView, now: number): DispatchRisk {
  const heartbeatExpiresAt = parseUtcTimestamp(worker.heartbeat_expires_at);
  const leaseExpiresAt = parseUtcTimestamp(worker.oldest_lease_expires_at);
  const lastHeartbeatAt = parseUtcTimestamp(worker.last_heartbeat_at);
  if (worker.worker_state === "stale" || (heartbeatExpiresAt !== null && heartbeatExpiresAt <= now)) {
    return {
      label: "Stale worker",
      tone: "danger",
      detail: "Worker heartbeats have expired while dispatch still expects this worker to exist.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt <= now) {
    return {
      label: "Expired lease",
      tone: "danger",
      detail: "At least one lease on this worker has already expired and now needs reconciliation.",
    };
  }
  if (leaseExpiresAt !== null && leaseExpiresAt - now <= 60_000) {
    return {
      label: "Lease expiring soon",
      tone: "warning",
      detail: "The oldest active lease on this worker is close to expiry.",
    };
  }
  if (lastHeartbeatAt !== null && now - lastHeartbeatAt >= 120_000) {
    return {
      label: "Renewal lag",
      tone: "warning",
      detail: "The worker is still registered, but heartbeats have slowed enough to deserve attention.",
    };
  }
  if (worker.worker_state === "lease_only") {
    return {
      label: "Registry gap",
      tone: "danger",
      detail: "Dispatch sees an active lease but no matching persisted worker heartbeat.",
    };
  }
  return {
    label: "Healthy worker",
    tone: "success",
    detail: "Heartbeat and lease evidence remain aligned for this worker.",
  };
}

function describeOutboxCause(state: string): { tone: DispatchRiskTone; detail: string; executionState?: string } {
  switch (state) {
    case "dead":
      return {
        tone: "danger",
        detail: "Outbox events have dead-lettered after repeated publish failures and now require operator follow-up.",
        executionState: "dead_lettered",
      };
    case "leased":
      return {
        tone: "warning",
        detail: "A publisher has claimed these events, so pressure may come from a stuck notification or dispatch publisher.",
        executionState: "dispatching",
      };
    case "pending":
      return {
        tone: "warning",
        detail: "Events are queued but not yet published, which usually means worker capacity or downstream publish lag.",
        executionState: "dispatching",
      };
    case "published":
      return {
        tone: "success",
        detail: "These events cleared the outbox and are retained only as recent publish evidence.",
      };
    default:
      return {
        tone: "neutral",
        detail: "This outbox state exists in storage, but it is not one of the standard publish lifecycle states.",
      };
  }
}

function buildScopedRoute(basePath: string, options: { instanceId?: string | null; companyId?: string | null }): string {
  const url = new URL(basePath, "https://forgeframe.local");
  if (options.instanceId?.trim()) {
    url.searchParams.set("instanceId", options.instanceId.trim());
  }
  if (options.companyId?.trim()) {
    url.searchParams.set("companyId", options.companyId.trim());
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function summarizeReconcileResults(results: ExecutionLeaseReconcileResult[]): {
  correctedLeases: number;
  correctedAttempts: number;
} {
  return {
    correctedLeases: results.length,
    correctedAttempts: new Set(results.map((item) => item.attempt_id)).size,
  };
}

export function DispatchPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const canReviewDispatch = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, instanceId, "execution.operate");
  const access = getExecutionAccess(session, sessionReady, instanceId);
  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [scopeState, setScopeState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [dispatchState, setDispatchState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [snapshot, setSnapshot] = useState<ExecutionDispatchSnapshot | null>(null);
  const [dispatchError, setDispatchError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reconcileState, setReconcileState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reconcileResults, setReconcileResults] = useState<ExecutionLeaseReconcileResult[]>([]);
  const [reconcileErrors, setReconcileErrors] = useState<string[]>([]);
  const now = Date.now();

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
  }, [canReviewDispatch, companyId, instanceId, refreshNonce]);

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

  const outboxStates = useMemo(
    () => Object.entries(snapshot?.outbox_counts ?? {}).filter(([, count]) => count > 0).sort((left, right) => right[1] - left[1]),
    [snapshot],
  );
  const eventMix = useMemo(
    () => Object.entries(snapshot?.event_counts ?? {}).sort((left, right) => right[1] - left[1]).slice(0, 3),
    [snapshot],
  );
  const reconcileSummary = summarizeReconcileResults(reconcileResults);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Dispatch"
        description="Inspect the technical worker and lease layer below runs and queues: active leases, stalled attempts, outbox pressure, and lease reconciliation."
        question="Is dispatch blocked by a stale worker, an expired lease, or outbox pressure that never reaches the next system?"
        links={[
          { label: "Queues", to: CONTROL_PLANE_ROUTES.queues, description: "Return to lane backlog and runnable queue posture." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Open a specific run once dispatch has identified the affected attempt." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect delivery truth when outbox pressure spills into notification publishing." },
        ]}
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note="Dispatch is a technical runtime surface. Queue triage and business-level run decisions stay on Queues and Execution Review."
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Dispatch Scope</h3>
            <p className="fg-muted">Worker leases and outbox truth are scoped to the same instance boundary as execution review.</p>
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
          <p className="fg-muted">ForgeFrame is loading worker leases, stalled attempts, outbox pressure, and reconciliation evidence.</p>
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
              <span className="fg-muted">Active leases</span>
              <strong className="fg-kpi-value">{snapshot.leased_attempts.length}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Stalled / expired</span>
              <strong className="fg-kpi-value">{snapshot.stalled_attempts.length}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Outbox pressure states</span>
              <strong className="fg-kpi-value">{outboxStates.length}</strong>
            </article>
            <article className="fg-kpi">
              <span className="fg-muted">Workers observed</span>
              <strong className="fg-kpi-value">{snapshot.workers.length}</strong>
            </article>
          </div>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Worker Leases</h3>
                <p className="fg-muted">Every row represents a persisted active lease on an attempt, not a guessed queue position.</p>
              </div>
              <span className="fg-pill" data-tone={snapshot.stalled_attempts.length > 0 ? "danger" : "success"}>
                {snapshot.stalled_attempts.length > 0 ? `${snapshot.stalled_attempts.length} stalled / expired` : "No stalled leases"}
              </span>
            </div>
            {snapshot.stalled_attempts.length > 0 ? (
              <p className="fg-danger">
                Expired leases are still present on the dispatch fabric. Review the rows below and reconcile them before queue truth drifts.
              </p>
            ) : null}
            {snapshot.leased_attempts.length === 0 ? (
              <p className="fg-muted">No active worker leases are currently held for this instance scope.</p>
            ) : (
              <div className="fg-table-wrap">
                <table className="fg-table" aria-label="Worker lease inventory">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Instance</th>
                      <th>Lane</th>
                      <th>Target</th>
                      <th>Lease expiry</th>
                      <th>Last renewal</th>
                      <th>Stale risk</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.leased_attempts.map((attempt) => {
                      const risk = describeAttemptLeaseRisk(attempt, now);
                      return (
                        <tr key={attempt.attempt_id}>
                          <td>
                            <strong>{attempt.worker_key ?? "Unassigned worker"}</strong>
                            <div className="fg-muted">Attempt {attempt.attempt_id}</div>
                          </td>
                          <td>{instanceId}</td>
                          <td>{attempt.execution_lane}</td>
                          <td>
                            <strong>{describeDispatchTarget(attempt)}</strong>
                            <div className="fg-muted">Run {attempt.run_id}</div>
                          </td>
                          <td>
                            <div>{formatTimestamp(attempt.lease_expires_at)}</div>
                            <div className="fg-muted">{formatLeaseWindow(attempt.lease_expires_at, { now, futureLabel: "expires in", pastLabel: "expired" })}</div>
                          </td>
                          <td>
                            <div>{formatTimestamp(attempt.last_heartbeat_at)}</div>
                            <div className="fg-muted">{formatLeaseWindow(attempt.last_heartbeat_at, { now, futureLabel: "renews in", pastLabel: "renewed" })}</div>
                          </td>
                          <td>
                            <span className="fg-pill" data-tone={risk.tone}>{risk.label}</span>
                            <div className="fg-muted">{risk.detail}</div>
                          </td>
                          <td>
                            <Link to={buildExecutionReviewPath({ instanceId, companyId, runId: attempt.run_id })}>Open execution review</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="fg-panel-heading fg-mt-md">
              <div>
                <h4>Worker registry evidence</h4>
                <p className="fg-muted">Heartbeat truth from persisted worker rows is shown separately from the active lease rows above.</p>
              </div>
            </div>
            {snapshot.workers.length === 0 ? (
              <p className="fg-muted">No worker heartbeat rows are registered for the current scope.</p>
            ) : (
              <div className="fg-table-wrap">
                <table className="fg-table" aria-label="Worker heartbeat registry">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Lane</th>
                      <th>State</th>
                      <th>Current attempt</th>
                      <th>Heartbeat expiry</th>
                      <th>Oldest lease</th>
                      <th>Stale risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.workers.map((worker) => {
                      const risk = describeWorkerLeaseRisk(worker, now);
                      return (
                        <tr key={worker.worker_key}>
                          <td>
                            <strong>{worker.worker_key}</strong>
                            <div className="fg-muted">{worker.instance_id}</div>
                          </td>
                          <td>{worker.execution_lane}</td>
                          <td>
                            <span className="fg-pill" data-tone={getStateTone(worker.worker_state)}>{worker.worker_state}</span>
                            <div className="fg-muted">{worker.active_attempts} active attempt(s)</div>
                          </td>
                          <td>{worker.current_attempt_id ?? "None recorded"}</td>
                          <td>{formatTimestamp(worker.heartbeat_expires_at)}</td>
                          <td>{formatTimestamp(worker.oldest_lease_expires_at)}</td>
                          <td>
                            <span className="fg-pill" data-tone={risk.tone}>{risk.label}</span>
                            <div className="fg-muted">{risk.detail}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Leased Attempts</h3>
                <p className="fg-muted">This section explains which attempts are in flight, which ones are stalled, and why dispatch still considers them active.</p>
              </div>
            </div>
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Paused runs</span>
                <strong className="fg-kpi-value">{snapshot.paused_runs}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Waiting on approval</span>
                <strong className="fg-kpi-value">{snapshot.waiting_on_approval_runs}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Quarantined runs</span>
                <strong className="fg-kpi-value">{snapshot.quarantined_runs}</strong>
              </article>
            </div>

            <div className="fg-panel-heading fg-mt-md">
              <div>
                <h4>Stalled Attempts</h4>
                <p className="fg-muted">Stalled means the lease has already expired but the attempt still appears leased.</p>
              </div>
            </div>
            {snapshot.stalled_attempts.length === 0 ? (
              <p className="fg-muted">No expired leases are currently waiting for reconciliation.</p>
            ) : (
              <div className="fg-table-wrap">
                <table className="fg-table" aria-label="Stalled leased attempts">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Run</th>
                      <th>State</th>
                      <th>Status reason</th>
                      <th>Next wake-up</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.stalled_attempts.map((attempt) => (
                      <tr key={attempt.attempt_id}>
                        <td>
                          <strong>{attempt.attempt_id}</strong>
                          <div className="fg-muted">{attempt.worker_key ?? "No worker key"}</div>
                        </td>
                        <td>{attempt.run_id}</td>
                        <td>
                          <span className="fg-pill" data-tone="danger">Expired lease</span>
                          <div className="fg-muted">{attempt.operator_state}</div>
                        </td>
                        <td>{attempt.status_reason ?? "No status reason recorded"}</td>
                        <td>{formatTimestamp(attempt.next_wakeup_at, "No wake-up scheduled")}</td>
                        <td>
                          <Link to={buildExecutionReviewPath({ instanceId, companyId, runId: attempt.run_id })}>Open execution review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="fg-panel-heading fg-mt-md">
              <div>
                <h4>All Leased Attempts</h4>
                <p className="fg-muted">Use this table for the full attempt and worker picture without confusing dispatch with a queue page.</p>
              </div>
            </div>
            {snapshot.leased_attempts.length === 0 ? (
              <p className="fg-muted">No leased attempts are active for this scope.</p>
            ) : (
              <div className="fg-table-wrap">
                <table className="fg-table" aria-label="All leased attempts">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Run kind</th>
                      <th>Dispatch state</th>
                      <th>Target</th>
                      <th>Wake-up</th>
                      <th>Lease status</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.leased_attempts.map((attempt) => (
                      <tr key={attempt.attempt_id}>
                        <td>
                          <strong>{attempt.attempt_id}</strong>
                          <div className="fg-muted">Run {attempt.run_id}</div>
                        </td>
                        <td>{attempt.run_kind}</td>
                        <td>
                          <span className="fg-pill" data-tone={getStateTone(attempt.operator_state)}>{attempt.operator_state}</span>
                          <div className="fg-muted">{attempt.status_reason ?? "No status reason recorded"}</div>
                        </td>
                        <td>{describeDispatchTarget(attempt)}</td>
                        <td>{formatTimestamp(attempt.next_wakeup_at, "No wake-up scheduled")}</td>
                        <td>{attempt.lease_status}</td>
                        <td>
                          <Link to={buildExecutionReviewPath({ instanceId, companyId, runId: attempt.run_id })}>Open execution review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Outbox Pressure</h3>
                <p className="fg-muted">Outbox pressure comes from persisted publish-state truth, not inferred runtime logs.</p>
              </div>
            </div>
            {outboxStates.length === 0 ? (
              <p className="fg-muted">No outbox rows are currently accumulating on this instance scope.</p>
            ) : (
              <div className="fg-grid fg-grid-compact">
                {outboxStates.map(([state, count]) => {
                  const cause = describeOutboxCause(state);
                  return (
                    <article key={state} className="fg-outline-row">
                      <div className="fg-panel-heading fg-data-row-heading">
                        <div className="fg-page-header">
                          <strong>{state}</strong>
                          <span className="fg-pill" data-tone={cause.tone}>{count}</span>
                        </div>
                      </div>
                      <p className="fg-muted">{cause.detail}</p>
                      <p className="fg-muted">
                        {eventMix.length > 0 ? `Current event mix: ${eventMix.map(([eventType, value]) => `${eventType} ${value}`).join(" · ")}` : "No event mix is available."}
                      </p>
                      <p>
                        <Link to={buildScopedRoute(CONTROL_PLANE_ROUTES.notifications, { instanceId, companyId })}>Open notifications</Link>
                        {" · "}
                        <Link to={buildExecutionReviewPath({ instanceId, companyId, state: cause.executionState ?? null })}>Open execution review</Link>
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Reconciliation</h3>
                <p className="fg-muted">Lease reconciliation turns expired dispatch leases into explicit quarantined or timed-out run truth.</p>
              </div>
              <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>
                {canMutate ? "Mutations enabled" : "Permission blocker"}
              </span>
            </div>
            {!canMutate ? (
              <p className="fg-danger">Reconcile is blocked because this session lacks `execution.operate` on the selected instance.</p>
            ) : null}
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Expired leases visible now</span>
                <strong className="fg-kpi-value">{snapshot.stalled_attempts.length}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Corrected leases</span>
                <strong className="fg-kpi-value">{reconcileSummary.correctedLeases}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Corrected attempts</span>
                <strong className="fg-kpi-value">{reconcileSummary.correctedAttempts}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Errors</span>
                <strong className="fg-kpi-value">{reconcileErrors.length}</strong>
              </article>
            </div>
            <div className="fg-actions">
              <button
                type="button"
                disabled={!canMutate || reconcileState === "submitting"}
                onClick={() => {
                  setReconcileState("submitting");
                  setReconcileResults([]);
                  setReconcileErrors([]);
                  void reconcileExecutionLeases({ instanceId, companyId })
                    .then((payload) => {
                      setReconcileResults(payload.reconciled);
                      setReconcileErrors([]);
                      setReconcileState("success");
                      setRefreshNonce((value) => value + 1);
                    })
                    .catch((error: unknown) => {
                      const message =
                        error instanceof AdminApiError
                          ? error.message
                          : error instanceof Error
                            ? error.message
                            : "Lease reconciliation failed.";
                      setReconcileResults([]);
                      setReconcileErrors([message]);
                      setReconcileState("error");
                    });
                }}
              >
                {reconcileState === "submitting" ? "Reconciling leases" : "Reconcile expired leases"}
              </button>
            </div>
            {reconcileState === "success" ? (
              reconcileResults.length === 0 ? (
                <p className="fg-note">Reconciliation completed, but no expired leases required correction.</p>
              ) : (
                <>
                  <p className="fg-note">
                    Reconciliation completed. Corrected {reconcileSummary.correctedLeases} lease(s) across {reconcileSummary.correctedAttempts} attempt(s).
                  </p>
                  <div className="fg-table-wrap">
                    <table className="fg-table" aria-label="Lease reconciliation results">
                      <thead>
                        <tr>
                          <th>Run</th>
                          <th>Attempt</th>
                          <th>Result state</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconcileResults.map((item) => (
                          <tr key={`${item.run_id}:${item.attempt_id}`}>
                            <td>{item.run_id}</td>
                            <td>{item.attempt_id}</td>
                            <td>{item.reconciled_to_state}</td>
                            <td>{item.dead_letter_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : null}
            {reconcileState === "error" ? (
              <div className="fg-stack">
                {reconcileErrors.map((message) => (
                  <p key={message} className="fg-danger">{message}</p>
                ))}
              </div>
            ) : null}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Advanced Diagnostics</h3>
                <p className="fg-muted">Raw dispatch evidence stays available, but it is intentionally pushed below the operational surface.</p>
              </div>
            </div>
            <details className="fg-outline-row">
              <summary>Worker registry payload</summary>
              <pre>{JSON.stringify(snapshot.workers, null, 2)}</pre>
            </details>
            <details className="fg-outline-row">
              <summary>Outbox event counts</summary>
              <pre>{JSON.stringify(snapshot.event_counts, null, 2)}</pre>
            </details>
            <details className="fg-outline-row">
              <summary>Lease reconciliation payload</summary>
              <pre>{JSON.stringify({ results: reconcileResults, errors: reconcileErrors }, null, 2)}</pre>
            </details>
            <details className="fg-outline-row">
              <summary>Full dispatch snapshot</summary>
              <pre>{JSON.stringify(snapshot, null, 2)}</pre>
            </details>
          </article>
        </>
      ) : null}
    </section>
  );
}
