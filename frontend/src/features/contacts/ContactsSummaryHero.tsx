/**
 * Top-level contacts summary hero — shows total contacts, reachability,
 * consent posture, delivery routes, attention count, and the most
 * important next action for the operator.
 *
 * @packageDocumentation
 */

/** Props for ContactsSummaryHero. */
export interface ContactsSummaryHeroProps {
  /** Total number of contacts. */
  totalContacts: number;
  /** Number of reachable contacts. */
  reachableCount: number;
  /** Number of contacts missing consent. */
  missingConsentCount: number;
  /** Number of contacts with delivery routes. */
  withRoutesCount: number;
  /** Number of contacts requiring attention. */
  attentionCount: number;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether an instance is selected. */
  hasInstance: boolean;
  /** Whether the contacts list is currently loading. */
  loading: boolean;
  /** Handler to open the create contact form. */
  onCreateContact: () => void;
}

/**
 * Summary hero banner showing contact KPIs and next action.
 */
export function ContactsSummaryHero({
  totalContacts,
  reachableCount,
  missingConsentCount,
  withRoutesCount,
  attentionCount,
  canMutate,
  hasInstance,
  loading,
  onCreateContact,
}: ContactsSummaryHeroProps) {
  const hasContacts = totalContacts > 0;
  const nextAction = hasContacts && attentionCount > 0
    ? `${attentionCount} contact${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
    : !hasContacts
      ? "Create your first contact to get started"
      : missingConsentCount > 0
        ? `${missingConsentCount} contact${missingConsentCount === 1 ? "" : "s"} missing consent`
        : "All contacts are in good shape";

  return (
    <article className="fg-card ff-contacts-hero ff-contacts-tron-frame">
      <div className="ff-contacts-hero-header">
        <div>
          <p className="ff-contacts-kicker">Contact registry</p>
          <h3>
            {loading
              ? "Loading contacts\u2026"
              : hasContacts
                ? `${totalContacts} contact${totalContacts === 1 ? "" : "s"} registered`
                : "No contacts registered"}
          </h3>
        </div>
        <span
          className="ff-contacts-status-led"
          data-state={attentionCount > 0 ? "warning" : "success"}
        >
          {attentionCount > 0 ? "Attention required" : "Registry clear"}
        </span>
      </div>

      {hasContacts && !loading && (
        <div className="ff-contacts-hero-strip" aria-label="Contact status breakdown">
          <div className="ff-contacts-stat">
            <span className="ff-contacts-stat-value">{totalContacts}</span>
            <span className="ff-contacts-stat-label">Total</span>
          </div>
          <div className="ff-contacts-stat">
            <span className="ff-contacts-stat-value ff-contacts-stat-success">{reachableCount}</span>
            <span className="ff-contacts-stat-label">Reachable</span>
          </div>
          <div className="ff-contacts-stat">
            <span className="ff-contacts-stat-value ff-contacts-stat-warning">{missingConsentCount}</span>
            <span className="ff-contacts-stat-label">Missing consent</span>
          </div>
          <div className="ff-contacts-stat">
            <span className="ff-contacts-stat-value">{withRoutesCount}</span>
            <span className="ff-contacts-stat-label">With routes</span>
          </div>
          <div className="ff-contacts-stat">
            <span className="ff-contacts-stat-value ff-contacts-stat-danger">{attentionCount}</span>
            <span className="ff-contacts-stat-label">Needs attention</span>
          </div>
        </div>
      )}

      <div className="ff-contacts-hero-footer">
        <p className="ff-contacts-next-action">
          Next action: {nextAction}
        </p>
        <div className="ff-contacts-hero-buttons">
          <span className="ff-contacts-admin-status">
            {canMutate ? "Admin mutations available" : "Read-only access"}
          </span>
          {!hasInstance ? (
            <span className="ff-contacts-admin-status">Select an instance</span>
          ) : null}
          {canMutate && hasInstance && (
            <button
              type="button"
              className="ff-contacts-primary-action"
              onClick={onCreateContact}
            >
              Create contact
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
