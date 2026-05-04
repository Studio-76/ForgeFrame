import type { ReactNode } from "react";

import type { StatusTone } from "./types";
import { toneToTailwind } from "./types";

/**
 * A compact rounded pill for status indicators.
 *
 * More compact than StatusBadge. Best for inline tags,
 * state labels, and attribute badges inside tables and cards.
 *
 * @example
 * ```tsx
 * <StatusPill tone="success">Active</StatusPill>
 * <StatusPill tone="warning" dot>Pending</StatusPill>
 * ```
 */
export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: StatusTone;
  /** Show a small colored dot before the label. */
  dot?: boolean;
}) {
  const classes = toneToTailwind(tone);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-meta font-medium leading-tight ${classes.pill}`}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={`inline-block w-1.5 h-1.5 rounded-full ${classes.bg}`}
        />
      ) : null}
      {children}
    </span>
  );
}
