import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";

/**
 * A status badge descriptor for the page header.
 */
export type PageHeaderBadge = {
  label: ReactNode;
  tone?: StatusTone;
  status?: string | null;
};

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badges?: PageHeaderBadge[];
  actions?: ReactNode;
  children?: ReactNode;
};

/**
 * Page-level header with title, description, status badges, and actions.
 *
 * Every operational page should use this as its topmost header to
 * ensure consistent hierarchy, accessible landmarks, and action placement.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Provider Targets"
 *   description="Active execution targets for routing"
 *   badges={[{ label: "3 online", tone: "success" }]}
 *   actions={<Button variant="primary">Add target</Button>}
 * />
 * ```
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="ff-page-header-panel">
      <div className="ff-page-header-main">
        <div className="ff-page-header-copy">
          {eyebrow ? (
            <span className="fg-section-label text-meta text-muted font-medium uppercase tracking-wider">
              {eyebrow}
            </span>
          ) : null}
          {typeof title === "string" ? (
            <h1 className="text-title text-primary font-bold">{title}</h1>
          ) : (
            <h1>{title}</h1>
          )}
          {description ? (
            typeof description === "string" ? (
              <p className="ff-page-header-description text-meta text-muted mt-1">
                {description}
              </p>
            ) : (
              <div className="ff-page-header-description">{description}</div>
            )
          ) : null}
        </div>
        {badges.length > 0 ? (
          <div className="ff-page-header-badges flex items-center gap-2" aria-label="Page status">
            {badges.map((badge, index) => (
              <StatusBadge
                key={`${String(badge.label)}-${index}`}
                tone={badge.tone}
                status={badge.status}
              >
                {badge.label}
              </StatusBadge>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="ff-page-header-actions flex items-center gap-2 mt-2">{actions}</div>
      ) : null}
      {children ? <div className="ff-page-header-body mt-2">{children}</div> : null}
    </header>
  );
}
