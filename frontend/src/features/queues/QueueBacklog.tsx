import { useState } from "react";
import { Link } from "react-router-dom";

import type { ExecutionQueueRunView } from "../../api/domain/execution";
import { buildExecutionReviewPath } from "../../app/executionReview";
import { getStateTone } from "../execution/helpers";

/**
 * Queue backlog props.
 */
type QueueBacklogProps = {
  /** Backlog runs to display. */
  runs: ExecutionQueueRunView[];
  /** Instance ID for link building. */
  instanceId: string;
  /** Company ID for link building. */
  companyId: string;
};

/**
 * Describe the target for a run view.
 */
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

/**
 * Format age seconds to a human-readable string.
 */
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

/**
 * Backlog table with focused item detail panel.
 * Shows a clear empty state when there is no backlog.
 */
export function QueueBacklog({ runs, instanceId, companyId }: QueueBacklogProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = selectedRunId
    ? runs.find((r) => r.run_id === selectedRunId) ?? null
    : null;

  if (runs.length === 0) {
    return (
      <div className="ff-queue-clear">
        <strong>no backlog</strong>
        <p>The selected scope has no waiting queue entries. That is a healthy outcome, not a rendering gap.</p>
      </div>
    );
  }

  return (
    <div className="ff-queue-backlog">
      <div className="ff-queue-backlog-header">
        <div>
          <h3>Backlog</h3>
          <p className="fg-muted">
            {runs.length} run{runs.length > 1 ? "s" : ""} waiting — select a row for details.
          </p>
        </div>
        <span className="fg-pill" data-tone={runs.length > 0 ? "warning" : "success"}>
          {runs.length} waiting
        </span>
      </div>

      <div className="ff-queue-backlog-table-wrap">
        <table className="fg-table ff-queue-backlog-table">
          <thead>
            <tr>
              <th>Work item</th>
              <th>Lane</th>
              <th>Waiting reason</th>
              <th>Age</th>
              <th>State</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const isSelected = selectedRunId === run.run_id;
              const executionLink = buildExecutionReviewPath({
                instanceId,
                companyId,
                state: run.state,
                runId: run.run_id,
              });
              return (
                <tr
                  key={run.run_id}
                  className={`ff-queue-backlog-row${isSelected ? " is-selected" : ""}`}
                  onClick={() => setSelectedRunId(isSelected ? null : run.run_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedRunId(isSelected ? null : run.run_id);
                    }
                  }}
                >
                  <td className="ff-queue-backlog-item">
                    <span className="fg-code">{run.run_id}</span>
                    <span className="ff-queue-backlog-target">{describeRunTarget(run)}</span>
                  </td>
                  <td>{run.execution_lane}</td>
                  <td>
                    <strong>{run.wait_reason}</strong>
                    {run.status_reason ? (
                      <div className="fg-muted">{run.status_reason}</div>
                    ) : null}
                  </td>
                  <td>{formatAgeSeconds(run.wait_age_seconds)}</td>
                  <td>
                    <span className="fg-pill" data-tone={getStateTone(run.operator_state)}>
                      {run.operator_state}
                    </span>
                  </td>
                  <td>
                    <strong>{run.next_allowed_action}</strong>
                    <div className="fg-muted">
                      <Link className="fg-nav-link" to={executionLink} onClick={(e) => e.stopPropagation()}>
                        Open execution review
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRun ? (
        <div className="ff-queue-detail">
          <div className="ff-queue-detail-header">
            <div>
              <h4>Backlog item detail</h4>
              <span className="fg-code">{selectedRun.run_id}</span>
            </div>
            <span className="fg-pill" data-tone={getStateTone(selectedRun.operator_state)}>
              {selectedRun.operator_state}
            </span>
          </div>
          <div className="ff-queue-detail-grid">
            <div>
              <strong>Lane</strong>
              <span>{selectedRun.execution_lane}</span>
            </div>
            <div>
              <strong>Target</strong>
              <span>{describeRunTarget(selectedRun)}</span>
            </div>
            <div>
              <strong>Waiting reason</strong>
              <span>{selectedRun.wait_reason}</span>
            </div>
            <div>
              <strong>Status reason</strong>
              <span>{selectedRun.status_reason ?? "No additional detail"}</span>
            </div>
            <div>
              <strong>Age</strong>
              <span>{formatAgeSeconds(selectedRun.wait_age_seconds)}</span>
            </div>
            <div>
              <strong>Next allowed action</strong>
              <span>{selectedRun.next_allowed_action}</span>
            </div>
            {selectedRun.current_approval_id ? (
              <div>
                <strong>Approval wait</strong>
                <span>{selectedRun.current_approval_id}</span>
              </div>
            ) : null}
          </div>
          <div className="ff-queue-detail-actions">
            <Link
              className="fg-nav-link"
              to={buildExecutionReviewPath({
                instanceId,
                companyId,
                state: selectedRun.state,
                runId: selectedRun.run_id,
              })}
            >
              Open execution review
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
