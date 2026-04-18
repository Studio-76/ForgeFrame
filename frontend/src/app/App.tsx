import { NavLink, Outlet } from "react-router-dom";

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
  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>ForgeGate — Smart AI Gateway</h1>
      <p>Phase-2 scaffold UI. Product features are not implemented yet.</p>

      <nav aria-label="Main navigation" style={{ marginBottom: "1rem" }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{ marginRight: "0.75rem" }}
          >
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
