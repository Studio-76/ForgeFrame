import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createPlugin,
  fetchInstances,
  fetchPluginDetail,
  fetchPlugins,
  updatePlugin,
  upsertPluginBinding,
  type PluginCatalogEntry,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<PluginCatalogEntry["status"]> = ["active", "disabled"];

const DEFAULT_SECURITY_POSTURE = JSON.stringify(
  {
    allowed_roles: ["admin", "owner"],
    admin_approval_required: true,
    network_access: false,
    writes_external_state: false,
    secret_refs: [],
  },
  null,
  2,
);

const DEFAULT_CONFIG_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {},
  },
  null,
  2,
);

const DEFAULT_CREATE_FORM = {
  pluginId: "",
  displayName: "",
  summary: "",
  vendor: "customer",
  version: "0.1.0",
  status: "active" as PluginCatalogEntry["status"],
  capabilities: "",
  uiSlots: "",
  apiMounts: "",
  runtimeSurfaces: "",
  configSchemaJson: DEFAULT_CONFIG_SCHEMA,
  defaultConfigJson: "{}",
  securityPostureJson: DEFAULT_SECURITY_POSTURE,
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  displayName: "",
  summary: "",
  vendor: "customer",
  version: "0.1.0",
  status: "active" as PluginCatalogEntry["status"],
  capabilities: "",
  uiSlots: "",
  apiMounts: "",
  runtimeSurfaces: "",
  configSchemaJson: DEFAULT_CONFIG_SCHEMA,
  defaultConfigJson: "{}",
  securityPostureJson: DEFAULT_SECURITY_POSTURE,
  metadataJson: "{}",
};

const DEFAULT_BINDING_FORM = {
  enabled: "yes" as "yes" | "no",
  configJson: "{}",
  enabledCapabilities: "",
  enabledUiSlots: "",
  enabledApiMounts: "",
  notes: "",
};

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function listToCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSecurityPosture(rawValue: string): PluginCatalogEntry["security_posture"] {
  return parseJsonObject(rawValue, "Plugin security posture") as PluginCatalogEntry["security_posture"];
}

export function PluginsPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedPluginId = searchParams.get("pluginId")?.trim() ?? "";
  const canRead = sessionReady && sessionHasAnyInstancePermission(session, "instance.read");
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [pluginsState, setPluginsState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [plugins, setPlugins] = useState<PluginCatalogEntry[]>([]);
  const [pluginSummary, setPluginSummary] = useState({
    registered_plugins: 0,
    active_plugins: 0,
    disabled_plugins: 0,
    bound_plugins: 0,
    enabled_bindings: 0,
    capability_keys: [] as string[],
    ui_slots: [] as string[],
    api_mounts: [] as string[],
  });
  const [detail, setDetail] = useState<PluginCatalogEntry | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [bindingForm, setBindingForm] = useState(DEFAULT_BINDING_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingManifest, setSavingManifest] = useState(false);
  const [savingBinding, setSavingBinding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Plugin instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setPlugins([]);
      setPluginSummary({
        registered_plugins: 0,
        active_plugins: 0,
        disabled_plugins: 0,
        bound_plugins: 0,
        enabled_bindings: 0,
        capability_keys: [],
        ui_slots: [],
        api_mounts: [],
      });
      setDetail(null);
      setPluginsState("idle");
      return;
    }

    let cancelled = false;
    setPluginsState("loading");

    void fetchPlugins(instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setPlugins(payload.plugins);
        setPluginSummary(payload.summary);
        setPluginsState("success");
        setError("");

        const nextPluginId = payload.plugins.some((plugin) => plugin.plugin_id === selectedPluginId)
          ? selectedPluginId
          : payload.plugins[0]?.plugin_id ?? "";
        if (nextPluginId !== selectedPluginId) {
          updateRoute((next) => {
            if (nextPluginId) {
              next.set("pluginId", nextPluginId);
            } else {
              next.delete("pluginId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setPlugins([]);
        setPluginSummary({
          registered_plugins: 0,
          active_plugins: 0,
          disabled_plugins: 0,
          bound_plugins: 0,
          enabled_bindings: 0,
          capability_keys: [],
          ui_slots: [],
          api_mounts: [],
        });
        setDetail(null);
        setPluginsState("error");
        setError(loadError instanceof Error ? loadError.message : "Plugin registry could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedPluginId]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedPluginId) {
      setDetail(null);
      setDetailState("idle");
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchPluginDetail(selectedPluginId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.plugin);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Plugin detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedPluginId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setBindingForm(DEFAULT_BINDING_FORM);
      return;
    }

    setEditForm({
      displayName: detail.display_name,
      summary: detail.summary,
      vendor: detail.vendor,
      version: detail.version,
      status: detail.status,
      capabilities: listToCsv(detail.capabilities),
      uiSlots: listToCsv(detail.ui_slots),
      apiMounts: listToCsv(detail.api_mounts),
      runtimeSurfaces: listToCsv(detail.runtime_surfaces),
      configSchemaJson: formatJson(detail.config_schema),
      defaultConfigJson: formatJson(detail.default_config),
      securityPostureJson: formatJson(detail.security_posture),
      metadataJson: formatJson(detail.metadata),
    });
    setBindingForm({
      enabled: detail.binding?.enabled ? "yes" : "no",
      configJson: formatJson(detail.binding?.config ?? detail.default_config),
      enabledCapabilities: listToCsv(detail.binding?.enabled_capabilities ?? detail.capabilities),
      enabledUiSlots: listToCsv(detail.binding?.enabled_ui_slots ?? detail.ui_slots),
      enabledApiMounts: listToCsv(detail.binding?.enabled_api_mounts ?? detail.api_mounts),
      notes: detail.binding?.notes ?? "",
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createPlugin({
        plugin_id: normalizeOptional(createForm.pluginId),
        display_name: createForm.displayName.trim(),
        summary: createForm.summary.trim(),
        vendor: createForm.vendor.trim(),
        version: createForm.version.trim(),
        status: createForm.status,
        capabilities: csvToList(createForm.capabilities),
        ui_slots: csvToList(createForm.uiSlots),
        api_mounts: csvToList(createForm.apiMounts),
        runtime_surfaces: csvToList(createForm.runtimeSurfaces),
        config_schema: parseJsonObject(createForm.configSchemaJson, "Plugin config schema"),
        default_config: parseJsonObject(createForm.defaultConfigJson, "Plugin default config"),
        security_posture: parseSecurityPosture(createForm.securityPostureJson),
        metadata: parseJsonObject(createForm.metadataJson, "Plugin metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("pluginId", payload.plugin.plugin_id);
      });
      setMessage(`Plugin ${payload.plugin.plugin_id} registered.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Plugin registration failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdateManifest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) {
      return;
    }
    setSavingManifest(true);
    setError("");
    setMessage("");
    try {
      const payload = await updatePlugin(detail.plugin_id, {
        display_name: editForm.displayName.trim(),
        summary: editForm.summary.trim(),
        vendor: editForm.vendor.trim(),
        version: editForm.version.trim(),
        status: editForm.status,
        capabilities: csvToList(editForm.capabilities),
        ui_slots: csvToList(editForm.uiSlots),
        api_mounts: csvToList(editForm.apiMounts),
        runtime_surfaces: csvToList(editForm.runtimeSurfaces),
        config_schema: parseJsonObject(editForm.configSchemaJson, "Plugin config schema"),
        default_config: parseJsonObject(editForm.defaultConfigJson, "Plugin default config"),
        security_posture: parseSecurityPosture(editForm.securityPostureJson),
        metadata: parseJsonObject(editForm.metadataJson, "Plugin metadata"),
      });
      setMessage(`Plugin ${payload.plugin.plugin_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Plugin manifest update failed.");
    } finally {
      setSavingManifest(false);
    }
  };

  const handleSaveBinding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !instanceId) {
      return;
    }
    setSavingBinding(true);
    setError("");
    setMessage("");
    try {
      const payload = await upsertPluginBinding(instanceId, detail.plugin_id, {
        enabled: bindingForm.enabled === "yes",
        config: parseJsonObject(bindingForm.configJson, "Plugin binding config"),
        enabled_capabilities: csvToList(bindingForm.enabledCapabilities),
        enabled_ui_slots: csvToList(bindingForm.enabledUiSlots),
        enabled_api_mounts: csvToList(bindingForm.enabledApiMounts),
        notes: bindingForm.notes.trim(),
      });
      setMessage(`Plugin binding for ${payload.plugin.plugin_id} saved.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Plugin binding update failed.");
    } finally {
      setSavingBinding(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Plugins"
          description="ForgeFrame is restoring plugin registry and instance binding truth before opening extension controls."
          question="Which instance should expose plugin status once the control plane restores session truth?"
          links={[
            { label: "Instances", to: CONTROL_PLANE_ROUTES.instances, description: "Review instance boundaries while plugin scope is loading." },
            { label: "Dashboard", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the command center until plugin truth is available." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="The plugin system is an escape hatch, not an excuse for untracked extension drift. ForgeFrame waits for real session truth before exposing it."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Plugins"
          description="This route stays closed until the session can inspect real instance-scoped plugin registry truth."
          question="Which adjacent module should stay open while plugin registry access is outside the current permission envelope?"
          links={[
            { label: "Instances", to: CONTROL_PLANE_ROUTES.instances, description: "Inspect instance boundaries without opening plugin controls." },
            { label: "Settings", to: CONTROL_PLANE_ROUTES.settings, description: "Review mutable defaults while plugin registry access stays closed." },
          ]}
          badges={[{ label: "Instance read required", tone: "warning" }]}
          note="ForgeFrame does not render a fake Plugins module when the session cannot inspect the real registry and instance bindings."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Plugins"
        description="Persistent plugin registry with instance-scoped activation, config, extension-point discovery, and security posture instead of ad-hoc core forks."
        question="Are plugin capabilities, slots, API mounts, and security posture visible enough to keep extension truth out of hidden side channels?"
        links={[
          { label: "Plugins", to: CONTROL_PLANE_ROUTES.plugins, description: "Stay on the plugin registry and binding surface." },
          { label: "Instances", to: CONTROL_PLANE_ROUTES.instances, description: "Cross-check the selected instance boundary and deployment posture." },
          { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Review workspace surfaces that may consume plugin UI slots." },
        ]}
        badges={[
          { label: `${pluginSummary.registered_plugins} registered`, tone: pluginSummary.registered_plugins > 0 ? "success" : "warning" },
          { label: `${pluginSummary.enabled_bindings} active binding${pluginSummary.enabled_bindings === 1 ? "" : "s"}`, tone: pluginSummary.enabled_bindings > 0 ? "success" : "neutral" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Plugins are tracked objects with instance bindings, config contracts, and visible security posture. This module is not a decorative placeholder for future extensibility."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and registry summary</h3>
            <p className="fg-muted">Choose the active instance, then inspect registered plugin capabilities, extension slots, and binding posture.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" && pluginsState === "success" ? "success" : instancesState === "error" || pluginsState === "error" ? "danger" : "neutral"}>
            {instancesState === "loading" || pluginsState === "loading" ? "loading" : pluginsState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Plugin instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("pluginId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fg-card-grid">
          <article className="fg-subcard">
            <h4>Discovery coverage</h4>
            <ul className="fg-list">
              <li>Capabilities: {pluginSummary.capability_keys.join(", ") || "none recorded"}</li>
              <li>UI slots: {pluginSummary.ui_slots.join(", ") || "none recorded"}</li>
              <li>API mounts: {pluginSummary.api_mounts.join(", ") || "none recorded"}</li>
              <li>Disabled manifests: {pluginSummary.disabled_plugins}</li>
            </ul>
          </article>
          <article className="fg-subcard">
            <h4>Binding posture</h4>
            <ul className="fg-list">
              <li>Registered plugins: {pluginSummary.registered_plugins}</li>
              <li>Bound plugins: {pluginSummary.bound_plugins}</li>
              <li>Enabled bindings: {pluginSummary.enabled_bindings}</li>
              <li>Active manifests: {pluginSummary.active_plugins}</li>
            </ul>
          </article>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Plugin registry</h3>
              <p className="fg-muted">Registered plugins stay visible even when a specific instance has not activated them yet.</p>
            </div>
            <span className="fg-pill" data-tone={pluginsState === "success" ? "success" : pluginsState === "error" ? "danger" : "neutral"}>{pluginsState}</span>
          </div>
          {pluginsState === "loading" ? <p className="fg-muted">Loading plugin registry.</p> : null}
          {plugins.length === 0 ? <p className="fg-muted">No plugins have been registered yet.</p> : null}
          {plugins.length > 0 ? (
            <div className="fg-stack">
              {plugins.map((plugin) => (
                <button
                  key={plugin.plugin_id}
                  type="button"
                  className={`fg-data-row${plugin.plugin_id === selectedPluginId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => { next.set("pluginId", plugin.plugin_id); })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{plugin.plugin_id}</span>
                      <strong>{plugin.display_name}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={plugin.effective_status === "enabled" ? "success" : plugin.effective_status === "disabled" ? "warning" : "neutral"}>
                        {plugin.effective_status}
                      </span>
                      <span className="fg-pill" data-tone={plugin.status === "active" ? "success" : "warning"}>
                        manifest {plugin.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{plugin.vendor} · v{plugin.version}</span>
                    <span className="fg-muted">{plugin.status_summary}</span>
                    <span className="fg-muted">Capabilities: {plugin.capabilities.join(", ") || "none"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create plugin manifest</h3>
              <p className="fg-muted">Register a plugin as a durable product object with explicit capabilities, extension points, config contract, and security posture.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Plugin ID
                <input value={createForm.pluginId} onChange={(event) => setCreateForm((current) => ({ ...current, pluginId: event.target.value }))} placeholder="plugin_review_bridge" />
              </label>
              <label>
                Display name
                <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Review Bridge" />
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as PluginCatalogEntry["status"] }))}>
                  {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Vendor
                <input value={createForm.vendor} onChange={(event) => setCreateForm((current) => ({ ...current, vendor: event.target.value }))} />
              </label>
              <label>
                Version
                <input value={createForm.version} onChange={(event) => setCreateForm((current) => ({ ...current, version: event.target.value }))} />
              </label>
            </div>
            <label>
              Capabilities
              <input value={createForm.capabilities} onChange={(event) => setCreateForm((current) => ({ ...current, capabilities: event.target.value }))} placeholder="review.panel, artifact.render" />
            </label>
            <label>
              UI slots
              <input value={createForm.uiSlots} onChange={(event) => setCreateForm((current) => ({ ...current, uiSlots: event.target.value }))} placeholder="workspaces.detail, artifacts.sidebar" />
            </label>
            <label>
              API mounts
              <input value={createForm.apiMounts} onChange={(event) => setCreateForm((current) => ({ ...current, apiMounts: event.target.value }))} placeholder="/plugins/review-bridge/hooks" />
            </label>
            <label>
              Runtime surfaces
              <input value={createForm.runtimeSurfaces} onChange={(event) => setCreateForm((current) => ({ ...current, runtimeSurfaces: event.target.value }))} placeholder="workspace_artifact_pipeline" />
            </label>
            <label>
              Config schema JSON
              <textarea rows={5} value={createForm.configSchemaJson} onChange={(event) => setCreateForm((current) => ({ ...current, configSchemaJson: event.target.value }))} />
            </label>
            <label>
              Default config JSON
              <textarea rows={4} value={createForm.defaultConfigJson} onChange={(event) => setCreateForm((current) => ({ ...current, defaultConfigJson: event.target.value }))} />
            </label>
            <label>
              Security posture JSON
              <textarea rows={5} value={createForm.securityPostureJson} onChange={(event) => setCreateForm((current) => ({ ...current, securityPostureJson: event.target.value }))} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={4} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !createForm.displayName.trim()}>
                {savingCreate ? "Creating plugin" : "Create plugin"}
              </button>
            </div>
          </form>
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Selected plugin truth</h3>
              <p className="fg-muted">Manifest capabilities and instance binding truth must stay readable in one place.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.plugin_id : "Select a plugin"}</span>
          </div>
          {detailState === "loading" ? <p className="fg-muted">Loading plugin detail.</p> : null}
          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Registry status</h4>
                <ul className="fg-list">
                  <li>Manifest status: {detail.status}</li>
                  <li>Effective status: {detail.effective_status}</li>
                  <li>Status summary: {detail.status_summary}</li>
                  <li>Vendor/version: {detail.vendor} / {detail.version}</li>
                  <li>Capabilities: {detail.capabilities.join(", ") || "none"}</li>
                  <li>UI slots: {detail.ui_slots.join(", ") || "none"}</li>
                  <li>API mounts: {detail.api_mounts.join(", ") || "none"}</li>
                </ul>
              </article>
              <article className="fg-subcard">
                <h4>Security and config</h4>
                <ul className="fg-list">
                  <li>Allowed roles: {detail.security_posture.allowed_roles.join(", ")}</li>
                  <li>Admin approval required: {detail.security_posture.admin_approval_required ? "yes" : "no"}</li>
                  <li>Network access: {detail.security_posture.network_access ? "yes" : "no"}</li>
                  <li>Writes external state: {detail.security_posture.writes_external_state ? "yes" : "no"}</li>
                  <li>Secret refs: {detail.security_posture.secret_refs.join(", ") || "none"}</li>
                </ul>
                <pre className="fg-code-block">{formatJson(detail.effective_config)}</pre>
              </article>
            </div>
          ) : (
            <p className="fg-muted">Select a plugin before editing its manifest or binding it to the current instance.</p>
          )}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Save plugin manifest</h3>
              <p className="fg-muted">Update the registry contract before instance-specific binding overrides diverge.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdateManifest}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Display name
                  <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as PluginCatalogEntry["status"] }))}>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Version
                  <input value={editForm.version} onChange={(event) => setEditForm((current) => ({ ...current, version: event.target.value }))} />
                </label>
              </div>
              <label>
                Summary
                <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Vendor
                  <input value={editForm.vendor} onChange={(event) => setEditForm((current) => ({ ...current, vendor: event.target.value }))} />
                </label>
              </div>
              <label>
                Capabilities
                <input value={editForm.capabilities} onChange={(event) => setEditForm((current) => ({ ...current, capabilities: event.target.value }))} />
              </label>
              <label>
                UI slots
                <input value={editForm.uiSlots} onChange={(event) => setEditForm((current) => ({ ...current, uiSlots: event.target.value }))} />
              </label>
              <label>
                API mounts
                <input value={editForm.apiMounts} onChange={(event) => setEditForm((current) => ({ ...current, apiMounts: event.target.value }))} />
              </label>
              <label>
                Runtime surfaces
                <input value={editForm.runtimeSurfaces} onChange={(event) => setEditForm((current) => ({ ...current, runtimeSurfaces: event.target.value }))} />
              </label>
              <label>
                Config schema JSON
                <textarea rows={5} value={editForm.configSchemaJson} onChange={(event) => setEditForm((current) => ({ ...current, configSchemaJson: event.target.value }))} />
              </label>
              <label>
                Default config JSON
                <textarea rows={4} value={editForm.defaultConfigJson} onChange={(event) => setEditForm((current) => ({ ...current, defaultConfigJson: event.target.value }))} />
              </label>
              <label>
                Security posture JSON
                <textarea rows={5} value={editForm.securityPostureJson} onChange={(event) => setEditForm((current) => ({ ...current, securityPostureJson: event.target.value }))} />
              </label>
              <label>
                Metadata JSON
                <textarea rows={4} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingManifest}>
                  {savingManifest ? "Saving plugin manifest" : "Save plugin manifest"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a plugin before editing its manifest.</p>
          )}
        </article>
      </div>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Save instance binding</h3>
            <p className="fg-muted">Persist the plugin activation and config for the selected instance instead of relying on hidden environment side channels.</p>
          </div>
          <span className="fg-pill" data-tone={detail?.binding?.enabled ? "success" : "neutral"}>{detail?.binding ? "Binding exists" : "No binding yet"}</span>
        </div>
        {detail ? (
          <form className="fg-stack" onSubmit={handleSaveBinding}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Binding enabled
                <select value={bindingForm.enabled} onChange={(event) => setBindingForm((current) => ({ ...current, enabled: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
            </div>
            <label>
              Binding config JSON
              <textarea rows={5} value={bindingForm.configJson} onChange={(event) => setBindingForm((current) => ({ ...current, configJson: event.target.value }))} />
            </label>
            <label>
              Enabled capabilities
              <input value={bindingForm.enabledCapabilities} onChange={(event) => setBindingForm((current) => ({ ...current, enabledCapabilities: event.target.value }))} />
            </label>
            <label>
              Enabled UI slots
              <input value={bindingForm.enabledUiSlots} onChange={(event) => setBindingForm((current) => ({ ...current, enabledUiSlots: event.target.value }))} />
            </label>
            <label>
              Enabled API mounts
              <input value={bindingForm.enabledApiMounts} onChange={(event) => setBindingForm((current) => ({ ...current, enabledApiMounts: event.target.value }))} />
            </label>
            <label>
              Binding notes
              <textarea rows={3} value={bindingForm.notes} onChange={(event) => setBindingForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingBinding || !instanceId}>
                {savingBinding ? "Saving instance binding" : "Save instance binding"}
              </button>
            </div>
          </form>
        ) : (
          <p className="fg-muted">Select a plugin before saving an instance binding.</p>
        )}
      </article>
    </section>
  );
}
