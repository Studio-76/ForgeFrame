import type { ReactNode } from "react";

/**
 * A structured empty state with clear messaging and recommended actions.
 *
 * Follows the empty state UX pattern:
 * - **Clear state** — what's happening
 * - **Short explanation** — why there's nothing yet
 * - **One primary action** — what to do next
 * - **Optional secondary action** — alternative path
 *
 * @example
 * ```tsx
 * <EmptyState
 *   title="No provider targets"
 *   description="Add a provider target to start routing executions."
 *   primaryAction={<Button variant="primary">Add target</Button>}
 *   secondaryAction={<Button variant="navigation">Learn more</Button>}
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
  compact = false,
}: {
  title: string;
  description?: string;
  /** Single primary call-to-action. */
  primaryAction?: ReactNode;
  /** Optional secondary action (navigation or tertiary). */
  secondaryAction?: ReactNode;
  /** Optional icon/illustration element. */
  icon?: ReactNode;
  /** Compact variant for use inside tables and cards. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
        <p className="text-body text-muted font-medium">{title}</p>
        {description ? <p className="text-meta text-muted mt-1">{description}</p> : null}
        {primaryAction ? <div className="mt-3">{primaryAction}</div> : null}
      </div>
    );
  }

  return (
    <div
      className="ff-state-block flex flex-col items-center justify-center py-8 px-6 text-center"
      data-state="empty"
    >
      {icon ? <div className="mb-4 text-muted opacity-60">{icon}</div> : null}
      <strong className="text-body text-primary font-semibold">{title}</strong>
      {description ? (
        <p className="text-meta text-muted mt-1.5 max-w-md">{description}</p>
      ) : null}
      {primaryAction ? <div className="mt-4">{primaryAction}</div> : null}
      {secondaryAction ? <div className="mt-2">{secondaryAction}</div> : null}
    </div>
  );
}
