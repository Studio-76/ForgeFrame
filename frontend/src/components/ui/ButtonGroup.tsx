import type { ReactNode } from "react";

/**
 * Renders a horizontal cluster of related buttons.
 *
 * Use when multiple actions share the same context (e.g. filter toggles,
 * view switchers). Attaches connected styling to grouped buttons.
 *
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant={view === "list" ? "primary" : "secondary"}>List</Button>
 *   <Button variant={view === "grid" ? "primary" : "secondary"}>Grid</Button>
 * </ButtonGroup>
 * ```
 */
export function ButtonGroup({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-px" role="group">
      {children}
    </div>
  );
}
