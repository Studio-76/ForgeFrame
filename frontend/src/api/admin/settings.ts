/**
 * Mutable settings API functions and types.
 *
 * @packageDocumentation
 */

import {
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------

/** A mutable setting entry with metadata. */
export type MutableSettingEntry = {
  key: string;
  label: string;
  group: "runtime" | "security" | "providers" | "routing" | "tls" | "observability" | "ui";
  group_label: string;
  category: string;
  value_type: "str" | "bool" | "float" | "int";
  description: string;
  default_value: string | number | boolean;
  effective_value: string | number | boolean;
  source: "default" | "override";
  source_label: string;
  mutable: boolean;
  risk_level: "low" | "medium" | "high";
  risk_label: string;
  risk_note: string;
  confirmation_required: boolean;
  allowed_values: string[];
  overridden: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
};

/** Result of a mutable setting operation. */
export type MutableSettingOperation = {
  kind: "patch" | "reset";
  keys: string[];
  summary: string;
  highest_risk: "low" | "medium" | "high";
  requires_confirmation: boolean;
};

// ---------------------------------------------------------------------------
// Settings API functions
// ---------------------------------------------------------------------------

/**
 * Fetch all mutable settings.
 * @returns Response with all settings.
 */
export function fetchMutableSettings() {
  return fetchJson<{ status: string; settings: MutableSettingEntry[] }>("/admin/settings/");
}

/**
 * Patch mutable settings with new values.
 * @param updates - Key-value pairs of settings to update.
 * @returns Response with updated settings and operation metadata.
 */
export function patchMutableSettings(updates: Record<string, unknown>) {
  return fetchJson<{ status: string; updated: string[]; settings: MutableSettingEntry[]; operation: MutableSettingOperation }>("/admin/settings/", {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}

/**
 * Reset a mutable setting to its default value.
 * @param key - The setting key to reset.
 * @returns Response with the reset setting.
 */
export function resetMutableSetting(key: string) {
  return fetchJson<{ status: string; reset: string; settings: MutableSettingEntry[]; operation: MutableSettingOperation }>(`/admin/settings/${key}`, {
    method: "DELETE",
  });
}
