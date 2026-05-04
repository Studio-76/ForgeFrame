/**
 * Costs feature — pure helper functions extracted from the monolithic CostsPage.
 *
 * @packageDocumentation
 */

import type { StatusTone } from "../../components/ui/StatusBadge";
import type {
  RoutingBudgetRecord,
  RoutingBudgetScopeRecord,
  RoutingBudgetScopeUpdateRecord,
  RoutingControlPlaneResponse,
} from "../../api/domain/routing";
import type { UsageSummaryResponse } from "../../api/domain/usage";
import type {
  BlockedCostClassRow,
  BudgetScopeDraft,
  CostMixRow,
  CostTruthKey,
  CostTruthRecord,
  GateStatus,
  ProviderCircuitRow,
  TargetCircuitRow,
} from "./types";
import {
  COST_TRUTH_ORDER,
  DEFAULT_SOFT_BLOCKED_COST_CLASSES,
} from "./types";

// ── Primitives ───────────────────────────────────────────────────────────

/** Parse any value to a finite number (defaults to 0). */
export function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Normalise a cost-class string to lowercase trimmed. */
export function normalizeCostClass(value: string): string {
  return value.trim().toLowerCase();
}

/** Convert snake/kebab-case to Title Case. */
export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Parse a value to boolean. */
export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  if (typeof value === "number") return value !== 0;
  return false;
}

/** Format a value as a locale-aware number. */
export function formatMetric(value: unknown, digits = 0): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Format a number as USD currency. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unsupported";
  return toNumber(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a ratio as a percentage string. */
export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Format a timestamp for display. */
export function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "No recent evidence";
}

/** Parse comma-separated values into a string array. */
export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Parse a form input as a non-negative number, returning null for empty. */
export function parseNullableNumber(label: string, value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return parsed;
}

// ── Cost truth helpers ───────────────────────────────────────────────────

/** Map a CostTruthRecord status to a StatusTone. */
export function truthTone(truth: CostTruthRecord): StatusTone {
  if (truth.status === "tracked") return "success";
  if (truth.status === "unsupported") return "info";
  return "warning";
}

/** Build cost-truth records from a usage summary (fallback when API cost_truths is absent). */
export function buildFallbackCostTruths(summary: UsageSummaryResponse): Record<CostTruthKey, CostTruthRecord> {
  const runtimeActual = toNumber(summary.traffic_split.runtime.actual_cost);
  const runtimeEstimated = toNumber(summary.traffic_split.runtime.hypothetical_cost);
  const runtimeAvoided = toNumber(summary.traffic_split.runtime.avoided_cost);
  const healthActual = toNumber(summary.traffic_split.health_check.actual_cost);
  const healthEstimated = toNumber(summary.traffic_split.health_check.hypothetical_cost);
  const healthAvoided = toNumber(summary.traffic_split.health_check.avoided_cost);
  const modeledRuntime = Math.max(runtimeEstimated - runtimeActual, 0);
  const modeledHealth = Math.max(healthEstimated - healthActual, 0);

  return {
    actual: {
      key: "actual",
      label: "Actual",
      status: "tracked",
      billing_truth: true,
      description: "Persisted runtime and health costs when ForgeFrame is the direct metering path.",
      runtime_cost: runtimeActual,
      health_check_cost: healthActual,
      total_cost: runtimeActual + healthActual,
    },
    provider_reported: {
      key: "provider_reported",
      label: "Provider reported",
      status: "unsupported",
      billing_truth: true,
      description: "ForgeFrame does not ingest provider invoices or billing exports on this host.",
      runtime_cost: null,
      health_check_cost: null,
      total_cost: null,
    },
    estimated: {
      key: "estimated",
      label: "Estimated",
      status: "derived",
      billing_truth: false,
      description: "Configured price-card estimate across recorded traffic. Useful for forecast, not billing truth.",
      runtime_cost: runtimeEstimated,
      health_check_cost: healthEstimated,
      total_cost: runtimeEstimated + healthEstimated,
    },
    modeled: {
      key: "modeled",
      label: "Modeled",
      status: "derived",
      billing_truth: false,
      description: "Estimated cost exposure that is not directly metered by ForgeFrame actual-cost records.",
      runtime_cost: modeledRuntime,
      health_check_cost: modeledHealth,
      total_cost: modeledRuntime + modeledHealth,
    },
    avoided: {
      key: "avoided",
      label: "Avoided",
      status: "derived",
      billing_truth: false,
      description: "Estimated spend avoided when traffic would have been billable under a metered equivalent.",
      runtime_cost: runtimeAvoided,
      health_check_cost: healthAvoided,
      total_cost: runtimeAvoided + healthAvoided,
    },
  };
}

/** Build the ordered cost-truth array from API response or fallback. */
export function buildCostTruths(summary: UsageSummaryResponse | null): CostTruthRecord[] {
  if (!summary) return [];
  const source = summary.cost_truths ?? buildFallbackCostTruths(summary);
  return COST_TRUTH_ORDER.map((key) => {
    const truth = source[key];
    if (!truth) return buildFallbackCostTruths(summary)[key];
    return {
      key,
      label: truth.label,
      status: truth.status,
      billing_truth: truth.billing_truth,
      description: truth.description,
      runtime_cost: truth.runtime_cost,
      health_check_cost: truth.health_check_cost,
      total_cost: truth.total_cost,
    };
  });
}

// ── Budget editor helpers ────────────────────────────────────────────────

/** Convert a scope record to the editor draft format. */
export function budgetScopeDraft(scope: RoutingBudgetScopeRecord): BudgetScopeDraft {
  return {
    scope_type: scope.scope_type,
    scope_key: scope.scope_key,
    window: scope.window,
    enabled: scope.enabled,
    soft_cost_limit: scope.soft_cost_limit == null ? "" : String(scope.soft_cost_limit),
    hard_cost_limit: scope.hard_cost_limit == null ? "" : String(scope.hard_cost_limit),
    soft_token_limit: scope.soft_token_limit == null ? "" : String(scope.soft_token_limit),
    hard_token_limit: scope.hard_token_limit == null ? "" : String(scope.hard_token_limit),
    soft_blocked_cost_classes: scope.soft_blocked_cost_classes.join(", "),
    note: scope.note ?? "",
    observed_cost: scope.observed_cost ?? null,
    observed_tokens: scope.observed_tokens ?? null,
    previous_window_cost: scope.previous_window_cost ?? null,
    previous_window_tokens: scope.previous_window_tokens ?? null,
    soft_limit_exceeded: scope.soft_limit_exceeded,
    hard_limit_exceeded: scope.hard_limit_exceeded,
    last_evaluated_at: scope.last_evaluated_at ?? null,
  };
}

/** Create a default empty budget scope draft. */
export function defaultBudgetScope(instanceId: string | null): BudgetScopeDraft {
  return {
    scope_type: "instance",
    scope_key: instanceId ?? "",
    window: "24h",
    enabled: true,
    soft_cost_limit: "",
    hard_cost_limit: "",
    soft_token_limit: "",
    hard_token_limit: "",
    soft_blocked_cost_classes: "high, premium",
    note: "",
    observed_cost: null,
    observed_tokens: null,
    previous_window_cost: null,
    previous_window_tokens: null,
    soft_limit_exceeded: false,
    hard_limit_exceeded: false,
    last_evaluated_at: null,
  };
}

/** Convert a draft scope to the API update payload. */
export function buildBudgetScopePayload(scope: BudgetScopeDraft): RoutingBudgetScopeUpdateRecord {
  const scopeKey = scope.scope_key.trim();
  if (!scopeKey) throw new Error("Budget scope key is required.");
  return {
    scope_type: scope.scope_type,
    scope_key: scopeKey,
    window: scope.window,
    enabled: scope.enabled,
    soft_cost_limit: parseNullableNumber("Soft cost limit", scope.soft_cost_limit),
    hard_cost_limit: parseNullableNumber("Hard cost limit", scope.hard_cost_limit),
    soft_token_limit: parseNullableNumber("Soft token limit", scope.soft_token_limit),
    hard_token_limit: parseNullableNumber("Hard token limit", scope.hard_token_limit),
    soft_blocked_cost_classes: parseCsv(scope.soft_blocked_cost_classes),
    note: scope.note.trim() || null,
  };
}

/** Compute display status for a budget scope. */
export function scopeStatus(scope: RoutingBudgetScopeRecord | BudgetScopeDraft): {
  label: string;
  tone: StatusTone;
  statusKey: string;
} {
  if (!scope.enabled) return { label: "Disabled", tone: "neutral", statusKey: "partial" };
  if (scope.hard_limit_exceeded) return { label: "Hard limit exceeded", tone: "danger", statusKey: "blocked" };
  if (scope.soft_limit_exceeded) return { label: "Soft limit exceeded", tone: "warning", statusKey: "degraded" };
  return { label: "Within limit", tone: "success", statusKey: "ready" };
}

// ── Date helpers ─────────────────────────────────────────────────────────

/** Return the latest ISO timestamp of two. */
export function latestIso(left: string | null | undefined, right: string | null | undefined): string | null {
  if (!left) return right ?? null;
  if (!right) return left;
  return left >= right ? left : right;
}

// ── Routing snapshot helpers ─────────────────────────────────────────────

/** Extract a string-array summary field. */
export function summaryStringList(snapshot: RoutingControlPlaneResponse | null, key: string): string[] {
  if (!snapshot) return [];
  const value = snapshot.summary[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

/** Whether the hard budget block is active. */
export function effectiveHardBlocked(snapshot: RoutingControlPlaneResponse | null): boolean {
  if (!snapshot) return false;
  const summaryValue = snapshot.summary.hard_budget_blocked;
  if (summaryValue !== undefined) return toBoolean(summaryValue);
  return snapshot.budget.hard_blocked;
}

/** Resolve the effective blocked cost classes from summary or budget. */
export function effectiveBlockedCostClasses(snapshot: RoutingControlPlaneResponse | null): string[] {
  if (!snapshot) return [];
  const fromSummary = summaryStringList(snapshot, "blocked_cost_classes");
  if (fromSummary.length > 0) return fromSummary;
  return snapshot.budget.blocked_cost_classes;
}

/** Build blocked cost-class table rows. */
export function buildBlockedCostClassRows(snapshot: RoutingControlPlaneResponse | null): BlockedCostClassRow[] {
  if (!snapshot) return [];

  const rows = new Map<string, BlockedCostClassRow>();
  const affectedTargetCounts = new Map<string, number>();
  const hardBlocked = effectiveHardBlocked(snapshot);
  const evaluatedBlockedClasses = effectiveBlockedCostClasses(snapshot);

  snapshot.targets.forEach((target) => {
    const key = normalizeCostClass(target.cost_class);
    affectedTargetCounts.set(key, (affectedTargetCounts.get(key) ?? 0) + 1);
  });

  const upsert = (costClass: string, row: Omit<BlockedCostClassRow, "affectedTargets">) => {
    const key = normalizeCostClass(costClass);
    const existing = rows.get(key);
    if (!existing) {
      rows.set(key, { ...row, costClass: key, affectedTargets: affectedTargetCounts.get(key) ?? 0 });
      return;
    }
    rows.set(key, {
      ...existing,
      status: existing.status === "blocked" || row.status === "blocked" ? "blocked" : "degraded",
      reasons: Array.from(new Set([...existing.reasons, ...row.reasons])),
      sources: Array.from(new Set([...existing.sources, ...row.sources])),
      lastSignalAt: latestIso(existing.lastSignalAt, row.lastSignalAt),
    });
  };

  snapshot.budget.blocked_cost_classes.forEach((costClass) => {
    upsert(costClass, {
      costClass,
      status: "blocked",
      effect: hardBlocked
        ? "Hard budget posture is active; this class is also excluded from selection."
        : "Targets in this cost class are excluded before routing chooses a winner.",
      reasons: [snapshot.budget.reason ?? "Configured blocked cost class list"],
      sources: ["budget_state"],
      lastSignalAt: snapshot.budget.updated_at ?? snapshot.budget.last_evaluated_at ?? null,
    });
  });

  snapshot.budget.scopes
    .filter((scope) => scope.enabled && scope.soft_limit_exceeded)
    .forEach((scope) => {
      const softBlockedClasses = scope.soft_blocked_cost_classes.length > 0
        ? scope.soft_blocked_cost_classes
        : DEFAULT_SOFT_BLOCKED_COST_CLASSES;
      softBlockedClasses.forEach((costClass) => {
        upsert(costClass, {
          costClass,
          status: "degraded",
          effect: "Soft-limit pressure is suppressing this class while lower-cost classes remain eligible.",
          reasons: [`${titleCase(scope.scope_type)} scope ${scope.scope_key} exceeded its soft limit in ${scope.window}.`],
          sources: [`${scope.scope_type}:${scope.scope_key}`],
          lastSignalAt: scope.last_evaluated_at ?? snapshot.budget.last_evaluated_at ?? null,
        });
      });
    });

  evaluatedBlockedClasses.forEach((costClass) => {
    const normalized = normalizeCostClass(costClass);
    if (rows.has(normalized)) return;
    upsert(costClass, {
      costClass,
      status: hardBlocked ? "blocked" : "degraded",
      effect: hardBlocked
        ? "Hard budget posture is active; all routing is blocked and this class is part of the evaluated exclusion set."
        : "Evaluated budget posture is suppressing this class before routing picks a target.",
      reasons: [snapshot.budget.reason ?? "Derived from the evaluated budget posture for the active instance scope."],
      sources: ["evaluated_budget_summary"],
      lastSignalAt: snapshot.budget.last_evaluated_at ?? snapshot.budget.updated_at ?? null,
    });
  });

  return Array.from(rows.values()).sort((left, right) => {
    if (left.status !== right.status) return left.status === "blocked" ? -1 : 1;
    return left.costClass.localeCompare(right.costClass);
  });
}

/** Build provider-aggregated circuit rows. */
export function buildProviderCircuitRows(snapshot: RoutingControlPlaneResponse | null): ProviderCircuitRow[] {
  if (!snapshot) return [];

  const circuitMap = new Map(snapshot.circuits.map((circuit) => [circuit.target_key, circuit]));
  const providerMap = new Map<string, ProviderCircuitRow>();

  snapshot.targets.forEach((target) => {
    const circuit = circuitMap.get(target.target_key);
    const current = providerMap.get(target.provider) ?? {
      provider: target.provider,
      targetCount: 0,
      openCircuitCount: 0,
      costClasses: [],
      reasons: [],
      lastTripAt: null,
      status: "ready",
    };
    current.targetCount += 1;
    if (!current.costClasses.includes(target.cost_class)) {
      current.costClasses.push(target.cost_class);
    }
    if (circuit?.state === "open") {
      current.openCircuitCount += 1;
      current.status = current.openCircuitCount === current.targetCount ? "blocked" : "degraded";
      current.lastTripAt = latestIso(current.lastTripAt, circuit.updated_at ?? null);
      if (circuit.reason && !current.reasons.includes(circuit.reason)) {
        current.reasons.push(circuit.reason);
      }
    }
    providerMap.set(target.provider, current);
  });

  Array.from(providerMap.values()).forEach((row) => {
    if (row.openCircuitCount === 0) row.status = "ready";
    else if (row.openCircuitCount === row.targetCount) row.status = "blocked";
    else row.status = "degraded";
    row.costClasses.sort();
  });

  return Array.from(providerMap.values()).sort((left, right) => left.provider.localeCompare(right.provider));
}

/** Build per-target circuit rows. */
export function buildTargetCircuitRows(snapshot: RoutingControlPlaneResponse | null): TargetCircuitRow[] {
  if (!snapshot) return [];

  const targetMap = new Map(snapshot.targets.map((target) => [target.target_key, target]));
  const keys = Array.from(
    new Set([
      ...snapshot.targets.map((target) => target.target_key),
      ...snapshot.circuits.map((circuit) => circuit.target_key),
    ]),
  );

  return keys
    .map((targetKey) => {
      const target = targetMap.get(targetKey);
      const circuit = snapshot.circuits.find((entry) => entry.target_key === targetKey);
      return {
        targetKey,
        label: target?.label ?? targetKey,
        provider: target?.provider ?? "unknown",
        costClass: target?.cost_class ?? "unknown",
        state: circuit?.state ?? "closed",
        reason: circuit?.reason ?? null,
        updatedAt: circuit?.updated_at ?? null,
      };
    })
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey));
}

/** Build cost-mix rows from recent routing decisions. */
export function buildCostMixRows(snapshot: RoutingControlPlaneResponse | null): CostMixRow[] {
  if (!snapshot) return [];

  const grouped = new Map<string, { count: number; providers: Set<string>; stages: Set<string> }>();
  let selectedCount = 0;

  snapshot.recent_decisions.forEach((decision) => {
    const selected = decision.candidates.find((candidate) => candidate.selected);
    if (!selected) return;
    selectedCount += 1;
    const key = normalizeCostClass(selected.cost_class);
    const current = grouped.get(key) ?? { count: 0, providers: new Set<string>(), stages: new Set<string>() };
    current.count += 1;
    current.providers.add(selected.provider);
    current.stages.add(decision.policy_stage);
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([costClass, item]) => ({
      costClass,
      selectedCount: item.count,
      providerCount: item.providers.size,
      providers: Array.from(item.providers).sort(),
      stages: Array.from(item.stages).sort(),
      share: selectedCount === 0 ? 0 : item.count / selectedCount,
    }))
    .sort((left, right) => right.selectedCount - left.selectedCount || left.costClass.localeCompare(right.costClass));
}

/** Find the remaining budget for the tightest hard-cost scope. */
export function remainingBudgetMeta(scopes: RoutingBudgetRecord["scopes"]): {
  label: string;
  remaining: number;
  limit: number;
} | null {
  const candidates = scopes
    .filter((scope) => scope.enabled && scope.hard_cost_limit !== null && scope.hard_cost_limit !== undefined)
    .map((scope) => ({
      label: `${scope.scope_type}:${scope.scope_key} · ${scope.window}`,
      remaining: toNumber(scope.hard_cost_limit) - toNumber(scope.observed_cost),
      limit: toNumber(scope.hard_cost_limit),
    }));
  if (candidates.length === 0) return null;
  return candidates.reduce((current, item) => (item.remaining < current.remaining ? item : current));
}

/** Compute the traffic-gate status label/tone/detail. */
export function gateStatus(
  snapshot: RoutingControlPlaneResponse | null,
  blockedCostClasses: BlockedCostClassRow[],
  openCircuits: number,
): GateStatus {
  if (!snapshot) {
    return {
      label: "Unavailable",
      tone: "neutral",
      statusKey: "partial",
      detail: "Routing budget and circuit truth are not loaded.",
    };
  }
  if (effectiveHardBlocked(snapshot)) {
    return {
      label: "Hard blocked",
      tone: "danger",
      statusKey: "blocked",
      detail: snapshot.budget.reason ?? "Budget guardrails are hard-blocking routing decisions.",
    };
  }
  if (blockedCostClasses.length > 0 || openCircuits > 0 || snapshot.budget.scopes.some((scope) => scope.soft_limit_exceeded)) {
    return {
      label: "Warning posture",
      tone: "warning",
      statusKey: "degraded",
      detail: "Routing remains open, but cost-class suppression or target circuit pressure is active.",
    };
  }
  return {
    label: "Within posture",
    tone: "success",
    statusKey: "ready",
    detail: "No active hard block, cost-class suppression, or target circuit pressure is visible.",
  };
}
