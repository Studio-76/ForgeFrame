import type { MutableSettingEntry } from "../../api/domain";
import { GROUP_TO_CATEGORY, CATEGORY_LABELS } from "./types";

/**
 * Format a setting value for display (raw string form).
 * @param value - The raw setting value.
 * @returns A string representation suitable for UI display.
 */
export function formatSettingValue(value: string | number | boolean): string {
  return String(value);
}

/**
 * Return a human-readable label for a boolean setting value.
 *
 * @param value - The raw boolean value (string, number, or boolean).
 * @returns "Enabled" for truthy boolean, "Disabled" for falsy.
 */
export function formatBooleanLabel(value: string | number | boolean): string {
  if (value === true || value === "true") {
    return "Enabled";
  }
  if (value === false || value === "false") {
    return "Disabled";
  }
  return String(value);
}

/**
 * Build a plain-language sentence describing the current effective state
 * of a boolean setting (e.g. "Gemini provider is disabled").
 *
 * @param item - The setting entry.
 * @returns A human-readable sentence describing the setting state.
 */
export function booleanStatusSentence(item: MutableSettingEntry): string {
  if (item.value_type === "bool") {
    const state = formatBooleanLabel(item.effective_value).toLowerCase();
    return `${item.label} is ${state}`;
  }
  return formatSettingValue(item.effective_value);
}

/**
 * Format a timestamp string for display.
 * @param value - ISO timestamp string or null/undefined.
 * @param fallback - Text to show when timestamp is missing.
 * @returns Formatted date string or fallback.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * Map a risk level to a UI tone value.
 * @param riskLevel - The setting's risk level.
 * @returns The corresponding tone for pill/styling.
 */
export function riskTone(riskLevel: MutableSettingEntry["risk_level"]): "success" | "warning" | "danger" {
  if (riskLevel === "high") {
    return "danger";
  }
  if (riskLevel === "medium") {
    return "warning";
  }
  return "success";
}

/**
 * Map a source type to a UI tone value.
 * @param source - The setting's source.
 * @returns The corresponding tone for pill/styling.
 */
export function sourceTone(source: MutableSettingEntry["source"]): "success" | "neutral" {
  return source === "override" ? "success" : "neutral";
}

/**
 * Determine whether a risk badge should be shown in the compact list row.
 * Low-risk settings do not display a badge — only moderate/high risks are shown.
 * @param riskLevel - The setting's risk level.
 * @returns True if a risk indicator should appear in the list.
 */
export function showRiskBadge(riskLevel: MutableSettingEntry["risk_level"]): boolean {
  return riskLevel === "high" || riskLevel === "medium";
}

/**
 * Map a setting's group to its operator-oriented display category.
 * @param item - The setting entry.
 * @returns The category key.
 */
export function getCategory(item: MutableSettingEntry): string {
  return GROUP_TO_CATEGORY[item.group] ?? item.group;
}

/**
 * Get the display label for a setting's category.
 * @param item - The setting entry.
 * @returns The human-readable category label.
 */
export function getCategoryLabel(item: MutableSettingEntry): string {
  const categoryKey = getCategory(item) as keyof typeof CATEGORY_LABELS;
  return CATEGORY_LABELS[categoryKey] ?? categoryKey;
}

/**
 * Get a human-readable description of the current source state.
 * @param source - The setting's source.
 * @param overridden - Whether the setting is overridden.
 * @returns A short description of the current state.
 */
export function sourceDescription(source: MutableSettingEntry["source"], overridden: boolean): string {
  if (source === "override" && overridden) {
    return "Overridden";
  }
  return "Default";
}

/**
 * Return a short status key for a setting based on its source and override state.
 * @param source - The setting's source.
 * @param overridden - Whether the setting has an active override.
 * @returns One of "default", "overridden".
 */
export function statusKey(source: MutableSettingEntry["source"], overridden: boolean): "default" | "overridden" {
  if (source === "override" && overridden) {
    return "overridden";
  }
  return "default";
}

/**
 * Normalize a draft string value to the correct type for the setting.
 * @param item - The setting entry defining value type.
 * @param draftValue - The raw string draft value.
 * @returns The normalized value.
 * @throws {Error} If the value cannot be parsed correctly.
 */
export function normalizeDraft(item: MutableSettingEntry, draftValue: string): string | number | boolean {
  if (item.value_type === "bool") {
    return draftValue === "true";
  }
  if (item.value_type === "float") {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${item.label} expects a numeric value.`);
    }
    return parsed;
  }
  if (item.value_type === "int") {
    const parsed = Number(draftValue);
    if (!Number.isInteger(parsed)) {
      throw new Error(`${item.label} expects a whole-number value.`);
    }
    return parsed;
  }
  return draftValue.trim();
}
