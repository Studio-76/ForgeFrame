import { StatusBadge } from "../../components/ui/StatusBadge";
import type { ProviderTargetRecord, ReadinessSummary } from "./types";
import { contractStatusForTarget } from "./utils";

type TargetReadinessSummaryProps = {
  summary: ReadinessSummary;
  targets: ProviderTargetRecord[];
};

/**
 * Compact readiness summary with a dominant remediation callout
 * when no targets are runtime-ready.
 */
export function TargetReadinessSummary({ summary, targets }: TargetReadinessSummaryProps) {
  const hasRuntimeReady = summary.runtimeReadyCount > 0;
  const anyBlockers = summary.primaryBlocker !== null && summary.runtimeReadyCount === 0;

  /* Find the first target that should be fixed first */
  const firstUnprobedTarget = targets.find(
    (t) => contractStatusForTarget(t) === "needs-health-check" && t.enabled,
  );

  return (
    <section className="fg-stack" aria-label="Target readiness summary">
      {/* Dominant remediation callout — shown when no target is runtime-ready */}
      {anyBlockers && targets.length > 0 ? (
        <div className="ff-remediation-callout">
          <div className="ff-remediation-callout-header">
            <span className="ff-remediation-callout-icon" aria-hidden="true">⚠</span>
            <div className="ff-remediation-callout-copy">
              <strong>No targets are runtime-ready</strong>
              <p>
                {summary.enabledCount} target{summary.enabledCount !== 1 ? "s" : ""} enabled,{" "}
                {summary.runtimeReadyCount} runtime-ready —{" "}
                {summary.primaryBlocker?.toLowerCase() ?? "no targets are dispatchable"}.
              </p>
            </div>
          </div>
          {firstUnprobedTarget ? (
            <div className="ff-remediation-callout-action">
              <strong>First recommended action:</strong>{" "}
              <span>Run provider health check for <em>{firstUnprobedTarget.label}</em></span>
            </div>
          ) : summary.nextAction ? (
            <div className="ff-remediation-callout-action">
              <strong>Next action:</strong> <span>{summary.nextAction}</span>
            </div>
          ) : null}
        </div>
      ) : hasRuntimeReady ? (
        <div className="ff-remediation-callout ff-remediation-callout-ok">
          <div className="ff-remediation-callout-header">
            <span className="ff-remediation-callout-icon" aria-hidden="true">✓</span>
            <div className="ff-remediation-callout-copy">
              <strong>{summary.runtimeReadyCount} target{summary.runtimeReadyCount !== 1 ? "s are" : " is"} runtime-ready</strong>
              <p>Targets can receive runtime traffic.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ff-summary-strip">
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
      </div>
    </section>
  );
}
