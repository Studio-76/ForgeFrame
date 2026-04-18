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
      <p className="fg-muted">Backend-gestützte Aggregationen nach Provider, Modell, Auth-Quelle und Traffic-Typ.</p>

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
              <li>Recorded errors: {summary.metrics.recorded_error_count}</li>
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Traffic split</h3>
            <ul>
              <li>
                Runtime requests={String(summary.traffic_split.runtime.requests)} · tokens=
                {String(summary.traffic_split.runtime.tokens)} · actual={String(summary.traffic_split.runtime.actual_cost)}
              </li>
              <li>
                Health requests={String(summary.traffic_split.health_check.requests)} · tokens=
                {String(summary.traffic_split.health_check.tokens)} · actual=
                {String(summary.traffic_split.health_check.actual_cost)}
              </li>
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
            <h3>Errors by provider/model/client</h3>
            <ul>
              {summary.aggregations.errors_by_provider.map((item) => (
                <li key={`p-${String(item.provider)}`}>
                  provider {String(item.provider)}: {String(item.errors)}
                </li>
              ))}
              {summary.aggregations.errors_by_model.map((item) => (
                <li key={`m-${String(item.model)}`}>
                  model {String(item.model)}: {String(item.errors)}
                </li>
              ))}
              {summary.aggregations.errors_by_client.map((item) => (
                <li key={`c-${String(item.client)}`}>
                  client {String(item.client)}: {String(item.errors)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Errors by traffic/type</h3>
            <ul>
              {summary.aggregations.errors_by_traffic_type.map((item) => (
                <li key={`t-${String(item.traffic_type)}`}>
                  {String(item.traffic_type)}: {String(item.errors)}
                </li>
              ))}
              {summary.aggregations.errors_by_type.map((item) => (
                <li key={`e-${String(item.error_key)}`}>
                  {String(item.error_key)}: {String(item.errors)}
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
