import { Link } from "react-router-dom";

import type { UxMetadata } from "./types";
import { uxAttributes } from "./types";

/**
 * A single navigation item in a ContextNavStrip.
 */
export type ContextNavItem = {
  /** Display label. */
  label: string;
  /** Route path (absolute). */
  to: string;
  /** Optional badge text shown next to the label. */
  badge?: string;
  /** Whether the link points to the current route. */
  isCurrent?: boolean;
  /** Whether the link is visually disabled (no href). */
  disabled?: boolean;
};

/**
 * Props for the ContextNavStrip component.
 */
export type ContextNavStripProps = {
  /** Navigation items to render. */
  items: ContextNavItem[];
  /** Section label visible above the strip. Defaults to "Related pages". */
  label?: string;
  /** Hide the section label entirely. */
  compact?: boolean;
  /** Additional CSS class names. */
  className?: string;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

/**
 * Compact cross-page navigation strip.
 *
 * Renders related-page links as an inline row of compact pill-style items
 * that are visually distinct from mutation actions. Use this component
 * wherever a page needs cross-page navigation links without the visual weight
 * of tiles, button bars, or primary-action styling.
 *
 * @example
 * ```tsx
 * <ContextNavStrip
 *   label="Related pages"
 *   items={[
 *     { label: "Execution Review", to: "/execution" },
 *     { label: "Dispatch", to: "/dispatch" },
 *     { label: "Errors & Activity", to: "/logs", badge: "3 new" },
 *   ]}
 * />
 * ```
 */
export function ContextNavStrip({
  items,
  label = "Related pages",
  compact = false,
  className = "",
  ux,
}: ContextNavStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={`ff-context-nav${className ? ` ${className}` : ""}`} aria-label={label} {...(ux ? uxAttributes(ux) : {})}>
      {!compact && label ? (
        <span className="ff-context-nav-label">{label}</span>
      ) : null}
      <div className="ff-context-nav-items">
        {items.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={`${item.label}-${item.to}`}
                className={`ff-context-nav-item is-disabled${item.isCurrent ? " is-current" : ""}`}
                aria-disabled="true"
              >
                <span className="ff-context-nav-item-label">{item.label}</span>
                {item.badge ? (
                  <span className="ff-context-nav-item-badge">{item.badge}</span>
                ) : null}
              </span>
            );
          }

          return (
            <Link
              key={`${item.label}-${item.to}`}
              className={`ff-context-nav-item${item.isCurrent ? " is-current" : ""}`}
              to={item.to}
              aria-current={item.isCurrent ? "page" : undefined}
            >
              <span className="ff-context-nav-item-label">{item.label}</span>
              {item.badge ? (
                <span className="ff-context-nav-item-badge">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
