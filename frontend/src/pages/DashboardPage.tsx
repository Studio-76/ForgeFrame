import { useEffect, useState } from "react";

import { fetchDashboard, type DashboardResponse } from "../api/admin";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = await fetchDashboard();
        if (!mounted) {
          return;
        }
        setDashboard(payload);
        setError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Dashboard loading failed.");
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h2>ForgeGate Control Plane Dashboard</h2>
      <p className="fg-muted">KPIs, Alerts, Security-Hinweise und Needs-Attention auf einer operativen Startseite.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      {dashboard ? (
        <>
          <div className="fg-grid fg-grid-compact" style={{ marginBottom: "1rem" }}>
            {Object.entries(dashboard.kpis).map(([key, value]) => (
              <article key={key} className="fg-card">
                <p className="fg-muted">{key}</p>
                <strong style={{ fontSize: "1.6rem" }}>{value}</strong>
              </article>
            ))}
          </div>
          <div className="fg-grid" style={{ marginBottom: "1rem" }}>
            <article className="fg-card">
              <h3>Alerts</h3>
              <ul>
                {dashboard.alerts.length === 0 ? <li>No active alerts.</li> : null}
                {dashboard.alerts.map((item, index) => (
                  <li key={`${String(item.type)}-${index}`}>
                    {String(item.severity)} · {String(item.type)} · {String(item.message)}
                  </li>
                ))}
              </ul>
            </article>
            <article className="fg-card">
              <h3>Needs Attention</h3>
              <ul>
                {dashboard.needs_attention.length === 0 ? <li>No provider flagged.</li> : null}
                {dashboard.needs_attention.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </div>
          <article className="fg-card">
            <h3>Security Bootstrap</h3>
            <ul>
              {Object.entries(dashboard.security).map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
