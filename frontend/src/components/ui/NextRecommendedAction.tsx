import type { ReactNode } from "react";

/**
 * A compact callout showing the single next recommended action for a user.
 *
 * Use in empty states, after successful operations, or when a workflow
 * is paused waiting on user input.
 *
 * @example
 * ```tsx
 * <NextRecommendedAction action={<NavigationAction>Create provider</NavigationAction>}>
 *   Add at least one provider target to enable execution.
 * </NextRecommendedAction>
 * ```
 */
export function NextRecommendedAction({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-subtle">
      <span
        aria-hidden="true"
        className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-bold"
      >
        →
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-meta text-muted leading-relaxed">{children}</p>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
