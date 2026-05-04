/**
 * Plugin feature helper functions — extracted from the monolithic PluginsPage.
 *
 * Includes JSON parsing, security posture analysis, config schema utilities,
 * and CSV/list formatting helpers.
 *
 * @packageDocumentation
 */

import { parseJsonObject } from "../../pages/workInteractionPageSupport";
import type { PluginSecurityPosture, PluginCatalogEntry } from "../../api/admin/plugins";
import type { StatusTone } from "../../components/ui/StatusBadge";
import { DEFAULT_SECURITY_POSTURE_VALUE } from "./types";
import type { SchemaFieldDraft, ConfigEntryDraft } from "./types";

// ─── JSON formatting ─────────────────────────────────────────────────────

/**
 * Format a value as pretty-printed JSON.
 */
export function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

/**
 * Safely parse a JSON string into an object, returning an empty object on failure.
 */
export function safeParseObject(rawValue: string): Record<string, unknown> {
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

/**
 * Cast a value to string array, or return empty array.
 */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

// ─── List / CSV helpers ──────────────────────────────────────────────────

/**
 * Join a string array into a comma-separated string.
 */
export function listToCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

/**
 * Split a comma-separated string into a trimmed, non-empty string array.
 */
export function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// ─── Security posture ────────────────────────────────────────────────────

/**
 * Parse security posture from a raw JSON string.
 */
export function parseSecurityPosture(rawValue: string): PluginSecurityPosture {
  return parseJsonObject(rawValue, "Plugin security posture") as PluginSecurityPosture;
}

/**
 * Safely parse security posture, returning defaults on failure.
 */
export function safeParseSecurityPosture(rawValue: string): PluginSecurityPosture {
  try {
    return parseSecurityPosture(rawValue);
  } catch {
    return DEFAULT_SECURITY_POSTURE_VALUE;
  }
}

/**
 * Validate a raw JSON string — returns an error message or null.
 */
export function jsonObjectError(rawValue: string, fieldLabel: string): string | null {
  try {
    parseJsonObject(rawValue, fieldLabel);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : `${fieldLabel} must be a JSON object.`;
  }
}

/**
 * Update a security posture JSON string by applying an updater function.
 */
export function updateSecurityPostureRaw(
  rawValue: string,
  updater: (current: PluginSecurityPosture) => PluginSecurityPosture,
): string {
  const current = parseSecurityPosture(rawValue);
  return formatJson(updater(current));
}

/**
 * Collect security warnings for a plugin's security posture.
 */
export function securityWarnings(
  entry: Pick<PluginCatalogEntry, "security_posture">,
): string[] {
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

/**
 * Determine the security tone for a plugin's posture.
 */
export function securityTone(entry: Pick<PluginCatalogEntry, "security_posture">): StatusTone {
  if (entry.security_posture.network_access || entry.security_posture.writes_external_state) {
    return "danger";
  }
  if (
    !entry.security_posture.admin_approval_required
    || entry.security_posture.allowed_roles.some((role) => role === "viewer" || role === "operator")
  ) {
    return "warning";
  }
  return entry.security_posture.secret_refs.length > 0 ? "info" : "success";
}

/**
 * Get a human-readable label for the security posture.
 */
export function securityLabel(entry: Pick<PluginCatalogEntry, "security_posture">): string {
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

/**
 * Get the status key for a plugin (ready/partial/blocked).
 */
export function pluginStatusKey(plugin: PluginCatalogEntry): "ready" | "partial" | "blocked" {
  if (plugin.status === "disabled" || plugin.effective_status === "disabled") {
    return "blocked";
  }
  return plugin.effective_status === "enabled" ? "ready" : "partial";
}

// ─── Config schema helpers ───────────────────────────────────────────────

/**
 * Extract schema field drafts from a raw config schema JSON string.
 */
export function schemaFieldsFromRaw(rawValue: string): SchemaFieldDraft[] {
  const schema = safeParseObject(rawValue);
  const properties = safeParseObject(JSON.stringify(schema.properties ?? {}));
  const required = new Set(asStringArray(schema.required));

  return Object.entries(properties).map(([key, value]) => {
    const property =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return {
      key,
      type: typeof property.type === "string" ? property.type : "string",
      required: required.has(key),
    };
  });
}

/**
 * Rebuild a config schema JSON string from schema field drafts.
 */
export function schemaRawFromFields(rawValue: string, fields: SchemaFieldDraft[]): string {
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

/**
 * Infer the config value type for a default config value.
 */
export function inferConfigValueType(value: unknown): ConfigEntryDraft["valueType"] | null {
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

/**
 * Extract config entry drafts from a raw default config JSON string.
 */
export function configEntriesFromRaw(rawValue: string): ConfigEntryDraft[] {
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
        value: String(currentValue),
      }];
    });
}

/**
 * Find config keys with unsupported (non-scalar) types.
 */
export function unsupportedConfigKeysFromRaw(rawValue: string): string[] {
  const value = safeParseObject(rawValue);
  return Object.entries(value)
    .filter(([, currentValue]) => inferConfigValueType(currentValue) === null)
    .map(([key]) => key);
}

/**
 * Build a config object from entry drafts.
 */
export function configObjectFromEntries(entries: ConfigEntryDraft[]): Record<string, unknown> {
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

/**
 * Update a config JSON string by replacing scalar entries while preserving
 * non-scalar (unsupported) keys.
 */
export function updateConfigRaw(rawValue: string, entries: ConfigEntryDraft[]): string {
  const current = safeParseObject(rawValue);
  const preserved = Object.fromEntries(
    Object.entries(current).filter(([, value]) => inferConfigValueType(value) === null),
  );
  return formatJson({
    ...preserved,
    ...configObjectFromEntries(entries),
  });
}

/**
 * Check for missing required config keys in a config JSON string.
 */
export function missingRequiredConfigKeys(schemaRaw: string, configRaw: string): string[] {
  const schema = safeParseObject(schemaRaw);
  const config = safeParseObject(configRaw);
  const required = asStringArray(schema.required);
  return required.filter((key) => !(key in config));
}
