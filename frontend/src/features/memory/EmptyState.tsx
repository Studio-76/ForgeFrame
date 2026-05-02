/**
 * Focused empty-state component displayed when no memory records exist.
 *
 * @packageDocumentation
 */

/** Props for EmptyState. */
export interface EmptyStateProps {
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether the instance ID is available. */
  hasInstance: boolean;
  /** Handler to open the create memory form. */
  onCreateMemory: () => void;
}

/**
 * Focused empty state — one clear message with primary and secondary actions.
 */
export function EmptyState({
  canMutate,
  hasInstance,
  onCreateMemory,
}: EmptyStateProps) {
  return (
    <article className="fg-card ff-memory-empty ff-memory-tron-frame">
      <div className="ff-memory-empty-content">
        <span className="ff-memory-status-led" data-state="idle">
          No records
        </span>
        <h3>No memory records found for this scope</h3>
        <p className="ff-memory-empty-desc">
          ForgeFrame has no memory entries for the current instance scope.
          Create a memory record to establish durable truth, boot candidates,
          or working context references.
        </p>
        <div className="ff-memory-empty-actions">
          <button
            type="button"
            className="ff-memory-primary-action"
            disabled={!canMutate || !hasInstance}
            onClick={onCreateMemory}
          >
            Create memory record
          </button>
        </div>
      </div>
    </article>
  );
}
