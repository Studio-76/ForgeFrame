import { useEffect, useState } from "react";

import {
  activateProvider,
  createProvider,
  deactivateProvider,
  fetchHarnessProfiles,
  fetchHarnessTemplates,
  fetchProviderControlPlane,
  fetchUsageSummary,
  patchHealthConfig,
  runHealthChecks,
  syncProviders,
  type HarnessProfile,
  type HarnessTemplate,
  type HealthConfig,
  type ProviderControlItem,
  updateProvider,
  upsertHarnessProfile,
  verifyHarnessProfile,
} from "../api/admin";

type LoadState = "idle" | "loading" | "success" | "error";

export function ProvidersPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderControlItem[]>([]);
  const [templates, setTemplates] = useState<HarnessTemplate[]>([]);
  const [profiles, setProfiles] = useState<HarnessProfile[]>([]);
  const [verificationResult, setVerificationResult] = useState<string>("");
  const [syncNote, setSyncNote] = useState<string>("");
  const [healthConfig, setHealthConfig] = useState<HealthConfig | null>(null);
  const [newProvider, setNewProvider] = useState({ provider: "", label: "" });
  const [providerErrors, setProviderErrors] = useState<Record<string, number>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, number>>({});
  const [integrationErrors, setIntegrationErrors] = useState<Record<string, number>>({});

  const [newHarness, setNewHarness] = useState({
    provider_key: "generic_openai_like",
    label: "Generic OpenAI-like",
    integration_class: "openai_compatible" as HarnessProfile["integration_class"],
    endpoint_base_url: "https://example.invalid/v1",
    auth_scheme: "bearer" as HarnessProfile["auth_scheme"],
    auth_value: "",
    auth_header: "Authorization",
    models: "model-1",
  });

  const load = async () => {
    setState("loading");
    try {
      const [payload, usage, harnessTemplates, harnessProfiles] = await Promise.all([
        fetchProviderControlPlane(),
        fetchUsageSummary(),
        fetchHarnessTemplates(),
        fetchHarnessProfiles(),
      ]);
      setProviders(payload.providers);
      setTemplates(harnessTemplates.templates);
      setProfiles(harnessProfiles.profiles);
      setSyncNote(payload.notes.sync_action);
      setHealthConfig(payload.health_config);
      setProviderErrors(Object.fromEntries(usage.aggregations.errors_by_provider.map((item) => [String(item.provider), Number(item.errors)])));
      setModelErrors(Object.fromEntries(usage.aggregations.errors_by_model.map((item) => [String(item.model), Number(item.errors)])));
      setIntegrationErrors(
        Object.fromEntries(usage.aggregations.errors_by_integration.map((item) => [String(item.integration_key), Number(item.errors)])),
      );
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
      await createProvider({ provider: newProvider.provider, label: newProvider.label, integration_class: "native", config: {} });
      setNewProvider({ provider: "", label: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider creation failed.");
    }
  };

  const onUpsertHarness = async () => {
    try {
      await upsertHarnessProfile(newHarness.provider_key, {
        provider_key: newHarness.provider_key,
        label: newHarness.label,
        integration_class: newHarness.integration_class,
        endpoint_base_url: newHarness.endpoint_base_url,
        auth_scheme: newHarness.auth_scheme,
        auth_value: newHarness.auth_value,
        auth_header: newHarness.auth_header,
        template_id: newHarness.integration_class,
        enabled: true,
        models: newHarness.models.split(",").map((item) => item.trim()).filter(Boolean),
        discovery_enabled: false,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harness profile upsert failed.");
    }
  };

  const onVerifyHarness = async (providerKey: string) => {
    try {
      const result = await verifyHarnessProfile({ provider_key: providerKey });
      setVerificationResult(JSON.stringify(result.verification, null, 2));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harness verify failed.");
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
      <h2>Providers & Harness Control Plane</h2>
      <p className="fg-muted">Provider-Verwaltung, Harness-Onboarding, Verifikation, Discovery-Sync und Health-Steuerung.</p>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Harness templates</h3>
        <ul>
          {templates.map((item) => (
            <li key={item.id}>
              {item.id} · {item.integration_class} · {item.description}
            </li>
          ))}
        </ul>
      </div>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Harness onboarding</h3>
        <div className="fg-row">
          <input value={newHarness.provider_key} onChange={(event) => setNewHarness((prev) => ({ ...prev, provider_key: event.target.value }))} placeholder="provider_key" />
          <input value={newHarness.label} onChange={(event) => setNewHarness((prev) => ({ ...prev, label: event.target.value }))} placeholder="label" />
          <input value={newHarness.endpoint_base_url} onChange={(event) => setNewHarness((prev) => ({ ...prev, endpoint_base_url: event.target.value }))} placeholder="endpoint_base_url" />
          <select value={newHarness.integration_class} onChange={(event) => setNewHarness((prev) => ({ ...prev, integration_class: event.target.value as HarnessProfile["integration_class"] }))}>
            <option value="openai_compatible">openai_compatible</option>
            <option value="templated_http">templated_http</option>
            <option value="static_catalog">static_catalog</option>
          </select>
          <input value={newHarness.models} onChange={(event) => setNewHarness((prev) => ({ ...prev, models: event.target.value }))} placeholder="models comma separated" />
          <button type="button" onClick={onUpsertHarness}>Save Harness Profile</button>
        </div>
        <ul>
          {profiles.map((profile) => (
            <li key={profile.provider_key}>
              {profile.provider_key} · {profile.integration_class} · models={profile.models.join(",") || "-"}
              <button type="button" onClick={() => void onVerifyHarness(profile.provider_key)} style={{ marginLeft: "0.5rem" }}>
                Verify
              </button>
            </li>
          ))}
        </ul>
        {verificationResult ? <pre>{verificationResult}</pre> : null}
      </div>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Model Health Controls</h3>
        {healthConfig ? (
          <div className="fg-row">
            <label><input type="checkbox" checked={healthConfig.provider_health_enabled} onChange={(event) => void updateHealth({ provider_health_enabled: event.target.checked })} />Provider health enabled</label>
            <label><input type="checkbox" checked={healthConfig.model_health_enabled} onChange={(event) => void updateHealth({ model_health_enabled: event.target.checked })} />Model health enabled</label>
            <label>Probe mode:
              <select value={healthConfig.probe_mode} onChange={(event) => void updateHealth({ probe_mode: event.target.value as HealthConfig["probe_mode"] })}>
                <option value="provider">provider</option><option value="discovery">discovery</option><option value="synthetic_probe">synthetic_probe</option>
              </select>
            </label>
            <button type="button" onClick={() => void runHealthChecks().then(load)}>Run health checks</button>
          </div>
        ) : null}
      </div>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Provider anlegen</h3>
        <div className="fg-row">
          <input placeholder="provider_key" value={newProvider.provider} onChange={(event) => setNewProvider((prev) => ({ ...prev, provider: event.target.value }))} />
          <input placeholder="Provider Label" value={newProvider.label} onChange={(event) => setNewProvider((prev) => ({ ...prev, label: event.target.value }))} />
          <button type="button" onClick={onCreateProvider}>Create</button>
        </div>
      </div>

      <div className="fg-row" style={{ marginBottom: "0.75rem" }}><strong>Status:</strong> {state}<button type="button" onClick={() => void syncProviders().then(load)}>Sync all providers</button></div>
      {error && <p className="fg-danger">{error}</p>}

      {providers.map((provider) => (
        <article key={provider.provider} className="fg-card" style={{ marginBottom: "0.75rem" }}>
          <h3>{provider.label} ({provider.provider})</h3>
          <p>integration_class={provider.integration_class} · template={provider.template_id ?? "-"}</p>
          <p>enabled={String(provider.enabled)} · ready={String(provider.ready)} · oauth_required={String(provider.oauth_required)}</p>
          <p>discovery_supported={String(provider.discovery_supported)} · last_sync_status={provider.last_sync_status} · models={provider.model_count}</p>
          <p>error_count={providerErrors[provider.provider] ?? 0}</p>
          {(providerErrors[provider.provider] ?? 0) >= 3 ? <p className="fg-danger">needs attention: elevated provider errors</p> : null}
          {!provider.ready && provider.readiness_reason ? <p>reason: {provider.readiness_reason}</p> : null}

          <div className="fg-row" style={{ marginBottom: "0.5rem" }}>
            <button type="button" onClick={() => void activateProvider(provider.provider).then(load)}>Activate</button>
            <button type="button" onClick={() => void deactivateProvider(provider.provider).then(load)}>Deactivate</button>
            <button type="button" onClick={() => void syncProviders(provider.provider).then(load)}>Sync models</button>
            <button type="button" onClick={() => void updateProvider(provider.provider, { label: `${provider.label} (edited)` }).then(load)}>Edit label</button>
          </div>

          <ul>
            {provider.models.map((model) => (
              <li key={model.id}>{model.id} · source={model.source} · discovery_status={model.discovery_status} · health={model.health_status} · active={String(model.active)} · errors={modelErrors[model.id] ?? 0}</li>
            ))}
          </ul>
        </article>
      ))}

      <div className="fg-card"><h3>Discovery-/Sync-Vorstufe</h3><p>{syncNote}</p><p>integration error dimensions: {Object.entries(integrationErrors).map(([k, v]) => `${k}=${v}`).join(" | ") || "none"}</p></div>
    </section>
  );
}
