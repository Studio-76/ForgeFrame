import { useEffect, useState } from "react";

import {
  activateProvider,
  createProvider,
  deactivateProvider,
  fetchProviderControlPlane,
  syncProviders,
  type ProviderControlItem,
  updateProvider,
} from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function ProvidersPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderControlItem[]>([]);
  const [syncNote, setSyncNote] = useState<string>("");
  const [newProvider, setNewProvider] = useState({ provider: "", label: "" });

  const load = async () => {
    setState("loading");
    try {
      const payload = await fetchProviderControlPlane();
      setProviders(payload.providers);
      setSyncNote(payload.notes.sync_action);
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown provider loading error.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreateProvider = async () => {
    if (!newProvider.provider || !newProvider.label) {
      setError("Provider und Label sind erforderlich.");
      return;
    }
    try {
      await createProvider({ provider: newProvider.provider, label: newProvider.label, config: {} });
      setNewProvider({ provider: "", label: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider creation failed.");
    }
  };

  return (
    <section>
      <h2>Providers Control Plane</h2>
      <p className="fg-muted">
        Diese Ansicht nutzt die Admin-Control-Plane-API für Provider-Verwaltung, Aktivierung und Model-Sync-Vorstufe.
      </p>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Provider anlegen</h3>
        <div className="fg-row">
          <input
            placeholder="provider_key"
            value={newProvider.provider}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, provider: event.target.value }))}
          />
          <input
            placeholder="Provider Label"
            value={newProvider.label}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, label: event.target.value }))}
          />
          <button type="button" onClick={onCreateProvider}>Create</button>
        </div>
      </div>

      <div className="fg-row" style={{ marginBottom: "0.75rem" }}>
        <strong>Status:</strong> {state}
        <button type="button" onClick={() => void syncProviders().then(load)}>Sync all providers</button>
      </div>
      {error && <p className="fg-danger">{error}</p>}

      {providers.map((provider) => (
        <article key={provider.provider} className="fg-card" style={{ marginBottom: "0.75rem" }}>
          <h3>{provider.label} ({provider.provider})</h3>
          <p>
            enabled={String(provider.enabled)} · ready={String(provider.ready)} · oauth_required={String(provider.oauth_required)}
          </p>
          <p>
            discovery_supported={String(provider.discovery_supported)} · last_sync_status={provider.last_sync_status} · models={provider.model_count}
          </p>
          {!provider.ready && provider.readiness_reason ? <p>reason: {provider.readiness_reason}</p> : null}

          <div className="fg-row" style={{ marginBottom: "0.5rem" }}>
            <button type="button" onClick={() => void activateProvider(provider.provider).then(load)}>Activate</button>
            <button type="button" onClick={() => void deactivateProvider(provider.provider).then(load)}>Deactivate</button>
            <button type="button" onClick={() => void syncProviders(provider.provider).then(load)}>Sync models</button>
            <button
              type="button"
              onClick={() =>
                void updateProvider(provider.provider, {
                  label: `${provider.label} (edited)`,
                }).then(load)
              }
            >
              Edit label
            </button>
          </div>

          <ul>
            {provider.models.map((model) => (
              <li key={model.id}>
                {model.id} · source={model.source} · discovery_status={model.discovery_status} · active={String(model.active)}
              </li>
            ))}
          </ul>
        </article>
      ))}

      <div className="fg-card">
        <h3>Discovery-/Sync-Vorstufe</h3>
        <p>{syncNote}</p>
      </div>
    </section>
  );
}
