import type { MutableSettingEntry } from "../../api/admin";

/**
 * Load state for asynchronous operations.
 * "idle" before first fetch, "loading" during fetch,
 * "success" after successful fetch, "error" on failure.
 */
export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Filter options for the settings category selector.
 */
export type CategoryFilter = "all" | "general" | "runtime" | "security" | "routing" | "advanced";

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
 * Maps API setting groups to simplified display categories.
 * Reduces 7 API groups into 5 scannable categories for operators.
 */
export const GROUP_TO_CATEGORY: Record<
  MutableSettingEntry["group"],
  Exclude<CategoryFilter, "all">
> = {
  ui: "general",
  runtime: "runtime",
  security: "security",
  routing: "routing",
  providers: "routing",
  tls: "advanced",
  observability: "advanced",
};

/**
 * Display label for each category filter option.
 */
export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All settings",
  general: "General",
  runtime: "Runtime",
  security: "Security",
  routing: "Routing",
  advanced: "Advanced",
};

/**
 * Priority order for displaying categories in the settings list.
 */
export const CATEGORY_ORDER: readonly Exclude<CategoryFilter, "all">[] = [
  "general",
  "runtime",
  "security",
  "routing",
  "advanced",
] as const;
