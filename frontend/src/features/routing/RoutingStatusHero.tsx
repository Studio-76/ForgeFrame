import type { RoutingControlPlaneResponse } from "../../api/domain/routing";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { liveStatus, routingBlockers, titleCase, toneForStatus } from "./utils";
import type { RoutingHealth } from "./types";

/**
 * Props for the routing status hero.
 */
export type RoutingStatusHeroProps = {
  snapshot: RoutingControlPlaneResponse | null;
  onEditPolicy: () => void;
  onRunSimulation: () => void;
};

/**
 * Compact routing status — overall health badge, single-line blocker message,
 * and optional action chips. Metric counts are owned by the SummaryStrip
 * and RoutingSummaryGrid to avoid duplication.
 */
export function RoutingStatusHero({ snapshot, onEditPolicy, onRunSimulation }: RoutingStatusHeroProps) {
  const statusKey = liveStatus(snapshot);
  const blockers = routingBlockers(snapshot);
  const isHealthy = blockers.length === 0;

  return (
    <section className="ff-status-hero" aria-label="Routing health status">
      <div className="ff-status-hero-top">
        <div>
          <h3 className="ff-status-hero-label">
            {isHealthy ? "Routing is ready" : titleCase(statusKey)}
          </h3>
          <p className="ff-status-hero-line">
            {isHealthy
              ? "No blockers are currently active."
              : blockers[0]}
          </p>
        </div>
        <StatusBadge tone={toneForStatus(statusKey)} status={statusKey}>
          {titleCase(statusKey)}
        </StatusBadge>
      </div>

      {isHealthy ? (
        <div className="ff-status-hero-actions">
          <button type="button" className="ff-action-chip" onClick={onEditPolicy}>
            Edit policy
          </button>
          <button type="button" className="ff-action-chip" onClick={onRunSimulation}>
            Run simulation
          </button>
          <span className="ff-status-hero-actions-hint">Optional.</span>
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
