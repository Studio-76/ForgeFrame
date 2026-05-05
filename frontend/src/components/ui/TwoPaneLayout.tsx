/**
 * TwoPaneOperationalLayout — a reusable two-pane split layout
 * for browse-and-detail interaction patterns.
 *
 * Wraps `ff-operator-layout` CSS grid with typed main/sidebar slots,
 * responsive collapse to single-pane on compact screens, and optional
 * sticky sidebar for long detail panels.
 *
 * @packageDocumentation
 */

import type { ReactNode } from "react";

/**
 * Props for the TwoPaneOperationalLayout component.
 */
export type TwoPaneOperationalLayoutProps = {
  /** Left/main pane content (usually a DataTable or list). */
  main: ReactNode;
  /** Right/sidebar pane content (usually a DetailPanel). */
  sidebar: ReactNode;
  /**
   * Whether the sidebar is visible.
   * When false on compact screens, only the main pane renders.
   * Default: true
   */
  sidebarOpen?: boolean;
  /**
   * CSS class name(s) to apply to the layout container.
   * Useful for overriding the grid template columns.
   */
  className?: string;
  /**
   * Whether to make the sidebar sticky (follows scroll).
   * Default: false
   */
  stickySidebar?: boolean;
};

/**
 * TwoPaneOperationalLayout renders a two-column grid layout
 * with the main content on the left and a detail/sidebar panel
 * on the right.
 *
 * The layout collapses to single-column on screens narrower than 1024px
 * (handled by `@media` in the CSS `ff-operator-layout` rule).
 *
 * @example
 * ```tsx
 * <TwoPaneOperationalLayout
 *   main={<DataTable data={items} columns={columns} />}
 *   sidebar={
 *     <DetailPanel title={selected.label} sticky>
 *       <p>Detail content here</p>
 *     </DetailPanel>
 *   }
 * />
 * ```
 */
export function TwoPaneOperationalLayout({
  main,
  sidebar,
  sidebarOpen = true,
  className,
  stickySidebar = false,
}: TwoPaneOperationalLayoutProps) {
  return (
    <div className={`ff-operator-layout${className ? ` ${className}` : ""}`}>
      <div className="ff-operator-main">
        {main}
      </div>
      {sidebarOpen ? (
        <div className={`ff-operator-sidebar${stickySidebar ? " ff-operator-sidebar-sticky" : ""}`}>
          {sidebar}
        </div>
      ) : null}
    </div>
  );
}
