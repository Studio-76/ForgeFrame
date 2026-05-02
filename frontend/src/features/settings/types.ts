import type { MutableSettingEntry } from "../../api/domain";

/**
 * Load state for asynchronous operations.
 * "idle" before first fetch, "loading" during fetch,
 * "success" after successful fetch, "error" on failure.
 */
export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Filter options for the settings category selector.
 */
export type CategoryFilter =
  | "all"
  | "general"
  | "routing_defaults"
  | "provider_enablement"
  | "tls_public_access"
  | "audit_retention"
  | "advanced_security";

/**
 * State for the high-risk setting confirmation dialog.
 */
export interface ConfirmDialogState {
  /** Whether the dialog is currently shown. */
  visible: boolean;
  /** The setting that triggered the confirmation. */
  item: MutableSettingEntry | null;
  /** The action type being confirmed. */
  action: "save" | "reset" | null;
}

/** Default closed confirmation dialog state. */
export const DEFAULT_CONFIRM_DIALOG: ConfirmDialogState = {
  visible: false,
  item: null,
  action: null,
};

/**
 * Maps API setting groups to operator-oriented display categories.
 *
 * Separates general app settings, routing defaults, provider enablement,
 * TLS/public access, audit/retention, and advanced security into distinct
 * scannable groups so operators can quickly find what they need.
 */
export const GROUP_TO_CATEGORY: Record<
  MutableSettingEntry["group"],
  Exclude<CategoryFilter, "all">
> = {
  ui: "general",
  runtime: "general",
  security: "advanced_security",
  routing: "routing_defaults",
  providers: "provider_enablement",
  tls: "tls_public_access",
  observability: "audit_retention",
};

/**
 * Display label for each category filter option.
 */
export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All settings",
  general: "General",
  routing_defaults: "Routing defaults",
  provider_enablement: "Provider enablement",
  tls_public_access: "TLS / Public access",
  audit_retention: "Audit & retention",
  advanced_security: "Advanced security",
};

/**
 * Priority order for displaying categories in the settings list.
 */
export const CATEGORY_ORDER: readonly Exclude<CategoryFilter, "all">[] = [
  "general",
  "routing_defaults",
  "provider_enablement",
  "tls_public_access",
  "audit_retention",
  "advanced_security",
] as const;
