/**
 * Focused empty-state component displayed when no skills exist.
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
  /** Handler to open the create skill form. */
  onCreateSkill: () => void;
}

/**
 * Focused empty state — one clear message with primary and secondary actions.
 */
export function EmptyState({
  canMutate,
  hasInstance,
  instanceId,
  onCreateSkill,
}: EmptyStateProps) {
  const learningPath = instanceId
    ? `${CONTROL_PLANE_ROUTES.learning}?instanceId=${encodeURIComponent(instanceId)}`
    : CONTROL_PLANE_ROUTES.learning;

  return (
    <article className="fg-card ff-skills-empty ff-skills-tron-frame">
      <div className="ff-skills-empty-content">
        <span className="ff-skills-status-led" data-state="success">
          Registry empty
        </span>
        <h3>No skills are registered for this scope</h3>
        <p className="ff-skills-empty-desc">
          Skills define executable instructions that agents can run during
          work interactions. Create a skill to define a reusable capability,
          or review learning events that can promote draft skills from
          observed patterns.
        </p>
        <div className="ff-skills-empty-actions">
          <button
            type="button"
            className="ff-skills-primary-action"
            disabled={!canMutate || !hasInstance}
            onClick={onCreateSkill}
          >
            Create skill
          </button>
          <Link
            className="ff-skills-secondary-action"
            to={learningPath}
          >
            Review learning events
          </Link>
        </div>
      </div>
    </article>
  );
}
