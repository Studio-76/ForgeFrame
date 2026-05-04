/**
 * DispatchWorkerTable — worker lease and worker registry evidence tables.
 *
 * Renders the active worker lease inventory and the worker heartbeat registry
 * as two adjacent tables within a single card section.
 *
 * @packageDocumentation
 */

import type { ExecutionDispatchSnapshot } from "../../../api/domain/execution";

import { Button } from "../../../components/ui/Button";
import { describeWorkerLeaseRisk, describeDispatchTarget, formatTimestamp, formatLeaseWindow, describeAttemptLeaseRisk } from "../helpers";
import { getStateTone } from "../../execution/helpers";

/**
 * Props for DispatchWorkerTable.
 */
export type DispatchWorkerTableProps = {
  /** The full dispatch snapshot. */
  snapshot: ExecutionDispatchSnapshot;
  /** Current instance ID for route building. */
  instanceId: string;
  /** Current company ID for route building. */
  companyId: string;
  /** Callback to navigate to the execution review for a given run. */
  onNavigateExecutionReview: (runId: string) => void;
};

/**
 * Worker lease and registry tables — active leases and persisted heartbeat truth.
 */
export function DispatchWorkerTable({
  snapshot,
  instanceId,
  onNavigateExecutionReview,
}: DispatchWorkerTableProps) {
  const now = Date.now();

  return (
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
                      <Button variant="navigation" onPress={() => onNavigateExecutionReview(attempt.run_id)}>
                        Open execution review
                      </Button>
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
  );
}
