/**
 * Costs & Budget Controls page.
 *
 * Separates billing truth from estimated and modeled cost, then exposes
 * budget posture, blocked classes, target circuits, and cost mix.
 *
 * @packageDocumentation
 */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchRoutingControlPlane,
  updateRoutingBudget,
  updateRoutingCircuit,
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
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button } from "../components/ui/Button";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { RawJson } from "../components/ui/AdvancedDiagnostics";

import {
  CostTruthTable,
  CostBudgetView,
  CostMixView,
  CostDetailPanel,
} from "../features/costs";
import type { BudgetDraft, BudgetScopeDraft, LoadState } from "../features/costs";
import {
  buildCostTruths,
  buildBlockedCostClassRows,
  buildProviderCircuitRows,
  buildTargetCircuitRows,
  buildCostMixRows,
  remainingBudgetMeta,
  gateStatus,
  budgetScopeDraft,
  defaultBudgetScope,
  buildBudgetScopePayload,
  formatCurrency,
  formatMetric,
  truthTone,
  effectiveHardBlocked,
  parseCsv,
  toNumber,
} from "../features/costs";

/**
 * Costs & Budget Controls page — container for cost truth,
 * budget posture, blocked classes, circuit map, and cost mix.
 */
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
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>({
    hard_blocked: false,
    blocked_cost_classes: "",
    reason: "",
    scopes: [],
  });
  const [circuitDrafts, setCircuitDrafts] = useState<Record<string, string>>({});

  const canReadUsage =
    sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "audit.read");
  const canReadRouting =
    sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "routing.read");
  const canMutateRouting =
    sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "routing.write");

  // ── Data loading ─────────────────────────────────────────────────

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
        nextMessages.push(
          usageResult.reason instanceof Error
            ? usageResult.reason.message
            : "Usage analytics failed to load.",
        );
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
            Object.fromEntries(
              routingPayload.circuits.map((circuit) => [circuit.target_key, circuit.reason ?? ""]),
            ),
          );
        } else {
          setRouting(null);
          nextMessages.push("Routing budget posture returned an empty payload.");
        }
      } else {
        setRouting(null);
        nextMessages.push(
          routingResult.reason instanceof Error
            ? routingResult.reason.message
            : "Routing budget posture failed to load.",
        );
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
    if (!sessionReady) return;
    void load();
  }, [sessionReady, canReadUsage, canReadRouting, instanceId]);

  // ── Instance switching ───────────────────────────────────────────

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  // ── Budget draft mutations ────────────────────────────────────────

  const updateScopeDraft = (index: number, patch: Partial<BudgetScopeDraft>) => {
    setBudgetDraft((current) => ({
      ...current,
      scopes: current.scopes.map((scope, scopeIndex) =>
        scopeIndex === index ? { ...scope, ...patch } : scope,
      ),
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

  const loadForRetry = () => void load();

  // ── Derived data ──────────────────────────────────────────────────

  const truths = buildCostTruths(usage);
  const truthByKey = Object.fromEntries(truths.map((truth) => [truth.key, truth])) as Partial<
    Record<string, (typeof truths)[number]>
  >;
  const blockedCostClasses = buildBlockedCostClassRows(routing);
  const providerCircuits = buildProviderCircuitRows(routing);
  const targetCircuits = buildTargetCircuitRows(routing);
  const costMixRows = buildCostMixRows(routing);
  const openCircuitCount = targetCircuits.filter((row) => row.state === "open").length;
  const hardBlocked = effectiveHardBlocked(routing);
  const budgetState = gateStatus(routing, blockedCostClasses, openCircuitCount);
  const routingVisibilityLabel = !canReadRouting
    ? "Hidden"
    : routing
      ? null
      : "Unavailable";
  const routingVisibilityDetail = !canReadRouting
    ? "routing.read is required before this page can claim any budget, blocked-class, or circuit truth."
    : "Routing truth did not load, so budget, blocked-class, and circuit posture remain unavailable.";
  const remainingHardBudget = routing ? remainingBudgetMeta(routing.budget.scopes) : null;
  const warningScopeCount =
    routing?.budget.scopes.filter((scope) => scope.enabled && scope.soft_limit_exceeded).length ??
    0;
  const hardExceededScopeCount =
    routing?.budget.scopes.filter((scope) => scope.enabled && scope.hard_limit_exceeded).length ??
    0;
  const selectedDecisionCount = costMixRows.reduce((total, row) => total + row.selectedCount, 0);
  const premiumEscalationCount = (
    routing?.recent_decisions ?? []
  ).filter((decision) => {
    const selected = decision.candidates.find((candidate) => candidate.selected);
    return (
      selected?.cost_class === "premium" &&
      (decision.policy_stage === "fallback" || decision.policy_stage === "escalation")
    );
  }).length;
  const providerCosts = (usage?.aggregations.by_provider ?? []).map((item) => ({
    id: String(item.provider),
    actualCost: toNumber(item.actual_cost),
    estimatedCost: toNumber(item.hypothetical_cost),
    avoidedCost: toNumber(item.avoided_cost),
  }));
  const clientCosts = (usage?.aggregations.by_client ?? []).map((item) => ({
    id: String(item.client_id),
    actualCost: toNumber(item.actual_cost),
    estimatedCost: toNumber(item.hypothetical_cost),
    avoidedCost: 0,
    requests: toNumber(item.requests),
  }));
  const pricingSnapshot = usage?.pricing_snapshot ?? {};
  const routingEditorRoute = withInstanceScope(
    `${CONTROL_PLANE_ROUTES.routing}#routing-policy-editor`,
    instanceId,
  );
  const routingTargetsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId);
  const usageRoute = withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId);
  const errorsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId);

  const anomalyData = (routing?.budget.anomalies ?? []).map((a) => ({
    severity: a.severity,
    anomalyType: a.anomaly_type,
    scopeType: a.scope_type,
    scopeKey: a.scope_key,
    observedCost: a.observed_cost ?? null,
    thresholdCost: a.threshold_cost ?? null,
    detectedAt: a.detected_at ?? null,
  }));

  // ── Summary items ────────────────────────────────────────────────

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
      meta: truthByKey.actual?.billing_truth
        ? "Billing truth when ForgeFrame meters the provider path."
        : "Not available.",
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
      value:
        routingVisibilityLabel ??
        (remainingHardBudget ? formatCurrency(remainingHardBudget.remaining) : "No hard limit"),
      meta: routingVisibilityLabel
        ? routingVisibilityDetail
        : remainingHardBudget
          ? `${remainingHardBudget.label} of ${formatCurrency(remainingHardBudget.limit)}`
          : "No enabled hard-cost scope is configured.",
      tone: routingVisibilityLabel
        ? "neutral"
        : remainingHardBudget
          ? remainingHardBudget.remaining < 0
            ? "danger"
            : remainingHardBudget.remaining < remainingHardBudget.limit * 0.2
              ? "warning"
              : "success"
          : "neutral",
      status: routingVisibilityLabel
        ? !canReadRouting
          ? "unsupported"
          : "partial"
        : remainingHardBudget
          ? remainingHardBudget.remaining < 0
            ? "blocked"
            : remainingHardBudget.remaining < remainingHardBudget.limit * 0.2
              ? "degraded"
              : "ready"
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
      tone: routingVisibilityLabel
        ? "neutral"
        : openCircuitCount === 0
          ? "success"
          : "warning",
      status: routingVisibilityLabel
        ? !canReadRouting
          ? "unsupported"
          : "partial"
        : openCircuitCount === 0
          ? "ready"
          : "degraded",
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
        ? !canReadRouting
          ? "unsupported"
          : "partial"
        : blockedCostClasses.some((row) => row.status === "blocked")
          ? "blocked"
          : blockedCostClasses.length > 0
            ? "degraded"
            : "ready",
    },
  ];

  // ── Attention items ──────────────────────────────────────────────

  const attentionItems: AttentionPayload[] = [];

  if (hardBlocked) {
    attentionItems.push({
      key: "hard-blocked",
      level: "primary_blocker",
      title: "Hard budget block active",
      description: routing?.budget.reason ?? "Budget guardrails are hard-blocking all routing.",
    });
  }

  if (blockedCostClasses.length > 0) {
    attentionItems.push({
      key: "blocked-classes-attention",
      level: "warning",
      title: `${blockedCostClasses.length} blocked cost class(es)`,
      description: blockedCostClasses.map((row) => row.costClass).join(", "),
    });
  }

  if (openCircuitCount > 0) {
    attentionItems.push({
      key: "open-circuits-attention",
      level: "warning",
      title: `${openCircuitCount} open target circuit(s)`,
    });
  }

  if (warningScopeCount > 0) {
    attentionItems.push({
      key: "soft-warning-scopes",
      level: "needs_action",
      title: `${warningScopeCount} soft-warning scope(s)`,
      description: `${warningScopeCount} budget scope(s) exceeded their soft limit.`,
    });
  }

  if (anomalyData.length > 0) {
    attentionItems.push({
      key: "budget-anomalies",
      level: "warning",
      title: `${anomalyData.length} budget anomaly(ies)`,
    });
  }

  // ── Diagnostics: raw budget config JSON ──────────────────────────

  const diagnosticsContent = routing ? (
    <div className="space-y-4">
      <RawJson data={routing.budget as Record<string, unknown>} />
    </div>
  ) : null;

  const hasContent = !!(usage || routing);

  const preloadState = !sessionReady ? "loading"
    : (sessionReady && !canReadUsage && !canReadRouting) ? "blocked"
    : (state === "loading" && !usage && !routing) ? "loading"
    : (state === "error" && !usage && !routing) ? "error"
    : null;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <RegistryManagementPage
      eyebrow="Operations"
      title="Costs & Budget Controls"
      description="Costs is the budget and cost-safety surface for ForgeFrame: billing truth stays separated from estimated and modeled exposure, while budget posture, blocked classes, and circuit pressure remain operator-visible and real."
      scope={
        selectedInstance
          ? {
              label: selectedInstance.display_name,
            }
          : undefined
      }
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={[
        { label: "Refresh", kind: "secondary", intent: "diagnose", onClick: loadForRetry, disabled: state === "loading" || (!canReadUsage && !canReadRouting) },
      ]}
      actionBarTitle="Cost-safety operator actions"
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Budget configuration diagnostics"
    >
      {/* Pre-loading states rendered inline */}
      {preloadState === "loading" ? (
        <div className="ff-state-block" data-state="loading">
          <div className="ff-skeleton-row" />
          <strong>Checking cost-safety access</strong>
          <p>ForgeFrame is confirming whether this session can read usage analytics, routing budget posture, or both.</p>
        </div>
      ) : null}

      {preloadState === "blocked" ? (
        <div className="ff-state-block" data-state="info">
          <strong>Cost-safety surface unavailable</strong>
          <p>This session does not hold audit.read or routing.read on the active scope, so ForgeFrame will not pretend the budget or cost truth surfaces are open.</p>
        </div>
      ) : null}

      {preloadState === "error" ? (
        <div className="ff-state-block" data-state="error">
          <strong>Costs surface failed to load</strong>
          <p className="text-meta text-muted mt-1.5 max-w-md">{error ?? "Cost posture could not be loaded."}</p>
          <div className="mt-4">
            <Button variant="secondary" onPress={loadForRetry}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!preloadState && state === "loading" ? (
        <p className="fg-muted">Refreshing usage cost truth, budget posture, and circuit pressure.</p>
      ) : null}

      {!preloadState ? (
        <>
          {/* Partial visibility messages */}
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

          {/* Action errors */}
          {actionError ? <p className="fg-danger">{actionError}</p> : null}

          {hasContent ? (
            <>
              {/* Cost truth ledger */}
              <section className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Cost truth ledger</h3>
                    <p className="fg-muted">
                      Billing truth and operator estimates stay split so this page never implies that
                      forecasted or modeled numbers are provider invoices.
                    </p>
                  </div>
                </div>
                <CostTruthTable
                  canReadUsage={canReadUsage}
                  hasUsage={!!usage}
                  truths={truths}
                  providerCosts={providerCosts}
                  clientCosts={clientCosts}
                  onRetry={loadForRetry}
                />
              </section>

              {/* Budget posture + blocked classes + circuits */}
              <section className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Budget posture</h3>
                    <p className="fg-muted">
                      Hard block stops all routing. Soft-limit scopes warn and can suppress selected
                      cost classes before fallback or escalation chooses a target.
                    </p>
                  </div>
                </div>
                <CostBudgetView
                  canReadRouting={canReadRouting}
                  canMutateRouting={canMutateRouting}
                  hasRouting={!!routing}
                  budgetState={budgetState}
                  hardBlocked={hardBlocked}
                  budgetReason={routing?.budget.reason ?? null}
                  lastEvaluatedAt={routing?.budget.last_evaluated_at ?? null}
                  warningScopeCount={warningScopeCount}
                  hardExceededScopeCount={hardExceededScopeCount}
                  anomalyCount={routing?.budget.anomalies.length ?? 0}
                  anomalies={anomalyData}
                  blockedCostClasses={blockedCostClasses}
                  providerCircuits={providerCircuits}
                  targetCircuits={targetCircuits}
                  openCircuitCount={openCircuitCount}
                  budgetDraft={budgetDraft}
                  budgetSaving={budgetSaving}
                  savingCircuitKey={savingCircuitKey}
                  circuitDrafts={circuitDrafts}
                  routingEditorRoute={routingEditorRoute}
                  onUpdateScopeDraft={updateScopeDraft}
                  onAddBudgetScope={addBudgetScope}
                  onRemoveBudgetScope={removeBudgetScope}
                  onSetHardBlocked={(value) => setBudgetDraft((c) => ({ ...c, hard_blocked: value }))}
                  onSetBlockedCostClasses={(value) => setBudgetDraft((c) => ({ ...c, blocked_cost_classes: value }))}
                  onSetBudgetReason={(value) => setBudgetDraft((c) => ({ ...c, reason: value }))}
                  onSaveBudget={saveBudget}
                  onSaveCircuit={saveCircuit}
                  onSetCircuitDraft={(targetKey, value) =>
                    setCircuitDrafts((current) => ({ ...current, [targetKey]: value }))
                  }
                  onRetry={loadForRetry}
                />
              </section>

              {/* Routing cost mix */}
              <section className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Routing cost mix</h3>
                    <p className="fg-muted">
                      Recent selected targets explain whether routing is leaning on premium paths or
                      staying inside low-cost lanes.
                    </p>
                  </div>
                </div>
                <CostMixView
                  canReadRouting={canReadRouting}
                  hasRouting={!!routing}
                  costMixRows={costMixRows}
                  selectedDecisionCount={selectedDecisionCount}
                  premiumEscalationCount={premiumEscalationCount}
                  openCircuitCount={openCircuitCount}
                  pricingSnapshot={pricingSnapshot}
                />
              </section>

              {/* Current cost safety context (formerly the sidebar) */}
              <section className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Current cost safety</h3>
                    <p className="fg-muted">
                      This section compresses the active blockers, warning sources, and handoff routes
                      for the current scope.
                    </p>
                  </div>
                </div>
                <CostDetailPanel
                  budgetState={budgetState}
                  hardBlocked={hardBlocked}
                  routingVisibilityLabel={routingVisibilityLabel}
                  routingVisibilityDetail={routingVisibilityDetail}
                  blockedCostClassNames={
                    blockedCostClasses.length > 0
                      ? blockedCostClasses.map((row) => row.costClass).join(", ")
                      : ""
                  }
                  warningScopeCount={warningScopeCount}
                  openCircuitCount={openCircuitCount}
                  anomalyCount={routing?.budget.anomalies.length ?? 0}
                  canMutateRouting={canMutateRouting}
                  canReadRouting={canReadRouting}
                  remainingBudgetLabel={remainingHardBudget?.label ?? null}
                  remainingBudgetValue={remainingHardBudget?.remaining ?? null}
                  routingEditorRoute={routingEditorRoute}
                  routingTargetsRoute={routingTargetsRoute}
                />
              </section>

              {/* Page-level navigation links */}
              <div className="fg-actions" style={{ marginTop: "1rem" }}>
                <Link className="fg-nav-link" to={routingEditorRoute}>
                  Routing policy
                </Link>
                <Link className="fg-nav-link" to={usageRoute}>
                  Usage
                </Link>
                <Link className="fg-nav-link" to={errorsRoute}>
                  Errors
                </Link>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </RegistryManagementPage>
  );
}
