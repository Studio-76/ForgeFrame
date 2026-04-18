import { useEffect, useState } from "react";

import { fetchUsageSummary, type UsageSummaryResponse } from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      try {
        const payload = await fetchUsageSummary();
        if (!mounted) {
          return;
        }
        setSummary(payload);
        setState("success");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setState("error");
        setError(err instanceof Error ? err.message : "Unknown usage loading error.");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h2>Usage & Cost Analytics</h2>
      <p className="fg-muted">Backend-gestützte Aggregationen nach Provider, Modell und Auth-Quelle.</p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      {error && <p className="fg-danger">{error}</p>}

      {summary ? (
        <>
          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Summary</h3>
            <ul>
              <li>Active models: {summary.metrics.active_model_count}</li>
              <li>Stream-capable models: {summary.metrics.stream_capable_model_count}</li>
              <li>Recorded requests: {summary.metrics.recorded_request_count}</li>
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>By provider</h3>
            <ul>
              {summary.aggregations.by_provider.map((item) => (
                <li key={String(item.provider)}>
                  {String(item.provider)} · requests={String(item.requests)} · tokens={String(item.tokens)} · actual=
                  {String(item.actual_cost)} · hypothetical={String(item.hypothetical_cost)} · avoided={String(item.avoided_cost)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>By auth source</h3>
            <ul>
              {summary.aggregations.by_auth.map((item) => (
                <li key={String(item.auth_key)}>
                  {String(item.auth_key)} · requests={String(item.requests)} · tokens={String(item.tokens)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Cost axes</h3>
            <ul>
              <li>Actual: {summary.cost_axes.actual}</li>
              <li>Hypothetical: {summary.cost_axes.hypothetical}</li>
              <li>Avoided: {summary.cost_axes.avoided}</li>
            </ul>
          </div>

          <div className="fg-card">
            <h3>Pricing snapshot</h3>
            <ul>
              {Object.entries(summary.pricing_snapshot).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
