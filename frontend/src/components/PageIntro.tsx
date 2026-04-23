import { Link, useLocation } from "react-router-dom";

import { isHrefCurrent } from "../app/navigation";
import { getInstanceIdFromSearchParams, withQueryParams } from "../app/tenantScope";

type IntroBadge = {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
};

export type PageIntroLink = {
  label: string;
  to: string;
  description: string;
  badge?: string;
  disabled?: boolean;
};

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  question: string;
  links: PageIntroLink[];
  badges?: IntroBadge[];
  note?: string;
};

export function PageIntro({ eyebrow, title, description, question, links, badges = [], note }: PageIntroProps) {
  const location = useLocation();
  const scopeSearchParams = new URLSearchParams(location.search);
  const instanceId = getInstanceIdFromSearchParams(scopeSearchParams);

  return (
    <div className="fg-card fg-page-intro">
      <div className="fg-panel-heading">
        <div className="fg-page-header">
          <span className="fg-section-label">{eyebrow}</span>
          <h2>{title}</h2>
          <p className="fg-muted">{description}</p>
          <p className="fg-page-question">{question}</p>
        </div>
        {badges.length > 0 ? (
          <div className="fg-actions">
            {badges.map((badge) => (
              <span key={badge.label} className="fg-pill" data-tone={badge.tone ?? "neutral"}>
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="fg-wayfinding-grid">
        {links.map((link) => {
          const scopedTo = withQueryParams(link.to, { instanceId });
          const isCurrent = !link.disabled && isHrefCurrent(location.pathname, location.hash, scopedTo);
          const className = `fg-wayfinding-link${isCurrent ? " is-current" : ""}${link.disabled ? " is-disabled" : ""}`;

          if (link.disabled) {
            return (
              <div key={`${link.label}-${link.to}`} className={className} aria-disabled="true">
                <div className="fg-wayfinding-label">
                  <strong>{link.label}</strong>
                  {link.badge ? <span className="fg-pill">{link.badge}</span> : null}
                </div>
                <span className="fg-muted">{link.description}</span>
              </div>
            );
          }

          return (
            <Link key={`${link.label}-${link.to}`} className={className} to={scopedTo}>
              <div className="fg-wayfinding-label">
                <strong>{link.label}</strong>
                {link.badge ? <span className="fg-pill">{link.badge}</span> : null}
              </div>
              <span className="fg-muted">{link.description}</span>
            </Link>
          );
        })}
      </div>

      {note ? <p className="fg-note">{note}</p> : null}
    </div>
  );
}
