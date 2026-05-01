import { Link, useLocation } from "react-router-dom";

import type { NavigationSection } from "../../app/navigation";
import { findNavigationMatch, isHrefCurrent } from "../../app/navigation";
import { withQueryParams } from "../../app/tenantScope";
import { Button } from "../ui/Button";
import { useSidebar } from "./SidebarContext";
import { ChevronDownIcon, CloseIcon, NavIcon } from "./icons";

type AppSidebarProps = {
  navigationSections: NavigationSection[];
  instanceId: string | null;
};

function getSectionCountLabel(section: NavigationSection) {
  const totalLinks = section.links.length;
  const enabledLinks = section.links.filter((link) => !link.disabled).length;

  return enabledLinks === totalLinks ? String(totalLinks) : `${enabledLinks}/${totalLinks}`;
}

export function AppSidebar({ navigationSections, instanceId }: AppSidebarProps) {
  const location = useLocation();
  const {
    isExpanded,
    isMobileOpen,
    closeMobileSidebar,
    isSectionOpen,
    toggleSection,
    openSection,
  } = useSidebar();
  const isDesktopOpen = isExpanded;
  const isSidebarOpen = isDesktopOpen || isMobileOpen;
  const activeMatch = findNavigationMatch(navigationSections, location.pathname, location.hash, instanceId);
  const activeSectionId = activeMatch?.section.id ?? null;

  return (
    <>
      <aside
        id="ff-sidebar"
        className={`ff-sidebar${isSidebarOpen ? " is-open" : " is-collapsed"}${isMobileOpen ? " is-mobile-open" : ""}`}
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
          <Button className="ff-icon-button ff-sidebar-close" aria-label="Close navigation" onPress={closeMobileSidebar}>
            <CloseIcon />
          </Button>
        </div>

        <nav className="ff-sidebar-nav" aria-label="Control-plane navigation">
          {navigationSections.map((section) => {
            const linksId = `ff-sidebar-section-${section.id}`;
            const isCurrentSection = activeSectionId === section.id;
            const isExpandedSection = isCurrentSection || isSectionOpen(section.id);
            const isSectionVisible = isSidebarOpen && isExpandedSection;
            const countLabel = getSectionCountLabel(section);
            const collapsedTooltip = `${section.label} (${countLabel})`;

            return (
              <section key={section.id} className="ff-sidebar-section">
                <Button
                  className={`ff-sidebar-section-trigger${isSectionVisible ? " is-open" : ""}${isCurrentSection ? " is-current" : ""}`}
                  aria-expanded={isSectionVisible}
                  aria-controls={linksId}
                  aria-label={isSidebarOpen ? `${section.label} section` : `Open ${section.label} section`}
                  data-tooltip={isSidebarOpen ? undefined : collapsedTooltip}
                  onPress={() => {
                    if (isCurrentSection) {
                      openSection(section.id);
                      return;
                    }
                    toggleSection(section.id);
                  }}
                >
                  <span className="ff-sidebar-section-leading">
                    <NavIcon name={section.icon} />
                    <span>{section.label}</span>
                  </span>
                  <span className="ff-sidebar-section-meta">
                    <span className="ff-mini-badge">{countLabel}</span>
                    <ChevronDownIcon />
                  </span>
                </Button>

                <div id={linksId} className="ff-sidebar-links" hidden={!isSectionVisible}>
                  {section.links.map((link) => {
                    const scopedTo = withQueryParams(link.to, { instanceId });
                    const isCurrent = isHrefCurrent(location.pathname, location.hash, scopedTo);
                    const className = `ff-sidebar-link${isCurrent ? " is-current" : ""}${link.disabled ? " is-disabled" : ""}`;

                    if (link.disabled) {
                      return (
                        <div
                          key={`${section.id}-${link.to}`}
                          className={className}
                          role="link"
                          aria-disabled="true"
                          aria-current={isCurrent ? "page" : undefined}
                        >
                          <span className="ff-sidebar-link-label">{link.label}</span>
                          {link.badge ? <span className="ff-mini-badge">{link.badge}</span> : null}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={`${section.id}-${link.to}`}
                        className={className}
                        to={scopedTo}
                        onClick={closeMobileSidebar}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        <span className="ff-sidebar-link-label">{link.label}</span>
                        {link.badge ? <span className="ff-mini-badge">{link.badge}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>
      </aside>
      {isMobileOpen ? <Button className="ff-backdrop" aria-label="Close navigation overlay" onPress={closeMobileSidebar} /> : null}
    </>
  );
}
