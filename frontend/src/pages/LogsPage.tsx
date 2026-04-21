import { useEffect, useState } from "react";

import { fetchLogs, type LogsResponse } from "../api/admin";

export function LogsPage() {
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = await fetchLogs();
        if (!mounted) {
          return;
        }
        setLogs(payload);
        setError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Logs loading failed.");
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h2>Logs & Audit</h2>
      <p className="fg-muted">Recent audit trail, alert summary and error dimensions.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      {logs ? (
        <>
          <div className="fg-grid" style={{ marginBottom: "1rem" }}>
            <article className="fg-card">
              <h3>Alerts</h3>
              <ul>
                {logs.alerts.length === 0 ? <li>No active alerts.</li> : null}
                {logs.alerts.map((alert, index) => (
                  <li key={`${String(alert.type)}-${index}`}>{String(alert.severity)} · {String(alert.type)} · {String(alert.message)}</li>
                ))}
              </ul>
            </article>
            <article className="fg-card">
              <h3>Error Summary</h3>
              <pre>{JSON.stringify(logs.error_summary, null, 2)}</pre>
            </article>
          </div>
          <article className="fg-card">
            <h3>Recent Audit Events</h3>
            <ul>
              {logs.audit_events.map((event) => (
                <li key={String(event.event_id)}>
                  {String(event.created_at)} · {String(event.action)} · {String(event.status)} · {String(event.details)}
                </li>
              ))}
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
