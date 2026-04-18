import { useEffect, useMemo, useState } from "react";

import { fetchRuntimeModels, type RuntimeModelRecord } from "../api/runtime";

type LoadState = "idle" | "loading" | "success" | "error";

export function ProvidersPage() {
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
        setError(err instanceof Error ? err.message : "Unknown provider loading error.");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const byProvider = useMemo(() => {
    return models.reduce<Record<string, RuntimeModelRecord[]>>((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {});
  }, [models]);

  return (
    <section>
      <h2>Providers Control Plane</h2>
      <p>
        Diese Ansicht ist die erste UI-first Grundlage für Provider-Readiness, Modellquellen (statisch/discovered)
        und Capability-Status.
      </p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {Object.entries(byProvider).map(([providerName, providerModels]) => (
        <article key={providerName} style={{ border: "1px solid #ccc", padding: "0.75rem", marginBottom: "0.75rem" }}>
          <h3>{providerName}</h3>
          <ul>
            {providerModels.map((model) => (
              <li key={model.id}>
                <strong>{model.id}</strong> · ready={String(model.ready)} · source={model.source} · streaming=
                {String(model.capabilities.streaming)} · discovery={String(model.discovery_supported)}
                {!model.ready && model.readiness_reason ? ` · reason: ${model.readiness_reason}` : ""}
              </li>
            ))}
          </ul>
        </article>
      ))}

      <div style={{ borderTop: "1px dashed #999", paddingTop: "0.75rem" }}>
        <h3>Geplante UI-Aktionen (Vorstufe)</h3>
        <ul>
          <li>Provider aktivieren/deaktivieren</li>
          <li>OAuth-/Key-Status prüfen</li>
          <li>Discovery-Sync manuell auslösen</li>
          <li>Model-Visibility/Default-Modell pflegen</li>
        </ul>
      </div>
    </section>
  );
}
