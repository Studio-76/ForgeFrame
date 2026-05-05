/**
 * DispatchAttemptTable — attempt-level lease tables.
 *
 * Renders mini KPIs (paused, waiting, quarantined), a stalled attempts table,
 * and the full leased attempts table within a single card section.
 *
 * @packageDocumentation
 */

import type { ExecutionDispatchSnapshot } from "../../../api/domain/execution";

import { Button } from "../../../components/ui/Button";
import { describeDispatchTarget, formatTimestamp, describeAttemptLeaseRisk } from "../helpers";
import { getStateTone } from "../../execution/helpers";

/**
 * Props for DispatchAttemptTable.
 */
export type DispatchAttemptTableProps = {
  /** The full dispatch snapshot. */
  snapshot: ExecutionDispatchSnapshot;
  /** Callback to navigate to the execution review for a given run. */
  onNavigateExecutionReview: (runId: string) => void;
};

/**
 * Attempt tables — mini run-state KPIs, stalled attempt inventory, and the
 * full roster of active leased attempts.
 */
export function DispatchAttemptTable({
  snapshot,
  onNavigateExecutionReview,
}: DispatchAttemptTableProps) {
  const now = Date.now();

  return (
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
                    <Button variant="navigation" onPress={() => onNavigateExecutionReview(attempt.run_id)}>
                      Open execution review
                    </Button>
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
              {snapshot.leased_attempts.map((attempt) => {
                const risk = describeAttemptLeaseRisk(attempt, now);
                return (
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
    </article>
  );
}
