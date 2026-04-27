import { Link, useLocation } from "react-router-dom";

import { isHrefCurrent } from "../app/navigation";
import { getInstanceIdFromSearchParams, withQueryParams } from "../app/tenantScope";
import { PageHeader } from "./ui/PageHeader";

type IntroBadge = {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
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
  question?: string;
  links?: PageIntroLink[];
  badges?: IntroBadge[];
  note?: string;
};

export function PageIntro({ eyebrow, title, description, question, links = [], badges = [], note }: PageIntroProps) {
  const location = useLocation();
  const scopeSearchParams = new URLSearchParams(location.search);
  const instanceId = getInstanceIdFromSearchParams(scopeSearchParams);

  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      badges={badges}
      actions={links.length > 0 ? (
        <div className="ff-compact-link-row" aria-label="Related routes">
          {links.map((link) => {
            const scopedTo = withQueryParams(link.to, { instanceId });
            const isCurrent = !link.disabled && isHrefCurrent(location.pathname, location.hash, scopedTo);
            const className = `ff-compact-link${isCurrent ? " is-current" : ""}${link.disabled ? " is-disabled" : ""}`;

            if (link.disabled) {
              return (
                <div key={`${link.label}-${link.to}`} className={className} aria-disabled="true">
                  <div className="ff-compact-link-copy">
                    <span>{link.label}</span>
                    <small>{link.description}</small>
                  </div>
                  {link.badge ? <small>{link.badge}</small> : null}
                </div>
              );
            }

            return (
              <Link key={`${link.label}-${link.to}`} className={className} to={scopedTo}>
                <div className="ff-compact-link-copy">
                  <span>{link.label}</span>
                  <small>{link.description}</small>
                </div>
                {link.badge ? <small>{link.badge}</small> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    >
      {question ? <p className="ff-page-header-support">{question}</p> : null}
      {note ? <p className="ff-page-header-note">{note}</p> : null}
    </PageHeader>
  );
}
