import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchRoutingControlPlane,
  updateRoutingBudget,
  updateRoutingCircuit,
  type RoutingBudgetRecord,
  type RoutingBudgetScopeRecord,
  type RoutingBudgetScopeUpdateRecord,
  type RoutingCircuitRecord,
  type RoutingControlPlaneResponse,
} from "../api/domain/routing";
import { fetchUsageSummary, type UsageSummaryResponse } from "../api/domain/usage";
import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { DetailPanel } from "../components/ui/DetailPanel";
import { ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";

type BudgetScopeDraft = {
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

type CostTruthKey = "actual" | "provider_reported" | "estimated" | "modeled" | "avoided";

type CostTruthRecord = {
  key: CostTruthKey;
  label: string;
  status: "tracked" | "derived" | "unsupported";
  billing_truth: boolean;
  description: string;
  runtime_cost: number | null;
  health_check_cost: number | null;
  total_cost: number | null;
};

type BlockedCostClassRow = {
  costClass: string;
  status: "blocked" | "degraded";
  effect: string;
  reasons: string[];
  sources: string[];
  lastSignalAt: string | null;
  affectedTargets: number;
};

type ProviderCircuitRow = {
  provider: string;
  targetCount: number;
  openCircuitCount: number;
  costClasses: string[];
  reasons: string[];
  lastTripAt: string | null;
  status: "ready" | "degraded" | "blocked";
};

type TargetCircuitRow = {
  targetKey: string;
  label: string;
  provider: string;
  costClass: string;
  state: RoutingCircuitRecord["state"];
  reason: string | null;
  updatedAt: string | null;
};

type CostMixRow = {
  costClass: string;
  selectedCount: number;
  providerCount: number;
  providers: string[];
  stages: string[];
  share: number;
};

const COST_TRUTH_ORDER: CostTruthKey[] = ["actual", "provider_reported", "estimated", "modeled", "avoided"];
const DEFAULT_SOFT_BLOCKED_COST_CLASSES = ["high", "premium"];
const BUDGET_WINDOW_OPTIONS: RoutingBudgetScopeUpdateRecord["window"][] = ["1h", "24h", "7d", "30d"];

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCostClass(value: string): string {
  return value.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function formatMetric(value: unknown, digits = 0): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Unsupported";
  }
  return toNumber(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "No recent evidence";
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableNumber(label: string, value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return parsed;
}

function truthTone(truth: CostTruthRecord): StatusTone {
  if (truth.status === "tracked") {
    return "success";
  }
  if (truth.status === "unsupported") {
    return "info";
  }
  return "warning";
}

function buildFallbackCostTruths(summary: UsageSummaryResponse): Record<CostTruthKey, CostTruthRecord> {
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

function buildCostTruths(summary: UsageSummaryResponse | null): CostTruthRecord[] {
  if (!summary) {
    return [];
  }

  const source = summary.cost_truths ?? buildFallbackCostTruths(summary);

  return COST_TRUTH_ORDER.map((key) => {
    const truth = source[key];
    if (!truth) {
      return buildFallbackCostTruths(summary)[key];
    }
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

function budgetScopeDraft(scope: RoutingBudgetScopeRecord): BudgetScopeDraft {
  return {
    scope_type: scope.scope_type,
    scope_key: scope.scope_key,
    window: scope.window,
    enabled: scope.enabled,
    soft_cost_limit: scope.soft_cost_limit === null || scope.soft_cost_limit === undefined ? "" : String(scope.soft_cost_limit),
    hard_cost_limit: scope.hard_cost_limit === null || scope.hard_cost_limit === undefined ? "" : String(scope.hard_cost_limit),
    soft_token_limit: scope.soft_token_limit === null || scope.soft_token_limit === undefined ? "" : String(scope.soft_token_limit),
    hard_token_limit: scope.hard_token_limit === null || scope.hard_token_limit === undefined ? "" : String(scope.hard_token_limit),
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

function defaultBudgetScope(instanceId: string | null): BudgetScopeDraft {
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

function buildBudgetScopePayload(scope: BudgetScopeDraft): RoutingBudgetScopeUpdateRecord {
  const scopeKey = scope.scope_key.trim();
  if (!scopeKey) {
    throw new Error("Budget scope key is required.");
  }
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

function scopeStatus(scope: RoutingBudgetScopeRecord | BudgetScopeDraft): { label: string; tone: StatusTone; statusKey: string } {
  if (!scope.enabled) {
    return { label: "Disabled", tone: "neutral", statusKey: "partial" };
  }
  if (scope.hard_limit_exceeded) {
    return { label: "Hard limit exceeded", tone: "danger", statusKey: "blocked" };
  }
  if (scope.soft_limit_exceeded) {
    return { label: "Soft limit exceeded", tone: "warning", statusKey: "degraded" };
  }
  return { label: "Within limit", tone: "success", statusKey: "ready" };
}

function latestIso(left: string | null | undefined, right: string | null | undefined): string | null {
  if (!left) {
    return right ?? null;
  }
  if (!right) {
    return left;
  }
  return left >= right ? left : right;
}

function summaryStringList(snapshot: RoutingControlPlaneResponse | null, key: string): string[] {
  if (!snapshot) {
    return [];
  }
  const value = snapshot.summary[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function effectiveHardBlocked(snapshot: RoutingControlPlaneResponse | null): boolean {
  if (!snapshot) {
    return false;
  }
  const summaryValue = snapshot.summary.hard_budget_blocked;
  if (summaryValue !== undefined) {
    return toBoolean(summaryValue);
  }
  return snapshot.budget.hard_blocked;
}

function effectiveBlockedCostClasses(snapshot: RoutingControlPlaneResponse | null): string[] {
  if (!snapshot) {
    return [];
  }
  const fromSummary = summaryStringList(snapshot, "blocked_cost_classes");
  if (fromSummary.length > 0) {
    return fromSummary;
  }
  return snapshot.budget.blocked_cost_classes;
}

function buildBlockedCostClassRows(snapshot: RoutingControlPlaneResponse | null): BlockedCostClassRow[] {
  if (!snapshot) {
    return [];
  }

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
      rows.set(key, {
        ...row,
        costClass: key,
        affectedTargets: affectedTargetCounts.get(key) ?? 0,
      });
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
    if (rows.has(normalized)) {
      return;
    }
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
    if (left.status !== right.status) {
      return left.status === "blocked" ? -1 : 1;
    }
    return left.costClass.localeCompare(right.costClass);
  });
}

function buildProviderCircuitRows(snapshot: RoutingControlPlaneResponse | null): ProviderCircuitRow[] {
  if (!snapshot) {
    return [];
  }

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
    if (row.openCircuitCount === 0) {
      row.status = "ready";
    } else if (row.openCircuitCount === row.targetCount) {
      row.status = "blocked";
    } else {
      row.status = "degraded";
    }
    row.costClasses.sort();
  });

  return Array.from(providerMap.values()).sort((left, right) => left.provider.localeCompare(right.provider));
}

function buildTargetCircuitRows(snapshot: RoutingControlPlaneResponse | null): TargetCircuitRow[] {
  if (!snapshot) {
    return [];
  }

  const targetMap = new Map(snapshot.targets.map((target) => [target.target_key, target]));
  const keys = Array.from(new Set([...snapshot.targets.map((target) => target.target_key), ...snapshot.circuits.map((circuit) => circuit.target_key)]));

  return keys.map((targetKey) => {
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
  }).sort((left, right) => left.targetKey.localeCompare(right.targetKey));
}

function buildCostMixRows(snapshot: RoutingControlPlaneResponse | null): CostMixRow[] {
  if (!snapshot) {
    return [];
  }

  const grouped = new Map<string, { count: number; providers: Set<string>; stages: Set<string> }>();
  let selectedCount = 0;

  snapshot.recent_decisions.forEach((decision) => {
    const selected = decision.candidates.find((candidate) => candidate.selected);
    if (!selected) {
      return;
    }
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

function remainingBudgetMeta(scopes: RoutingBudgetRecord["scopes"]): { label: string; remaining: number; limit: number } | null {
  const candidates = scopes
    .filter((scope) => scope.enabled && scope.hard_cost_limit !== null && scope.hard_cost_limit !== undefined)
    .map((scope) => ({
      label: `${scope.scope_type}:${scope.scope_key} · ${scope.window}`,
      remaining: toNumber(scope.hard_cost_limit) - toNumber(scope.observed_cost),
      limit: toNumber(scope.hard_cost_limit),
    }));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((current, item) => (item.remaining < current.remaining ? item : current));
}

function gateStatus(snapshot: RoutingControlPlaneResponse | null, blockedCostClasses: BlockedCostClassRow[], openCircuits: number): { label: string; tone: StatusTone; statusKey: string; detail: string } {
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

export function CostsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [routing, setRouting] = useState<RoutingControlPlaneResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [savingCircuitKey, setSavingCircuitKey] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<{
    hard_blocked: boolean;
    blocked_cost_classes: string;
    reason: string;
    scopes: BudgetScopeDraft[];
  }>({
    hard_blocked: false,
    blocked_cost_classes: "",
    reason: "",
    scopes: [],
  });
  const [circuitDrafts, setCircuitDrafts] = useState<Record<string, string>>({});

  const canReadUsage = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "audit.read");
  const canReadRouting = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "routing.read");
  const canMutateRouting = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "routing.write");

  const load = async () => {
    if (!canReadUsage && !canReadRouting) {
      setUsage(null);
      setRouting(null);
      setMessages([]);
      setError(null);
      setState("idle");
      return;
    }

    setState("loading");
    setError(null);
    setMessages([]);

    const usagePromise = canReadUsage ? fetchUsageSummary("24h", instanceId) : null;
    const routingPromise = canReadRouting ? fetchRoutingControlPlane(instanceId) : null;
    const results = await Promise.allSettled([
      usagePromise ?? Promise.resolve<UsageSummaryResponse | null>(null),
      routingPromise ?? Promise.resolve<RoutingControlPlaneResponse | null>(null),
    ]);

    const nextMessages: string[] = [];
    const [usageResult, routingResult] = results;

    if (canReadUsage) {
      if (usageResult.status === "fulfilled") {
        const usagePayload = usageResult.value;
        if (usagePayload) {
          setUsage(usagePayload);
        } else {
          setUsage(null);
          nextMessages.push("Usage analytics returned an empty payload.");
        }
      } else {
        setUsage(null);
        nextMessages.push(usageResult.reason instanceof Error ? usageResult.reason.message : "Usage analytics failed to load.");
      }
    } else {
      setUsage(null);
      nextMessages.push("Usage analytics are not visible for this session.");
    }

    if (canReadRouting) {
      if (routingResult.status === "fulfilled") {
        const routingPayload = routingResult.value;
        if (routingPayload) {
          setRouting(routingPayload);
          setBudgetDraft({
            hard_blocked: routingPayload.budget.hard_blocked,
            blocked_cost_classes: routingPayload.budget.blocked_cost_classes.join(", "),
            reason: routingPayload.budget.reason ?? "",
            scopes: routingPayload.budget.scopes.map((scope) => budgetScopeDraft(scope)),
          });
          setCircuitDrafts(
            Object.fromEntries(routingPayload.circuits.map((circuit) => [circuit.target_key, circuit.reason ?? ""])),
          );
        } else {
          setRouting(null);
          nextMessages.push("Routing budget posture returned an empty payload.");
        }
      } else {
        setRouting(null);
        nextMessages.push(routingResult.reason instanceof Error ? routingResult.reason.message : "Routing budget posture failed to load.");
      }
    } else {
      setRouting(null);
      nextMessages.push("Routing budget and circuit controls are not visible for this session.");
    }

    const hasUsage = canReadUsage && usageResult.status === "fulfilled";
    const hasRouting = canReadRouting && routingResult.status === "fulfilled";

    setMessages(nextMessages);
    if (!hasUsage && !hasRouting) {
      setState("error");
      setError(nextMessages[0] ?? "Cost controls failed to load.");
      return;
    }

    setState("success");
  };

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    void load();
  }, [sessionReady, canReadUsage, canReadRouting, instanceId]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const updateScopeDraft = (index: number, patch: Partial<BudgetScopeDraft>) => {
    setBudgetDraft((current) => ({
      ...current,
      scopes: current.scopes.map((scope, scopeIndex) => (
        scopeIndex === index ? { ...scope, ...patch } : scope
      )),
    }));
  };

  const addBudgetScope = () => {
    setBudgetDraft((current) => ({
      ...current,
      scopes: [...current.scopes, defaultBudgetScope(instanceId)],
    }));
  };

  const removeBudgetScope = (index: number) => {
    setBudgetDraft((current) => ({
      ...current,
      scopes: current.scopes.filter((_, scopeIndex) => scopeIndex !== index),
    }));
  };

  const saveBudget = async () => {
    if (!canMutateRouting) {
      setActionError("This session cannot mutate routing budget posture.");
      return;
    }
    setBudgetSaving(true);
    setActionError(null);
    try {
      await updateRoutingBudget(
        {
          hard_blocked: budgetDraft.hard_blocked,
          blocked_cost_classes: parseCsv(budgetDraft.blocked_cost_classes),
          reason: budgetDraft.reason.trim() || null,
          scopes: budgetDraft.scopes.map((scope) => buildBudgetScopePayload(scope)),
        },
        instanceId,
      );
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Budget update failed.");
    } finally {
      setBudgetSaving(false);
    }
  };

  const saveCircuit = async (targetKey: string, nextState: RoutingCircuitRecord["state"]) => {
    if (!canMutateRouting) {
      setActionError("This session cannot mutate routing circuits.");
      return;
    }
    setSavingCircuitKey(targetKey);
    setActionError(null);
    try {
      await updateRoutingCircuit(
        targetKey,
        {
          state: nextState,
          reason: circuitDrafts[targetKey]?.trim() || null,
        },
        instanceId,
      );
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Circuit update failed.");
    } finally {
      setSavingCircuitKey(null);
    }
  };

  const truths = buildCostTruths(usage);
  const truthByKey = Object.fromEntries(truths.map((truth) => [truth.key, truth])) as Partial<Record<CostTruthKey, CostTruthRecord>>;
  const blockedCostClasses = buildBlockedCostClassRows(routing);
  const providerCircuits = buildProviderCircuitRows(routing);
  const targetCircuits = buildTargetCircuitRows(routing);
  const costMixRows = buildCostMixRows(routing);
  const openCircuitCount = targetCircuits.filter((row) => row.state === "open").length;
  const hardBlocked = effectiveHardBlocked(routing);
  const budgetState = gateStatus(routing, blockedCostClasses, openCircuitCount);
  const routingVisibilityLabel = !canReadRouting ? "Hidden" : routing ? null : "Unavailable";
  const routingVisibilityDetail = !canReadRouting
    ? "routing.read is required before this page can claim any budget, blocked-class, or circuit truth."
    : "Routing truth did not load, so budget, blocked-class, and circuit posture remain unavailable.";
  const remainingHardBudget = routing ? remainingBudgetMeta(routing.budget.scopes) : null;
  const warningScopeCount = routing?.budget.scopes.filter((scope) => scope.enabled && scope.soft_limit_exceeded).length ?? 0;
  const hardExceededScopeCount = routing?.budget.scopes.filter((scope) => scope.enabled && scope.hard_limit_exceeded).length ?? 0;
  const premiumMix = costMixRows.find((row) => row.costClass === "premium");
  const lowCostSelections = costMixRows
    .filter((row) => row.costClass === "baseline" || row.costClass === "low")
    .reduce((total, row) => total + row.selectedCount, 0);
  const selectedDecisionCount = costMixRows.reduce((total, row) => total + row.selectedCount, 0);
  const premiumEscalationCount = (routing?.recent_decisions ?? []).filter((decision) => {
    const selected = decision.candidates.find((candidate) => candidate.selected);
    return selected?.cost_class === "premium" && (decision.policy_stage === "fallback" || decision.policy_stage === "escalation");
  }).length;
  const providerCosts = usage?.aggregations.by_provider ?? [];
  const clientCosts = usage?.aggregations.by_client ?? [];
  const routingEditorRoute = withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-policy-editor`, instanceId);
  const routingTargetsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId);
  const usageRoute = withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId);
  const errorsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId);

  const summaryItems: SummaryStripItem[] = [
    {
      key: "gate",
      label: "Traffic gate",
      value: budgetState.label,
      meta: budgetState.detail,
      tone: budgetState.tone,
      status: budgetState.statusKey,
    },
    {
      key: "actual",
      label: "Actual cost",
      value: formatCurrency(truthByKey.actual?.total_cost ?? null),
      meta: truthByKey.actual?.billing_truth ? "Billing truth when ForgeFrame meters the provider path." : "Not available.",
      tone: truthByKey.actual ? truthTone(truthByKey.actual) : "neutral",
      status: truthByKey.actual?.status ?? "partial",
    },
    {
      key: "estimated",
      label: "Estimated cost",
      value: formatCurrency(truthByKey.estimated?.total_cost ?? null),
      meta: "Forecast only. Never presented as provider billing truth.",
      tone: truthByKey.estimated ? truthTone(truthByKey.estimated) : "neutral",
      status: truthByKey.estimated?.status ?? "partial",
    },
    {
      key: "modeled",
      label: "Modeled gap",
      value: formatCurrency(truthByKey.modeled?.total_cost ?? null),
      meta: "Estimated exposure outside ForgeFrame direct metering.",
      tone: truthByKey.modeled ? truthTone(truthByKey.modeled) : "neutral",
      status: truthByKey.modeled?.status ?? "partial",
    },
    {
      key: "remaining",
      label: "Hard budget remaining",
      value: routingVisibilityLabel ?? (remainingHardBudget ? formatCurrency(remainingHardBudget.remaining) : "No hard limit"),
      meta: routingVisibilityLabel
        ? routingVisibilityDetail
        : remainingHardBudget
          ? `${remainingHardBudget.label} of ${formatCurrency(remainingHardBudget.limit)}`
          : "No enabled hard-cost scope is configured.",
      tone: routingVisibilityLabel
        ? "neutral"
        : remainingHardBudget
          ? (remainingHardBudget.remaining < 0 ? "danger" : remainingHardBudget.remaining < remainingHardBudget.limit * 0.2 ? "warning" : "success")
          : "neutral",
      status: routingVisibilityLabel
        ? (!canReadRouting ? "unsupported" : "partial")
        : remainingHardBudget
          ? (remainingHardBudget.remaining < 0 ? "blocked" : remainingHardBudget.remaining < remainingHardBudget.limit * 0.2 ? "degraded" : "ready")
          : "partial",
    },
    {
      key: "circuits",
      label: "Open circuits",
      value: routingVisibilityLabel ?? formatMetric(openCircuitCount),
      meta: routingVisibilityLabel
        ? routingVisibilityDetail
        : openCircuitCount === 0
          ? "No target circuit is currently open."
          : `${providerCircuits.filter((row) => row.openCircuitCount > 0).length} provider group(s) are affected.`,
      tone: routingVisibilityLabel ? "neutral" : openCircuitCount === 0 ? "success" : "warning",
      status: routingVisibilityLabel ? (!canReadRouting ? "unsupported" : "partial") : openCircuitCount === 0 ? "ready" : "degraded",
    },
    {
      key: "blocked-classes",
      label: "Blocked cost classes",
      value: routingVisibilityLabel ?? formatMetric(blockedCostClasses.length),
      meta: routingVisibilityLabel
        ? routingVisibilityDetail
        : blockedCostClasses.length === 0
          ? "No cost class is suppressed right now."
          : blockedCostClasses.map((row) => row.costClass).join(", "),
      tone: routingVisibilityLabel
        ? "neutral"
        : blockedCostClasses.some((row) => row.status === "blocked")
          ? "danger"
          : blockedCostClasses.length > 0
            ? "warning"
            : "success",
      status: routingVisibilityLabel
        ? (!canReadRouting ? "unsupported" : "partial")
        : blockedCostClasses.some((row) => row.status === "blocked")
          ? "blocked"
          : blockedCostClasses.length > 0
            ? "degraded"
            : "ready",
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Costs & Budget Controls"
        description="Costs is the budget and cost-safety surface for ForgeFrame: billing truth stays separated from estimated and modeled exposure, while budget posture, blocked classes, and circuit pressure remain operator-visible and real."
        question="Are we still inside the allowed cost posture, or are budget and routing controls already suppressing traffic?"
        links={[
          {
            label: "Usage",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Switch to historical provider, client, and model traffic analysis.",
          },
          {
            label: "Routing",
            to: CONTROL_PLANE_ROUTES.routing,
            description: "Open the full routing policy editor, simulation, and target reference.",
          },
          {
            label: "Errors",
            to: CONTROL_PLANE_ROUTES.errors,
            description: "Move into incident review when blocked cost posture has become a runtime failure.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: budgetState.label, tone: budgetState.tone === "danger" ? "danger" : budgetState.tone === "warning" ? "warning" : budgetState.tone === "success" ? "success" : "neutral" },
          { label: canMutateRouting ? "Budget & circuits editable" : canReadRouting ? "Routing read-only" : "Routing hidden", tone: canMutateRouting ? "success" : canReadRouting ? "warning" : "info" },
        ]}
        note="Estimated and modeled values are never shown as provider billing truth. Provider-reported cost stays explicitly unsupported until ForgeFrame ingests real billing exports."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="cost and budget posture"
        onInstanceChange={onInstanceChange}
      />

      <ActionBar
        title="Cost-safety operator actions"
        description={canMutateRouting
          ? "Budget posture and target circuit controls persist through the routing API from this page. Use the full routing surface when you need simulation or policy-stage editing."
          : canReadRouting
            ? "This session can review cost posture honestly, but budget and circuit edits stay read-only here until a routing.write session takes over."
            : "This session can review usage-backed cost truth, but routing budget and circuit sections stay hidden until routing.read is available."}
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={() => void load()} disabled={state === "loading" || (!canReadUsage && !canReadRouting)}>
              Refresh
            </button>
            <Link className="fg-nav-link" to={routingEditorRoute}>Routing policy</Link>
            <Link className="fg-nav-link" to={usageRoute}>Usage</Link>
            <Link className="fg-nav-link" to={errorsRoute}>Errors</Link>
          </div>
        )}
      >
        <p className="fg-muted">
          This route separates billing truth (`actual`, `provider_reported`) from operator estimates (`estimated`, `modeled`, `avoided`) and then shows which budget or circuit controls are actively suppressing traffic.
        </p>
      </ActionBar>

      {!sessionReady ? (
        <LoadingState title="Checking cost-safety access" description="ForgeFrame is confirming whether this session can read usage analytics, routing budget posture, or both." />
      ) : null}

      {sessionReady && !canReadUsage && !canReadRouting ? (
        <PermissionState
          title="Cost-safety surface unavailable"
          description="This session does not hold audit.read or routing.read on the active scope, so ForgeFrame will not pretend the budget or cost truth surfaces are open."
        />
      ) : null}

      {state === "loading" && !usage && !routing ? (
        <LoadingState
          title="Loading cost posture"
          description="ForgeFrame is restoring persisted usage cost truth, routing budget posture, blocked classes, and target circuit state."
        />
      ) : null}

      {state === "error" && !usage && !routing ? (
        <ErrorState
          title="Costs surface failed to load"
          description={error ?? "Cost posture could not be loaded."}
          action={<button type="button" onClick={() => void load()}>Retry</button>}
        />
      ) : null}

      {(usage || routing) ? (
        <>
          {state === "loading" ? <p className="fg-muted">Refreshing usage cost truth, budget posture, and circuit pressure.</p> : null}
          {messages.length > 0 ? (
            <article className="fg-card">
              <h3>Partial visibility</h3>
              <ul className="fg-list">
                {messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {actionError ? <p className="fg-danger">{actionError}</p> : null}

          <SummaryStrip items={summaryItems} />

          <div className="ff-operator-layout">
            <div className="ff-operator-main">
              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Cost truth ledger</h3>
                    <p className="fg-muted">Billing truth and operator estimates stay split so this page never implies that forecasted or modeled numbers are provider invoices.</p>
                  </div>
                </div>

                {!canReadUsage ? (
                  <PermissionState
                    title="Usage cost truth hidden"
                    description="This session cannot read persisted usage analytics, so actual, estimated, modeled, and avoided cost remain unavailable here."
                  />
                ) : !usage ? (
                  <ErrorState
                    title="Usage cost truth unavailable"
                    description="Usage analytics did not load for the active scope."
                    action={<button type="button" onClick={() => void load()}>Retry usage load</button>}
                  />
                ) : (
                  <>
                    <div className="fg-card-grid">
                      {truths.map((truth) => (
                        <article key={truth.key} className="fg-subcard">
                          <div className="fg-panel-heading">
                            <div>
                              <h4>{truth.label}</h4>
                              <p className="fg-muted">{truth.description}</p>
                            </div>
                            <StatusBadge tone={truthTone(truth)} status={truth.status === "tracked" ? "ready" : truth.status === "unsupported" ? "unsupported" : "degraded"}>
                              {truth.status}
                            </StatusBadge>
                          </div>
                          <ul className="fg-list">
                            <li>Billing truth: {truth.billing_truth ? "Yes" : "No"}</li>
                            <li>Runtime cost: {formatCurrency(truth.runtime_cost)}</li>
                            <li>Health-check cost: {formatCurrency(truth.health_check_cost)}</li>
                            <li>Total cost: {formatCurrency(truth.total_cost)}</li>
                          </ul>
                        </article>
                      ))}
                    </div>

                    <div className="fg-card-grid">
                      <article className="fg-subcard">
                        <h4>Provider cost hotspots</h4>
                        <ul className="fg-list">
                          {providerCosts.length === 0 ? <li>No provider cost evidence was recorded in the last 24 hours.</li> : null}
                          {providerCosts.slice(0, 5).map((item, index) => (
                            <li key={`${String(item.provider)}-${index}`}>
                              {String(item.provider)} · actual={formatCurrency(toNumber(item.actual_cost))} · estimated={formatCurrency(toNumber(item.hypothetical_cost))} · avoided={formatCurrency(toNumber(item.avoided_cost))}
                            </li>
                          ))}
                        </ul>
                      </article>

                      <article className="fg-subcard">
                        <h4>Client cost hotspots</h4>
                        <ul className="fg-list">
                          {clientCosts.length === 0 ? <li>No client cost evidence was recorded in the last 24 hours.</li> : null}
                          {clientCosts.slice(0, 5).map((item, index) => (
                            <li key={`${String(item.client_id)}-${index}`}>
                              {String(item.client_id)} · requests={formatMetric(item.requests)} · actual={formatCurrency(toNumber(item.actual_cost))} · estimated={formatCurrency(toNumber(item.hypothetical_cost))}
                            </li>
                          ))}
                        </ul>
                      </article>
                    </div>
                  </>
                )}
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Budget posture</h3>
                    <p className="fg-muted">Hard block stops all routing. Soft-limit scopes warn and can suppress selected cost classes before fallback or escalation chooses a target.</p>
                  </div>
                  <StatusBadge tone={budgetState.tone} status={budgetState.statusKey}>
                    {budgetState.label}
                  </StatusBadge>
                </div>

                {!canReadRouting ? (
                  <PermissionState
                    title="Routing budget posture hidden"
                    description="This session cannot read the routing control plane, so budget, blocked classes, and circuits stay unavailable here."
                  />
                ) : !routing ? (
                  <ErrorState
                    title="Routing budget posture unavailable"
                    description="Routing state did not load for the active scope."
                    action={<button type="button" onClick={() => void load()}>Retry routing load</button>}
                  />
                ) : (
                  <div className="fg-card-grid">
                    <article className="fg-subcard">
                      <h4>Current gate state</h4>
                        <ul className="fg-list">
                        <li>Hard blocked: {String(hardBlocked)}</li>
                        <li>Budget reason: {routing.budget.reason ?? "none recorded"}</li>
                        <li>Last evaluated: {formatTimestamp(routing.budget.last_evaluated_at)}</li>
                        <li>Soft warning scopes: {formatMetric(warningScopeCount)}</li>
                        <li>Hard-exceeded scopes: {formatMetric(hardExceededScopeCount)}</li>
                        <li>Budget anomalies: {formatMetric(routing.budget.anomalies.length)}</li>
                        <li>Blocked cost classes: {blockedCostClasses.length > 0 ? blockedCostClasses.map((row) => row.costClass).join(", ") : "none"}</li>
                      </ul>
                    </article>

                    <article className="fg-subcard">
                      <div className="fg-panel-heading">
                        <div>
                          <h4>Budget editor</h4>
                          <p className="fg-muted">This editor persists hard block, blocked classes, and scoped budget rules through the routing API. Server-calculated observed spend and anomaly fields remain read-only.</p>
                        </div>
                        <StatusBadge tone={canMutateRouting ? "success" : "warning"} status={canMutateRouting ? "ready" : "waiting_approval"}>
                          {canMutateRouting ? "editable" : "read-only"}
                        </StatusBadge>
                      </div>

                      <div className="fg-inline-form">
                        <label className="fg-checkbox">
                          <input
                            type="checkbox"
                            checked={budgetDraft.hard_blocked}
                            onChange={(event) => setBudgetDraft((current) => ({ ...current, hard_blocked: event.target.checked }))}
                            disabled={!canMutateRouting || budgetSaving}
                          />
                          Hard block all routing
                        </label>

                        <label>
                          Blocked cost classes
                          <input
                            aria-label="Blocked cost classes"
                            value={budgetDraft.blocked_cost_classes}
                            onChange={(event) => setBudgetDraft((current) => ({ ...current, blocked_cost_classes: event.target.value }))}
                            disabled={!canMutateRouting || budgetSaving}
                          />
                        </label>

                        <label>
                          Budget reason
                          <input
                            aria-label="Budget reason"
                            value={budgetDraft.reason}
                            onChange={(event) => setBudgetDraft((current) => ({ ...current, reason: event.target.value }))}
                            disabled={!canMutateRouting || budgetSaving}
                          />
                        </label>
                      </div>

                      <div className="fg-actions">
                        <button type="button" onClick={addBudgetScope} disabled={!canMutateRouting || budgetSaving}>
                          Add scope rule
                        </button>
                      </div>

                      <div className="fg-stack">
                        {budgetDraft.scopes.map((scope, index) => {
                          const status = scopeStatus(scope);
                          return (
                            <section key={`${scope.scope_type}:${scope.scope_key}:${scope.window}:${index}`} className="fg-subcard">
                              <div className="fg-panel-heading">
                                <div>
                                  <h5>{scope.scope_type}:{scope.scope_key || "new scope"}</h5>
                                  <p className="fg-muted">Window {scope.window}. Observed values and limit-exceeded flags are calculated by the backend and stay read-only.</p>
                                </div>
                                <StatusBadge tone={status.tone} status={status.statusKey}>
                                  {status.label}
                                </StatusBadge>
                              </div>

                              <div className="fg-inline-form">
                                <label>
                                  Scope type
                                  <select
                                    value={scope.scope_type}
                                    onChange={(event) => updateScopeDraft(index, { scope_type: event.target.value as BudgetScopeDraft["scope_type"] })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  >
                                    <option value="instance">instance</option>
                                    <option value="agent">agent</option>
                                    <option value="task">task</option>
                                  </select>
                                </label>

                                <label>
                                  Scope key
                                  <input
                                    value={scope.scope_key}
                                    onChange={(event) => updateScopeDraft(index, { scope_key: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Window
                                  <select
                                    value={scope.window}
                                    onChange={(event) => updateScopeDraft(index, { window: event.target.value as BudgetScopeDraft["window"] })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  >
                                    {BUDGET_WINDOW_OPTIONS.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </label>

                                <label className="fg-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={scope.enabled}
                                    onChange={(event) => updateScopeDraft(index, { enabled: event.target.checked })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                  Enabled
                                </label>

                                <label>
                                  Soft cost limit
                                  <input
                                    inputMode="decimal"
                                    value={scope.soft_cost_limit}
                                    onChange={(event) => updateScopeDraft(index, { soft_cost_limit: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Hard cost limit
                                  <input
                                    inputMode="decimal"
                                    value={scope.hard_cost_limit}
                                    onChange={(event) => updateScopeDraft(index, { hard_cost_limit: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Soft token limit
                                  <input
                                    inputMode="numeric"
                                    value={scope.soft_token_limit}
                                    onChange={(event) => updateScopeDraft(index, { soft_token_limit: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Hard token limit
                                  <input
                                    inputMode="numeric"
                                    value={scope.hard_token_limit}
                                    onChange={(event) => updateScopeDraft(index, { hard_token_limit: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Soft-blocked cost classes
                                  <input
                                    value={scope.soft_blocked_cost_classes}
                                    onChange={(event) => updateScopeDraft(index, { soft_blocked_cost_classes: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>

                                <label>
                                  Note
                                  <input
                                    value={scope.note}
                                    onChange={(event) => updateScopeDraft(index, { note: event.target.value })}
                                    disabled={!canMutateRouting || budgetSaving}
                                  />
                                </label>
                              </div>

                              <div className="fg-detail-grid">
                                <p>Observed cost: {scope.observed_cost === null ? "No evidence" : formatCurrency(scope.observed_cost)}</p>
                                <p>Observed tokens: {scope.observed_tokens === null ? "No evidence" : formatMetric(scope.observed_tokens)}</p>
                                <p>Previous-window cost: {scope.previous_window_cost === null ? "No evidence" : formatCurrency(scope.previous_window_cost)}</p>
                                <p>Previous-window tokens: {scope.previous_window_tokens === null ? "No evidence" : formatMetric(scope.previous_window_tokens)}</p>
                                <p>Soft limit exceeded: {String(scope.soft_limit_exceeded)}</p>
                                <p>Hard limit exceeded: {String(scope.hard_limit_exceeded)}</p>
                                <p>Last evaluated: {formatTimestamp(scope.last_evaluated_at)}</p>
                              </div>

                              <div className="fg-actions fg-actions-end">
                                <button type="button" onClick={() => removeBudgetScope(index)} disabled={!canMutateRouting || budgetSaving}>
                                  Remove scope
                                </button>
                              </div>
                            </section>
                          );
                        })}

                        {budgetDraft.scopes.length === 0 ? (
                          <p className="fg-muted">No scoped budget rules are configured yet. Add one if you need hard or soft cost limits per instance, agent, or task.</p>
                        ) : null}
                      </div>

                      <div className="fg-actions fg-actions-end">
                        <button type="button" onClick={() => void saveBudget()} disabled={!canMutateRouting || budgetSaving}>
                          {budgetSaving ? "Saving budget posture" : "Save budget posture"}
                        </button>
                      </div>
                    </article>

                    <article className="fg-subcard">
                      <h4>Budget anomalies</h4>
                      <ul className="fg-list">
                        {routing.budget.anomalies.length === 0 ? <li>No budget anomaly is currently recorded.</li> : null}
                        {routing.budget.anomalies.map((anomaly, index) => (
                          <li key={`${anomaly.scope_type}:${anomaly.scope_key}:${anomaly.window}:${anomaly.anomaly_type}:${index}`}>
                            {anomaly.severity} · {anomaly.anomaly_type} · {anomaly.scope_type}:{anomaly.scope_key} · observed={formatCurrency(anomaly.observed_cost ?? null)} · threshold={formatCurrency(anomaly.threshold_cost ?? null)} · detected={formatTimestamp(anomaly.detected_at)}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </div>
                )}
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Blocked cost classes</h3>
                    <p className="fg-muted">Cost-class suppression is listed concretely with source, reason, and a direct route into routing policy review.</p>
                  </div>
                </div>

                {!canReadRouting ? (
                  <PermissionState
                    title="Blocked-class review hidden"
                    description="Routing.read is required to inspect which cost classes are currently being suppressed."
                  />
                ) : blockedCostClasses.length === 0 ? (
                  <p className="fg-muted">No cost class is currently blocked or suppressed by the active budget posture.</p>
                ) : (
                  <div className="fg-table-wrap">
                    <table className="fg-table" aria-label="Blocked cost classes">
                      <thead>
                        <tr>
                          <th>Cost class</th>
                          <th>Effect</th>
                          <th>Reason</th>
                          <th>Affected targets</th>
                          <th>Last signal</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blockedCostClasses.map((row) => (
                          <tr key={row.costClass}>
                            <td>
                              <div className="fg-stack">
                                <strong>{row.costClass}</strong>
                                <StatusBadge tone={row.status === "blocked" ? "danger" : "warning"} status={row.status === "blocked" ? "blocked" : "degraded"}>
                                  {row.status === "blocked" ? "blocking" : "warning"}
                                </StatusBadge>
                              </div>
                            </td>
                            <td>{row.effect}</td>
                            <td>{row.reasons.join(" ")}</td>
                            <td>{formatMetric(row.affectedTargets)}</td>
                            <td>{formatTimestamp(row.lastSignalAt)}</td>
                            <td>
                              <Link className="fg-nav-link" to={routingEditorRoute}>
                                Routing policy
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Circuit & guard map</h3>
                    <p className="fg-muted">Provider rows aggregate persisted target circuits. The target-level controls below are the real write path for circuit state on this instance.</p>
                  </div>
                </div>

                {!canReadRouting ? (
                  <PermissionState
                    title="Circuit map hidden"
                    description="Routing.read is required to inspect provider circuit pressure and target circuit state."
                  />
                ) : (
                  <>
                    <div className="fg-card-grid">
                      <article className="fg-subcard">
                        <h4>Instance guard</h4>
                        <ul className="fg-list">
                          <li>Traffic gate: {budgetState.label}</li>
                          <li>Hard block reason: {routing?.budget.reason ?? "none recorded"}</li>
                          <li>Open target circuits: {formatMetric(openCircuitCount)}</li>
                          <li>Provider groups with open circuits: {formatMetric(providerCircuits.filter((row) => row.openCircuitCount > 0).length)}</li>
                          <li>Routing cost-class suppressions: {formatMetric(blockedCostClasses.length)}</li>
                        </ul>
                      </article>

                      <article className="fg-subcard">
                        <h4>Provider circuit posture</h4>
                        <div className="fg-table-wrap">
                          <table className="fg-table" aria-label="Provider circuit posture">
                            <thead>
                              <tr>
                                <th>Provider</th>
                                <th>Status</th>
                                <th>Targets</th>
                                <th>Open circuits</th>
                                <th>Cost classes</th>
                                <th>Last trip</th>
                              </tr>
                            </thead>
                            <tbody>
                              {providerCircuits.length === 0 ? (
                                <tr>
                                  <td colSpan={6}>No provider targets are registered for this instance.</td>
                                </tr>
                              ) : providerCircuits.map((row) => (
                                <tr key={row.provider}>
                                  <td>{row.provider}</td>
                                  <td>
                                    <StatusBadge tone={row.status === "blocked" ? "danger" : row.status === "degraded" ? "warning" : "success"} status={row.status === "blocked" ? "blocked" : row.status === "degraded" ? "degraded" : "ready"}>
                                      {row.status}
                                    </StatusBadge>
                                  </td>
                                  <td>{formatMetric(row.targetCount)}</td>
                                  <td>{formatMetric(row.openCircuitCount)}</td>
                                  <td>{row.costClasses.join(", ") || "unknown"}</td>
                                  <td>{formatTimestamp(row.lastTripAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    </div>

                    <article className="fg-subcard">
                      <div className="fg-panel-heading">
                        <div>
                          <h4>Per-target circuit controls</h4>
                          <p className="fg-muted">Open circuit excludes the target immediately. Close circuit restores it to normal routing competition.</p>
                        </div>
                        <StatusBadge tone={canMutateRouting ? "success" : "warning"} status={canMutateRouting ? "ready" : "waiting_approval"}>
                          {canMutateRouting ? "editable" : "read-only"}
                        </StatusBadge>
                      </div>

                      <div className="fg-table-wrap">
                        <table className="fg-table" aria-label="Per-target circuit controls">
                          <thead>
                            <tr>
                              <th>Target</th>
                              <th>Provider</th>
                              <th>Cost class</th>
                              <th>Status</th>
                              <th>Last trip</th>
                              <th>Reason</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {targetCircuits.length === 0 ? (
                              <tr>
                                <td colSpan={7}>No persisted target circuits exist for the active instance.</td>
                              </tr>
                            ) : targetCircuits.map((row) => (
                              <tr key={row.targetKey}>
                                <td>
                                  <div className="fg-stack">
                                    <strong>{row.label}</strong>
                                    <span className="fg-muted">{row.targetKey}</span>
                                  </div>
                                </td>
                                <td>{row.provider}</td>
                                <td>{row.costClass}</td>
                                <td>
                                  <StatusBadge tone={row.state === "open" ? "danger" : "success"} status={row.state === "open" ? "blocked" : "ready"}>
                                    {row.state === "open" ? "open" : "closed"}
                                  </StatusBadge>
                                </td>
                                <td>{formatTimestamp(row.updatedAt)}</td>
                                <td>
                                  <input
                                    aria-label={`Circuit reason ${row.targetKey}`}
                                    value={circuitDrafts[row.targetKey] ?? row.reason ?? ""}
                                    onChange={(event) => setCircuitDrafts((current) => ({ ...current, [row.targetKey]: event.target.value }))}
                                    disabled={!canMutateRouting || savingCircuitKey === row.targetKey}
                                  />
                                </td>
                                <td>
                                  <div className="fg-actions">
                                    <button type="button" onClick={() => void saveCircuit(row.targetKey, "open")} disabled={!canMutateRouting || savingCircuitKey === row.targetKey}>
                                      Open
                                    </button>
                                    <button type="button" onClick={() => void saveCircuit(row.targetKey, "closed")} disabled={!canMutateRouting || savingCircuitKey === row.targetKey}>
                                      Close
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  </>
                )}
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Routing cost mix</h3>
                    <p className="fg-muted">Recent selected targets explain whether routing is leaning on premium paths or staying inside low-cost lanes.</p>
                  </div>
                </div>

                {!canReadRouting ? (
                  <PermissionState
                    title="Routing mix hidden"
                    description="Routing.read is required to explain premium-versus-low-cost selection from the recent decision ledger."
                  />
                ) : costMixRows.length === 0 ? (
                  <p className="fg-muted">No recent selected routing decisions are available yet.</p>
                ) : (
                  <>
                    <div className="fg-card-grid">
                      <article className="fg-subcard">
                        <h4>Premium vs low-cost usage</h4>
                        <ul className="fg-list">
                          <li>Selected decisions reviewed: {formatMetric(selectedDecisionCount)}</li>
                          <li>Premium share: {premiumMix ? formatPercent(premiumMix.share) : "0.0%"}</li>
                          <li>Low-cost share: {selectedDecisionCount === 0 ? "0.0%" : formatPercent(lowCostSelections / selectedDecisionCount)}</li>
                          <li>Premium fallback/escalation selections: {formatMetric(premiumEscalationCount)}</li>
                          <li>Open provider circuits during this review: {formatMetric(openCircuitCount)}</li>
                        </ul>
                      </article>

                      <article className="fg-subcard">
                        <h4>Pricing snapshot</h4>
                        <ul className="fg-list">
                          {usage ? Object.entries(usage.pricing_snapshot).map(([key, value]) => (
                            <li key={key}>{key}: {formatMetric(value, 2)}</li>
                          )) : <li>Pricing snapshot unavailable without usage analytics.</li>}
                        </ul>
                      </article>
                    </div>

                    <div className="fg-table-wrap">
                      <table className="fg-table" aria-label="Routing cost mix">
                        <thead>
                          <tr>
                            <th>Cost class</th>
                            <th>Selected</th>
                            <th>Share</th>
                            <th>Providers</th>
                            <th>Policy stages</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costMixRows.map((row) => (
                            <tr key={row.costClass}>
                              <td>{row.costClass}</td>
                              <td>{formatMetric(row.selectedCount)}</td>
                              <td>{formatPercent(row.share)}</td>
                              <td>{row.providers.join(", ")}</td>
                              <td>{row.stages.join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </article>
            </div>

            <DetailPanel
              title="Current cost safety"
              description="This sidebar compresses the active blockers, warning sources, and handoff routes for the current scope."
              status={budgetState.label}
              statusTone={budgetState.tone}
              statusKey={budgetState.statusKey}
              sticky
              actions={(
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={routingEditorRoute}>Routing</Link>
                  <Link className="fg-nav-link" to={routingTargetsRoute}>Targets</Link>
                </div>
              )}
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Blocking vs warning</h4>
                  <p>{budgetState.detail}</p>
                  <p className="fg-muted">
                    Hard block stops all routing. Warning posture keeps traffic open but may suppress premium or high-cost classes and may leave some target circuits open.
                  </p>
                </section>

                <section className="fg-subcard">
                  <h4>Visible blockers</h4>
                  <ul className="fg-list">
                    <li>Hard block active: {routingVisibilityLabel ?? String(hardBlocked)}</li>
                    <li>Blocked cost classes: {routingVisibilityLabel ?? (blockedCostClasses.length > 0 ? blockedCostClasses.map((row) => row.costClass).join(", ") : "none")}</li>
                    <li>Soft warning scopes: {routingVisibilityLabel ?? formatMetric(warningScopeCount)}</li>
                    <li>Open target circuits: {routingVisibilityLabel ?? formatMetric(openCircuitCount)}</li>
                    <li>Budget anomalies: {routingVisibilityLabel ?? formatMetric(routing?.budget.anomalies.length ?? 0)}</li>
                  </ul>
                  {routingVisibilityLabel ? <p className="fg-muted">{routingVisibilityDetail}</p> : null}
                </section>

                <section className="fg-subcard">
                  <h4>Billing truth guardrail</h4>
                  <p>Provider-reported billing is currently unsupported.</p>
                  <p className="fg-muted">
                    Estimated and modeled values stay operational only. Use actual cost for metered billing truth and treat the other axes as forecast, exposure, or avoided-spend evidence.
                  </p>
                </section>

                <section className="fg-subcard">
                  <h4>Write path</h4>
                  <p>{canMutateRouting ? "Budget and circuit controls are writable on this page." : canReadRouting ? "This session is read-only for routing.write." : "Routing write-path is hidden with the routing control plane."}</p>
                  <p className="fg-muted">
                    {canMutateRouting
                      ? "Use the editor and target controls here for direct persistence, then switch to Routing only when you need simulation or policy-stage edits."
                      : canReadRouting
                        ? "Open the same scope with a routing.write session if budget or circuit posture must be changed."
                        : "Open the same scope with routing.read plus routing.write if budget or circuit posture must be reviewed and changed."}
                  </p>
                </section>
              </div>
            </DetailPanel>
          </div>
        </>
      ) : null}
    </section>
  );
}
