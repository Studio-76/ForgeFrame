import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./StatusBadge";

type PageHeaderBadge = {
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
          {eyebrow ? <span className="fg-section-label">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p className="ff-page-header-description">{description}</p> : null}
        </div>
        {badges.length > 0 ? (
          <div className="ff-page-header-badges" aria-label="Page status">
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
      {actions ? <div className="ff-page-header-actions">{actions}</div> : null}
      {children ? <div className="ff-page-header-body">{children}</div> : null}
    </header>
  );
}
