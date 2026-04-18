import { useEffect, useState } from "react";

import { fetchClientOperationalView, fetchUsageSummary, type UsageSummaryResponse } from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [window, setWindow] = useState<"1h" | "24h" | "7d" | "all">("24h");
  const [clientOps, setClientOps] = useState<Array<Record<string, string | number | boolean>>>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      try {
        const [payload, clients] = await Promise.all([fetchUsageSummary(window), fetchClientOperationalView(window)]);
        if (!mounted) {
          return;
        }
        setSummary(payload);
        setClientOps(clients.clients);
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
  }, [window]);

  return (
    <section>
      <h2>Usage & Cost Analytics</h2>
      <p className="fg-muted">Backend-gestützte Aggregationen nach Provider, Modell, Auth-Quelle und Traffic-Typ.</p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      <div className="fg-row" style={{ marginBottom: "0.75rem" }}>
        <label>
          Window:
          <select value={window} onChange={(event) => setWindow(event.target.value as "1h" | "24h" | "7d" | "all")}>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="all">all</option>
          </select>
        </label>
      </div>
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
              <li>Recorded health events: {summary.metrics.recorded_health_event_count}</li>
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Alerts</h3>
            <ul>
              {summary.alerts.length === 0 ? <li>no active alert indicators</li> : null}
              {summary.alerts.map((item, index) => (
                <li key={`${String(item.type)}-${index}`}>
                  {String(item.severity)} · {String(item.type)} · {String(item.message)} · value={String(item.value)}
                </li>
              ))}
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
            <h3>By client</h3>
            <ul>
              {summary.aggregations.by_client.map((item) => (
                <li key={String(item.client_id)}>
                  {String(item.client_id)} · requests={String(item.requests)} · tokens={String(item.tokens)} · actual=
                  {String(item.actual_cost)}
                </li>
              ))}
            </ul>
          </div>


          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Client operational view</h3>
            <ul>
              {clientOps.map((item) => (
                <li key={String(item.client_id)}>
                  {String(item.client_id)} · requests={String(item.requests)} · errors={String(item.errors ?? 0)} · rate={Number(item.error_rate ?? 0).toFixed(2)} · needs_attention={String(item.needs_attention)}
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
                <li key={`c-${String(item.client_id)}`}>
                  client {String(item.client_id)}: {String(item.errors)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Timeline (24h buckets)</h3>
            <ul>
              {summary.timeline_24h.slice(-8).map((item) => (
                <li key={String(item.bucket_start)}>
                  {String(item.bucket_start)} · req={String(item.requests)} · err={String(item.errors)} · rate=
                  {Number(item.error_rate).toFixed(2)} · actual={String(item.actual_cost)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
            <h3>Latest health states</h3>
            <ul>
              {summary.latest_health.map((item) => (
                <li key={`${String(item.provider)}:${String(item.model)}`}>
                  {String(item.provider)} / {String(item.model)} · status={String(item.status)} · check={String(item.check_type)} ·
                  at={String(item.checked_at)}
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
              {summary.aggregations.errors_by_integration.map((item) => (
                <li key={`i-${String(item.integration_key)}`}>
                  {String(item.integration_key)}: {String(item.errors)}
                </li>
              ))}
              {summary.aggregations.errors_by_profile.map((item) => (
                <li key={`p2-${String(item.profile_key)}`}>
                  profile {String(item.profile_key)}: {String(item.errors)}
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
