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
      <h2>Usage & Cost Foundations</h2>
      <p>
        Diese Seite ist eine frühe Control-Plane-Vorstufe mit Backend-Anbindung an die Admin-Usage-Summary.
      </p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {summary ? (
        <>
          <ul>
            <li>Active models: {summary.metrics.active_model_count}</li>
            <li>Ready models: {summary.metrics.ready_model_count}</li>
            <li>Stream-capable models: {summary.metrics.stream_capable_model_count}</li>
          </ul>

          <h3>Kostenachsen (Produktregel)</h3>
          <ul>
            <li>Actual: {summary.cost_axes.actual}</li>
            <li>Hypothetical: {summary.cost_axes.hypothetical}</li>
            <li>Avoided: {summary.cost_axes.avoided}</li>
          </ul>

          <h3>Pricing-Snapshot</h3>
          <ul>
            {Object.entries(summary.pricing_snapshot).map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
