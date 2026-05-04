/**
 * Costs feature — inline types extracted from the monolithic CostsPage.
 *
 * @packageDocumentation
 */

import type {
  RoutingBudgetScopeUpdateRecord,
  RoutingCircuitRecord,
} from "../../api/domain/routing";

// ── State ────────────────────────────────────────────────────────────────

/** Load state for the costs page data. */
export type LoadState = "idle" | "loading" | "success" | "error";

// ── Budget editor ────────────────────────────────────────────────────────

/** Draft values for a single budget scope in the budget editor. */
export type BudgetScopeDraft = {
  scope_type: RoutingBudgetScopeUpdateRecord["scope_type"];
  scope_key: string;
  window: RoutingBudgetScopeUpdateRecord["window"];
  enabled: boolean;
  soft_cost_limit: string;
  hard_cost_limit: string;
  soft_token_limit: string;
  hard_token_limit: string;
  soft_blocked_cost_classes: string;
  note: string;
  observed_cost: number | null;
  observed_tokens: number | null;
  previous_window_cost: number | null;
  previous_window_tokens: number | null;
  soft_limit_exceeded: boolean;
  hard_limit_exceeded: boolean;
  last_evaluated_at: string | null;
};

/** The full budget draft state stored in the editor. */
export type BudgetDraft = {
  hard_blocked: boolean;
  blocked_cost_classes: string;
  reason: string;
  scopes: BudgetScopeDraft[];
};

// ── Cost truth ───────────────────────────────────────────────────────────

/** Key for each cost-truth axis. */
export type CostTruthKey = "actual" | "provider_reported" | "estimated" | "modeled" | "avoided";

/** A single cost-truth ledger entry. */
export type CostTruthRecord = {
  key: CostTruthKey;
  label: string;
  status: "tracked" | "derived" | "unsupported";
  billing_truth: boolean;
  description: string;
  runtime_cost: number | null;
  health_check_cost: number | null;
  total_cost: number | null;
};

// ── Blocked cost classes ─────────────────────────────────────────────────

/** A row in the blocked-cost-classes table. */
export type BlockedCostClassRow = {
  costClass: string;
  status: "blocked" | "degraded";
  effect: string;
  reasons: string[];
  sources: string[];
  lastSignalAt: string | null;
  affectedTargets: number;
};

// ── Circuits ─────────────────────────────────────────────────────────────

/** A provider-aggregated circuit row. */
export type ProviderCircuitRow = {
  provider: string;
  targetCount: number;
  openCircuitCount: number;
  costClasses: string[];
  reasons: string[];
  lastTripAt: string | null;
  status: "ready" | "degraded" | "blocked";
};

/** A per-target circuit row. */
export type TargetCircuitRow = {
  targetKey: string;
  label: string;
  provider: string;
  costClass: string;
  state: RoutingCircuitRecord["state"];
  reason: string | null;
  updatedAt: string | null;
};

// ── Cost mix ────────────────────────────────────────────────────────────

/** A row in the routing cost-mix table. */
export type CostMixRow = {
  costClass: string;
  selectedCount: number;
  providerCount: number;
  providers: string[];
  stages: string[];
  share: number;
};

// ── Gate status ─────────────────────────────────────────────────────────

/** Summary of the traffic-gate status. */
export type GateStatus = {
  label: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  statusKey: string;
  detail: string;
};

// ── Constants ───────────────────────────────────────────────────────────

/** Canonical ordering of cost-truth keys. */
export const COST_TRUTH_ORDER: CostTruthKey[] = [
  "actual",
  "provider_reported",
  "estimated",
  "modeled",
  "avoided",
];

/** Default soft-blocked cost classes when a scope exceeds its soft limit. */
export const DEFAULT_SOFT_BLOCKED_COST_CLASSES = ["high", "premium"];

/** Budget window options for the editor. */
export const BUDGET_WINDOW_OPTIONS: RoutingBudgetScopeUpdateRecord["window"][] = [
  "1h",
  "24h",
  "7d",
  "30d",
];
