/**
 * Props for the routing action bar.
 */
export type RoutingActionBarProps = {
  canMutate: boolean;
  canRead: boolean;
  onRefresh: () => void;
  onEditPolicy: () => void;
  onRunSimulation: () => void;
  onEditPolicyLabel?: string;
  onRunSimulationLabel?: string;
};

/**
 * Compact action bar with page-level controls only.
 * Related-page navigation is handled by the global sidebar.
 */
export function RoutingActionBar({
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
  );
}
