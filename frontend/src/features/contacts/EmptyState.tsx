/**
 * Focused empty-state component displayed when no contacts exist.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";

/** Props for EmptyState. */
export interface EmptyStateProps {
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether an instance is selected. */
  hasInstance: boolean;
  /** The current instance ID (for navigation links). */
  instanceId: string;
  /** Handler to open the create contact form. */
  onCreateContact: () => void;
}

/**
 * Focused empty state — one clear message with primary and secondary actions.
 */
export function EmptyState({
  canMutate,
  hasInstance,
  instanceId,
  onCreateContact,
}: EmptyStateProps) {
  const knowledgeSourcesPath = instanceId
    ? `${CONTROL_PLANE_ROUTES.knowledgeSources}?instanceId=${encodeURIComponent(instanceId)}`
    : CONTROL_PLANE_ROUTES.knowledgeSources;

  return (
    <article className="fg-card ff-contacts-empty ff-contacts-tron-frame">
      <div className="ff-contacts-empty-content">
        <span className="ff-contacts-status-led" data-state="success">
          No contacts configured
        </span>
        <h3>No contacts are configured for this scope</h3>
        <p className="ff-contacts-empty-desc">
          Contacts define reachable people and services that ForgeFrame can
          notify, route work to, or reference in conversations. Create a
          contact to establish a governed communication channel, or review
          knowledge sources that may contain contact data for import.
        </p>
        <div className="ff-contacts-empty-actions">
          <button
            type="button"
            className="ff-contacts-primary-action"
            disabled={!canMutate || !hasInstance}
            onClick={onCreateContact}
          >
            Create contact
          </button>
          <Link
            className="ff-contacts-secondary-action"
            to={knowledgeSourcesPath}
          >
            Review knowledge sources
          </Link>
        </div>
      </div>
    </article>
  );
}
