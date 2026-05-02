import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

import sidebarRailLogoUrl from "../../assets/ff_logo_small.png";
import sidebarBrandLogoUrl from "../../assets/ff_logo_small-2-tp.png";
import type { NavigationSection } from "../../app/navigation";
import { findNavigationMatch, isHrefCurrent } from "../../app/navigation";
import { withQueryParams } from "../../app/tenantScope";
import { Button } from "../ui/Button";
import { useSidebar } from "./SidebarContext";
import { ChevronDownIcon, NavIcon } from "./icons";

type AppSidebarProps = {
  navigationSections: NavigationSection[];
  instanceId: string | null;
};

/**
 * Count enabled section links for the compact sidebar section badge.
 * @param section - Navigation section to count.
 * @returns Label with enabled and total link counts.
 */
function getSectionCountLabel(section: NavigationSection) {
  const totalLinks = section.links.length;
  const enabledLinks = section.links.filter((link) => !link.disabled).length;

  return enabledLinks === totalLinks ? String(totalLinks) : `${enabledLinks}/${totalLinks}`;
}

/**
 * Render the ForgeFrame control-plane sidebar navigation.
 * @param props - Sidebar navigation sections and optional instance scope.
 * @returns Sidebar navigation shell with expandable route groups.
 */
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
  const brandActionLabel = isMobile
    ? "Close navigation"
    : isSidebarOpen
      ? "Collapse sidebar"
      : "Expand sidebar";
  const brandLogoUrl = isSidebarOpen ? sidebarBrandLogoUrl : sidebarRailLogoUrl;

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
   * Handle brand press as the sidebar expand/collapse control.
   * On mobile it closes the overlay; on desktop it toggles the icon rail.
   */
  const handleBrandPress = () => {
    if (isMobile) {
      closeMobileSidebar();
    } else {
      setSidebarExpanded(!isSidebarOpen);
    }
  };

  return (
    <>
      <aside
        id="ff-sidebar"
        className={`ff-sidebar${isSidebarOpen ? " is-open" : " is-collapsed"}${isMobileOpen ? " is-mobile-open" : ""}`}
      >
        <div className="ff-sidebar-brand">
          <Button
            className="ff-brand-mark"
            aria-expanded={isSidebarOpen}
            aria-label={brandActionLabel}
            title={brandActionLabel}
            data-tooltip={brandActionLabel}
            onPress={handleBrandPress}
          >
            <span className="ff-brand-symbol" aria-hidden="true">
              <img
                className="ff-brand-logo"
                src={brandLogoUrl}
                alt=""
                width={isSidebarOpen ? 134 : 75}
                height={75}
              />
            </span>
          </Button>
        </div>

        <nav className="ff-sidebar-nav" aria-label="Control-plane navigation">
          {navigationSections.map((section) => {
            const linksId = `ff-sidebar-section-${section.id}`;
            const isCurrentSection = activeSectionId === section.id;
            const isExpandedSection = isSectionOpen(section.id);
            const isSectionVisible = isSidebarOpen && isExpandedSection;
            const sectionState = isSectionVisible ? "open" : "closed";
            const countLabel = getSectionCountLabel(section);
            const collapsedTooltip = `${section.label} (${countLabel})`;
            const sectionLinks = isSectionVisible
              ? section.links.map((link) => {
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
                })
              : null;

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
                      {isCurrentSection ? <i className="ff-sidebar-current-indicator" aria-hidden="true" /> : null}
                    </span>
                    <span className="ff-sidebar-section-meta">
                      <span className="ff-mini-badge">{countLabel}</span>
                      <ChevronDownIcon />
                    </span>
                  </Button>
                ) : (
                  /* Collapsed (rail) mode: icon-only button expands and opens a section */
                  <Button
                    className={`ff-sidebar-rail-link${isCurrentSection ? " is-current" : ""}`}
                    aria-label={collapsedTooltip}
                    data-tooltip={collapsedTooltip}
                    onPress={() => handleSectionPress(section.id)}
                  >
                    <NavIcon name={section.icon} />
                  </Button>
                )}

                <div id={linksId} className="ff-sidebar-links" data-state={sectionState} hidden={!isSectionVisible}>
                  {sectionLinks}
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
