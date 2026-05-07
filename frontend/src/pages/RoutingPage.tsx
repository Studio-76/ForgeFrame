import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import {
  fetchRoutingControlPlane,
  simulateRouting,
  updateRoutingBudget,
  updateRoutingCircuit,
  updateRoutingPolicy,
  type RoutingControlPlaneResponse,
  type RoutingPolicyRecord,
  type RoutingCircuitRecord,
} from "../api/domain/routing";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button } from "../components/ui/Button";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";

import {
  RoutingStatusHero,
  RoutingSummaryGrid,
  RoutingActionBar,
  RoutingCollapseSection,
  RoutingPolicyEditor,
  RoutingBudgetCircuits,
  RoutingSimulationPanel,
  RoutingDecisionsList,
  RoutingTargetReference,
  toneForStatus,
  liveStatus,
  toPolicyDraft,
  formatJson,
  writableBudgetScopes,
  parseBudgetScopesJson,
  parseTargetKeyList,
  defaultSimulationForm,
  applySimulationScenario,
  buildSimulationMessages,
  buildSimulationRouteContext,
  simulationSummary,
} from "../features/routing";

import type {
  LoadState,
  PolicyDraft,
  SimulationFormState,
  SimulationResultState,
  SimulationScenario,
  BudgetDraftState,
  SectionKey,
} from "../features/routing";

/**
 * ForgeFrame Smart Execution Routing page.
 * Policy, budget, and circuit guardrails with explainable decision history.
 *
 * Conforms to the Registry Management pattern. Wraps routing feature modules
 * in RegistryManagementPage with scope indicator, summary strip, attention
 * handling, and collapsed diagnostics.
 */
export function RoutingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [snapshot, setSnapshot] = useState<RoutingControlPlaneResponse | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraftState>({
    hard_blocked: false,
    blocked_cost_classes: "",
    reason: "",
    scopes_json: "[]",
  });
  const [circuitDrafts, setCircuitDrafts] = useState<Record<string, string>>({});
  const [simulationForm, setSimulationForm] = useState<SimulationFormState>(() => defaultSimulationForm(instanceId));
  const [simulationPending, setSimulationPending] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResultState | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<Partial<Record<SimulationScenario, SimulationResultState>>>({});
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    policy: false,
    budget: false,
    simulation: false,
    decisions: false,
  });

  const canReadRouting =
    sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "routing.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "routing.write");

  const load = async () => {
    setState("loading");
    setLoadError("");
    try {
      const payload = await fetchRoutingControlPlane(instanceId);
      setSnapshot(payload);
      setPolicyDrafts(
        Object.fromEntries(payload.policies.map((policy) => [policy.classification, toPolicyDraft(policy)])),
      );
      setBudgetDraft({
        hard_blocked: payload.budget.hard_blocked,
        blocked_cost_classes: payload.budget.blocked_cost_classes.join(", "),
        reason: payload.budget.reason ?? "",
        scopes_json: formatJson(writableBudgetScopes(payload.budget.scopes ?? [])),
      });
      setCircuitDrafts(
        Object.fromEntries(payload.circuits.map((circuit) => [circuit.target_key, circuit.reason ?? ""])),
      );
      setState("success");
    } catch (nextError) {
      setSnapshot(null);
      setState("error");
      setLoadError(nextError instanceof Error ? nextError.message : "Routing control plane could not be loaded.");
    }
  };

  useEffect(() => {
    if (!canReadRouting) {
      setSnapshot(null);
      setState("idle");
      setLoadError("");
      return;
    }
    void load();
  }, [canReadRouting, instanceId]);

  useEffect(() => {
    setSimulationForm((current) =>
      current.budgetScopeType === "instance"
        ? { ...current, budgetScopeKey: instanceId ?? "" }
        : current,
    );
  }, [instanceId]);

  const targets = snapshot?.targets ?? [];
  const policies = snapshot?.policies ?? [];
  const circuits = snapshot?.circuits ?? [];
  const recentDecisions = snapshot?.recent_decisions ?? [];
  const budget = snapshot?.budget;
  const statusKey = liveStatus(snapshot);
  const simSummaryStr = simulationSummary(simulationResult ?? undefined);

  const providerOptions = useMemo(
    () => Array.from(new Set(targets.map((target) => target.provider))).sort(),
    [targets],
  );

  const setSection = (key: SectionKey, open: boolean) => {
    setSections((prev) => ({ ...prev, [key]: open }));
  };

  const openSection = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: true }));
  };

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const savePolicy = async (classification: RoutingPolicyRecord["classification"]) => {
    if (!canMutate) {
      setActionError("This session cannot mutate routing policy.");
      return;
    }
    const draft = policyDrafts[classification];
    if (!draft) {
      return;
    }
    setActionError("");
    try {
      await updateRoutingPolicy(
        classification,
        {
          execution_lane: draft.execution_lane,
          prefer_local: draft.prefer_local,
          prefer_low_latency: draft.prefer_low_latency,
          allow_premium: draft.allow_premium,
          allow_fallback: draft.allow_fallback,
          allow_escalation: draft.allow_escalation,
          require_queue_eligible: draft.require_queue_eligible,
          preferred_target_keys: parseTargetKeyList(draft.preferred_target_keys),
          fallback_target_keys: parseTargetKeyList(draft.fallback_target_keys),
          escalation_target_keys: parseTargetKeyList(draft.escalation_target_keys),
        },
        instanceId,
      );
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Routing policy update failed.");
    }
  };

  const saveBudget = async () => {
    if (!canMutate) {
      setActionError("This session cannot mutate routing budget state.");
      return;
    }
    setActionError("");
    try {
      const scopes = writableBudgetScopes(parseBudgetScopesJson(budgetDraft.scopes_json));
      await updateRoutingBudget(
        {
          hard_blocked: budgetDraft.hard_blocked,
          blocked_cost_classes: parseTargetKeyList(budgetDraft.blocked_cost_classes),
          reason: budgetDraft.reason.trim() || null,
          scopes,
        },
        instanceId,
      );
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Routing budget update failed.");
    }
  };

  const saveCircuit = async (targetKey: string, stateValue: RoutingCircuitRecord["state"]) => {
    if (!canMutate) {
      setActionError("This session cannot mutate routing circuits.");
      return;
    }
    setActionError("");
    try {
      await updateRoutingCircuit(
        targetKey,
        {
          state: stateValue,
          reason: circuitDrafts[targetKey]?.trim() || null,
        },
        instanceId,
      );
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Routing circuit update failed.");
    }
  };

  const runSimulation = async (formOverride?: SimulationFormState) => {
    const nextForm = formOverride ?? simulationForm;
    if (nextForm.requestPathPolicy === "pinned_target" && !nextForm.pinnedTargetKey.trim()) {
      setActionError("Pinned-target path requires a concrete target key.");
      return;
    }
    setActionError("");
    setSimulationPending(true);
    setSimulationResult(null);
    try {
      const payload = await simulateRouting(
        {
          requested_model: nextForm.requestedModel.trim() || null,
          prompt: nextForm.prompt.trim() || null,
          messages: buildSimulationMessages(nextForm),
          stream: nextForm.requireStreaming,
          require_vision: nextForm.requireVision,
          tools: nextForm.requireToolCalling
            ? [{ type: "function", function: { name: "lookup_health", description: "Inspect current provider health." } }]
            : undefined,
          max_output_tokens: Number(nextForm.maxOutputTokens) > 0 ? Number(nextForm.maxOutputTokens) : null,
          allowed_providers: nextForm.requestedProvider !== "all" ? [nextForm.requestedProvider] : undefined,
          route_context: buildSimulationRouteContext(nextForm, instanceId),
        },
        instanceId,
      );
      const nextResult: SimulationResultState = {
        ...payload,
        form: nextForm,
      };
      setSimulationResult(nextResult);
      setSimulationHistory((current) => ({
        ...current,
        [nextForm.scenario]: nextResult,
      }));
      await load();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Routing simulation failed.");
    } finally {
      setSimulationPending(false);
    }
  };

  const runScenarioSimulation = async (scenario: SimulationScenario) => {
    const nextForm = applySimulationScenario(simulationForm, scenario, instanceId);
    setSimulationForm(nextForm);
    await runSimulation(nextForm);
  };

  // ── Scope config ───────────────────────────────────────
  const scopeConfig = selectedInstance
    ? {
        label: selectedInstance.display_name,
        onChange: instanceId
          ? () => onInstanceChange(null)
          : undefined,
      }
    : undefined;

  // ── Attention items ────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];

  if (!canReadRouting) {
    attentionItems.push({
      key: "access-blocked",
      level: "primary_blocker",
      title: "Routing review unavailable",
      description: "This session does not hold routing.read on the active instance scope.",
    });
  } else if (state === "error") {
    attentionItems.push({
      key: "load-error",
      level: "primary_blocker",
      title: "Routing control plane failed to load",
      description: loadError || "Routing state could not be loaded.",
    });
  } else if (state === "loading" && !snapshot) {
    attentionItems.push({
      key: "loading",
      level: "informational",
      title: "Loading routing control plane \u2014 restoring policy truth, budget posture, circuit state, target inventory, and recent decision explainability.",
    });
  }

  // ── Summary items ──────────────────────────────────────
  const summaryItems: SummaryStripItem[] | undefined = snapshot
    ? [
        {
          key: "policies",
          label: "Policies",
          value: policies.length,
          tone: policies.length >= 2 ? "success" : "warning",
          status: policies.length >= 2 ? "ready" : "partial",
        },
        {
          key: "open-circuits",
          label: "Open circuits",
          value: circuits.filter((c) => c.state === "open").length,
          tone: circuits.filter((c) => c.state === "open").length === 0 ? "success" : "warning",
          status: circuits.filter((c) => c.state === "open").length === 0 ? "ready" : "open",
        },
        {
          key: "budget",
          label: "Budget",
          value: budget?.hard_blocked ? "Hard blocked" : "Open",
          tone: budget?.hard_blocked ? "danger" : "success",
          status: budget?.hard_blocked ? "blocked" : "ready",
        },
      ]
    : undefined;

  // ── Access gate ───────────────────────────────────────
  if (!canReadRouting) {
    return (
      <RegistryManagementPage
        eyebrow="Routing"
        title="Smart Execution Routing"
        description="Policy, budget, circuit guardrails, and decision history."
        isEmpty
        emptyTitle="Routing review unavailable"
        emptyDescription="This session does not hold routing.read on the active instance scope."
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Routing"
      title="Smart Execution Routing"
      description="Policy, budget, circuit guardrails, and decision history."
      scope={scopeConfig}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      diagnostics={
        <pre>{formatJson({ snapshot, policyDrafts, budgetDraft, circuitDrafts, simulationForm, simulationHistory })}</pre>
      }
      diagnosticsTitle="Routing raw truth"
    >
      {/* Inline loading message when snapshot exists but refreshing */}
      {state === "loading" ? <p className="fg-muted">Refreshing routing state.</p> : null}

      {/* Inline error with retry action */}
      {state === "error" ? (
        <div className="fg-danger mb-2">
          <p>{loadError || "Routing state could not be loaded."}</p>
          <Button variant="secondary" onPress={() => void load()}>Retry</Button>
        </div>
      ) : null}

      {/* Action-level error */}
      {actionError ? <p className="fg-danger">{actionError}</p> : null}

      {/* Main content when snapshot is loaded */}
      {snapshot ? (
        <>
          {/* ── Status Hero ── */}
          <RoutingStatusHero
            snapshot={snapshot}
            onEditPolicy={() => openSection("policy")}
            onRunSimulation={() => openSection("simulation")}
          />

          {/* ── Summary Grid — fills the main area and replaces empty space ── */}
          <RoutingSummaryGrid snapshot={snapshot} simulationSummary={simSummaryStr} />

          {/* ── Action Bar ── */}
          <RoutingActionBar
            canMutate={canMutate}
            canRead={canReadRouting}
            onRefresh={() => void load()}
            onEditPolicy={() => openSection("policy")}
            onRunSimulation={() => openSection("simulation")}
          />

          {/* ── Collapsible sections ── */}

          {/* Policy Editor */}
          <RoutingCollapseSection
            id="routing-policy-editor"
            heading="Policy editor"
            summary={
              policies.length >= 2
                ? `Simple and non-simple policies are configured. ${targets.length} targets available.`
                : `${policies.length} of 2 policies configured — expand to edit.`
            }
            badgeLabel={policies.length >= 2 ? "policy ready" : "policy partial"}
            badgeTone={toneForStatus(policies.length >= 2 ? "ready" : "partial")}
            open={sections.policy}
            onToggle={(open) => setSection("policy", open)}
          >
            <RoutingPolicyEditor
              snapshot={snapshot}
              policyDrafts={policyDrafts}
              canMutate={canMutate}
              actionError={actionError}
              onSetPolicyDrafts={setPolicyDrafts}
              onSavePolicy={savePolicy}
            />
          </RoutingCollapseSection>

          {/* Budget and Circuit Guardrails */}
          <RoutingCollapseSection
            id="routing-budget-circuits"
            heading="Budget and circuit guardrails"
            summary={
              budget?.hard_blocked
                ? "Hard-blocking all routing."
                : budget && budget.blocked_cost_classes.length > 0
                  ? `${budget.blocked_cost_classes.length} blocked cost class(es) active.`
                  : circuits.filter((c) => c.state === "open").length > 0
                    ? `${circuits.filter((c) => c.state === "open").length} open circuit(s).`
                    : "No active budget or circuit blockers."
            }
            badgeLabel={statusKey === "blocked" ? "blocked" : statusKey === "degraded" ? "degraded" : "passing"}
            badgeTone={toneForStatus(statusKey)}
            open={sections.budget}
            onToggle={(open) => setSection("budget", open)}
          >
            <RoutingBudgetCircuits
              snapshot={snapshot}
              budgetDraft={budgetDraft}
              circuitDrafts={circuitDrafts}
              canMutate={canMutate}
              actionError={actionError}
              onSetBudgetDraft={setBudgetDraft}
              onSaveBudget={saveBudget}
              onSetCircuitDrafts={setCircuitDrafts}
              onSaveCircuit={saveCircuit}
            />
          </RoutingCollapseSection>

          {/* Dry-run Simulation */}
          <RoutingCollapseSection
            id="routing-simulation"
            heading="Dry-run simulation"
            summary={
              simulationResult
                ? `Last result: ${simSummaryStr}`
                : "Simulate a routing decision before it goes live."
            }
            badgeLabel={simulationPending ? "running" : simulationResult?.status ?? "not run"}
            badgeTone={simulationPending ? "warning" : simulationResult?.status === "blocked" ? "danger" : simulationResult ? "success" : "neutral"}
            badgeStatus={simulationPending ? "running" : simulationResult?.status === "blocked" ? "blocked" : simulationResult ? "ready" : null}
            open={sections.simulation}
            onToggle={(open) => setSection("simulation", open)}
          >
            <RoutingSimulationPanel
              snapshot={snapshot}
              simulationForm={simulationForm}
              simulationPending={simulationPending}
              simulationResult={simulationResult}
              simulationHistory={simulationHistory}
              providerOptions={providerOptions}
              instanceId={instanceId}
              canMutate={canMutate}
              actionError={actionError}
              onSetSimulationForm={setSimulationForm}
              onRunSimulation={runSimulation}
              onRunScenarioSimulation={runScenarioSimulation}
            />
          </RoutingCollapseSection>

          {/* Recent Decisions */}
          <RoutingCollapseSection
            id="routing-recent-decisions"
            heading="Recent decisions"
            summary={
              recentDecisions.length > 0
                ? `${recentDecisions.length} decisions recorded. ${recentDecisions.filter((d) => Boolean(d.error_type)).length} blocked.`
                : "No routing decisions are persisted yet."
            }
            badgeLabel={`${recentDecisions.length} decisions`}
            badgeTone={recentDecisions.length > 0 ? "success" : "warning"}
            open={sections.decisions}
            onToggle={(open) => setSection("decisions", open)}
          >
            <RoutingDecisionsList snapshot={snapshot} />
          </RoutingCollapseSection>

          {/* Target Reference — moved from sidebar to expandable diagnostics panel */}
          <RoutingTargetReference snapshot={snapshot} />
        </>
      ) : null}
    </RegistryManagementPage>
  );
}
