/**
 * API Keys feature — helper functions.
 *
 * @packageDocumentation
 */

import type {
  RuntimeKey,
  RuntimeKeyRequestPathPolicy,
} from "../../api/domain/runtime-keys";
import type { StatusTone } from "../../components/ui/types";
import {
  REQUEST_PATH_OPTIONS,
  DEFAULT_SCOPES,
  type PolicyValidation,
  type RuntimeKeyIssueFormState,
  type RuntimeKeyPolicyDraft,
} from "./types";

// ─── String / value helpers ───────────────────────────────────────────────

/**
 * Normalize a query parameter value — trims and returns null if empty.
 * @param value - Raw query value.
 * @returns Normalized value or null.
 */
export function normalizeQueryValue(value: string | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Format a timestamp string for display.
 * @param value - The timestamp string.
 * @returns Formatted timestamp or "Not recorded".
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

/**
 * Normalize a delimited list (newline, comma, semicolon) into unique items.
 * @param value - Raw delimited string.
 * @returns Array of unique non-empty items.
 */
export function normalizeDelimitedList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────

/**
 * Create a policy draft from a key (or default values).
 * @param key - Optional key to derive from.
 * @returns Policy draft with stringified fields.
 */
export function keyPolicyDraft(key?: RuntimeKey | null): RuntimeKeyPolicyDraft {
  return {
    allowed_request_paths: (key?.allowed_request_paths ?? ["smart_routing"]).join("\n"),
    default_request_path: key?.default_request_path ?? "smart_routing",
    pinned_target_key: key?.pinned_target_key ?? "",
    local_only_policy: key?.local_only_policy ?? "require_local_target",
    review_required_conditions: (key?.review_required_conditions ?? []).join("\n"),
  };
}

/**
 * Validate a policy draft.
 * @param draft - The policy draft to validate.
 * @returns Validation result with parsed policy.
 */
export function validatePolicyDraft(draft: RuntimeKeyPolicyDraft): PolicyValidation {
  const errors: string[] = [];
  const rawAllowed = draft.allowed_request_paths
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = rawAllowed.filter((item): item is RuntimeKeyRequestPathPolicy["allowed_request_paths"][number] => (
    REQUEST_PATH_OPTIONS.includes(item as RuntimeKeyRequestPathPolicy["allowed_request_paths"][number])
  ));

  if (rawAllowed.length !== allowed.length) {
    errors.push("Allowed request paths contain unsupported values.");
  }
  if (rawAllowed.length !== normalizeDelimitedList(draft.allowed_request_paths).length) {
    errors.push("Allowed request paths must be unique.");
  }
  if (allowed.length === 0) {
    errors.push("At least one allowed request path is required.");
  }
  if (!REQUEST_PATH_OPTIONS.includes(draft.default_request_path)) {
    errors.push("Default request path is invalid.");
  }
  if (!allowed.includes(draft.default_request_path)) {
    errors.push("Default request path must also be allowed.");
  }
  if (allowed.includes("pinned_target") && !draft.pinned_target_key.trim()) {
    errors.push("Pinned target key is required when the pinned_target path is allowed.");
  }

  const reviewConditions = normalizeDelimitedList(draft.review_required_conditions);
  if (allowed.includes("review_required") && reviewConditions.length === 0) {
    errors.push("Review-required conditions are required when the review_required path is allowed.");
  }

  return {
    valid: errors.length === 0,
    errors,
    policy: {
      allowed_request_paths: allowed.length > 0 ? allowed : ["smart_routing"],
      default_request_path: REQUEST_PATH_OPTIONS.includes(draft.default_request_path) ? draft.default_request_path : "smart_routing",
      pinned_target_key: draft.pinned_target_key.trim() || null,
      local_only_policy: draft.local_only_policy ?? "require_local_target",
      review_required_conditions: reviewConditions,
    },
  };
}

/**
 * Validate a full issue form (policy + identity fields).
 * @param form - The issue form state.
 * @returns Validation result with scopes and errors.
 */
export function validateIssueForm(
  form: RuntimeKeyIssueFormState,
): PolicyValidation & { scopes: string[]; errors: string[] } {
  const policyValidation = validatePolicyDraft(form);
  const scopes = normalizeDelimitedList(form.scopes);
  const errors = [...policyValidation.errors];

  if (!form.label.trim()) {
    errors.push("Key label is required.");
  }
  if (scopes.length === 0) {
    errors.push("At least one runtime scope is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    policy: policyValidation.policy,
    scopes,
  };
}

/**
 * Create the default issue form state.
 * @param accountId - Optional pre-selected account ID.
 * @returns Default issue form state.
 */
export function createIssueFormState(accountId?: string | null): RuntimeKeyIssueFormState {
  return {
    label: "",
    accountId: accountId ?? "",
    scopes: DEFAULT_SCOPES,
    allowed_request_paths: "smart_routing",
    default_request_path: "smart_routing",
    pinned_target_key: "",
    local_only_policy: "require_local_target",
    review_required_conditions: "",
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────

/**
 * Map a key status to a StatusTone.
 * @param status - The key status.
 * @returns Corresponding StatusTone.
 */
export function toneForKeyStatus(status: RuntimeKey["status"]): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "disabled":
      return "warning";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Return a human-readable label for a key status.
 * @param status - The key status.
 * @returns Human-readable label.
 */
export function statusLabel(status: RuntimeKey["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

/**
 * Return a rotation label for a key.
 * @param key - The runtime key.
 * @returns Rotation description.
 */
export function rotationLabel(key: RuntimeKey): string {
  return key.rotated_from ? `Rotated from ${key.rotated_from}` : "Original issue";
}

/**
 * Format allowed request paths for display.
 * @param key - The runtime key.
 * @returns Comma-separated path string.
 */
export function formatAllowedPaths(key: RuntimeKey): string {
  return (key.allowed_request_paths ?? ["smart_routing"]).join(", ");
}

/**
 * Check if a key matches a search value.
 * @param key - The runtime key.
 * @param accountLabel - The owning account label.
 * @param instanceLabel - The instance label.
 * @param value - The search query.
 * @returns True if the key matches.
 */
export function searchMatches(
  key: RuntimeKey,
  accountLabel: string,
  instanceLabel: string,
  value: string,
): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    key.key_id,
    key.label,
    key.prefix,
    key.account_id ?? "",
    accountLabel,
    key.instance_id ?? "",
    instanceLabel,
    key.status,
    key.scopes.join(" "),
    formatAllowedPaths(key),
  ].some((item) => item.toLowerCase().includes(normalized));
}
