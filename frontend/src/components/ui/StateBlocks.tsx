/**
 * @deprecated Import from individual modules or the ui/ barrel instead.
 *   - EmptyState → import { EmptyState } from "./EmptyState"
 *   - The new EmptyState supports primaryAction/secondaryAction pattern
 */

import { EmptyState as NewEmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import type { UxMetadata } from "./types";
import { uxAttributes } from "./types";

/**
 * Enhanced empty state with primary + secondary actions.
 * Re-exports the new EmptyState from `./EmptyState`.
 */
export function EmptyState({
  title,
  description,
  action,
  ux,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
}) {
  return (
    <NewEmptyState
      title={title}
      description={description}
      primaryAction={action}
      compact
      ux={ux}
    />
  );
}

export type StateBlockProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

export type BlockedStateProps = StateBlockProps & {
  status?: string | null;
  badgeLabel?: string;
};

function StateFrame({
  state,
  title,
  description,
  action,
  badge,
  ux,
}: StateBlockProps & { state: string; badge?: React.ReactNode }) {
  return (
    <div className="ff-state-block" data-state={state} {...(ux ? uxAttributes(ux) : {})}>
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
export function ErrorState({ title, description, action, ux }: StateBlockProps) {
  return <StateFrame state="error" title={title} description={description} action={action} ux={ux} />;
}

/**
 * Loading state skeleton block.
 */
export function LoadingState({ title = "Loading", description, ux }: Partial<StateBlockProps>) {
  return (
    <div className="ff-state-block" data-state="loading" {...(ux ? uxAttributes(ux) : {})}>
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
export function PermissionState({ title, description, action, ux }: StateBlockProps) {
  return (
    <StateFrame
      state="permission"
      title={title}
      description={description}
      action={action}
      ux={ux}
      badge={<StatusBadge status="waiting_approval">Permission limited</StatusBadge>}
    />
  );
}

/**
 * Blocked state block with status badge.
 */
export function BlockedState({ title, description, action, status = "blocked", badgeLabel, ux }: BlockedStateProps) {
  const normalizedStatus = status ?? "blocked";

  return (
    <StateFrame
      state="blocked"
      title={title}
      description={description}
      action={action}
      ux={ux}
      badge={<StatusBadge status={normalizedStatus}>{badgeLabel ?? normalizedStatus.replace(/_/g, " ")}</StatusBadge>}
    />
  );
}
