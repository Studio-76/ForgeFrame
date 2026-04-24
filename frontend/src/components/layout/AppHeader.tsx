import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { AdminSessionUser } from "../../api/admin";
import type { NavigationSection } from "../../app/navigation";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
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
};

function flattenNavigation(sections: NavigationSection[], instanceId: string | null): SearchResult[] {
  return sections.flatMap((section) =>
    section.links
      .filter((link) => !link.disabled)
      .map((link) => ({
        label: link.label,
        description: link.description,
        to: withQueryParams(link.to, { instanceId }),
        section: section.label,
      })),
  );
}

export function AppHeader({ navigationSections, instanceId, session, sessionError, onLogout }: AppHeaderProps) {
  const { mode, toggleMode } = useTheme();
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
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
      return allResults.slice(0, 6);
    }
    return allResults
      .filter((item) =>
        `${item.label} ${item.description} ${item.section}`.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [instanceId, navigationSections, query]);

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

  const chooseSearchResult = (to: string) => {
    setSearchOpen(false);
    setQuery("");
    void navigate(to);
  };

  const pageLabel = useMemo(() => {
    const allResults = flattenNavigation(navigationSections, instanceId);
    const match = allResults.find((item) => {
      const [targetPathWithSearch, rawTargetHash] = item.to.split("#");
      const [targetPath] = targetPathWithSearch.split("?");
      const targetHash = rawTargetHash ? `#${rawTargetHash}` : "";
      return location.pathname === targetPath && location.hash === targetHash;
    });
    return match?.label ?? "Control Plane";
  }, [instanceId, location.hash, location.pathname, navigationSections]);

  return (
    <header className="ff-topbar">
      <div className="ff-topbar-left">
        <button className="ff-icon-button ff-mobile-toggle" type="button" onClick={toggleMobileSidebar} aria-label="Open navigation">
          <MenuIcon />
        </button>
        <button className="ff-icon-button ff-desktop-toggle" type="button" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <MenuIcon />
        </button>
        <div className="ff-topbar-title">
          <span>ForgeFrame</span>
          <strong>{pageLabel}</strong>
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
        />
        <kbd>{shortcutLabel}</kbd>
        {searchOpen ? (
          <div className="ff-command-menu">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button key={`${item.section}-${item.to}`} type="button" onMouseDown={() => chooseSearchResult(item.to)}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.section}</small>
                  </span>
                  <em>{item.description}</em>
                </button>
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
