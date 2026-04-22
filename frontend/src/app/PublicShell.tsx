import { NavLink, Outlet, useLocation } from "react-router-dom";

import { normalizeNextPath } from "./authRouting";
import { CONTROL_PLANE_ROUTES } from "./navigation";
import { useTheme } from "../theme/ThemeProvider";

export function PublicShell() {
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const rawNextPath = new URLSearchParams(location.search).get("next");
  const nextPath = normalizeNextPath(rawNextPath);

  return (
    <div className="fg-shell fg-page">
      <header className="fg-row fg-row-spread">
        <div className="fg-page-header">
          <h1>ForgeGate — Smart AI Gateway</h1>
          <p className="fg-muted">Signed-out entry shell for control-plane authentication and protected-route recovery.</p>
          <p className="fg-muted">Sign in before opening Setup, Governance, Operations, or Settings.</p>
        </div>
        <div className="fg-actions">
          <button type="button" onClick={toggleMode}>
            Theme: {mode === "dark" ? "Dark (Default)" : "Light"}
          </button>
        </div>
      </header>

      <nav aria-label="Authentication navigation" className="fg-card fg-auth-nav">
        <div className="fg-panel-heading">
          <div>
            <h3>Sign-In Boundary</h3>
            <p className="fg-muted">The signed-out shell only exposes authentication. Protected control-plane modules stay behind the admin session boundary.</p>
          </div>
        </div>
        <NavLink className="fg-nav-link" to={CONTROL_PLANE_ROUTES.login}>
          Login
        </NavLink>
      </nav>

      {rawNextPath ? (
        <article className="fg-card">
          <h3>Continue After Sign-In</h3>
          <p className="fg-muted">
            Sign in to continue to <code>{nextPath}</code>.
          </p>
        </article>
      ) : null}

      <main>
        <Outlet />
      </main>
    </div>
  );
}
