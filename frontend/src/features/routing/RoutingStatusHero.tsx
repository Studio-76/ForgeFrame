import type { RoutingControlPlaneResponse } from "../../api/domain/routing";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { liveStatus, nextStepLabel, nextStepTone, routingBlockers, titleCase, toneForStatus } from "./utils";
import type { RoutingHealth } from "./types";

/**
 * Props for the routing status hero.
 */
type RoutingStatusHeroProps = {
  snapshot: RoutingControlPlaneResponse | null;
  onEditPolicy: () => void;
  onRunSimulation: () => void;
};

/**
 * Status hero that shows routing health, next action, and quick-access buttons.
 * When routing is healthy it displays a clear no-action-needed message with
 * suggested optional actions so the page feels intentional and complete.
 */
export function RoutingStatusHero({ snapshot, onEditPolicy, onRunSimulation }: RoutingStatusHeroProps) {
  const statusKey = liveStatus(snapshot);
  const blockers = routingBlockers(snapshot);
  const isHealthy = blockers.length === 0;
  const policies = snapshot?.policies ?? [];
  const circuits = snapshot?.circuits ?? [];
  const budget = snapshot?.budget;
  const targets = snapshot?.targets ?? [];
  const recentDecisions = snapshot?.recent_decisions ?? [];
  const openCircuits = circuits.filter((circuit) => circuit.state === "open");
  const blockedDecisions = recentDecisions.filter((decision) => Boolean(decision.error_type));

  return (
    <section className="ff-status-hero" aria-label="Routing health status">
      <div className="ff-status-hero-top">
        <div>
          <h3 className="ff-status-hero-label">
            {isHealthy ? "Routing is ready" : titleCase(statusKey)}
          </h3>
          <p className="ff-status-hero-line">
            {isHealthy
              ? "No blockers are currently active. Both policy classes are persisted and all guardrails are passing."
              : blockers[0]}
          </p>
        </div>
        <StatusBadge tone={toneForStatus(statusKey)} status={statusKey}>
          {titleCase(statusKey)}
        </StatusBadge>
      </div>

      <div className="ff-status-hero-stats">
        <span>{policies.length} / 2 policies</span>
        <span>{openCircuits.length} circuits open</span>
        <span>{budget?.hard_blocked ? "Budget blocked" : "Budget open"}</span>
        <span>{recentDecisions.length} decisions</span>
        <span>{blockedDecisions.length} blocked</span>
        <span>{targets.length} targets</span>
      </div>

      {isHealthy ? (
        <div className="ff-next-step" data-tone="success">
          <span className="ff-next-step-label">Routing is healthy</span>
          <span>No active budget, circuit, or readiness blockers. Both policy classes are persisted.</span>
        </div>
      ) : (
        <div className="ff-next-step" data-tone={nextStepTone(statusKey)}>
          <span className="ff-next-step-label">{nextStepLabel(statusKey)}</span>
          <span>{blockers[0]}</span>
        </div>
      )}

      {isHealthy ? (
        <div className="ff-status-hero-actions">
          <button type="button" className="ff-action-chip" onClick={onEditPolicy}>
            Edit policy
          </button>
          <button type="button" className="ff-action-chip" onClick={onRunSimulation}>
            Run simulation
          </button>
          <span className="ff-status-hero-actions-hint">No action required — these are optional.</span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Health summary record for the summary grid.
 */
export type HealthSummary = {
  routingClasses: string;
  enabledTargets: number;
  preferredTarget: string;
  lastSimulationResult: string;
  lastDecisionTimestamp: string;
};
