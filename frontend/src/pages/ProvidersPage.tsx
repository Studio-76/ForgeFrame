import { useEffect, useState } from "react";

import { fetchProviderControlPlane, type ProviderControlItem } from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function ProvidersPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderControlItem[]>([]);
  const [syncNote, setSyncNote] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      try {
        const payload = await fetchProviderControlPlane();
        if (!mounted) {
          return;
        }
        setProviders(payload.providers);
        setSyncNote(payload.notes.sync_action);
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

  return (
    <section>
      <h2>Providers Control Plane</h2>
      <p>
        Diese Ansicht nutzt die Admin-Control-Plane-API und zeigt Provider-Readiness, Capabilities sowie
        Modellquellen (static/discovered).
      </p>

      <p>
        <strong>Status:</strong> {state}
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {providers.map((provider) => (
        <article key={provider.provider} style={{ border: "1px solid #ccc", padding: "0.75rem", marginBottom: "0.75rem" }}>
          <h3>{provider.provider}</h3>
          <p>
            ready={String(provider.ready)} · oauth_required={String(provider.oauth_required)} · discovery_supported=
            {String(provider.discovery_supported)} · model_count={provider.model_count}
          </p>
          {!provider.ready && provider.readiness_reason ? <p>reason: {provider.readiness_reason}</p> : null}
          <ul>
            {provider.models.map((model) => (
              <li key={model.id}>
                {model.id} · source={model.source} · discovery_status={model.discovery_status} · active=
                {String(model.active)}
              </li>
            ))}
          </ul>
        </article>
      ))}

      <div style={{ borderTop: "1px dashed #999", paddingTop: "0.75rem" }}>
        <h3>Discovery-/Sync-Vorstufe</h3>
        <p>{syncNote}</p>
      </div>
    </section>
  );
}
