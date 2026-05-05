/**
 * Account feature types, constants, and default form values.
 *
 * @packageDocumentation
 */

import type { GatewayAccount } from "../../api/domain/accounts";

// ---------------------------------------------------------------------------
// Load state
// ---------------------------------------------------------------------------

/** Standardised data-fetching state. */
export type LoadState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Drawer mode
// ---------------------------------------------------------------------------

/** Detail drawer visibility mode. */
export type DrawerMode = "closed" | "create" | "edit";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/** Lifecycle status filter. */
export type StatusFilter = GatewayAccount["status"] | "all";

/** Risk review pressure filter. */
export type RiskFilter = "all" | "controlled" | "review" | "attention";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/** Form state for creating or editing an account. */
export type AccountFormState = {
  label: string;
  providerBindingsText: string;
  notes: string;
};

// ---------------------------------------------------------------------------
// Risk summary
// ---------------------------------------------------------------------------

import type { StatusTone } from "../../components/ui/StatusBadge";

/** Derived risk summary for a single account. */
export type AccountRiskSummary = {
  level: Exclude<RiskFilter, "all">;
  label: string;
  detail: string;
  tone: StatusTone;
  statusKey: "ready" | "partial" | "blocked";
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Empty form state for resetting the create/edit form. */
export const EMPTY_FORM: AccountFormState = {
  label: "",
  providerBindingsText: "",
  notes: "",
};

/** HTML form ID for the account drawer form. */
export const DRAWER_FORM_ID = "account-drawer-form";
