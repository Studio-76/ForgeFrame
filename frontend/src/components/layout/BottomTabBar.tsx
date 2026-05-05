import { Link, useLocation } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withQueryParams } from "../../app/tenantScope";
import { useSidebar } from "./SidebarContext";
import { NavIcon } from "./icons";

type TabItem = {
  label: string;
  icon: string;
  to: string;
};

/**
 * Primary navigation tabs shown on the bottom tab bar for mobile viewports.
 * Each tab has a touch target of at least 44px and shows an active indicator
 * when its route matches the current location.
 */
const BOTTOM_TABS: TabItem[] = [
  { label: "Dashboard", icon: "command", to: CONTROL_PLANE_ROUTES.dashboard },
  { label: "Conversations", icon: "work", to: CONTROL_PLANE_ROUTES.conversations },
  { label: "Providers", icon: "setup", to: CONTROL_PLANE_ROUTES.providers },
  { label: "Runtime", icon: "runtime", to: CONTROL_PLANE_ROUTES.execution },
  { label: "Settings", icon: "system", to: CONTROL_PLANE_ROUTES.settings },
];

export type BottomTabBarProps = {
  /** Current instance ID for scoping navigation links. */
  instanceId: string | null;
};

/**
 * Determine whether the current pathname belongs to a tab route.
 * @param pathname - Current location pathname.
 * @param tabPath - Tab root path.
 * @returns True when the tab should be highlighted as active.
 */
function isTabRouteActive(pathname: string, tabPath: string): boolean {
  if (tabPath === CONTROL_PLANE_ROUTES.dashboard && pathname === "/") {
    return true;
  }
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

/**
 * Bottom tab bar for mobile navigation.
 * Provides quick access to the five most common control-plane surfaces.
 * Touches the sidebar context to close mobile sidebar when a tab is activated.
 */
export function BottomTabBar({ instanceId }: BottomTabBarProps) {
  const location = useLocation();
  const { closeMobileSidebar } = useSidebar();

  return (
    <nav className="ff-bottom-tab-bar" aria-label="Primary navigation">
      {BOTTOM_TABS.map((tab) => {
        const scopedTo = withQueryParams(tab.to, { instanceId });
        const isActive = isTabRouteActive(location.pathname, tab.to);

        return (
          <Link
            key={tab.to}
            className={`ff-bottom-tab${isActive ? " is-active" : ""}`}
            to={scopedTo}
            onClick={closeMobileSidebar}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon name={tab.icon} />
            <span className="ff-bottom-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
