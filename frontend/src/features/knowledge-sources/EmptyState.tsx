/**
 * Focused empty-state component displayed when no knowledge sources exist.
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
  /** Handler to open the create knowledge source form. */
  onCreateSource: () => void;
}

/**
 * Focused empty state — one clear message with primary and secondary actions.
 */
export function EmptyState({
  canMutate,
  hasInstance,
  instanceId,
  onCreateSource,
}: EmptyStateProps) {
  const providersPath = instanceId
    ? `${CONTROL_PLANE_ROUTES.providers}?instanceId=${encodeURIComponent(instanceId)}`
    : CONTROL_PLANE_ROUTES.providers;

  return (
    <article className="fg-card ff-sources-empty ff-sources-tron-frame">
      <div className="ff-sources-empty-content">
        <span className="ff-sources-status-led" data-state="idle">
          No sources
        </span>
        <h3>No knowledge sources are configured for this scope</h3>
        <p className="ff-sources-empty-desc">
          Knowledge sources connect your instance to real data — mailboxes,
          calendars, contact directories, file libraries, and knowledge bases.
          Create a source to define what data is available for recall and
          durable memory.
        </p>
        <div className="ff-sources-empty-actions">
          <button
            type="button"
            className="ff-sources-primary-action"
            disabled={!canMutate || !hasInstance}
            onClick={onCreateSource}
          >
            Create knowledge source
          </button>
          <Link
            className="ff-sources-secondary-action"
            to={providersPath}
          >
            Review connectors
          </Link>
        </div>
      </div>
    </article>
  );
}
