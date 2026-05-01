import type { OverallStatus } from "./types";

/**
 * Props for the {@link SetupProgress} component.
 */
export type SetupProgressProps = {
  /** Number of completed steps. */
  completeCount: number;
  /** Total number of steps. */
  totalCount: number;
  /** Current step index (0-based, for progress fill calculation). */
  currentStepIndex: number;
  /** Overall system status label. */
  overallStatus: OverallStatus;
};

/**
 * Map overall status to a tone class suffix.
 */
function statusTone(status: OverallStatus): string {
  switch (status) {
    case "restricted":
    case "blocked":
      return "danger";
    case "in-progress":
    case "not-started":
      return "warning";
    case "ready":
    case "live":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Human-readable label for the overall status.
 */
function statusLabel(status: OverallStatus): string {
  switch (status) {
    case "restricted":
      return "Password rotation required";
    case "not-started":
      return "Setup not started";
    case "in-progress":
      return "Setup in progress";
    case "blocked":
      return "Setup blocked";
    case "ready":
      return "Ready for go-live";
    case "live":
      return "Operational";
    default:
      return "Unknown";
  }
}

/**
 * Visual progress bar and status summary for the guided setup flow.
 *
 * Renders a thin horizontal progress bar with a fill that animates
 * to reflect the current completion percentage, plus a status line
 * showing "Step X of Y" and the overall health.
 */
export function SetupProgress({
  completeCount,
  totalCount,
  currentStepIndex,
  overallStatus,
}: SetupProgressProps) {
  if (totalCount === 0) {
    return null;
  }

  const percent = Math.round((completeCount / totalCount) * 100);
  const tone = statusTone(overallStatus);

  return (
    <div className="ff-setup-status-bar" data-tone={tone}>
      <div className="ff-setup-status-bar-info">
        <span className="ff-setup-step-indicator">
          Step {Math.min(currentStepIndex + 1, totalCount)} of {totalCount}
        </span>
        <span className="ff-setup-status-label">{statusLabel(overallStatus)}</span>
      </div>
      <div className="ff-setup-progress">
        <div
          className="ff-setup-progress-fill"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={completeCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`Setup progress: ${completeCount} of ${totalCount} steps complete`}
        />
      </div>
    </div>
  );
}
