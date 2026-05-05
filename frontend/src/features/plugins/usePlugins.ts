/**
 * Master hook for the Plugins page.
 *
 * Manages session access, URL state, data fetching, form state,
 * all CRUD handlers, and panel switching.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createPlugin,
  fetchPluginDetail,
  fetchPlugins,
  updatePlugin,
  upsertPluginBinding,
  type PluginCatalogEntry,
} from "../../api/domain/plugins";
import { fetchInstances } from "../../api/domain/instances";
import { useAppSession } from "../../app/session";
import { roleAllows, sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { normalizeOptional, parseJsonObject, type LoadState } from "../../pages/workInteractionPageSupport";
import type { StatusTone } from "../../components/ui/StatusBadge";

import {
  DEFAULT_BINDING_FORM,
  DEFAULT_CONFIG_SCHEMA,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  type PluginPanel,
  type PluginSummaryStats,
  type CreatePluginForm,
  type EditPluginForm,
  type BindingPluginForm,
} from "./types";
import {
  csvToList,
  formatJson,
  jsonObjectError,
  listToCsv,
  missingRequiredConfigKeys,
  parseSecurityPosture,
  safeParseSecurityPosture,
  securityLabel,
  securityTone,
  securityWarnings,
  updateSecurityPostureRaw,
  pluginStatusKey,
  schemaFieldsFromRaw,
  schemaRawFromFields,
  configEntriesFromRaw,
  updateConfigRaw,
  unsupportedConfigKeysFromRaw,
} from "./helpers";

/**
 * Return type of the usePlugins hook.
 */
export interface UsePluginsReturn {
  /** Current session user. */
  session: ReturnType<typeof useAppSession>["session"];
  /** Whether the session data is ready. */
  sessionReady: boolean;
  /** Whether the user has read access. */
  canRead: boolean;
  /** Whether the user has mutation access. */
  canMutate: boolean;

  // ── URL state ──
  /** Current instance ID from URL. */
  instanceId: string;
  /** Current selected plugin ID from URL. */
  selectedPluginId: string;

  // ── Data state ──
  /** Load states. */
  instancesState: LoadState;
  pluginsState: LoadState;
  detailState: LoadState;
  /** Instance list. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Full plugin catalog. */
  plugins: PluginCatalogEntry[];
  /** Plugin summary from the API. */
  pluginSummary: PluginSummaryStats;
  /** Currently selected plugin detail. */
  detail: PluginCatalogEntry | null;
  /** Currently selected instance record. */
  selectedInstance: { instance_id: string; display_name: string } | null;
  /** Fallback selected plugin (detail or from catalog). */
  selectedPlugin: PluginCatalogEntry | null;

  // ── Derived state ──
  /** Summary strip items. */
  summaryItems: Array<{ key: string; label: string; value: number; meta: string; tone: StatusTone; status: string }>;
  /** List of plugins with high-risk security posture. */
  highRiskPlugins: PluginCatalogEntry[];
  /** Error/message display. */
  error: string;
  message: string;

  // ── Panel state ──
  /** Currently active panel tab. */
  activePanel: PluginPanel;
  /** Set active panel tab. */
  setActivePanel: (panel: PluginPanel) => void;

  // ── Create form state ──
  createForm: CreatePluginForm;
  setCreateForm: React.Dispatch<React.SetStateAction<CreatePluginForm>>;
  savingCreate: boolean;
  createSecurity: ReturnType<typeof safeParseSecurityPosture>;
  createConfigSchemaError: string | null;
  createDefaultConfigError: string | null;
  createSecurityPostureError: string | null;
  createMetadataError: string | null;
  createSchemaFields: ReturnType<typeof schemaFieldsFromRaw>;
  createDefaultConfigEntries: ReturnType<typeof configEntriesFromRaw>;
  createUnsupportedConfigKeys: string[];
  createMissingRequiredDefaultConfigKeys: string[];
  createFormHasJsonErrors: boolean;

  // ── Edit form state ──
  editForm: EditPluginForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditPluginForm>>;
  savingManifest: boolean;
  manifestSecurityPosture: ReturnType<typeof safeParseSecurityPosture>;
  editConfigSchemaError: string | null;
  editDefaultConfigError: string | null;
  editSecurityPostureError: string | null;
  editMetadataError: string | null;
  editSchemaFields: ReturnType<typeof schemaFieldsFromRaw>;
  editDefaultConfigEntries: ReturnType<typeof configEntriesFromRaw>;
  editUnsupportedConfigKeys: string[];
  editMissingRequiredDefaultConfigKeys: string[];
  editFormHasJsonErrors: boolean;

  // ── Binding form state ──
  bindingForm: BindingPluginForm;
  setBindingForm: React.Dispatch<React.SetStateAction<BindingPluginForm>>;
  savingBinding: boolean;
  bindingSchemaJson: string;
  bindingConfigError: string | null;
  bindingConfigEntries: ReturnType<typeof configEntriesFromRaw>;
  bindingUnsupportedConfigKeys: string[];
  bindingMissingRequiredKeys: string[];

  // ── Handlers ──
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdateManifest: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleSaveBinding: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  handleRefresh: () => void;
}

/**
 * Compute summary stats from the API plugin summary.
 */
function computeSummaryStats(
  summary: {
    registered_plugins: number;
    active_plugins: number;
    disabled_plugins: number;
    bound_plugins: number;
    enabled_bindings: number;
    capability_keys: string[];
    ui_slots: string[];
    api_mounts: string[];
  },
  highRiskIds: string[],
): PluginSummaryStats {
  return {
    registered: summary.registered_plugins,
    activeManifests: summary.active_plugins,
    disabledPlugins: summary.disabled_plugins,
    enabledBindings: summary.enabled_bindings,
    boundPlugins: summary.bound_plugins,
    capabilityKeys: summary.capability_keys.length,
    uiSlots: summary.ui_slots.length,
    apiMounts: summary.api_mounts.length,
    highRiskCount: highRiskIds.length,
    highRiskIds: highRiskIds,
  };
}

/**
 * Master hook for the Plugins page.
 *
 * Manages access control, URL state, data fetching, form state,
 * all save handlers, and panel tab switching.
 */
export function usePlugins(): UsePluginsReturn {
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
  const [apiSummary, setApiSummary] = useState({
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
  const [createForm, setCreateForm] = useState<CreatePluginForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditPluginForm>(DEFAULT_EDIT_FORM);
  const [bindingForm, setBindingForm] = useState<BindingPluginForm>(DEFAULT_BINDING_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingManifest, setSavingManifest] = useState(false);
  const [savingBinding, setSavingBinding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activePanel, setActivePanel] = useState<PluginPanel>("catalog");

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  // ── Fetch instances ──
  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Plugin instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // ── Fetch plugins ──
  useEffect(() => {
    if (!canRead || !instanceId) {
      setPlugins([]);
      setApiSummary({
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
        if (cancelled) return;
        setPlugins(payload.plugins);
        setApiSummary(payload.summary);
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
        if (cancelled) return;
        setPlugins([]);
        setApiSummary({
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

  // ── Fetch plugin detail ──
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
        if (cancelled) return;
        setDetail(payload.plugin);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Plugin detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedPluginId]);

  // ── Sync forms when detail changes ──
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

  // ── Handlers ──

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
    if (!detail) return;
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
    if (!detail || !instanceId) return;
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

  const handleRefresh = () => {
    setRefreshNonce((current) => current + 1);
  };

  // ── Derived state ──

  const selectedInstance = instances.find((instance) => instance.instance_id === instanceId) ?? null;
  const selectedPlugin = detail ?? plugins.find((plugin) => plugin.plugin_id === selectedPluginId) ?? null;

  const highRiskPlugins = plugins.filter((plugin) => securityTone(plugin) === "danger");

  const summaryItems = useMemo<Array<{ key: string; label: string; value: number; meta: string; tone: StatusTone; status: string }>>(() => [
    {
      key: "registered",
      label: "Registered plugins",
      value: apiSummary.registered_plugins,
      meta: `${apiSummary.active_plugins} active manifests, ${apiSummary.disabled_plugins} disabled.`,
      tone: apiSummary.registered_plugins > 0 ? "success" : "warning",
      status: apiSummary.registered_plugins > 0 ? "ready" : "partial",
    },
    {
      key: "enabled-bindings",
      label: "Enabled bindings",
      value: apiSummary.enabled_bindings,
      meta: `${apiSummary.bound_plugins} plugin(s) are bound on the selected instance.`,
      tone: apiSummary.enabled_bindings > 0 ? "success" : "warning",
      status: apiSummary.enabled_bindings > 0 ? "ready" : "partial",
    },
    {
      key: "security",
      label: "Security posture warnings",
      value: highRiskPlugins.length,
      meta: highRiskPlugins.length > 0
        ? highRiskPlugins.map((p) => p.plugin_id).join(", ")
        : "No high-risk plugin posture is currently visible in the catalog.",
      tone: highRiskPlugins.length > 0 ? "danger" : "success",
      status: highRiskPlugins.length > 0 ? "blocked" : "ready",
    },
    {
      key: "slots",
      label: "Extension slots",
      value: apiSummary.ui_slots.length + apiSummary.api_mounts.length,
      meta: `${apiSummary.ui_slots.length} UI slot(s), ${apiSummary.api_mounts.length} API mount(s), ${apiSummary.capability_keys.length} capability key(s).`,
      tone: apiSummary.ui_slots.length + apiSummary.api_mounts.length > 0 ? "success" : "warning",
      status: apiSummary.ui_slots.length + apiSummary.api_mounts.length > 0 ? "ready" : "partial",
    },
  ], [apiSummary, highRiskPlugins]);

  // ── Create form derived state ──
  const createSecurity = safeParseSecurityPosture(createForm.securityPostureJson);
  const createConfigSchemaError = jsonObjectError(createForm.configSchemaJson, "Plugin config schema");
  const createDefaultConfigError = jsonObjectError(createForm.defaultConfigJson, "Plugin default config");
  const createSecurityPostureError = jsonObjectError(createForm.securityPostureJson, "Plugin security posture");
  const createMetadataError = jsonObjectError(createForm.metadataJson, "Plugin metadata");
  const createSchemaFields = schemaFieldsFromRaw(createForm.configSchemaJson);
  const createDefaultConfigEntries = configEntriesFromRaw(createForm.defaultConfigJson);
  const createUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(createForm.defaultConfigJson);
  const createMissingRequiredDefaultConfigKeys = missingRequiredConfigKeys(
    createForm.configSchemaJson, createForm.defaultConfigJson,
  );
  const createFormHasJsonErrors = Boolean(
    createConfigSchemaError || createDefaultConfigError || createSecurityPostureError || createMetadataError,
  );

  // ── Edit form derived state ──
  const manifestSecurityPosture = safeParseSecurityPosture(editForm.securityPostureJson);
  const editConfigSchemaError = jsonObjectError(editForm.configSchemaJson, "Plugin config schema");
  const editDefaultConfigError = jsonObjectError(editForm.defaultConfigJson, "Plugin default config");
  const editSecurityPostureError = jsonObjectError(editForm.securityPostureJson, "Plugin security posture");
  const editMetadataError = jsonObjectError(editForm.metadataJson, "Plugin metadata");
  const editSchemaFields = schemaFieldsFromRaw(editForm.configSchemaJson);
  const editDefaultConfigEntries = configEntriesFromRaw(editForm.defaultConfigJson);
  const editUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(editForm.defaultConfigJson);
  const editMissingRequiredDefaultConfigKeys = missingRequiredConfigKeys(
    editForm.configSchemaJson, editForm.defaultConfigJson,
  );
  const editFormHasJsonErrors = Boolean(
    editConfigSchemaError || editDefaultConfigError || editSecurityPostureError || editMetadataError,
  );

  // ── Binding form derived state ──
  const bindingSchemaJson = detail ? formatJson(detail.config_schema) : DEFAULT_CONFIG_SCHEMA;
  const bindingConfigError = jsonObjectError(bindingForm.configJson, "Plugin binding config");
  const bindingConfigEntries = configEntriesFromRaw(bindingForm.configJson);
  const bindingUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(bindingForm.configJson);
  const bindingMissingRequiredKeys = missingRequiredConfigKeys(bindingSchemaJson, bindingForm.configJson);

  return {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    selectedPluginId,
    instancesState,
    pluginsState,
    detailState,
    instances,
    plugins,
    pluginSummary: computeSummaryStats(apiSummary, highRiskPlugins.map((p) => p.plugin_id)),
    detail,
    selectedInstance,
    selectedPlugin,
    summaryItems,
    highRiskPlugins,
    error,
    message,
    activePanel,
    setActivePanel,
    createForm,
    setCreateForm,
    savingCreate,
    createSecurity,
    createConfigSchemaError,
    createDefaultConfigError,
    createSecurityPostureError,
    createMetadataError,
    createSchemaFields,
    createDefaultConfigEntries,
    createUnsupportedConfigKeys,
    createMissingRequiredDefaultConfigKeys,
    createFormHasJsonErrors,
    editForm,
    setEditForm,
    savingManifest,
    manifestSecurityPosture,
    editConfigSchemaError,
    editDefaultConfigError,
    editSecurityPostureError,
    editMetadataError,
    editSchemaFields,
    editDefaultConfigEntries,
    editUnsupportedConfigKeys,
    editMissingRequiredDefaultConfigKeys,
    editFormHasJsonErrors,
    bindingForm,
    setBindingForm,
    savingBinding,
    bindingSchemaJson,
    bindingConfigError,
    bindingConfigEntries,
    bindingUnsupportedConfigKeys,
    bindingMissingRequiredKeys,
    handleCreate,
    handleUpdateManifest,
    handleSaveBinding,
    updateRoute,
    handleRefresh,
  };
}
