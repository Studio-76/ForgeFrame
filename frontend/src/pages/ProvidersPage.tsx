import { useEffect, useState } from "react";

import {
  activateHarnessProfile,
  activateProvider,
  createProvider,
  deactivateHarnessProfile,
  deactivateProvider,
  deleteHarnessProfile,
  dryRunHarness,
  fetchHarnessProfiles,
  fetchClientOperationalView,
  fetchHarnessRuns,
  fetchHarnessTemplates,
  fetchProviderControlPlane,
  fetchUsageSummary,
  patchHealthConfig,
  previewHarness,
  probeHarness,
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
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [runSummary, setRunSummary] = useState<Record<string, number>>({});
  const [runModeFilter, setRunModeFilter] = useState<string>("all");
  const [runStatusFilter, setRunStatusFilter] = useState<string>("all");
  const [runProviderFilter, setRunProviderFilter] = useState<string>("all");
  const [runClientFilter, setRunClientFilter] = useState<string>("all");
  const [operationResult, setOperationResult] = useState<string>("");
  const [syncNote, setSyncNote] = useState<string>("");
  const [healthConfig, setHealthConfig] = useState<HealthConfig | null>(null);
  const [newProvider, setNewProvider] = useState({ provider: "", label: "" });
  const [providerErrors, setProviderErrors] = useState<Record<string, number>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, number>>({});
  const [integrationErrors, setIntegrationErrors] = useState<Record<string, number>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, number>>({});
  const [clients, setClients] = useState<Array<Record<string, string | number | boolean>>>([]);

  const [newHarness, setNewHarness] = useState({
    provider_key: "generic_openai_like",
    label: "Generic OpenAI-like",
    integration_class: "openai_compatible" as HarnessProfile["integration_class"],
    endpoint_base_url: "https://example.invalid/v1",
    auth_scheme: "bearer" as HarnessProfile["auth_scheme"],
    auth_value: "",
    auth_header: "Authorization",
    models: "model-1",
    stream_enabled: false,
  });

  const load = async () => {
    setState("loading");
    try {
      const [payload, usage, harnessTemplates, harnessProfiles, harnessRuns, clientView] = await Promise.all([
        fetchProviderControlPlane(),
        fetchUsageSummary(),
        fetchHarnessTemplates(),
        fetchHarnessProfiles(),
        fetchHarnessRuns(
          runProviderFilter === "all" ? undefined : runProviderFilter,
          runModeFilter === "all" ? undefined : runModeFilter,
          runStatusFilter === "all" ? undefined : runStatusFilter,
          runClientFilter === "all" ? undefined : runClientFilter,
          40,
        ),
        fetchClientOperationalView(),
      ]);
      setProviders(payload.providers);
      setTemplates(harnessTemplates.templates);
      setProfiles(harnessProfiles.profiles);
      setRuns(harnessRuns.runs.slice(0, 20));
      setRunSummary(harnessRuns.summary ?? {});
      setClients(clientView.clients ?? []);
      setSyncNote(String(payload.notes.sync_action));
      setHealthConfig(payload.health_config);
      setProviderErrors(Object.fromEntries(usage.aggregations.errors_by_provider.map((item) => [String(item.provider), Number(item.errors)])));
      setModelErrors(Object.fromEntries(usage.aggregations.errors_by_model.map((item) => [String(item.model), Number(item.errors)])));
      setIntegrationErrors(Object.fromEntries(usage.aggregations.errors_by_integration.map((item) => [String(item.integration_key), Number(item.errors)])));
      setProfileErrors(Object.fromEntries(usage.aggregations.errors_by_profile.map((item) => [String(item.profile_key), Number(item.errors)])));
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown provider loading error.");
    }
  };

  useEffect(() => {
    void load();
  }, [runModeFilter, runStatusFilter, runProviderFilter, runClientFilter]);

  const runHarnessAction = async (providerKey: string, model?: string) => {
    const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
    try {
      const preview = await previewHarness({ provider_key: providerKey, model: targetModel, message: "preview", stream: false });
      const dry = await dryRunHarness({ provider_key: providerKey, model: targetModel, message: "dry-run", stream: false });
      const verify = await verifyHarnessProfile({ provider_key: providerKey, model: targetModel });
      setOperationResult(JSON.stringify({ preview, dry, verify }, null, 2));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harness action failed.");
    }
  };

  const onCreateProvider = async () => {
    if (!newProvider.provider || !newProvider.label) {
      setError("Provider und Label sind erforderlich.");
      return;
    }
    await createProvider({ provider: newProvider.provider, label: newProvider.label, integration_class: "native", config: {} });
    setNewProvider({ provider: "", label: "" });
    await load();
  };

  const onUpsertHarness = async () => {
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
      stream_mapping: { enabled: newHarness.stream_enabled },
      capabilities: { streaming: newHarness.stream_enabled, model_source: "manual" },
    });
    await load();
  };

  const updateHealth = async (patch: Partial<HealthConfig>) => {
    const response = await patchHealthConfig(patch);
    setHealthConfig(response.config);
    await load();
  };

  return (
    <section>
      <h2>Providers & Harness Control Plane</h2>
      <p className="fg-muted">Persistente Harness-Profile, Preview/Verify/Dry-Run/Probe, Sync und Health-Steuerung.</p>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Harness templates</h3>
        <ul>{templates.map((item) => <li key={item.id}>{item.id} · {item.integration_class} · {item.description}</li>)}</ul>
      </div>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Harness onboarding</h3>
        <div className="fg-row">
          <input value={newHarness.provider_key} onChange={(event) => setNewHarness((prev) => ({ ...prev, provider_key: event.target.value }))} placeholder="provider_key" />
          <input value={newHarness.label} onChange={(event) => setNewHarness((prev) => ({ ...prev, label: event.target.value }))} placeholder="label" />
          <input value={newHarness.endpoint_base_url} onChange={(event) => setNewHarness((prev) => ({ ...prev, endpoint_base_url: event.target.value }))} placeholder="endpoint_base_url" />
          <select value={newHarness.integration_class} onChange={(event) => setNewHarness((prev) => ({ ...prev, integration_class: event.target.value as HarnessProfile["integration_class"] }))}>
            <option value="openai_compatible">openai_compatible</option><option value="templated_http">templated_http</option><option value="static_catalog">static_catalog</option>
          </select>
          <label><input type="checkbox" checked={newHarness.stream_enabled} onChange={(event) => setNewHarness((prev) => ({ ...prev, stream_enabled: event.target.checked }))} />stream enabled</label>
          <input value={newHarness.models} onChange={(event) => setNewHarness((prev) => ({ ...prev, models: event.target.value }))} placeholder="models comma separated" />
          <button type="button" onClick={() => void onUpsertHarness()}>Save Profile</button>
        </div>
        <ul>
          {profiles.map((profile) => (
            <li key={profile.provider_key}>
              {profile.provider_key} · {profile.integration_class} · enabled={String(profile.enabled)} · lifecycle={String(profile.lifecycle_status ?? "unknown")} · verify={String(profile.last_verify_status ?? "never")} · probe={String(profile.last_probe_status ?? "never")} · last_sync={profile.last_sync_status ?? "never"} · last_used={String(profile.last_used_at ?? "never")} · last_model={String(profile.last_used_model ?? "-")} · requests={String(profile.request_count ?? 0)} · stream_requests={String(profile.stream_request_count ?? 0)} · tokens={String(profile.total_tokens ?? 0)} · errors={profileErrors[profile.provider_key] ?? 0}
              {profile.needs_attention ? <strong className="fg-danger" style={{ marginLeft: "0.5rem" }}>needs attention</strong> : null}
              <button type="button" onClick={() => void runHarnessAction(profile.provider_key)} style={{ marginLeft: "0.5rem" }}>Preview+Verify</button>
              <button type="button" onClick={() => void probeHarness({ provider_key: profile.provider_key, model: profile.models[0] ?? "model-1", message: "probe", stream: false }).then((res) => setOperationResult(JSON.stringify(res, null, 2)))} style={{ marginLeft: "0.5rem" }}>Probe</button>
              {profile.enabled ? (
                <button type="button" onClick={() => void deactivateHarnessProfile(profile.provider_key).then(load)} style={{ marginLeft: "0.5rem" }}>Deactivate</button>
              ) : (
                <button type="button" onClick={() => void activateHarnessProfile(profile.provider_key).then(load)} style={{ marginLeft: "0.5rem" }}>Activate</button>
              )}
              <button type="button" onClick={() => void deleteHarnessProfile(profile.provider_key).then(load)} style={{ marginLeft: "0.5rem" }}>Delete</button>
            </li>
          ))}
        </ul>
        {operationResult ? <pre>{operationResult}</pre> : null}
      </div>

      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Recent harness runs & runtime history</h3>
        <div className="fg-row" style={{ marginBottom: "0.5rem" }}>
          <label>mode:<select value={runModeFilter} onChange={(event) => setRunModeFilter(event.target.value)}><option value="all">all</option><option value="verify">verify</option><option value="probe">probe</option><option value="sync">sync</option></select></label>
          <label>status:<select value={runStatusFilter} onChange={(event) => setRunStatusFilter(event.target.value)}><option value="all">all</option><option value="ok">ok</option><option value="warning">warning</option><option value="failed">failed</option></select></label>
          <label>provider:<select value={runProviderFilter} onChange={(event) => setRunProviderFilter(event.target.value)}><option value="all">all</option>{profiles.map((p) => <option key={p.provider_key} value={p.provider_key}>{p.provider_key}</option>)}</select></label>
          <label>client:<select value={runClientFilter} onChange={(event) => setRunClientFilter(event.target.value)}><option value="all">all</option><option value="runtime">runtime</option><option value="control_plane">control_plane</option></select></label>
          <span>summary total={String(runSummary.total ?? 0)} failed={String(runSummary.failed ?? 0)} verify={String(runSummary.verify ?? 0)} probe={String(runSummary.probe ?? 0)} sync={String(runSummary.sync ?? 0)} runtime_non_stream={String(runSummary.runtime_non_stream ?? 0)} runtime_stream={String(runSummary.runtime_stream ?? 0)}</span>
        </div>
        <ul>{runs.map((run, idx) => <li key={`${String(run.run_id ?? run.provider_key)}-${idx}`}>{String(run.executed_at)} · {String(run.provider_key)} · {String(run.mode)} · status={String(run.status)} · success={String(run.success)} · client={String(run.client_id ?? "-")} · integration={String(run.integration ?? "-")}</li>)}</ul>
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
          <button type="button" onClick={() => void onCreateProvider()}>Create</button>
        </div>
      </div>

      <div className="fg-row" style={{ marginBottom: "0.75rem" }}><strong>Status:</strong> {state}<button type="button" onClick={() => void syncProviders().then(load)}>Sync all providers</button></div>
      {error && <p className="fg-danger">{error}</p>}

      {providers.map((provider) => (
        <article key={provider.provider} className="fg-card" style={{ marginBottom: "0.75rem" }}>
          <h3>{provider.label} ({provider.provider})</h3>
          <p>integration_class={provider.integration_class} · template={provider.template_id ?? "-"} · last_sync_error={provider.last_sync_error ?? "none"}</p>
          <p>harness_profiles={String(provider.harness_profile_count ?? 0)} · harness_runs={String(provider.harness_run_count ?? 0)} · harness_needs_attention={String(provider.harness_needs_attention_count ?? 0)}</p>
          <p>enabled={String(provider.enabled)} · ready={String(provider.ready)} · oauth_required={String(provider.oauth_required)}</p>
          <p>discovery_supported={String(provider.discovery_supported)} · last_sync_status={provider.last_sync_status} · models={provider.model_count}</p>
          <p>provider_errors={providerErrors[provider.provider] ?? 0} · integration_errors={integrationErrors[`runtime:none:none`] ?? 0}</p>
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


      <div className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Client / Consumer Operational View</h3>
        <ul>
          {clients.slice(0, 15).map((client) => (
            <li key={String(client.client_id)}>
              {String(client.client_id)} · requests={String(client.requests ?? 0)} · errors={String(client.errors ?? 0)} · error_rate={Number(client.error_rate ?? 0).toFixed(2)} · actual_cost={Number(client.actual_cost ?? 0).toFixed(4)} · needs_attention={String(client.needs_attention ?? false)}
            </li>
          ))}
        </ul>
      </div>
      <div className="fg-card"><h3>Discovery-/Sync-Zustand</h3><p>{syncNote}</p><p>integration error dimensions: {Object.entries(integrationErrors).map(([k, v]) => `${k}=${v}`).join(" | ") || "none"}</p></div>
    </section>
  );
}
