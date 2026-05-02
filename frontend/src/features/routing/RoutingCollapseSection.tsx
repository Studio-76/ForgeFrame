import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "../../components/ui/StatusBadge";

/**
 * Props for the enhanced collapse section.
 */
type RoutingCollapseSectionProps = {
  /** Unique element ID for scroll-targeting. */
  id: string;
  /** Section heading. */
  heading: string;
  /** Rich summary shown when collapsed. */
  summary: string;
  /** Status badge label. */
  badgeLabel: string;
  /** Status badge tone. */
  badgeTone: StatusTone;
  /** Badge status key for semantic coloring. */
  badgeStatus?: string | null;
  /** Open state from parent (controlled mode when provided). */
  open?: boolean;
  /** Toggle handler. */
  onToggle?: (open: boolean) => void;
  /** Section body content. */
  children: ReactNode;
};

/**
 * Enhanced collapsible section with a rich summary preview.
 * Operators can see the key state of each section without opening it.
 * When `open` and `onToggle` are provided the section is controlled from the parent,
 * otherwise it behaves as a standard uncontrolled details element.
 */
export function RoutingCollapseSection({
  id,
  heading,
  summary,
  badgeLabel,
  badgeTone,
  badgeStatus,
  open,
  onToggle,
  children,
}: RoutingCollapseSectionProps) {
  const isControlled = open !== undefined;

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (onToggle) {
      onToggle((event.target as HTMLDetailsElement).open);
    }
  };

  return (
    <details
      id={id}
      className="ff-collapse-section"
      open={isControlled ? open : undefined}
      onToggle={isControlled ? handleToggle : undefined}
    >
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>{heading}</h3>
          <p>{summary}</p>
        </div>
        <StatusBadge tone={badgeTone} status={badgeStatus ?? badgeLabel}>
          {badgeLabel}
        </StatusBadge>
      </summary>
      <div className="ff-collapse-section-body">{children}</div>
    </details>
  );
}
