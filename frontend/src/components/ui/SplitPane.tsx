import type { ReactNode } from "react";

/**
 * A horizontal split layout with a primary content area and a detail panel.
 *
 * Use for master-detail views, list+detail pages, and side-by-side
 * comparison layouts. The right/top panel scrolls independently.
 *
 * @example
 * ```tsx
 * <SplitPane
 *   main={<EntityTable ... />}
 *   detail={<DetailPanel title="Details">...</DetailPanel>}
 * />
 * ```
 */
export function SplitPane({
  main,
  detail,
  detailPosition = "right",
  detailMinWidth = "320px",
  className = "",
}: {
  main: ReactNode;
  detail: ReactNode;
  /** Side where the detail panel appears. Defaults to "right". */
  detailPosition?: "right" | "left";
  /** Minimum width of the detail panel before wrapping. */
  detailMinWidth?: string;
  className?: string;
}) {
  const mainOrder = detailPosition === "right" ? "order-1" : "order-2";
  const detailOrder = detailPosition === "right" ? "order-2" : "order-1";

  return (
    <div
      className={`flex flex-col lg:flex-row gap-4 ${className}`}
      style={{ minHeight: 0 }}
    >
      <div className={`flex-1 min-w-0 ${mainOrder}`}>{main}</div>
      <div
        className={`lg:w-[var(--pane-detail-width,420px)] flex-shrink-0 ${detailOrder}`}
        style={{ minWidth: detailMinWidth }}
      >
        {detail}
      </div>
    </div>
  );
}
