import { Link } from "react-router-dom";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";

/**
 * Props for the routing action bar.
 */
type RoutingActionBarProps = {
  instanceId: string | null;
  canMutate: boolean;
  canRead: boolean;
  onRefresh: () => void;
  onEditPolicy: () => void;
  onRunSimulation: () => void;
  onEditPolicyLabel?: string;
  onRunSimulationLabel?: string;
};

/**
 * Action bar with page-level controls and de-emphasized related-page navigation.
 * "Edit policy" and "Run simulation" clearly map to their respective sections.
 * Related pages are grouped under a "Related pages" heading with secondary visual weight.
 */
export function RoutingActionBar({
  instanceId,
  canMutate,
  canRead,
  onRefresh,
  onEditPolicy,
  onRunSimulation,
  onEditPolicyLabel = "Edit policy",
  onRunSimulationLabel = "Run simulation",
}: RoutingActionBarProps) {
  return (
    <div className="ff-action-bar">
      <div className="ff-action-bar-header">
        <div className="ff-action-bar-copy">
          <h3>Routing controls</h3>
          <p>Edit policy, simulate decisions, or navigate to related surfaces.</p>
        </div>
        <div className="ff-action-controls">
          <button type="button" onClick={onRefresh} disabled={!canRead}>
            Refresh
          </button>
          {canMutate ? (
            <button type="button" onClick={onEditPolicy}>
              {onEditPolicyLabel}
            </button>
          ) : null}
          <button type="button" onClick={onRunSimulation}>
            {onRunSimulationLabel}
          </button>
        </div>
      </div>
      <details className="ff-nav-section">
        <summary className="ff-nav-section-summary">Related pages</summary>
        <div className="ff-nav-links">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
            Provider targets
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.models, instanceId)}>
            Models
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>
            Costs
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
            Logs
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId)}>
            Execution review
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>
            Setup progress
          </Link>
        </div>
      </details>
    </div>
  );
}
