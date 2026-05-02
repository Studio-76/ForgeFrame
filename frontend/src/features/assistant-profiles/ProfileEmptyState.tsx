/**
 * Empty state shown when no assistant profiles exist.
 *
 * Guides the operator to create their first profile with a clear primary action,
 * and provides optional secondary actions (import documentation, etc.).
 *
 * @packageDocumentation
 */

/** Props for {@link ProfileEmptyState}. */
export type ProfileEmptyStateProps = {
  /** Whether the current session can mutate. */
  canMutate: boolean;
  /** Called when the operator clicks "Create assistant profile". */
  onCreateProfile: () => void;
};

/**
 * Focused empty state for the assistant profiles page.
 *
 * Shown when no profiles match the current scope, replacing the inventory
 * and detail sections with a clear next-action prompt.
 */
export function ProfileEmptyState({ canMutate, onCreateProfile }: ProfileEmptyStateProps) {
  return (
    <article className="fg-card" style={{ textAlign: "center", padding: "var(--space-32, 32px) var(--space-16, 16px)" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h3 style={{ marginBottom: "var(--space-8, 8px)" }}>No assistant profiles found</h3>
        <p className="fg-muted" style={{ marginBottom: "var(--space-16, 16px)", lineHeight: 1.6 }}>
          Assistant profiles govern how your personal or team assistant communicates,
          schedules, delegates, and executes actions. Create your first profile to define
          quiet hours, delivery rules, action permissions, and approval policies.
        </p>
        {canMutate ? (
          <button type="button" className="ff-primary-action" onClick={onCreateProfile}>
            Create assistant profile
          </button>
        ) : (
          <p className="fg-muted" style={{ fontStyle: "italic" }}>
            Operator or admin access required to create profiles.
          </p>
        )}
      </div>
    </article>
  );
}
