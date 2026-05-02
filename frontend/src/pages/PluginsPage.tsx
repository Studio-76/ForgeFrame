import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { BlockedState, EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";
import { normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<PluginCatalogEntry["status"]> = ["active", "disabled"];
const PANEL_OPTIONS = [
  { key: "catalog", label: "Catalog" },
  { key: "manifest", label: "Edit manifest" },
  { key: "binding", label: "Instance activation" },
] as const;
const SECURITY_ROLE_OPTIONS = ["viewer", "operator", "admin", "owner"] as const;
const CONFIG_SCHEMA_TYPES = ["string", "integer", "number", "boolean", "object", "array"] as const;

type PluginPanel = (typeof PANEL_OPTIONS)[number]["key"];
type SchemaFieldDraft = {
  key: string;
  type: string;
  required: boolean;
};
type ConfigEntryDraft = {
  key: string;
  valueType: "string" | "number" | "boolean";
  value: string;
};

const DEFAULT_SECURITY_POSTURE_VALUE: PluginCatalogEntry["security_posture"] = {
  allowed_roles: ["admin", "owner"],
  admin_approval_required: true,
  network_access: false,
  writes_external_state: false,
  secret_refs: [],
};

const DEFAULT_SECURITY_POSTURE = JSON.stringify(
  DEFAULT_SECURITY_POSTURE_VALUE,
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

function jsonObjectError(rawValue: string, fieldLabel: string): string | null {
  try {
    parseJsonObject(rawValue, fieldLabel);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : `${fieldLabel} must be a JSON object.`;
  }
}

function safeParseSecurityPosture(rawValue: string): PluginCatalogEntry["security_posture"] {
  try {
    return parseSecurityPosture(rawValue);
  } catch {
    return DEFAULT_SECURITY_POSTURE_VALUE;
  }
}

function safeParseObject(rawValue: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function schemaFieldsFromRaw(rawValue: string): SchemaFieldDraft[] {
  const schema = safeParseObject(rawValue);
  const properties = safeParseObject(JSON.stringify(schema.properties ?? {}));
  const required = new Set(asStringArray(schema.required));

  return Object.entries(properties).map(([key, value]) => {
    const property = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      key,
      type: typeof property.type === "string" ? property.type : "string",
      required: required.has(key),
    };
  });
}

function schemaRawFromFields(rawValue: string, fields: SchemaFieldDraft[]): string {
  const current = safeParseObject(rawValue);
  const nextProperties: Record<string, unknown> = {};
  const required: string[] = [];

  fields.forEach((field) => {
    const key = field.key.trim();
    if (!key) {
      return;
    }
    nextProperties[key] = { type: field.type };
    if (field.required) {
      required.push(key);
    }
  });

  const nextSchema: Record<string, unknown> = {
    ...current,
    type: "object",
    properties: nextProperties,
  };
  if (required.length > 0) {
    nextSchema.required = required;
  } else {
    delete nextSchema.required;
  }
  return formatJson(nextSchema);
}

function inferConfigValueType(value: unknown): ConfigEntryDraft["valueType"] | null {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return null;
}

function configEntriesFromRaw(rawValue: string): ConfigEntryDraft[] {
  const value = safeParseObject(rawValue);
  return Object.entries(value)
    .flatMap(([key, currentValue]) => {
      const valueType = inferConfigValueType(currentValue);
      if (!valueType) {
        return [];
      }
      return [{
        key,
        valueType,
        value: valueType === "boolean" ? String(currentValue) : String(currentValue),
      }];
    });
}

function unsupportedConfigKeysFromRaw(rawValue: string): string[] {
  const value = safeParseObject(rawValue);
  return Object.entries(value)
    .filter(([, currentValue]) => inferConfigValueType(currentValue) === null)
    .map(([key]) => key);
}

function configObjectFromEntries(entries: ConfigEntryDraft[]): Record<string, unknown> {
  const nextValue: Record<string, unknown> = {};
  entries.forEach((entry) => {
    const key = entry.key.trim();
    if (!key) {
      return;
    }
    if (entry.valueType === "number") {
      nextValue[key] = Number(entry.value);
      return;
    }
    if (entry.valueType === "boolean") {
      nextValue[key] = entry.value === "true";
      return;
    }
    nextValue[key] = entry.value;
  });
  return nextValue;
}

function updateConfigRaw(rawValue: string, entries: ConfigEntryDraft[]): string {
  const current = safeParseObject(rawValue);
  const preserved = Object.fromEntries(
    Object.entries(current).filter(([, value]) => inferConfigValueType(value) === null),
  );
  return formatJson({
    ...preserved,
    ...configObjectFromEntries(entries),
  });
}

function updateSecurityPostureRaw(
  rawValue: string,
  updater: (current: PluginCatalogEntry["security_posture"]) => PluginCatalogEntry["security_posture"],
): string {
  const current = parseSecurityPosture(rawValue);
  return formatJson(updater(current));
}

function securityWarnings(entry: Pick<PluginCatalogEntry, "security_posture">): string[] {
  const warnings: string[] = [];
  if (entry.security_posture.network_access) {
    warnings.push("Network access enabled.");
  }
  if (entry.security_posture.writes_external_state) {
    warnings.push("Writes external state.");
  }
  if (!entry.security_posture.admin_approval_required) {
    warnings.push("No admin approval required.");
  }
  if (entry.security_posture.allowed_roles.some((role) => role === "viewer" || role === "operator")) {
    warnings.push(`Broad role access: ${entry.security_posture.allowed_roles.join(", ")}.`);
  }
  if (entry.security_posture.secret_refs.length > 0) {
    warnings.push(`Secret refs: ${entry.security_posture.secret_refs.join(", ")}.`);
  }
  return warnings;
}

function securityTone(entry: Pick<PluginCatalogEntry, "security_posture">): StatusTone {
  if (entry.security_posture.network_access || entry.security_posture.writes_external_state) {
    return "danger";
  }
  if (!entry.security_posture.admin_approval_required || entry.security_posture.allowed_roles.some((role) => role === "viewer" || role === "operator")) {
    return "warning";
  }
  return entry.security_posture.secret_refs.length > 0 ? "info" : "success";
}

function securityLabel(entry: Pick<PluginCatalogEntry, "security_posture">): string {
  if (entry.security_posture.network_access || entry.security_posture.writes_external_state) {
    return "high-risk posture";
  }
  if (!entry.security_posture.admin_approval_required) {
    return "approval gap";
  }
  if (entry.security_posture.secret_refs.length > 0) {
    return "secret-bound";
  }
  return "restricted posture";
}

function pluginStatusKey(plugin: PluginCatalogEntry): "ready" | "partial" | "blocked" {
  if (plugin.status === "disabled" || plugin.effective_status === "disabled") {
    return "blocked";
  }
  return plugin.effective_status === "enabled" ? "ready" : "partial";
}

function missingRequiredConfigKeys(schemaRaw: string, configRaw: string): string[] {
  const schema = safeParseObject(schemaRaw);
  const config = safeParseObject(configRaw);
  const required = asStringArray(schema.required);
  return required.filter((key) => !(key in config));
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
  const [activePanel, setActivePanel] = useState<PluginPanel>("catalog");

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

  const selectedInstance = instances.find((instance) => instance.instance_id === instanceId) ?? null;
  const selectedPlugin = detail ?? plugins.find((plugin) => plugin.plugin_id === selectedPluginId) ?? null;
  const createSecurity = safeParseSecurityPosture(createForm.securityPostureJson);
  const manifestSecurityPosture = safeParseSecurityPosture(editForm.securityPostureJson);
  const createConfigSchemaError = jsonObjectError(createForm.configSchemaJson, "Plugin config schema");
  const createDefaultConfigError = jsonObjectError(createForm.defaultConfigJson, "Plugin default config");
  const createSecurityPostureError = jsonObjectError(createForm.securityPostureJson, "Plugin security posture");
  const createMetadataError = jsonObjectError(createForm.metadataJson, "Plugin metadata");
  const editConfigSchemaError = jsonObjectError(editForm.configSchemaJson, "Plugin config schema");
  const editDefaultConfigError = jsonObjectError(editForm.defaultConfigJson, "Plugin default config");
  const editSecurityPostureError = jsonObjectError(editForm.securityPostureJson, "Plugin security posture");
  const editMetadataError = jsonObjectError(editForm.metadataJson, "Plugin metadata");
  const bindingConfigError = jsonObjectError(bindingForm.configJson, "Plugin binding config");
  const highRiskPlugins = plugins.filter((plugin) => securityTone(plugin) === "danger");
  const createSchemaFields = schemaFieldsFromRaw(createForm.configSchemaJson);
  const editSchemaFields = schemaFieldsFromRaw(editForm.configSchemaJson);
  const createDefaultConfigEntries = configEntriesFromRaw(createForm.defaultConfigJson);
  const editDefaultConfigEntries = configEntriesFromRaw(editForm.defaultConfigJson);
  const bindingConfigEntries = configEntriesFromRaw(bindingForm.configJson);
  const createUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(createForm.defaultConfigJson);
  const editUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(editForm.defaultConfigJson);
  const bindingUnsupportedConfigKeys = unsupportedConfigKeysFromRaw(bindingForm.configJson);
  const createMissingRequiredDefaultConfigKeys = missingRequiredConfigKeys(createForm.configSchemaJson, createForm.defaultConfigJson);
  const editMissingRequiredDefaultConfigKeys = missingRequiredConfigKeys(editForm.configSchemaJson, editForm.defaultConfigJson);
  const bindingSchemaJson = detail ? formatJson(detail.config_schema) : DEFAULT_CONFIG_SCHEMA;
  const bindingMissingRequiredKeys = missingRequiredConfigKeys(bindingSchemaJson, bindingForm.configJson);
  const createFormHasJsonErrors = Boolean(
    createConfigSchemaError
    || createDefaultConfigError
    || createSecurityPostureError
    || createMetadataError
  );
  const editFormHasJsonErrors = Boolean(
    editConfigSchemaError
    || editDefaultConfigError
    || editSecurityPostureError
    || editMetadataError
  );
  const bindingFormHasJsonErrors = Boolean(bindingConfigError);
  const summaryItems: SummaryStripItem[] = [
    {
      key: "registered",
      label: "Registered plugins",
      value: pluginSummary.registered_plugins,
      meta: `${pluginSummary.active_plugins} active manifests, ${pluginSummary.disabled_plugins} disabled.`,
      tone: pluginSummary.registered_plugins > 0 ? "success" : "warning",
      status: pluginSummary.registered_plugins > 0 ? "ready" : "partial",
    },
    {
      key: "enabled-bindings",
      label: "Enabled bindings",
      value: pluginSummary.enabled_bindings,
      meta: `${pluginSummary.bound_plugins} plugin(s) are bound on the selected instance.`,
      tone: pluginSummary.enabled_bindings > 0 ? "success" : "warning",
      status: pluginSummary.enabled_bindings > 0 ? "ready" : "partial",
    },
    {
      key: "security",
      label: "Security posture warnings",
      value: highRiskPlugins.length,
      meta: highRiskPlugins.length > 0 ? `${highRiskPlugins.map((plugin) => plugin.plugin_id).join(", ")}` : "No high-risk plugin posture is currently visible in the catalog.",
      tone: highRiskPlugins.length > 0 ? "danger" : "success",
      status: highRiskPlugins.length > 0 ? "blocked" : "ready",
    },
    {
      key: "slots",
      label: "Extension slots",
      value: pluginSummary.ui_slots.length + pluginSummary.api_mounts.length,
      meta: `${pluginSummary.ui_slots.length} UI slot(s), ${pluginSummary.api_mounts.length} API mount(s), ${pluginSummary.capability_keys.length} capability key(s).`,
      tone: pluginSummary.ui_slots.length + pluginSummary.api_mounts.length > 0 ? "success" : "warning",
      status: pluginSummary.ui_slots.length + pluginSummary.api_mounts.length > 0 ? "ready" : "partial",
    },
  ];
  const catalogColumns = useMemo<EntityTableColumn<PluginCatalogEntry>[]>(() => [
    {
      key: "plugin",
      header: "Plugin",
      render: (plugin) => (
        <button
          type="button"
          className="fg-data-row"
          onClick={() => updateRoute((next) => {
            next.set("pluginId", plugin.plugin_id);
          })}
        >
          <div>
            <strong>{plugin.display_name}</strong>
            <div className="fg-muted">{plugin.plugin_id}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (plugin) => (
        <div className="fg-stack">
          <StatusBadge tone={pluginStatusKey(plugin) === "blocked" ? "danger" : pluginStatusKey(plugin) === "ready" ? "success" : "warning"} status={pluginStatusKey(plugin)}>
            {plugin.effective_status}
          </StatusBadge>
          <StatusBadge tone={plugin.status === "active" ? "success" : "warning"} status={plugin.status === "active" ? "ready" : "blocked"}>
            manifest {plugin.status}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: "version",
      header: "Version / provenance",
      render: (plugin) => (
        <div>
          <div>v{plugin.version}</div>
          <div className="fg-muted">{plugin.vendor}</div>
        </div>
      ),
    },
    {
      key: "security",
      header: "Security posture",
      render: (plugin) => (
        <div>
          <StatusBadge tone={securityTone(plugin)}>{securityLabel(plugin)}</StatusBadge>
          <div className="fg-muted">{securityWarnings(plugin)[0] ?? "No active security warning."}</div>
        </div>
      ),
    },
    {
      key: "slots",
      header: "Extension slots",
      render: (plugin) => (
        <div>
          <div>UI {plugin.ui_slots.length} · API {plugin.api_mounts.length}</div>
          <div className="fg-muted">{plugin.runtime_surfaces.join(", ") || "No runtime surface declared"}</div>
        </div>
      ),
    },
    {
      key: "bindings",
      header: "Activated in instances",
      render: (plugin) => (
        <div>
          <div>{plugin.enabled_binding_count}/{plugin.binding_count}</div>
          <div className="fg-muted">{plugin.enabled_instance_ids.join(", ") || "No enabled instance binding"}</div>
        </div>
      ),
    },
  ], [selectedPluginId, pluginsState]);

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Extensions"
          title="Plugins"
          description="ForgeFrame is restoring plugin catalog and instance activation truth before opening extension controls."
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="A plugin extends product surfaces or system functions. A skill extends procedural behavior. ForgeFrame keeps those boundaries explicit."
        />
        <LoadingState title="Loading plugin control plane" description="Restoring instance scope, plugin catalog, manifest truth, and activation posture." />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Extensions"
          title="Plugins"
          description="This route stays closed until the session can inspect real instance-scoped plugin registry truth."
          badges={[{ label: "Instance read required", tone: "warning" }]}
          note="ForgeFrame does not render a fake extension registry when the current session cannot inspect the real plugin catalog and bindings."
        />
        <PermissionState
          title="Plugin registry unavailable"
          description="Instance read permission is required before ForgeFrame will expose extension registry, manifest, or binding controls."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Extensions"
        title="Plugins"
        description="Plugins are ForgeFrame's extension registry: catalog, manifest contract, per-instance activation, config contract, extension slots, audit posture, and security review."
        question="Does this extension alter product surface or system behavior as a tracked plugin, or should it remain a procedural skill instead?"
        badges={[
          { label: `${pluginSummary.registered_plugins} registered`, tone: pluginSummary.registered_plugins > 0 ? "success" : "warning" },
          { label: `${pluginSummary.enabled_bindings} enabled bindings`, tone: pluginSummary.enabled_bindings > 0 ? "success" : "neutral" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Plugins extend product surfaces or system functions. Skills extend procedural behavior. This page keeps registry truth, manifest contract, and instance activation separate so they cannot blur into each other."
      />

      <ActionBar
        title="Plugin control panels"
        description="Switch between catalog truth, manifest editing, and per-instance activation without collapsing them into one mixed surface."
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={() => setRefreshNonce((current) => current + 1)} disabled={!instanceId}>
              Refresh
            </button>
            <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.skills}>Skills</Link>
            <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.workspaces}>Workspaces</Link>
            <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.security}>Security</Link>
          </div>
        )}
      >
        <div className="fg-actions">
          {PANEL_OPTIONS.map((panel) => (
            <button
              key={panel.key}
              type="button"
              aria-pressed={activePanel === panel.key}
              onClick={() => setActivePanel(panel.key)}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </ActionBar>

      {message ? <p>{message}</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {instancesState === "loading" && instances.length === 0 ? (
        <LoadingState title="Loading instance scope" description="Restoring the instance list before plugin activation or binding changes can be trusted." />
      ) : null}

      {instancesState === "error" || pluginsState === "error" ? (
        <ErrorState
          title="Plugin control plane failed to load"
          description={error || "Plugin registry or instance scope could not be restored."}
          action={<button type="button" onClick={() => setRefreshNonce((current) => current + 1)}>Retry</button>}
        />
      ) : null}

      {instancesState === "success" ? <SummaryStrip items={summaryItems} /> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Active instance scope</h3>
            <p className="fg-muted">Instance activation is separate from registry truth. Choose the scope first, then decide whether to review catalog, manifest, or binding.</p>
          </div>
          <StatusBadge tone={selectedInstance ? "success" : "warning"} status={selectedInstance ? "ready" : "partial"}>
            {selectedInstance ? selectedInstance.display_name : "No instance"}
          </StatusBadge>
        </div>
        <div className="fg-inline-form">
          <label>
            Plugin instance
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
      </article>

      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          {activePanel === "catalog" ? (
            <EntityTable
              title="Extension catalog"
              description="Catalog truth separates registry status, provenance, security posture, extension slots, and multi-instance activation counts."
              columns={catalogColumns}
              rows={plugins}
              rowKey={(plugin) => plugin.plugin_id}
              tableLabel="Plugin catalog table"
              emptyTitle="No plugins registered"
              emptyDescription="Register the first plugin manifest before instance activation can happen."
              getRowClassName={(plugin) => (plugin.plugin_id === selectedPluginId ? "is-selected" : undefined)}
              footer={<p className="fg-muted">Activated in instances is counted globally per plugin; the detail sidebar still shows the selected instance binding truth separately.</p>}
            />
          ) : null}

          {activePanel === "manifest" ? (
            <div className="fg-stack">
              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Create plugin manifest</h3>
                    <p className="fg-muted">Register a plugin as a durable extension object. Raw JSON stays optional and advanced; the primary editor stays structured.</p>
                  </div>
                  <StatusBadge tone={securityTone({ security_posture: createSecurity })}>{securityLabel({ security_posture: createSecurity })}</StatusBadge>
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

                  <section className="fg-subcard">
                    <h4>Security posture</h4>
                    <div className="fg-inline-form">
                      {SECURITY_ROLE_OPTIONS.map((role) => (
                        <label key={`create-role-${role}`} className="fg-checkbox">
                          <input
                            type="checkbox"
                            checked={createSecurity.allowed_roles.includes(role)}
                            onChange={(event) => setCreateForm((current) => ({
                              ...current,
                              securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                ...security,
                                allowed_roles: event.target.checked
                                  ? Array.from(new Set([...security.allowed_roles, role]))
                                  : security.allowed_roles.filter((item) => item !== role),
                              })),
                            }))}
                          />
                          {role}
                        </label>
                      ))}
                      <label className="fg-checkbox">
                        <input
                          type="checkbox"
                          checked={createSecurity.admin_approval_required}
                          onChange={(event) => setCreateForm((current) => ({
                            ...current,
                            securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                              ...security,
                              admin_approval_required: event.target.checked,
                            })),
                          }))}
                        />
                        Admin approval required
                      </label>
                      <label className="fg-checkbox">
                        <input
                          type="checkbox"
                          checked={createSecurity.network_access}
                          onChange={(event) => setCreateForm((current) => ({
                            ...current,
                            securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                              ...security,
                              network_access: event.target.checked,
                            })),
                          }))}
                        />
                        Network access
                      </label>
                      <label className="fg-checkbox">
                        <input
                          type="checkbox"
                          checked={createSecurity.writes_external_state}
                          onChange={(event) => setCreateForm((current) => ({
                            ...current,
                            securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                              ...security,
                              writes_external_state: event.target.checked,
                            })),
                          }))}
                        />
                        Writes external state
                      </label>
                      <label>
                        Secret refs
                        <input
                          value={createSecurity.secret_refs.join(", ")}
                          onChange={(event) => setCreateForm((current) => ({
                            ...current,
                            securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                              ...security,
                              secret_refs: csvToList(event.target.value),
                            })),
                          }))}
                        />
                      </label>
                    </div>
                    {securityWarnings({ security_posture: createSecurity }).length > 0 ? (
                      <ul className="fg-list">
                        {securityWarnings({ security_posture: createSecurity }).map((warning) => (
                          <li key={`create-warning-${warning}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fg-muted">Current posture is restricted: no network access, no external writes, and admin approval stays required.</p>
                    )}
                  </section>

                  <section className="fg-subcard">
                    <h4>Config contract</h4>
                    <p className="fg-muted">Edit contract fields and scalar default config values directly. Advanced JSON stays optional below for complex schema details.</p>
                    <div className="fg-stack">
                      {createSchemaFields.map((field, index) => (
                        <div key={`create-schema-${index}`} className="fg-inline-form">
                          <label>
                            Field key
                            <input
                              value={field.key}
                              onChange={(event) => setCreateForm((current) => {
                                const nextFields = createSchemaFields.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, key: event.target.value } : item
                                ));
                                return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                              })}
                            />
                          </label>
                          <label>
                            Field type
                            <select
                              value={field.type}
                              onChange={(event) => setCreateForm((current) => {
                                const nextFields = createSchemaFields.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, type: event.target.value } : item
                                ));
                                return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                              })}
                            >
                              {CONFIG_SCHEMA_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          </label>
                          <label className="fg-checkbox">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(event) => setCreateForm((current) => {
                                const nextFields = createSchemaFields.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, required: event.target.checked } : item
                                ));
                                return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                              })}
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => setCreateForm((current) => ({
                              ...current,
                              configSchemaJson: schemaRawFromFields(current.configSchemaJson, createSchemaFields.filter((_, itemIndex) => itemIndex !== index)),
                            }))}
                          >
                            Remove field
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCreateForm((current) => ({
                          ...current,
                          configSchemaJson: schemaRawFromFields(current.configSchemaJson, [...createSchemaFields, { key: "", type: "string", required: false }]),
                        }))}
                      >
                        Add config field
                      </button>
                    </div>
                    <div className="fg-stack">
                      {createDefaultConfigEntries.map((entry, index) => (
                        <div key={`create-config-${index}`} className="fg-inline-form">
                          <label>
                            Config key
                            <input
                              value={entry.key}
                              onChange={(event) => setCreateForm((current) => {
                                const nextEntries = createDefaultConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, key: event.target.value } : item
                                ));
                                return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                              })}
                            />
                          </label>
                          <label>
                            Value type
                            <select
                              value={entry.valueType}
                              onChange={(event) => setCreateForm((current) => {
                                const nextEntries = createDefaultConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, valueType: event.target.value as ConfigEntryDraft["valueType"] } : item
                                ));
                                return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                              })}
                            >
                              <option value="string">string</option>
                              <option value="number">number</option>
                              <option value="boolean">boolean</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              value={entry.value}
                              onChange={(event) => setCreateForm((current) => {
                                const nextEntries = createDefaultConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, value: event.target.value } : item
                                ));
                                return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                              })}
                            />
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCreateForm((current) => ({
                          ...current,
                          defaultConfigJson: updateConfigRaw(current.defaultConfigJson, [...createDefaultConfigEntries, { key: "", valueType: "string", value: "" }]),
                        }))}
                      >
                        Add default config value
                      </button>
                      {createUnsupportedConfigKeys.length > 0 ? (
                        <p className="fg-muted">Advanced JSON still carries non-scalar keys: {createUnsupportedConfigKeys.join(", ")}.</p>
                      ) : (
                        <p className="fg-muted">Default config currently stays aligned with the scalar fields above.</p>
                      )}
                      {createMissingRequiredDefaultConfigKeys.length > 0 ? (
                        <ul className="fg-list">
                          {createMissingRequiredDefaultConfigKeys.map((key) => (
                            <li key={`create-required-${key}`}>Required default config key missing: {key}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>

                  <AdvancedDiagnostics title="Advanced manifest JSON" description="Optional raw JSON for complex schema or metadata cases. It is not the primary editing path." status="advanced" statusTone="neutral">
                    <div className="fg-stack">
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
                      {createConfigSchemaError ? <p className="fg-danger">{createConfigSchemaError}</p> : null}
                      {createDefaultConfigError ? <p className="fg-danger">{createDefaultConfigError}</p> : null}
                      {createSecurityPostureError ? <p className="fg-danger">{createSecurityPostureError}</p> : null}
                      {createMetadataError ? <p className="fg-danger">{createMetadataError}</p> : null}
                    </div>
                  </AdvancedDiagnostics>

                  <div className="fg-actions">
                    <button
                      type="submit"
                      disabled={
                        !canMutate
                        || savingCreate
                        || !createForm.displayName.trim()
                        || createFormHasJsonErrors
                        || createMissingRequiredDefaultConfigKeys.length > 0
                      }
                    >
                      {savingCreate ? "Creating plugin" : "Create plugin"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Save plugin manifest</h3>
                    <p className="fg-muted">Edit the selected manifest contract without blurring it into per-instance activation state.</p>
                  </div>
                  <StatusBadge tone={selectedPlugin ? securityTone(selectedPlugin) : "warning"}>{selectedPlugin ? securityLabel(selectedPlugin) : "Select plugin"}</StatusBadge>
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
                    <label>
                      Vendor
                      <input value={editForm.vendor} onChange={(event) => setEditForm((current) => ({ ...current, vendor: event.target.value }))} />
                    </label>
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

                    <section className="fg-subcard">
                      <h4>Security posture</h4>
                      <div className="fg-inline-form">
                        {SECURITY_ROLE_OPTIONS.map((role) => (
                          <label key={`edit-role-${role}`} className="fg-checkbox">
                            <input
                              type="checkbox"
                              checked={manifestSecurityPosture.allowed_roles.includes(role)}
                              onChange={(event) => setEditForm((current) => ({
                                ...current,
                                securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                  ...security,
                                  allowed_roles: event.target.checked
                                    ? Array.from(new Set([...security.allowed_roles, role]))
                                    : security.allowed_roles.filter((item) => item !== role),
                                })),
                              }))}
                            />
                            {role}
                          </label>
                        ))}
                        <label className="fg-checkbox">
                          <input
                            type="checkbox"
                            checked={manifestSecurityPosture.admin_approval_required}
                            onChange={(event) => setEditForm((current) => ({
                              ...current,
                              securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                ...security,
                                admin_approval_required: event.target.checked,
                              })),
                            }))}
                          />
                          Admin approval required
                        </label>
                        <label className="fg-checkbox">
                          <input
                            type="checkbox"
                            checked={manifestSecurityPosture.network_access}
                            onChange={(event) => setEditForm((current) => ({
                              ...current,
                              securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                ...security,
                                network_access: event.target.checked,
                              })),
                            }))}
                          />
                          Network access
                        </label>
                        <label className="fg-checkbox">
                          <input
                            type="checkbox"
                            checked={manifestSecurityPosture.writes_external_state}
                            onChange={(event) => setEditForm((current) => ({
                              ...current,
                              securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                ...security,
                                writes_external_state: event.target.checked,
                              })),
                            }))}
                          />
                          Writes external state
                        </label>
                        <label>
                          Secret refs
                          <input
                            value={manifestSecurityPosture.secret_refs.join(", ")}
                            onChange={(event) => setEditForm((current) => ({
                              ...current,
                              securityPostureJson: updateSecurityPostureRaw(current.securityPostureJson, (security) => ({
                                ...security,
                                secret_refs: csvToList(event.target.value),
                              })),
                            }))}
                          />
                        </label>
                      </div>
                      {securityWarnings({ security_posture: manifestSecurityPosture }).length > 0 ? (
                        <ul className="fg-list">
                          {securityWarnings({ security_posture: manifestSecurityPosture }).map((warning) => (
                            <li key={`edit-warning-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="fg-muted">Selected plugin currently carries a restricted security posture.</p>
                      )}
                    </section>

                    <section className="fg-subcard">
                      <h4>Config contract</h4>
                      <div className="fg-stack">
                        {editSchemaFields.map((field, index) => (
                          <div key={`edit-schema-${index}`} className="fg-inline-form">
                            <label>
                              Field key
                              <input
                                value={field.key}
                                onChange={(event) => setEditForm((current) => {
                                  const nextFields = editSchemaFields.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, key: event.target.value } : item
                                  ));
                                  return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                                })}
                              />
                            </label>
                            <label>
                              Field type
                              <select
                                value={field.type}
                                onChange={(event) => setEditForm((current) => {
                                  const nextFields = editSchemaFields.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, type: event.target.value } : item
                                  ));
                                  return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                                })}
                              >
                                {CONFIG_SCHEMA_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </label>
                            <label className="fg-checkbox">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(event) => setEditForm((current) => {
                                  const nextFields = editSchemaFields.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, required: event.target.checked } : item
                                  ));
                                  return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                                })}
                              />
                              Required
                            </label>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditForm((current) => ({
                            ...current,
                            configSchemaJson: schemaRawFromFields(current.configSchemaJson, [...editSchemaFields, { key: "", type: "string", required: false }]),
                          }))}
                        >
                          Add config field
                        </button>
                        {editDefaultConfigEntries.map((entry, index) => (
                          <div key={`edit-config-${index}`} className="fg-inline-form">
                            <label>
                              Config key
                              <input
                                value={entry.key}
                                onChange={(event) => setEditForm((current) => {
                                  const nextEntries = editDefaultConfigEntries.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, key: event.target.value } : item
                                  ));
                                  return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                                })}
                              />
                            </label>
                            <label>
                              Value type
                              <select
                                value={entry.valueType}
                                onChange={(event) => setEditForm((current) => {
                                  const nextEntries = editDefaultConfigEntries.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, valueType: event.target.value as ConfigEntryDraft["valueType"] } : item
                                  ));
                                  return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                                })}
                              >
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                              </select>
                            </label>
                            <label>
                              Value
                              <input
                                value={entry.value}
                                onChange={(event) => setEditForm((current) => {
                                  const nextEntries = editDefaultConfigEntries.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, value: event.target.value } : item
                                  ));
                                  return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                                })}
                              />
                            </label>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditForm((current) => ({
                            ...current,
                            defaultConfigJson: updateConfigRaw(current.defaultConfigJson, [...editDefaultConfigEntries, { key: "", valueType: "string", value: "" }]),
                          }))}
                        >
                          Add default config value
                        </button>
                        {editUnsupportedConfigKeys.length > 0 ? (
                          <p className="fg-muted">Advanced JSON still carries non-scalar default config keys: {editUnsupportedConfigKeys.join(", ")}.</p>
                        ) : (
                          <p className="fg-muted">Persisted default config stays aligned with the structured scalar editor above.</p>
                        )}
                        {editMissingRequiredDefaultConfigKeys.length > 0 ? (
                          <ul className="fg-list">
                            {editMissingRequiredDefaultConfigKeys.map((key) => (
                              <li key={`edit-required-${key}`}>Required default config key missing: {key}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </section>

                    <AdvancedDiagnostics title="Advanced manifest JSON" description="Optional raw JSON for schema, default config, security posture, or metadata." status="advanced" statusTone="neutral">
                      <div className="fg-stack">
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
                        {editConfigSchemaError ? <p className="fg-danger">{editConfigSchemaError}</p> : null}
                        {editDefaultConfigError ? <p className="fg-danger">{editDefaultConfigError}</p> : null}
                        {editSecurityPostureError ? <p className="fg-danger">{editSecurityPostureError}</p> : null}
                        {editMetadataError ? <p className="fg-danger">{editMetadataError}</p> : null}
                      </div>
                    </AdvancedDiagnostics>

                    <div className="fg-actions">
                      <button
                        type="submit"
                        disabled={
                          !canMutate
                          || savingManifest
                          || editFormHasJsonErrors
                          || editMissingRequiredDefaultConfigKeys.length > 0
                        }
                      >
                        {savingManifest ? "Saving plugin manifest" : "Save plugin manifest"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <EmptyState title="No plugin selected" description="Pick a catalog row before editing a manifest contract." />
                )}
              </article>
            </div>
          ) : null}

          {activePanel === "binding" ? (
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Save instance binding</h3>
                  <p className="fg-muted">Binding is a distinct action: activate or deactivate the selected plugin for the current instance, fulfil the config contract, and keep scope truth visible.</p>
                </div>
                <StatusBadge tone={selectedPlugin?.binding?.enabled ? "success" : "warning"} status={selectedPlugin?.binding?.enabled ? "ready" : "partial"}>
                  {selectedPlugin?.binding ? "Binding exists" : "No binding yet"}
                </StatusBadge>
              </div>
              {detail ? (
                <form className="fg-stack" onSubmit={handleSaveBinding}>
                  <section className="fg-subcard">
                    <h4>Scope check</h4>
                    <ul className="fg-list">
                      <li>Selected instance: {selectedInstance?.display_name ?? instanceId}</li>
                      <li>Selected plugin: {detail.display_name} ({detail.plugin_id})</li>
                      <li>Manifest status: {detail.status}</li>
                      <li>Activated in instances: {detail.enabled_instance_ids.join(", ") || "none"}</li>
                    </ul>
                    {bindingMissingRequiredKeys.length > 0 ? (
                      <ul className="fg-list">
                        {bindingMissingRequiredKeys.map((key) => (
                          <li key={`missing-${key}`}>Missing required config key: {key}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fg-muted">Current binding config satisfies the required manifest keys visible from this schema.</p>
                    )}
                    {securityWarnings(detail).length > 0 ? (
                      <p className="fg-muted">Security posture warnings stay visible here because activation is where the current instance actually picks up the plugin contract.</p>
                    ) : null}
                  </section>

                  {detail.status !== "active" ? (
                    <BlockedState
                      title="Manifest is disabled"
                      description="This binding can still be persisted for scope planning, but the plugin will stay runtime-blocked until the manifest is re-enabled."
                      status="blocked"
                      badgeLabel="Manifest disabled"
                    />
                  ) : null}

                  <label>
                    Binding enabled
                    <select value={bindingForm.enabled} onChange={(event) => setBindingForm((current) => ({ ...current, enabled: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>

                  <section className="fg-subcard">
                    <h4>Config contract values</h4>
                    <div className="fg-stack">
                      {bindingConfigEntries.map((entry, index) => (
                        <div key={`binding-config-${index}`} className="fg-inline-form">
                          <label>
                            Config key
                            <input
                              value={entry.key}
                              onChange={(event) => setBindingForm((current) => {
                                const nextEntries = bindingConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, key: event.target.value } : item
                                ));
                                return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
                              })}
                            />
                          </label>
                          <label>
                            Value type
                            <select
                              value={entry.valueType}
                              onChange={(event) => setBindingForm((current) => {
                                const nextEntries = bindingConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, valueType: event.target.value as ConfigEntryDraft["valueType"] } : item
                                ));
                                return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
                              })}
                            >
                              <option value="string">string</option>
                              <option value="number">number</option>
                              <option value="boolean">boolean</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              value={entry.value}
                              onChange={(event) => setBindingForm((current) => {
                                const nextEntries = bindingConfigEntries.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, value: event.target.value } : item
                                ));
                                return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
                              })}
                            />
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setBindingForm((current) => ({
                          ...current,
                          configJson: updateConfigRaw(current.configJson, [...bindingConfigEntries, { key: "", valueType: "string", value: "" }]),
                        }))}
                      >
                        Add binding config value
                      </button>
                      {bindingUnsupportedConfigKeys.length > 0 ? (
                        <p className="fg-muted">Advanced JSON still carries non-scalar binding config keys: {bindingUnsupportedConfigKeys.join(", ")}.</p>
                      ) : (
                        <p className="fg-muted">Binding config currently stays aligned with the structured scalar editor above.</p>
                      )}
                      {bindingConfigError ? <p className="fg-danger">{bindingConfigError}</p> : null}
                    </div>
                  </section>

                  <section className="fg-subcard">
                    <h4>Enabled extension surfaces</h4>
                    <div className="fg-inline-form">
                      {detail.capabilities.map((capability) => {
                        const currentValues = csvToList(bindingForm.enabledCapabilities);
                        return (
                          <label key={`binding-capability-${capability}`} className="fg-checkbox">
                            <input
                              type="checkbox"
                              checked={currentValues.includes(capability)}
                              onChange={(event) => setBindingForm((current) => {
                                const nextValues = event.target.checked
                                  ? Array.from(new Set([...csvToList(current.enabledCapabilities), capability]))
                                  : csvToList(current.enabledCapabilities).filter((item) => item !== capability);
                                return { ...current, enabledCapabilities: nextValues.join(", ") };
                              })}
                            />
                            {capability}
                          </label>
                        );
                      })}
                    </div>
                    <div className="fg-inline-form">
                      {detail.ui_slots.map((slot) => {
                        const currentValues = csvToList(bindingForm.enabledUiSlots);
                        return (
                          <label key={`binding-slot-${slot}`} className="fg-checkbox">
                            <input
                              type="checkbox"
                              checked={currentValues.includes(slot)}
                              onChange={(event) => setBindingForm((current) => {
                                const nextValues = event.target.checked
                                  ? Array.from(new Set([...csvToList(current.enabledUiSlots), slot]))
                                  : csvToList(current.enabledUiSlots).filter((item) => item !== slot);
                                return { ...current, enabledUiSlots: nextValues.join(", ") };
                              })}
                            />
                            {slot}
                          </label>
                        );
                      })}
                    </div>
                    <div className="fg-inline-form">
                      {detail.api_mounts.map((mount) => {
                        const currentValues = csvToList(bindingForm.enabledApiMounts);
                        return (
                          <label key={`binding-mount-${mount}`} className="fg-checkbox">
                            <input
                              type="checkbox"
                              checked={currentValues.includes(mount)}
                              onChange={(event) => setBindingForm((current) => {
                                const nextValues = event.target.checked
                                  ? Array.from(new Set([...csvToList(current.enabledApiMounts), mount]))
                                  : csvToList(current.enabledApiMounts).filter((item) => item !== mount);
                                return { ...current, enabledApiMounts: nextValues.join(", ") };
                              })}
                            />
                            {mount}
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <label>
                    Binding notes
                    <textarea rows={3} value={bindingForm.notes} onChange={(event) => setBindingForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>

                  <AdvancedDiagnostics title="Advanced binding JSON" description="Optional raw JSON and CSV fallbacks for complex edits. They are not the primary activation workflow." status="advanced" statusTone="neutral">
                    <div className="fg-stack">
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
                    </div>
                  </AdvancedDiagnostics>

                  <div className="fg-actions">
                    <button
                      type="submit"
                      disabled={
                        !canMutate
                        || savingBinding
                        || !instanceId
                        || bindingFormHasJsonErrors
                        || bindingMissingRequiredKeys.length > 0
                      }
                    >
                      {savingBinding ? "Saving instance binding" : "Save instance binding"}
                    </button>
                  </div>
                </form>
              ) : (
                <EmptyState title="No plugin selected" description="Pick a catalog row before activating or deactivating a plugin for this instance." />
              )}
            </article>
          ) : null}
        </div>

        <div className="ff-operator-sidebar">
          <DetailPanel
            title={selectedPlugin ? selectedPlugin.display_name : "Selected plugin truth"}
            description={selectedPlugin ? `${selectedPlugin.plugin_id} · ${selectedPlugin.vendor} · v${selectedPlugin.version}` : "Choose a catalog row to inspect manifest, activation, and security posture truth."}
            status={selectedPlugin ? selectedPlugin.effective_status : "none"}
            statusTone={selectedPlugin ? (pluginStatusKey(selectedPlugin) === "blocked" ? "danger" : pluginStatusKey(selectedPlugin) === "ready" ? "success" : "warning") : "neutral"}
            statusKey={selectedPlugin ? pluginStatusKey(selectedPlugin) : "partial"}
            sticky
          >
            {selectedPlugin ? (
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Plugin vs skill boundary</h4>
                  <p>Plugin: extends product surfaces or system functions.</p>
                  <p>Skill: extends procedural behavior for an agent or workflow.</p>
                </section>
                <section className="fg-subcard">
                  <h4>Registry truth</h4>
                  <p>{selectedPlugin.status_summary}</p>
                  <p>Capabilities: {selectedPlugin.capabilities.join(", ") || "none"}</p>
                  <p>UI slots: {selectedPlugin.ui_slots.join(", ") || "none"}</p>
                  <p>API mounts: {selectedPlugin.api_mounts.join(", ") || "none"}</p>
                </section>
                <section className="fg-subcard">
                  <h4>Security posture</h4>
                  {securityWarnings(selectedPlugin).length > 0 ? (
                    <ul className="fg-list">
                      {securityWarnings(selectedPlugin).map((warning) => (
                        <li key={`sidebar-warning-${warning}`}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="fg-muted">No active security warning is visible for this plugin.</p>
                  )}
                </section>
                <section className="fg-subcard">
                  <h4>Activation truth</h4>
                  <p>Bound instances: {selectedPlugin.bound_instance_ids.join(", ") || "none"}</p>
                  <p>Enabled instances: {selectedPlugin.enabled_instance_ids.join(", ") || "none"}</p>
                  <p>Current instance binding: {selectedPlugin.binding ? (selectedPlugin.binding.enabled ? "enabled" : "disabled") : "not bound"}</p>
                </section>
                <AdvancedDiagnostics title="Selected plugin raw truth" description="Raw effective config stays collapsed so the main panels remain operational first." status="advanced" statusTone="neutral">
                  <pre>{formatJson(selectedPlugin)}</pre>
                </AdvancedDiagnostics>
              </div>
            ) : (
              <EmptyState title="No plugin selected" description="Select a plugin to inspect manifest truth, security posture, and instance activation side by side." />
            )}
          </DetailPanel>
        </div>
      </div>
    </section>
  );
}
