import { Link, useLocation } from "react-router-dom";

import type { NavigationSection } from "../../app/navigation";
import { isHrefCurrent } from "../../app/navigation";
import { withQueryParams } from "../../app/tenantScope";
import { useSidebar } from "./SidebarContext";
import { CloseIcon, NavIcon } from "./icons";

type AppSidebarProps = {
  navigationSections: NavigationSection[];
  instanceId: string | null;
};

function getSectionIcon(label: string) {
  switch (label) {
    case "Home":
      return "home";
    case "Setup":
      return "setup";
    case "Governance":
      return "governance";
    case "Operations":
      return "operations";
    case "Work Interaction":
      return "work";
    case "Settings":
      return "settings";
    default:
      return "default";
  }
}

export function AppSidebar({ navigationSections, instanceId }: AppSidebarProps) {
  const location = useLocation();
  const { isExpanded, isHovered, isMobileOpen, setIsHovered, closeMobileSidebar } = useSidebar();
  const isOpen = isExpanded || isHovered || isMobileOpen;

  return (
    <>
      <aside
        className={`ff-sidebar${isOpen ? " is-open" : " is-collapsed"}${isMobileOpen ? " is-mobile-open" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="ff-sidebar-brand">
          <Link to="/dashboard" className="ff-brand-mark" onClick={closeMobileSidebar}>
            <span className="ff-brand-symbol" aria-hidden="true">
              FF
            </span>
            <span className="ff-brand-copy">
              <strong>ForgeFrame</strong>
              <span>Control Plane</span>
            </span>
          </Link>
          <button className="ff-icon-button ff-sidebar-close" type="button" onClick={closeMobileSidebar} aria-label="Close navigation">
            <CloseIcon />
          </button>
        </div>

        <nav className="ff-sidebar-nav" aria-label="ForgeFrame navigation">
          {navigationSections.map((section) => (
            <section key={section.label} className="ff-sidebar-section">
              <div className="ff-sidebar-section-label">
                <NavIcon name={getSectionIcon(section.label)} />
                <span>{section.label}</span>
              </div>
              <div className="ff-sidebar-links">
                {section.links.map((link) => {
                  const scopedTo = withQueryParams(link.to, { instanceId });
                  const isCurrent = isHrefCurrent(location.pathname, location.hash, scopedTo);
                  const className = `ff-sidebar-link${isCurrent ? " is-current" : ""}${link.disabled ? " is-disabled" : ""}`;

                  if (link.disabled) {
                    return (
                      <div key={`${section.label}-${link.to}`} className={className} aria-disabled="true">
                        <span className="ff-sidebar-link-label">{link.label}</span>
                        {link.badge ? <span className="ff-mini-badge">{link.badge}</span> : null}
                      </div>
                    );
                  }

                  return (
                    <Link key={`${section.label}-${link.to}`} className={className} to={scopedTo} onClick={closeMobileSidebar}>
                      <span className="ff-sidebar-link-label">{link.label}</span>
                      {link.badge ? <span className="ff-mini-badge">{link.badge}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      {isMobileOpen ? <button className="ff-backdrop" type="button" aria-label="Close navigation overlay" onClick={closeMobileSidebar} /> : null}
    </>
  );
}
