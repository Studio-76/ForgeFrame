import { useEffect, useState } from "react";

import {
  activateProvider,
  createProvider,
  deactivateProvider,
  fetchUsageSummary,
  fetchProviderControlPlane,
  patchHealthConfig,
  runHealthChecks,
  syncProviders,
  type HealthConfig,
  type ProviderControlItem,
  updateProvider,
} from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function ProvidersPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderControlItem[]>([]);
  const [syncNote, setSyncNote] = useState<string>("");
  const [healthConfig, setHealthConfig] = useState<HealthConfig | null>(null);
  const [newProvider, setNewProvider] = useState({ provider: "", label: "" });
  const [providerErrors, setProviderErrors] = useState<Record<string, number>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, number>>({});

  const load = async () => {
    setState("loading");
    try {
      const payload = await fetchProviderControlPlane();
      const usage = await fetchUsageSummary();
      setProviders(payload.providers);
      setSyncNote(payload.notes.sync_action);
      setHealthConfig(payload.health_config);
      setProviderErrors(
        Object.fromEntries(usage.aggregations.errors_by_provider.map((item) => [String(item.provider), Number(item.errors)])),
      );
      setModelErrors(Object.fromEntries(usage.aggregations.errors_by_model.map((item) => [String(item.model), Number(item.errors)])));
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

  const updateHealth = async (patch: Partial<HealthConfig>) => {
    try {
      const response = await patchHealthConfig(patch);
      setHealthConfig(response.config);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health config update failed.");
    }
  };

  return (
    <section>
      <h2>Providers Control Plane</h2>
      <p className="fg-muted">
        Diese Ansicht nutzt die Admin-Control-Plane-API für Provider-Verwaltung, Sync und Modell-Health-Steuerung.
      </p>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Model Health Controls</h3>
        {healthConfig ? (
          <div className="fg-row">
            <label>
              <input
                type="checkbox"
                checked={healthConfig.provider_health_enabled}
                onChange={(event) => void updateHealth({ provider_health_enabled: event.target.checked })}
              />
              Provider health enabled
            </label>
            <label>
              <input
                type="checkbox"
                checked={healthConfig.model_health_enabled}
                onChange={(event) => void updateHealth({ model_health_enabled: event.target.checked })}
              />
              Model health enabled
            </label>
            <label>
              Probe mode:
              <select
                value={healthConfig.probe_mode}
                onChange={(event) => void updateHealth({ probe_mode: event.target.value as HealthConfig["probe_mode"] })}
              >
                <option value="provider">provider</option>
                <option value="discovery">discovery</option>
                <option value="synthetic_probe">synthetic_probe</option>
              </select>
            </label>
            <button type="button" onClick={() => void runHealthChecks().then(load)}>Run health checks</button>
          </div>
        ) : null}
      </div>

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
          <h3>
            {provider.label} ({provider.provider})
          </h3>
          <p>
            enabled={String(provider.enabled)} · ready={String(provider.ready)} · oauth_required={String(provider.oauth_required)}
          </p>
          <p>
            discovery_supported={String(provider.discovery_supported)} · last_sync_status={provider.last_sync_status} · models=
            {provider.model_count}
          </p>
          <p>error_count={providerErrors[provider.provider] ?? 0}</p>
          {!provider.ready && provider.readiness_reason ? <p>reason: {provider.readiness_reason}</p> : null}

          <div className="fg-row" style={{ marginBottom: "0.5rem" }}>
            <button type="button" onClick={() => void activateProvider(provider.provider).then(load)}>
              Activate
            </button>
            <button type="button" onClick={() => void deactivateProvider(provider.provider).then(load)}>
              Deactivate
            </button>
            <button type="button" onClick={() => void syncProviders(provider.provider).then(load)}>
              Sync models
            </button>
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
                {model.id} · source={model.source} · discovery_status={model.discovery_status} · health={model.health_status} ·
                active={String(model.active)} · errors={modelErrors[model.id] ?? 0}
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
