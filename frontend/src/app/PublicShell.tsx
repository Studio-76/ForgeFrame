import { NavLink, Outlet, useLocation } from "react-router-dom";

import { normalizeNextPath } from "./authRouting";
import { CONTROL_PLANE_ROUTES } from "./navigation";
import { useTheme } from "../theme/ThemeProvider";
import { MoonIcon, SunIcon } from "../components/layout/icons";

export function PublicShell() {
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const rawNextPath = new URLSearchParams(location.search).get("next");
  const nextPath = normalizeNextPath(rawNextPath);

  return (
    <div className="ff-public-shell">
      <header className="ff-public-header">
        <div className="ff-brand-mark">
          <span className="ff-brand-symbol" aria-hidden="true">FF</span>
          <div className="ff-brand-copy">
            <strong>ForgeFrame</strong>
            <span>Autonomous AI Runtime Platform</span>
          </div>
        </div>
        <button className="ff-icon-button" type="button" onClick={toggleMode} aria-label="Toggle theme">
          {mode === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
      </header>

      <main className="ff-public-main">
        <section className="ff-public-copy">
          <span className="ff-status-badge" data-tone="info">Control Plane</span>
          <h1>ForgeFrame</h1>
          <p>Sign in to operate Setup, Governance, Operations, Work Interaction, and Settings from the protected admin surface.</p>
          <nav aria-label="Authentication navigation" className="ff-auth-boundary">
            <div>
              <h2>Sign-In Boundary</h2>
              <p>The signed-out shell only exposes authentication. Protected control-plane modules stay behind the admin session boundary.</p>
            </div>
            <NavLink className="fg-nav-link" to={CONTROL_PLANE_ROUTES.login}>
              Login
            </NavLink>
          </nav>
          {rawNextPath ? (
            <div className="ff-session-banner" data-tone="warning">
              <strong>Continue After Sign-In</strong>
              <span> Continue after sign-in to <code>{nextPath}</code>.</span>
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
