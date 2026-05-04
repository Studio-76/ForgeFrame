/**
 * Account feature helper functions.
 *
 * @packageDocumentation
 */

import type { GatewayAccount } from "../../api/domain/accounts";
import type { StatusTone } from "../../components/ui/StatusBadge";
import type { AccountFormState, AccountRiskSummary, RiskFilter } from "./types";

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

/**
 * Format a timestamp string for display.
 * @param value - The raw timestamp string.
 * @returns A formatted string or "Not recorded".
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

// ---------------------------------------------------------------------------
// Provider binding helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a raw binding string into a unique array of trimmed values.
 * Accepts newline-, comma-, or semicolon-separated input.
 * @param value - The raw input string.
 * @returns Unique, trimmed, non-empty binding array.
 */
export function normalizeProviderBindings(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Format provider bindings for display.
 * @param account - The account.
 * @returns A comma-separated binding string.
 */
export function formatBindings(account: GatewayAccount): string {
  return account.provider_bindings.length > 0
    ? account.provider_bindings.join(", ")
    : "No provider bindings";
}

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

/**
 * Validate the account form state.
 * @param form - The current form state.
 * @returns Validated bindings and any error messages.
 */
export function validateForm(form: AccountFormState): { bindings: string[]; errors: string[] } {
  const bindings = normalizeProviderBindings(form.providerBindingsText);
  const errors: string[] = [];

  if (!form.label.trim()) {
    errors.push("Account label is required.");
  }

  const rawBindings = form.providerBindingsText
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (rawBindings.length !== bindings.length) {
    errors.push("Provider bindings must be unique.");
  }

  const invalidBinding = bindings.find((binding) => !/^[a-z0-9._-]+$/i.test(binding));
  if (invalidBinding) {
    errors.push(`Provider binding '${invalidBinding}' contains unsupported characters.`);
  }

  return { bindings, errors };
}

// ---------------------------------------------------------------------------
// Account status helpers
// ---------------------------------------------------------------------------

/**
 * Derive the appropriate StatusTone for an account lifecycle status.
 * @param status - The account status.
 * @returns The display tone.
 */
export function toneForAccountStatus(status: GatewayAccount["status"]): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "warning";
    case "disabled":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Derive the appropriate StatusTone for an account risk level.
 * @param level - The risk level.
 * @returns The display tone.
 */
export function toneForRiskLevel(level: AccountRiskSummary["level"]): StatusTone {
  switch (level) {
    case "attention":
      return "danger";
    case "review":
      return "warning";
    case "controlled":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Human-readable label for an account status.
 * @param status - The account status.
 * @returns Display label.
 */
export function statusLabel(status: GatewayAccount["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}

/**
 * One-line lifecycle summary for an account.
 * @param account - The account.
 * @returns Descriptive summary.
 */
export function lifecycleSummary(account: GatewayAccount): string {
  switch (account.status) {
    case "active":
      return "Runtime identity can currently issue or serve bound access.";
    case "suspended":
      return "Identity is paused without being permanently retired.";
    case "disabled":
      return "Identity is fully deactivated for runtime use.";
    default:
      return "Lifecycle state unavailable.";
  }
}

// ---------------------------------------------------------------------------
// Risk assessment
// ---------------------------------------------------------------------------

/**
 * Derive the risk summary for a single account.
 * @param account - The account to assess.
 * @returns The risk summary object.
 */
export function getAccountRisk(account: GatewayAccount): AccountRiskSummary {
  if (account.status === "active" && account.provider_bindings.length === 0) {
    return {
      level: "attention",
      label: "Unbound active identity",
      detail: "The account is active but not bound to any provider. Runtime access would resolve without provider truth.",
      tone: "danger",
      statusKey: "blocked",
    };
  }

  if (account.status === "active" && (account.runtime_key_count ?? 0) > 0 && !account.last_activity_at) {
    return {
      level: "review",
      label: "Live keys without usage evidence",
      detail: "Keys exist, but no runtime usage was recorded yet. Confirm whether issuance was expected.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "active" && (account.runtime_key_count ?? 0) === 0) {
    return {
      level: "review",
      label: "Ready but unissued",
      detail: "The identity is active but no runtime key is attached yet.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "suspended") {
    return {
      level: "review",
      label: "Temporarily paused",
      detail: "This identity is intentionally suspended and should be reviewed before reactivation.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "disabled") {
    return {
      level: "controlled",
      label: "Deactivated",
      detail: "The identity is disabled and not expected to serve runtime access.",
      tone: "neutral",
      statusKey: "ready",
    };
  }

  return {
    level: "controlled",
    label: "Controlled",
    detail: "Bindings, lifecycle, and runtime exposure are aligned.",
    tone: "success",
    statusKey: "ready",
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Check whether an account matches a free-text search value.
 * @param account - The account to test.
 * @param instanceLabel - The resolved instance label.
 * @param value - The search query.
 * @returns True if the account matches.
 */
export function searchMatches(account: GatewayAccount, instanceLabel: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    account.account_id,
    account.label,
    account.instance_id ?? "",
    instanceLabel,
    account.tenant_id ?? "",
    account.status,
    account.provider_bindings.join(" "),
    account.notes,
  ].some((part) => part.toLowerCase().includes(normalized));
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

/**
 * Create an AccountFormState from an existing account (for editing) or empty.
 * @param account - Optional account to populate from.
 * @returns The form state.
 */
export function createFormState(account?: GatewayAccount | null): AccountFormState {
  if (!account) {
    return { label: "", providerBindingsText: "", notes: "" };
  }
  return {
    label: account.label,
    providerBindingsText: account.provider_bindings.join("\n"),
    notes: account.notes,
  };
}
