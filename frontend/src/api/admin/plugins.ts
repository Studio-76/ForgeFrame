/**
 * Plugin management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Plugin types
// ---------------------------------------------------------------------------

/** Plugin security posture. */
export type PluginSecurityPosture = {
  allowed_roles: Array<"viewer" | "operator" | "admin" | "owner">;
  admin_approval_required: boolean;
  network_access: boolean;
  writes_external_state: boolean;
  secret_refs: string[];
};

/** Plugin instance binding. */
export type PluginInstanceBinding = {
  plugin_id: string;
  instance_id: string;
  company_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  enabled_capabilities: string[];
  enabled_ui_slots: string[];
  enabled_api_mounts: string[];
  notes: string;
  created_at: string;
  updated_at: string;
};

/** Plugin catalog entry. */
export type PluginCatalogEntry = {
  plugin_id: string;
  display_name: string;
  summary: string;
  vendor: string;
  version: string;
  status: "active" | "disabled";
  capabilities: string[];
  ui_slots: string[];
  api_mounts: string[];
  runtime_surfaces: string[];
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  security_posture: PluginSecurityPosture;
  metadata: Record<string, unknown>;
  binding?: PluginInstanceBinding | null;
  binding_count: number;
  enabled_binding_count: number;
  bound_instance_ids: string[];
  enabled_instance_ids: string[];
  effective_status: "available" | "enabled" | "disabled";
  status_summary: string;
  effective_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Plugin catalog summary statistics. */
export type PluginCatalogSummary = {
  registered_plugins: number;
  active_plugins: number;
  disabled_plugins: number;
  bound_plugins: number;
  enabled_bindings: number;
  capability_keys: string[];
  ui_slots: string[];
  api_mounts: string[];
};

/** Plugin catalog API response. */
export type PluginCatalogResponse = {
  status: "ok";
  instance?: InstanceRecord;
  summary: PluginCatalogSummary;
  plugins: PluginCatalogEntry[];
};

// ---------------------------------------------------------------------------
// Plugin API functions
// ---------------------------------------------------------------------------

/**
 * Fetch all plugins from the catalog.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Plugin catalog response.
 */
export function fetchPlugins(instanceId?: string | null) {
  return fetchJson<PluginCatalogResponse>(appendTenantScope("/admin/plugins", undefined, instanceId));
}

/**
 * Fetch plugin detail by ID.
 * @param pluginId - The plugin ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with plugin detail.
 */
export function fetchPluginDetail(pluginId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; instance?: InstanceRecord; plugin: PluginCatalogEntry }>(
    appendTenantScope(`/admin/plugins/${encodeURIComponent(pluginId)}`, undefined, instanceId),
  );
}

/**
 * Create a new plugin in the catalog.
 * @param payload - Plugin creation parameters.
 * @returns Response with the created plugin.
 */
export function createPlugin(payload: {
  plugin_id?: string | null;
  display_name: string;
  summary?: string;
  vendor?: string;
  version?: string;
  status?: PluginCatalogEntry["status"];
  capabilities?: string[];
  ui_slots?: string[];
  api_mounts?: string[];
  runtime_surfaces?: string[];
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  security_posture?: PluginSecurityPosture;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; plugin: PluginCatalogEntry }>("/admin/plugins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing plugin.
 * @param pluginId - The plugin ID.
 * @param payload - Fields to update.
 * @returns Response with the updated plugin.
 */
export function updatePlugin(pluginId: string, payload: {
  display_name?: string;
  summary?: string;
  vendor?: string;
  version?: string;
  status?: PluginCatalogEntry["status"];
  capabilities?: string[];
  ui_slots?: string[];
  api_mounts?: string[];
  runtime_surfaces?: string[];
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  security_posture?: PluginSecurityPosture;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; plugin: PluginCatalogEntry }>(`/admin/plugins/${encodeURIComponent(pluginId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Upsert a plugin instance binding.
 * @param instanceId - The instance ID or null.
 * @param pluginId - The plugin ID.
 * @param payload - Binding parameters.
 * @returns Response with the updated plugin.
 */
export function upsertPluginBinding(instanceId: string | null | undefined, pluginId: string, payload: {
  enabled?: boolean;
  config?: Record<string, unknown>;
  enabled_capabilities?: string[];
  enabled_ui_slots?: string[];
  enabled_api_mounts?: string[];
  notes?: string;
}) {
  return fetchJson<{ status: string; instance?: InstanceRecord; plugin: PluginCatalogEntry }>(
    appendTenantScope(`/admin/plugins/${encodeURIComponent(pluginId)}/binding`, undefined, instanceId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}
