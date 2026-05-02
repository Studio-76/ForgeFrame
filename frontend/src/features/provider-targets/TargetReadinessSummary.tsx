import { StatusBadge } from "../../components/ui/StatusBadge";
import type { ReadinessSummary } from "./types";

/**
 * Compact readiness summary bar showing total targets, runtime-ready count,
 * primary blocker, and recommended next action.
 */
export function TargetReadinessSummary({ summary }: { summary: ReadinessSummary }) {
  const hasRuntimeReady = summary.runtimeReadyCount > 0;
  const anyBlockers = summary.primaryBlocker !== null && summary.runtimeReadyCount === 0;

  return (
    <section className="ff-summary-strip" aria-label="Target readiness summary">
      <article className="ff-summary-card">
        <div className="ff-summary-card-header">
          <span className="ff-summary-label">Total targets</span>
        </div>
        <strong className="ff-summary-value">{summary.totalTargets}</strong>
        <p className="ff-summary-meta">
          {summary.enabledCount} enabled
        </p>
      </article>

      <article className="ff-summary-card">
        <div className="ff-summary-card-header">
          <span className="ff-summary-label">Runtime ready</span>
          <StatusBadge tone={hasRuntimeReady ? "success" : "warning"} status={hasRuntimeReady ? "ready" : "blocked"}>
            {hasRuntimeReady ? "Ready" : "Not ready"}
          </StatusBadge>
        </div>
        <strong className="ff-summary-value">
          {summary.runtimeReadyCount}
          <span className="ff-summary-value-muted">/{summary.totalTargets}</span>
        </strong>
        <p className="ff-summary-meta">
          {hasRuntimeReady
            ? "Targets can receive runtime traffic"
            : summary.totalTargets > 0
              ? "No targets are dispatchable"
              : "No targets configured"}
        </p>
      </article>

      {anyBlockers ? (
        <article className="ff-summary-card ff-summary-card-urgent">
          <div className="ff-summary-card-header">
            <span className="ff-summary-label">Primary blocker</span>
          </div>
          <strong className="ff-summary-value">{summary.primaryBlocker}</strong>
        </article>
      ) : null}

      {summary.nextAction ? (
        <article className="ff-summary-card">
          <div className="ff-summary-card-header">
            <span className="ff-summary-label">Next action</span>
          </div>
          <strong className="ff-summary-value">{summary.nextAction}</strong>
        </article>
      ) : null}
    </section>
  );
}
