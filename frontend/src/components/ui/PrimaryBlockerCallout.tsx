import type { ReactNode } from "react";

import type { StatusTone } from "./types";

/**
 * A high-visibility callout explaining why a workflow is blocked.
 *
 * Follows the blocker pattern:
 * - **What** is wrong
 * - **Why** it matters
 * - **How** to fix it
 * - **Where** to fix it
 *
 * @example
 * ```tsx
 * <PrimaryBlockerCallout
 *   title="API key expired"
 *   tone="danger"
 *   action={<Button variant="navigation">Manage keys</Button>}
 * >
 *   The provider API key for OpenAI expired 3 days ago. New executions
 *   will fail until the key is rotated. Go to Provider Settings to update.
 * </PrimaryBlockerCallout>
 * ```
 */
export function PrimaryBlockerCallout({
  title,
  description,
  children,
  tone = "danger",
  action,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: StatusTone;
  /** Primary action to resolve the blocker. */
  action?: ReactNode;
}) {
  const borderColor =
    tone === "danger"
      ? "border-danger-border"
      : tone === "warning"
        ? "border-warning-border"
        : "border-border";

  const bgColor =
    tone === "danger"
      ? "bg-danger-soft"
      : tone === "warning"
        ? "bg-warning-soft"
        : "bg-surface-subtle";

  return (
    <div
      className={`ff-state-block relative flex flex-col gap-3 p-4 rounded-lg border ${borderColor} ${bgColor}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
            tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-muted"
          }`}
        />
        <div className="flex flex-col gap-1">
          <strong className="text-body text-primary font-semibold">{title}</strong>
          {description ? <p className="text-meta text-muted">{description}</p> : null}
          {children ? <div className="text-meta text-muted leading-relaxed">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex justify-end">{action}</div> : null}
    </div>
  );
}
