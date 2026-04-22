import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { clearAdminToken, fetchAdminSession, getAdminToken, logoutAdmin, type AdminSessionUser } from "../api/admin";
import { getSessionRouteState } from "./authRouting";
import { CONTROL_PLANE_ROUTES, getControlPlaneNavigation, isHrefCurrent } from "./navigation";
import { getTenantIdFromSearchParams, withTenantScope } from "./tenantScope";
import { useTheme } from "../theme/ThemeProvider";

export function App() {
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const [session, setSession] = useState<AdminSessionUser | null>(null);
  const [sessionError, setSessionError] = useState<string>("");
  const [sessionReady, setSessionReady] = useState<boolean>(false);

  const navigationSections = getControlPlaneNavigation(session);
  const tenantId = getTenantIdFromSearchParams(new URLSearchParams(location.search));
  const routeState = getSessionRouteState({
    pathname: location.pathname,
    hasToken: Boolean(getAdminToken()),
    session,
    sessionReady,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setSessionReady(false);
      if (!getAdminToken()) {
        setSession(null);
        setSessionReady(true);
        return;
      }
      try {
        const payload = await fetchAdminSession();
        if (!mounted) {
          return;
        }
        setSession(payload.user);
        setSessionError("");
        setSessionReady(true);
      } catch (error) {
        clearAdminToken();
        if (!mounted) {
          return;
        }
        setSession(null);
        setSessionError(error instanceof Error ? error.message : "Session check failed.");
        setSessionReady(true);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const onLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // noop
    }
    clearAdminToken();
    setSession(null);
  };

  const markPasswordRotationComplete = () => {
    setSession((current) => (current ? { ...current, must_rotate_password: false } : current));
  };

  const passwordRotationNavigation = (
    <nav aria-label="Password rotation navigation" className="fg-card fg-auth-nav">
      <div className="fg-panel-heading">
        <div>
          <h3>Password Rotation Required</h3>
          <p className="fg-muted">This session can only rotate its password or log out until the temporary secret is replaced.</p>
        </div>
      </div>
      <NavLink className="fg-nav-link" to={CONTROL_PLANE_ROUTES.passwordRotation}>
        Rotate password
      </NavLink>
    </nav>
  );

  const controlPlaneNavigation = (
    <nav aria-label="Control-plane navigation" className="fg-section-nav">
      {navigationSections.map((section) => (
        <section key={section.label} className="fg-section-card">
          <div className="fg-section-card-header">
            <h3>{section.label}</h3>
            <p className="fg-muted">{section.description}</p>
          </div>
          <div className="fg-section-links">
            {section.links.map((link) => {
              const scopedTo = withTenantScope(link.to, tenantId);
              const isCurrent = isHrefCurrent(location.pathname, location.hash, scopedTo);
              const className = `fg-section-link${isCurrent ? " is-current" : ""}${link.disabled ? " is-disabled" : ""}`;

              if (link.disabled) {
                return (
                  <div key={`${section.label}-${link.to}`} aria-disabled="true" className={className}>
                    <div className="fg-section-link-copy">
                      <span className="fg-section-link-label">{link.label}</span>
                      <span className="fg-muted">{link.description}</span>
                    </div>
                    {link.badge ? <span className="fg-pill">{link.badge}</span> : null}
                  </div>
                );
              }

              return (
                <Link key={`${section.label}-${link.to}`} className={className} to={scopedTo}>
                  <div className="fg-section-link-copy">
                    <span className="fg-section-link-label">{link.label}</span>
                    <span className="fg-muted">{link.description}</span>
                  </div>
                  {link.badge ? <span className="fg-pill">{link.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  return (
    <div className="fg-shell fg-page">
      <header className="fg-row fg-row-spread">
        <div className="fg-page-header">
          <h1>ForgeGate — Smart AI Gateway</h1>
          <p className="fg-muted">UI-first Control Plane mit Auth, Accounts, Runtime Keys, Observability und Provider-Operatorik.</p>
          <p className="fg-muted">
            {session ? `Signed in as ${session.display_name} (${session.role})` : "No active admin session."}
          </p>
          {session?.must_rotate_password ? (
            <p className="fg-danger">Password rotation required before ForgeGate will open the standard control-plane routes.</p>
          ) : null}
          {sessionError ? <p className="fg-danger">{sessionError}</p> : null}
        </div>
        <div className="fg-actions">
          <button type="button" onClick={toggleMode}>
            Theme: {mode === "dark" ? "Dark (Default)" : "Light"}
          </button>
          {session ? (
            <button type="button" onClick={() => void onLogout()}>
              Logout
            </button>
          ) : null}
        </div>
      </header>

      {routeState.loading
        ? null
        : routeState.shellMode === "password_rotation"
          ? passwordRotationNavigation
          : routeState.shellMode === "control_plane"
            ? controlPlaneNavigation
            : null}

      <main>
        {routeState.loading ? (
          <article className="fg-card" style={{ maxWidth: "40rem" }}>
            <h2>Restoring Admin Session</h2>
            <p className="fg-muted">Checking the current admin session and its policy gates before opening the control plane.</p>
          </article>
        ) : routeState.redirectTo ? (
          <Navigate replace to={routeState.redirectTo} />
        ) : (
          <Outlet context={{ session, sessionReady, markPasswordRotationComplete, replaceSession: setSession }} />
        )}
      </main>
    </div>
  );
}
