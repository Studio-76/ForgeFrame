/**
 * Focused empty-state component displayed when no skills exist.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import { Button, StatusBadge } from "../../components/ui";
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
    <article className="fg-card ff-skills-empty ff-frame-accent">
      <div className="ff-skills-empty-content">
        <StatusBadge tone="success">Registry empty</StatusBadge>
        <h3>No skills are registered for this scope</h3>
        <p className="ff-skills-empty-desc">
          Skills define executable instructions that agents can run during
          work interactions. Create a skill to define a reusable capability,
          or review learning events that can promote draft skills from
          observed patterns.
        </p>
        <div className="ff-skills-empty-actions">
          <Button
            variant="primary"
            isDisabled={!canMutate || !hasInstance}
            onPress={onCreateSkill}
          >
            Create skill
          </Button>
          <Link
            className="ff-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-body font-medium leading-none rounded-md border border-border text-muted hover:border-accent hover:text-primary transition-all duration-100 no-underline"
            to={learningPath}
          >
            Review learning events
          </Link>
        </div>
      </div>
    </article>
  );
}
