import type { MutableSettingEntry } from "../../api/admin";
import { GROUP_TO_CATEGORY } from "./types";

/**
 * Format a setting value for display.
 * @param value - The raw setting value.
 * @returns A string representation suitable for UI display.
 */
export function formatSettingValue(value: string | number | boolean): string {
  return typeof value === "boolean" ? String(value) : String(value);
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
 * Map a setting's group to its simplified display category.
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
  const categoryKey = getCategory(item);
  return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
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
  return "Using default";
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
