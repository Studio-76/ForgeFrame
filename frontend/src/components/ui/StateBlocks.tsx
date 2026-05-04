/**
 * @deprecated Import from individual modules or the ui/ barrel instead.
 *   - EmptyState → import { EmptyState } from "./EmptyState"
 *   - The new EmptyState supports primaryAction/secondaryAction pattern
 */

import { EmptyState as NewEmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";

/**
 * Enhanced empty state with primary + secondary actions.
 * Re-exports the new EmptyState from `./EmptyState`.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <NewEmptyState
      title={title}
      description={description}
      primaryAction={action}
      compact
    />
  );
}

type StateBlockProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

type BlockedStateProps = StateBlockProps & {
  status?: string | null;
  badgeLabel?: string;
};

function StateFrame({
  state,
  title,
  description,
  action,
  badge,
}: StateBlockProps & { state: string; badge?: React.ReactNode }) {
  return (
    <div className="ff-state-block" data-state={state}>
      {badge ? <div className="ff-state-badge">{badge}</div> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="ff-state-actions">{action}</div> : null}
    </div>
  );
}

/**
 * @deprecated Use EmptyState from ./EmptyState for new code.
 * Kept for backward compatibility with existing pages.
 */
export function ErrorState({ title, description, action }: StateBlockProps) {
  return <StateFrame state="error" title={title} description={description} action={action} />;
}

/**
 * Loading state skeleton block.
 */
export function LoadingState({ title = "Loading", description }: Partial<StateBlockProps>) {
  return (
    <div className="ff-state-block" data-state="loading">
      <div className="ff-skeleton-row" />
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

/**
 * Skeleton placeholder rows.
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ff-skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ff-skeleton-row" />
      ))}
    </div>
  );
}

/**
 * Permission-limited state block.
 */
export function PermissionState({ title, description, action }: StateBlockProps) {
  return (
    <StateFrame
      state="permission"
      title={title}
      description={description}
      action={action}
      badge={<StatusBadge status="waiting_approval">Permission limited</StatusBadge>}
    />
  );
}

/**
 * Blocked state block with status badge.
 */
export function BlockedState({ title, description, action, status = "blocked", badgeLabel }: BlockedStateProps) {
  const normalizedStatus = status ?? "blocked";

  return (
    <StateFrame
      state="blocked"
      title={title}
      description={description}
      action={action}
      badge={<StatusBadge status={normalizedStatus}>{badgeLabel ?? normalizedStatus.replace(/_/g, " ")}</StatusBadge>}
    />
  );
}
