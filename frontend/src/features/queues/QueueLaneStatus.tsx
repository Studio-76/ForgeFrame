import type { ExecutionQueueLaneSummary } from "../../api/domain/execution";

/**
 * Queue lane status strip props.
 */
export type QueueLaneStatusProps = {
  /** Lane summaries from the API. */
  laneSummaries: ExecutionQueueLaneSummary[];
};

/**
 * Signal analysis result for a lane.
 */
type LaneSignal = {
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

/**
 * Describe the signal state of an execution lane.
 */
function describeLaneSignal(lane: ExecutionQueueLaneSummary): LaneSignal {
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
 * Compact lane status table replacing large lane cards.
 * Shows each lane in a single row with key metrics and a status pill.
 * Lanes with all zeros are still shown but in a compact, muted form.
 */
export function QueueLaneStatus({ laneSummaries }: QueueLaneStatusProps) {
  if (laneSummaries.length === 0) {
    return null;
  }

  return (
    <div className="ff-queue-lanes">
      <div className="ff-queue-lane-row ff-queue-lane-header-row">
        <span className="ff-queue-lane-header">Lane</span>
        <span className="ff-queue-lane-header">Backlog</span>
        <span className="ff-queue-lane-header">Running</span>
        <span className="ff-queue-lane-header">Paused</span>
        <span className="ff-queue-lane-header ff-queue-lane-header-age">Oldest age</span>
        <span className="ff-queue-lane-header">Status</span>
      </div>
      {laneSummaries.map((lane) => {
        const signal = describeLaneSignal(lane);
        const allZero = lane.total_runs === 0;
        return (
          <div
            key={lane.execution_lane}
            className="ff-queue-lane-row"
            data-all-clear={allZero ? "true" : undefined}
          >
            <span className="ff-queue-lane-name">
              {lane.display_name}
            </span>
            <span className={`ff-queue-lane-value${lane.total_runs > 0 ? " is-highlight" : ""}`}>
              {lane.total_runs}
            </span>
            <span className={`ff-queue-lane-value${lane.running_runs > 0 ? " is-highlight" : ""}`}>
              {lane.running_runs}
            </span>
            <span className={`ff-queue-lane-value${lane.paused_runs > 0 ? " is-highlight" : ""}`}>
              {lane.paused_runs}
            </span>
            <span className="ff-queue-lane-value ff-queue-lane-age">
              {formatAgeSeconds(lane.longest_wait_seconds, "No queued work")}
            </span>
            <span className="fg-pill" data-tone={signal.tone}>
              {signal.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
