/**
 * Focused empty-state component displayed when no learning events exist.
 *
 * @packageDocumentation
 */

/** Props for EmptyState. */
export interface EmptyStateProps {
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether the instance ID is available. */
  hasInstance: boolean;
  /** Whether a pattern scan is currently running. */
  scanningPatterns: boolean;
  /** Handler to run the first pattern scan. */
  onScan: () => void;
  /** Handler to create a manual review item. */
  onCreateManual: () => void;
}

/**
 * Focused empty state — one clear message with primary and secondary actions.
 */
export function EmptyState({
  canMutate,
  hasInstance,
  scanningPatterns,
  onScan,
  onCreateManual,
}: EmptyStateProps) {
  return (
    <article className="fg-card ff-learning-empty ff-learning-tron-frame">
      <div className="ff-learning-empty-content">
        <span className="ff-learning-status-led" data-state="success">
          Queue clear
        </span>
        <h3>No learning events need review</h3>
        <p className="ff-learning-empty-desc">
          ForgeFrame has no pending learning suggestions for this instance.
          Run one pattern scan to check recent conversations, executions, and
          session rotations for reviewable memory or skill candidates.
        </p>
        <div className="ff-learning-empty-actions">
          <button
            type="button"
            className="ff-learning-primary-action"
            disabled={!canMutate || scanningPatterns || !hasInstance}
            onClick={onScan}
          >
            {scanningPatterns
              ? "Scanning for learning opportunities…"
              : "Scan for learning opportunities"}
          </button>
          <button
            type="button"
            className="ff-learning-secondary-action"
            disabled={!canMutate || !hasInstance}
            onClick={onCreateManual}
          >
            Create manual review item
          </button>
        </div>
      </div>
    </article>
  );
}
