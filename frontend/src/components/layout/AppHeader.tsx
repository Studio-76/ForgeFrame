import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { AdminSessionUser } from "../../api/admin";
import type { NavigationSection } from "../../app/navigation";
import { CONTROL_PLANE_ROUTES, findNavigationMatch } from "../../app/navigation";
import { withQueryParams } from "../../app/tenantScope";
import { useTheme } from "../../theme/ThemeProvider";
import { useSidebar } from "./SidebarContext";
import { BellIcon, ChevronDownIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from "./icons";

type AppHeaderProps = {
  navigationSections: NavigationSection[];
  instanceId: string | null;
  session: AdminSessionUser | null;
  sessionError: string;
  onLogout: () => void;
};

type SearchResult = {
  label: string;
  description: string;
  to: string;
  section: string;
  badge?: string;
  disabled: boolean;
};

type SearchGroup = {
  section: string;
  items: SearchResult[];
};

function flattenNavigation(sections: NavigationSection[], instanceId: string | null): SearchResult[] {
  return sections.flatMap((section) =>
    section.links
      .map((link) => ({
        label: link.label,
        description: link.description,
        to: withQueryParams(link.to, { instanceId }),
        section: section.label,
        badge: link.badge,
        disabled: link.disabled === true,
      })),
  );
}

export function AppHeader({ navigationSections, instanceId, session, sessionError, onLogout }: AppHeaderProps) {
  const { mode, toggleMode } = useTheme();
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const shortcutLabel = typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘K" : "Ctrl K";

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const allResults = flattenNavigation(navigationSections, instanceId);
    if (!normalizedQuery) {
      return allResults.slice(0, 10);
    }
    return allResults
      .filter((item) =>
        `${item.label} ${item.description} ${item.section}`.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 12);
  }, [instanceId, navigationSections, query]);

  const searchGroups = useMemo<SearchGroup[]>(() => {
    const groupedResults = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      const sectionResults = groupedResults.get(result.section) ?? [];
      sectionResults.push(result);
      groupedResults.set(result.section, sectionResults);
    }
    return Array.from(groupedResults.entries()).map(([section, items]) => ({ section, items }));
  }, [searchResults]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setUserOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setUserOpen(false);
  }, [location.hash, location.pathname, location.search]);

  const chooseSearchResult = (to: string) => {
    setSearchOpen(false);
    setQuery("");
    void navigate(to);
  };

  const currentRoute = useMemo(() => {
    return findNavigationMatch(navigationSections, location.pathname, location.hash, instanceId);
  }, [instanceId, location.hash, location.pathname, navigationSections]);

  return (
    <header className="ff-topbar">
      <div className="ff-topbar-left">
        <button
          className="ff-icon-button ff-mobile-toggle"
          type="button"
          onClick={toggleMobileSidebar}
          aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
          aria-controls="ff-sidebar"
          aria-expanded={isMobileOpen}
        >
          <MenuIcon />
        </button>
        <button
          className="ff-icon-button ff-desktop-toggle"
          type="button"
          onClick={toggleSidebar}
          aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
          aria-controls="ff-sidebar"
          aria-expanded={isExpanded}
        >
          <MenuIcon />
        </button>
        <div className="ff-topbar-title">
          <span>{currentRoute?.section.label ?? "ForgeFrame"}</span>
          <strong>{currentRoute?.link.label ?? "Control Plane"}</strong>
        </div>
      </div>

      <div className="ff-command-wrap">
        <SearchIcon />
        <input
          ref={inputRef}
          className="ff-command-input"
          type="search"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          placeholder="Search command surfaces"
          aria-label="Search command surfaces"
          role="combobox"
          aria-expanded={searchOpen}
          aria-controls="ff-command-menu"
        />
        <kbd>{shortcutLabel}</kbd>
        {searchOpen ? (
          <div id="ff-command-menu" className="ff-command-menu" role="listbox" aria-label="Command surfaces">
            {searchGroups.length > 0 ? (
              searchGroups.map((group) => (
                <section key={group.section} className="ff-command-group" aria-label={group.section}>
                  <div className="ff-command-group-label">{group.section}</div>
                  {group.items.map((item) => (
                    <button
                      key={`${item.section}-${item.to}`}
                      type="button"
                      role="option"
                      aria-disabled={item.disabled}
                      className={item.disabled ? "is-disabled" : undefined}
                      onMouseDown={(event) => {
                        if (item.disabled) {
                          event.preventDefault();
                          return;
                        }
                        chooseSearchResult(item.to);
                      }}
                    >
                      <span>
                        <strong>{item.label}</strong>
                        <span className="ff-command-meta">
                          <small>{item.section}</small>
                          {item.badge ? <span className="ff-mini-badge">{item.badge}</span> : null}
                        </span>
                      </span>
                      <em>{item.description}</em>
                    </button>
                  ))}
                </section>
              ))
            ) : (
              <div className="ff-menu-empty">No matching ForgeFrame surface</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="ff-topbar-actions">
        <div className="ff-menu-anchor">
          <button
            className="ff-icon-button"
            type="button"
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setUserOpen(false);
            }}
            aria-label="Open attention surfaces"
            aria-expanded={notificationsOpen}
          >
            <BellIcon />
          </button>
          {notificationsOpen ? (
            <div className="ff-dropdown ff-dropdown-narrow">
              <div className="ff-dropdown-heading">
                <strong>Attention</strong>
                <span>Live operator routes</span>
              </div>
              <Link to={CONTROL_PLANE_ROUTES.approvals}>Approvals</Link>
              <Link to={CONTROL_PLANE_ROUTES.errors}>Errors</Link>
              <Link to={CONTROL_PLANE_ROUTES.logs}>Logs</Link>
              <Link to={CONTROL_PLANE_ROUTES.health}>Health</Link>
            </div>
          ) : null}
        </div>

        <button className="ff-icon-button" type="button" onClick={toggleMode} aria-label="Toggle theme">
          {mode === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>

        <div className="ff-menu-anchor">
          <button
            className="ff-user-button"
            type="button"
            onClick={() => {
              setUserOpen((current) => !current);
              setNotificationsOpen(false);
            }}
            aria-expanded={userOpen}
          >
            <span className="ff-avatar" aria-hidden="true">
              {(session?.display_name ?? session?.username ?? "A").slice(0, 1).toUpperCase()}
            </span>
            <span className="ff-user-copy">
              <strong>{session?.display_name ?? "Admin"}</strong>
              <small>{session?.role ?? "signed out"}</small>
            </span>
            <ChevronDownIcon />
          </button>
          {userOpen ? (
            <div className="ff-dropdown ff-user-dropdown">
              <div className="ff-dropdown-heading">
                <strong>{session?.display_name ?? session?.username ?? "Admin"}</strong>
                <span>{session?.read_only ? "Read-only session" : session?.role ?? "No active session"}</span>
              </div>
              {sessionError ? <p className="ff-dropdown-error">{sessionError}</p> : null}
              <Link to={CONTROL_PLANE_ROUTES.settings}>System Settings</Link>
              <Link to={CONTROL_PLANE_ROUTES.security}>Security & Policies</Link>
              <button type="button" onClick={onLogout}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
