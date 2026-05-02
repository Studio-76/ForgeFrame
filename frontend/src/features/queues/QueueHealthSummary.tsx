import type { ExecutionQueueLaneSummary } from "../../api/domain/execution";

/**
 * Queue health summary props.
 */
type QueueHealthSummaryProps = {
  /** Lane summaries from the API. */
  laneSummaries: ExecutionQueueLaneSummary[];
  /** Total backlog run count. */
  totalBacklog: number;
  /** Total blocked/paused/quarantined items. */
  blockedItems: number;
  /** Oldest queued work age in seconds. */
  oldestWaitSeconds: number | null;
  /** Lanes that have active pressure. */
  pressureLanes: string[];
  /** Next recommended action text. */
  nextAction: string;
};

/**
 * Top-level queue health summary block.
 * Shows a compact grid of key health metrics or a clear empty state
 * when all queues are healthy.
 */
export function QueueHealthSummary({
  laneSummaries,
  totalBacklog,
  blockedItems,
  oldestWaitSeconds,
  pressureLanes,
  nextAction,
}: QueueHealthSummaryProps) {
  const allClear = laneSummaries.length === 0 || laneSummaries.every((l) => l.total_runs === 0);

  if (allClear) {
    return (
      <div className="ff-queue-clear">
        <strong>no backlog</strong>
        <p>All lanes are clear. No operator action required.</p>
      </div>
    );
  }

  const oldestLabel = oldestWaitSeconds !== null && oldestWaitSeconds > 0
    ? formatCompactAge(oldestWaitSeconds)
    : "—";

  return (
    <div className="ff-queue-health">
      <div className="ff-queue-health-stat">
        <span className="ff-queue-health-stat-label">Backlog</span>
        <span className="ff-queue-health-stat-value">{totalBacklog}</span>
      </div>
      <div className="ff-queue-health-stat">
        <span className="ff-queue-health-stat-label">Blocked</span>
        <span className="ff-queue-health-stat-value">{blockedItems}</span>
      </div>
      <div className="ff-queue-health-stat">
        <span className="ff-queue-health-stat-label">Oldest</span>
        <span className="ff-queue-health-stat-value">{oldestLabel}</span>
      </div>
      <div className="ff-queue-health-stat">
        <span className="ff-queue-health-stat-label">Pressure</span>
        <span className="ff-queue-health-stat-value">
          {pressureLanes.length > 0 ? pressureLanes.length : 0}
        </span>
      </div>
      <div className="ff-queue-health-stat ff-queue-health-action">
        <span className="ff-queue-health-stat-label">Next action</span>
        <span className="ff-queue-health-stat-action">{nextAction}</span>
      </div>
    </div>
  );
}

/**
 * Format seconds into a compact human-readable age string.
 */
function formatCompactAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
