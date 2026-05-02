import type { RoutingControlPlaneResponse } from "../../api/domain/routing";

/**
 * Props for the summary grid.
 */
type RoutingSummaryGridProps = {
  snapshot: RoutingControlPlaneResponse | null;
  simulationSummary: string;
};

/**
 * Summary grid that fills the main content area with key routing metrics.
 * Replaces the "empty space" problem when all collapse sections are closed.
 */
export function RoutingSummaryGrid({ snapshot, simulationSummary: simSummary }: RoutingSummaryGridProps) {
  if (!snapshot) {
    return null;
  }

  const policies = snapshot.policies;
  const targets = snapshot.targets;
  const enabledTargets = targets.filter((t) => t.enabled);
  const readyTargets = targets.filter((t) => t.enabled && t.runtime_ready && t.readiness_status === "ready");
  const recentDecisions = snapshot.recent_decisions;
  const lastDecision = recentDecisions.length > 0 ? recentDecisions[0] : null;
  const activeClasses = policies.map((p) => p.classification).join(", ") || "none";
  const preferredTarget =
    policies.length > 0
      ? policies[0].preferred_target_keys.slice(0, 2).join(", ") || "none configured"
      : "none configured";

  const lastDecisionTime = lastDecision
    ? new Date(lastDecision.created_at).toLocaleString()
    : "none recorded";

  return (
    <div className="fg-grid-compact" aria-label="Routing summary">
      <article className="fg-stat-block">
        <span className="fg-stat-label">Routing classes</span>
        <span className="fg-stat-value">{titleCase(activeClasses)}</span>
        <span className="fg-stat-detail">
          {policies.length >= 2 ? "Both persisted" : `${policies.length} of 2 persisted`}
        </span>
      </article>

      <article className="fg-stat-block">
        <span className="fg-stat-label">Enabled targets</span>
        <span className="fg-stat-value">{enabledTargets.length}</span>
        <span className="fg-stat-detail">
          {readyTargets.length} ready · {enabledTargets.length - readyTargets.length} not ready
        </span>
      </article>

      <article className="fg-stat-block">
        <span className="fg-stat-label">Preferred target</span>
        <span className="fg-stat-value fg-stat-value--truncated">{preferredTarget}</span>
        <span className="fg-stat-detail">
          {targets.find((t) => t.target_key === policies[0]?.preferred_target_keys[0])?.label ?? "—"}
        </span>
      </article>

      <article className="fg-stat-block">
        <span className="fg-stat-label">Last simulation</span>
        <span className="fg-stat-value fg-stat-value--truncated">{simSummary || "not run"}</span>
        <span className="fg-stat-detail">Dry-run against live policy</span>
      </article>

      <article className="fg-stat-block">
        <span className="fg-stat-label">Last decision</span>
        <span className="fg-stat-value">{lastDecisionTime}</span>
        <span className="fg-stat-detail">
          {lastDecision
            ? `${lastDecision.selected_target_key ?? "no target"} · ${lastDecision.policy_stage}`
            : "No decisions recorded"}
        </span>
      </article>
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
