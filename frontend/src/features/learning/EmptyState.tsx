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
    <article className="fg-card ff-learning-empty">
      <div className="ff-learning-empty-content">
        <h3>No learning events found for this scope</h3>
        <p className="ff-learning-empty-desc">
          Learning events are created automatically from pattern scans, session
          rotations, and runtime signals. Start with a pattern scan to discover
          opportunities for memory and skill promotion.
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
              : "Run pattern scan"}
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
