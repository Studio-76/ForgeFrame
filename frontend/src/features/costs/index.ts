/**
 * Costs feature module — decomposed cost management and budget controls.
 *
 * Provides data types, pure helper functions, and presentation components
 * for the Costs & Budget Controls page, extracted from the monolithic
 * 1734-line CostsPage.
 *
 * @packageDocumentation
 */

export { CostTruthTable } from "./components/CostTruthTable";
export type { CostTruthTableProps, CostHotspotItem } from "./components/CostTruthTable";

export { CostBudgetView } from "./components/CostBudgetView";
export type { CostBudgetViewProps } from "./components/CostBudgetView";

export { CostMixView } from "./components/CostMixView";
export type { CostMixViewProps } from "./components/CostMixView";

export { CostDetailPanel } from "./components/CostDetailPanel";
export type { CostDetailPanelProps } from "./components/CostDetailPanel";

export type {
  LoadState,
  BudgetScopeDraft,
  BudgetDraft,
  CostTruthKey,
  CostTruthRecord,
  BlockedCostClassRow,
  ProviderCircuitRow,
  TargetCircuitRow,
  CostMixRow,
  GateStatus,
} from "./types";

export {
  COST_TRUTH_ORDER,
  DEFAULT_SOFT_BLOCKED_COST_CLASSES,
  BUDGET_WINDOW_OPTIONS,
} from "./types";

export {
  toNumber,
  normalizeCostClass,
  titleCase,
  toBoolean,
  formatMetric,
  formatCurrency,
  formatPercent,
  formatTimestamp,
  parseCsv,
  parseNullableNumber,
  truthTone,
  buildFallbackCostTruths,
  buildCostTruths,
  budgetScopeDraft,
  defaultBudgetScope,
  buildBudgetScopePayload,
  scopeStatus,
  latestIso,
  summaryStringList,
  effectiveHardBlocked,
  effectiveBlockedCostClasses,
  buildBlockedCostClassRows,
  buildProviderCircuitRows,
  buildTargetCircuitRows,
  buildCostMixRows,
  remainingBudgetMeta,
  gateStatus,
} from "./helpers";
