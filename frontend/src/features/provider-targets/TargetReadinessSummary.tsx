import type { ProviderTargetRecord, ReadinessSummary } from "./types";
import { contractStatusForTarget } from "./utils";

type TargetReadinessSummaryProps = {
  summary: ReadinessSummary;
  targets: ProviderTargetRecord[];
};

/**
 * Compact remediation callout when targets are not runtime-ready.
 * Summary metrics (total, runtime-ready, enabled) are rendered by
 * the RegistryManagementPage template — this section adds only
 * the contextual callout and recommended next action.
 */
export function TargetReadinessSummary({ summary, targets }: TargetReadinessSummaryProps) {
  const hasRuntimeReady = summary.runtimeReadyCount > 0;
  const anyBlockers = summary.primaryBlocker !== null && summary.runtimeReadyCount === 0;

  /* Find the first target that should be fixed first */
  const firstUnprobedTarget = targets.find(
    (t) => contractStatusForTarget(t) === "needs-health-check" && t.enabled,
  );

  if (!anyBlockers && !hasRuntimeReady) {
    return null;
  }

  return (
    <section aria-label="Target readiness summary">
      {/* Dominant remediation callout — shown when no target is runtime-ready */}
      {anyBlockers ? (
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
      ) : (
        <div className="ff-remediation-callout ff-remediation-callout-ok">
          <div className="ff-remediation-callout-header">
            <span className="ff-remediation-callout-icon" aria-hidden="true">✓</span>
            <div className="ff-remediation-callout-copy">
              <strong>{summary.runtimeReadyCount} target{summary.runtimeReadyCount !== 1 ? "s are" : " is"} runtime-ready</strong>
              <p>Targets can receive runtime traffic.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
