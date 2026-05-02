import { useEffect, useRef } from "react";
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

/**
 * Find the first non-disabled link for a section, used as navigation target
 * when clicking a collapsed rail icon.
 */
function getFirstActiveLink(section: NavigationSection): string | null {
  for (const link of section.links) {
    if (!link.disabled) {
      return link.to;
    }
  }
  return null;
}

export function AppSidebar({ navigationSections, instanceId }: AppSidebarProps) {
  const location = useLocation();
  const {
    isExpanded,
    isMobile,
    isMobileOpen,
    closeMobileSidebar,
    setSidebarExpanded,
    isSectionOpen,
    toggleSection,
    openSection,
  } = useSidebar();
  const isDesktopOpen = isExpanded;
  const isSidebarOpen = isDesktopOpen || isMobileOpen;
  const activeMatch = findNavigationMatch(navigationSections, location.pathname, location.hash, instanceId);
  const activeSectionId = activeMatch?.section.id ?? null;

  // Auto-open the currently active section when navigation changes to it.
  // Only fires on section change so the user can still manually collapse it.
  const prevSectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeSectionId && activeSectionId !== prevSectionRef.current) {
      openSection(activeSectionId);
      prevSectionRef.current = activeSectionId;
    }
  }, [activeSectionId, openSection]);

  /**
   * Handle section trigger press.
   * In expanded mode: toggle section open/closed.
   * In collapsed (rail) mode: expand sidebar and open the section.
   */
  const handleSectionPress = (sectionId: string) => {
    if (!isSidebarOpen) {
      setSidebarExpanded(true);
      openSection(sectionId);
    } else {
      toggleSection(sectionId);
    }
  };

  /**
   * Handle close/collapse button press.
   * On mobile: close the overlay.
   * On desktop: collapse sidebar to icon rail.
   */
  const handleClosePress = () => {
    if (isMobile) {
      closeMobileSidebar();
    } else if (isSidebarOpen) {
      setSidebarExpanded(false);
    }
  };

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
          {isSidebarOpen ? (
            <Button
              className="ff-icon-button ff-sidebar-close"
              aria-label={isMobile ? "Close navigation" : "Collapse sidebar"}
              onPress={handleClosePress}
            >
              <CloseIcon />
            </Button>
          ) : null}
        </div>

        <nav className="ff-sidebar-nav" aria-label="Control-plane navigation">
          {navigationSections.map((section) => {
            const linksId = `ff-sidebar-section-${section.id}`;
            const isCurrentSection = activeSectionId === section.id;
            const isExpandedSection = isSectionOpen(section.id);
            const isSectionVisible = isSidebarOpen && isExpandedSection;
            const countLabel = getSectionCountLabel(section);
            const collapsedTooltip = `${section.label} (${countLabel})`;
            const firstActiveLink = getFirstActiveLink(section);

            return (
              <section key={section.id} className={`ff-sidebar-section${isCurrentSection ? " is-current" : ""}`}>
                {isSidebarOpen ? (
                  /* Expanded mode: section trigger toggles sub-links */
                  <Button
                    className={`ff-sidebar-section-trigger${isExpandedSection ? " is-open" : ""}${isCurrentSection ? " is-current" : ""}`}
                    aria-expanded={isExpandedSection}
                    aria-controls={linksId}
                    aria-label={`${section.label} section`}
                    onPress={() => handleSectionPress(section.id)}
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
                ) : (
                  /* Collapsed (rail) mode: icon-only button, navigates or expands */
                  <Button
                    className={`ff-sidebar-rail-link${isCurrentSection ? " is-current" : ""}`}
                    aria-label={collapsedTooltip}
                    data-tooltip={collapsedTooltip}
                    onPress={() => handleSectionPress(section.id)}
                  >
                    <NavIcon name={section.icon} />
                  </Button>
                )}

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
