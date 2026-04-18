import { NavLink, Outlet } from "react-router-dom";

import { useTheme } from "../theme/ThemeProvider";

const navItems = [
  { to: "/login", label: "Login" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/providers", label: "Providers" },
  { to: "/accounts", label: "Accounts" },
  { to: "/api-keys", label: "API Keys" },
  { to: "/usage", label: "Usage" },
  { to: "/logs", label: "Logs" },
  { to: "/settings", label: "Settings" },
];

export function App() {
  const { mode, toggleMode } = useTheme();

  return (
    <div className="fg-shell">
      <div className="fg-row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>ForgeGate — Smart AI Gateway</h1>
          <p className="fg-muted">UI-first Control Plane Vorstufe mit realer Admin-/Runtime-Anbindung.</p>
        </div>
        <button type="button" onClick={toggleMode} className="fg-card" style={{ cursor: "pointer" }}>
          Theme: {mode === "dark" ? "Dark (Default)" : "Light"}
        </button>
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
