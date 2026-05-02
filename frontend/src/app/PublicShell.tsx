import { NavLink, Outlet, useLocation } from "react-router-dom";

import { normalizeNextPath } from "./authRouting";
import { CONTROL_PLANE_ROUTES } from "./navigation";
import { useTheme } from "../theme/ThemeProvider";
import { MoonIcon, SunIcon } from "../components/layout/icons";
import sidebarBrandLogoUrl from "../assets/ff_logo_small-2-tp.png";

/**
 * Public shell layout rendered for unauthenticated users.
 * Provides a split-panel auth experience: brand/security context on the left,
 * login form panel on the right.
 */
export function PublicShell() {
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const rawNextPath = new URLSearchParams(location.search).get("next");
  const nextPath = normalizeNextPath(rawNextPath);

  return (
    <div className="ff-public-shell">
      <header className="ff-public-header">
        <div className="ff-public-brand">
          <img
            src={sidebarBrandLogoUrl}
            alt="ForgeFrame"
            className="ff-public-logo"
          />
        </div>
        <button
          className="ff-icon-button"
          type="button"
          onClick={toggleMode}
          aria-label="Toggle theme"
        >
          {mode === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
      </header>

      <main className="ff-public-main">
        <section className="ff-public-copy">
          <h1>ForgeFrame</h1>
          <p>
            Sign in to operate Setup, Governance, Operations, Work Interaction,
            and Settings from the protected admin surface.
          </p>

          <nav
            aria-label="Authentication navigation"
            className="ff-auth-boundary-inline"
          >
            <span className="ff-status-badge" data-tone="info">
              Control Plane
            </span>
            <span className="ff-auth-description">
              <strong>Sign-In Boundary</strong> &mdash; The signed-out shell
              only exposes authentication. Protected control-plane modules stay
              behind the admin session boundary.
            </span>
            <NavLink
              className="fg-nav-link"
              to={CONTROL_PLANE_ROUTES.login}
            >
              Login
            </NavLink>
          </nav>

          {rawNextPath ? (
            <div className="ff-session-banner" data-tone="warning">
              <strong>Continue After Sign-In</strong>
              <span>
                {" "}
                Continue after sign-in to <code>{nextPath}</code>.
              </span>
            </div>
          ) : null}
        </section>

        <div className="ff-public-panel">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
