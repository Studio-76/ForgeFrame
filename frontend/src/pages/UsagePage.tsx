import { useEffect, useMemo, useState } from "react";

import { fetchRuntimeModels, type RuntimeModelRecord } from "../api/runtime";

type LoadState = "idle" | "loading" | "success" | "error";

type UsageFoundation = {
  readyModelCount: number;
  streamCapableModels: number;
  oauthBackedModels: number;
  discoveredModelCount: number;
};

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<RuntimeModelRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      try {
        const payload = await fetchRuntimeModels();
        if (!mounted) {
          return;
        }
        setModels(payload.data);
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

  const summary = useMemo<UsageFoundation>(() => {
    return {
      readyModelCount: models.filter((m) => m.ready).length,
      streamCapableModels: models.filter((m) => m.capabilities.streaming).length,
      oauthBackedModels: models.filter((m) => m.oauth_required).length,
      discoveredModelCount: models.filter((m) => m.source === "discovered").length,
    };
  }, [models]);

  return (
    <section>
      <h2>Usage & Cost Foundations</h2>
      <p>
        Diese Seite ist eine frühe Control-Plane-Vorstufe: sie zeigt, welche Modellbasis aktuell für spätere
        Usage-, Token- und Kostenanalyse verfügbar ist.
      </p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <ul>
        <li>Ready models: {summary.readyModelCount}</li>
        <li>Stream-capable models: {summary.streamCapableModels}</li>
        <li>OAuth-sensitive models: {summary.oauthBackedModels}</li>
        <li>Discovered models: {summary.discoveredModelCount}</li>
      </ul>

      <h3>Kostenachsen (Produktregel)</h3>
      <ul>
        <li>Actual cost: tatsächlich entstandene API-Kosten</li>
        <li>Hypothetical cost: hypothetische Kosten bei alternativem API-Betrieb</li>
        <li>Avoided cost: vermiedene Kosten bei OAuth-/Subscription-Nutzung</li>
      </ul>
    </section>
  );
}
