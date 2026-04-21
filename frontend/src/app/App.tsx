import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { clearAdminToken, fetchAdminSession, getAdminToken, logoutAdmin, type AdminSessionUser } from "../api/admin";
import { useTheme } from "../theme/ThemeProvider";

const navItems = [
  { to: "/login", label: "Login" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/providers", label: "Providers" },
  { to: "/accounts", label: "Accounts" },
  { to: "/api-keys", label: "API Keys" },
  { to: "/security", label: "Security" },
  { to: "/usage", label: "Usage" },
  { to: "/logs", label: "Logs" },
  { to: "/settings", label: "Settings" },
];

export function App() {
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const [session, setSession] = useState<AdminSessionUser | null>(null);
  const [sessionError, setSessionError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!getAdminToken()) {
        setSession(null);
        return;
      }
      try {
        const payload = await fetchAdminSession();
        if (!mounted) {
          return;
        }
        setSession(payload.user);
        setSessionError("");
      } catch (error) {
        clearAdminToken();
        if (!mounted) {
          return;
        }
        setSession(null);
        setSessionError(error instanceof Error ? error.message : "Session check failed.");
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

  return (
    <div className="fg-shell">
      <div className="fg-row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>ForgeGate — Smart AI Gateway</h1>
          <p className="fg-muted">UI-first Control Plane mit Auth, Accounts, Runtime Keys, Observability und Provider-Operatorik.</p>
          <p className="fg-muted">
            {session ? `Signed in as ${session.display_name} (${session.role})` : "No active admin session."}
          </p>
          {sessionError ? <p className="fg-danger">{sessionError}</p> : null}
        </div>
        <div className="fg-row">
          <button type="button" onClick={toggleMode} className="fg-card" style={{ cursor: "pointer" }}>
            Theme: {mode === "dark" ? "Dark (Default)" : "Light"}
          </button>
          {session ? (
            <button type="button" onClick={() => void onLogout()} className="fg-card" style={{ cursor: "pointer" }}>
              Logout
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Main navigation" className="fg-row" style={{ marginBottom: "1rem" }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
