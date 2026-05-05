/**
 * Plugin feature types, form states, and constants.
 *
 * @packageDocumentation
 */

import type { PluginCatalogEntry, PluginSecurityPosture, PluginCatalogSummary } from "../../api/admin/plugins";

// ── URL panel tabs ────────────────────────────────────────────────────────

/** Available panel tabs on the plugins page. */
export type PluginPanel = "catalog" | "manifest" | "binding";

/** Panel tab definitions. */
export const PANEL_OPTIONS: ReadonlyArray<{ key: PluginPanel; label: string }> = [
  { key: "catalog", label: "Catalog" },
  { key: "manifest", label: "Edit manifest" },
  { key: "binding", label: "Instance activation" },
] as const;

// ── Schema field draft (structured JSON schema editor) ───────────────────

/** A single config schema field in the structured editor. */
export type SchemaFieldDraft = {
  key: string;
  type: string;
  required: boolean;
};

/** A single default config entry in the structured editor. */
export type ConfigEntryDraft = {
  key: string;
  valueType: "string" | "number" | "boolean";
  value: string;
};

// ── Security role options ─────────────────────────────────────────────────

export const SECURITY_ROLE_OPTIONS: ReadonlyArray<string> = [
  "viewer", "operator", "admin", "owner",
] as const;

export const CONFIG_SCHEMA_TYPES: ReadonlyArray<string> = [
  "string", "integer", "number", "boolean", "object", "array",
] as const;

export const STATUS_OPTIONS: ReadonlyArray<PluginCatalogEntry["status"]> = [
  "active", "disabled",
] as const;

// ── Default values ────────────────────────────────────────────────────────

export const DEFAULT_SECURITY_POSTURE_VALUE: PluginSecurityPosture = {
  allowed_roles: ["admin", "owner"],
  admin_approval_required: true,
  network_access: false,
  writes_external_state: false,
  secret_refs: [],
};

export const DEFAULT_SECURITY_POSTURE = JSON.stringify(DEFAULT_SECURITY_POSTURE_VALUE, null, 2);

export const DEFAULT_CONFIG_SCHEMA = JSON.stringify(
  { type: "object", properties: {} },
  null,
  2,
);

export const DEFAULT_CREATE_FORM = {
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

export const DEFAULT_EDIT_FORM = {
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

export const DEFAULT_BINDING_FORM = {
  enabled: "yes" as "yes" | "no",
  configJson: "{}",
  enabledCapabilities: "",
  enabledUiSlots: "",
  enabledApiMounts: "",
  notes: "",
};

// ── Derived types ────────────────────────────────────────────────────────

export type CreatePluginForm = typeof DEFAULT_CREATE_FORM;
export type EditPluginForm = typeof DEFAULT_EDIT_FORM;
export type BindingPluginForm = typeof DEFAULT_BINDING_FORM;

/**
 * Summary stats computed from plugins list plus the API summary.
 */
export type PluginSummaryStats = {
  registered: number;
  activeManifests: number;
  disabledPlugins: number;
  enabledBindings: number;
  boundPlugins: number;
  capabilityKeys: number;
  uiSlots: number;
  apiMounts: number;
  highRiskCount: number;
  highRiskIds: string[];
};
