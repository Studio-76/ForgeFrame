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
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";

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
  routingBlockers,
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
 * Request classification, target selection stages, budget and circuit guardrails,
 * and explainable decision history — in one focused surface.
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
  const blockers = routingBlockers(snapshot);
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

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Smart Execution Routing"
        description="Request classification, target selection stages, budget and circuit guardrails, and explainable decision history — in one focused surface."
        question="Which routing class applies, which targets are allowed to compete, and what will block or redirect traffic before runtime touches a provider?"
        badges={[
          { label: `${policies.length} policies`, tone: policies.length >= 2 ? "success" : "warning" },
          { label: `${circuits.filter((c) => c.state === "open").length} open circuits`, tone: circuits.filter((c) => c.state === "open").length === 0 ? "success" : "warning" },
          { label: budget?.hard_blocked ? "Budget hard blocked" : "Budget open", tone: budget?.hard_blocked ? "danger" : "success" },
          ...(selectedInstance ? [{ label: `${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note="Simulation and recent-decision explainability are backed by persisted routing policy, budget state, target truth, and the routing ledger."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="routing control plane"
        onInstanceChange={onInstanceChange}
      />

      {!canReadRouting ? (
        <PermissionState
          title="Routing review unavailable"
          description="This session does not hold routing.read on the active instance scope."
        />
      ) : null}

      {state === "loading" && !snapshot ? (
        <LoadingState
          title="Loading routing control plane"
          description="Restoring policy truth, budget posture, circuit state, target inventory, and recent decision explainability."
        />
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Routing control plane failed to load"
          description={loadError || "Routing state could not be loaded."}
          action={<button type="button" onClick={() => void load()}>Retry</button>}
        />
      ) : null}

      {snapshot && canReadRouting ? (
        <>
          {state === "loading" ? <p className="fg-muted">Refreshing routing state.</p> : null}
          {actionError ? <p className="fg-danger">{actionError}</p> : null}

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
            instanceId={instanceId}
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

          {/**
           * Bottom raw-truth diagnostics.
           * Moved to the very bottom so the page stays operational first.
           */}
          <AdvancedDiagnostics
            title="Routing raw truth"
            description="This stays collapsed so the page remains operational first. Open it when you need the exact snapshot or local draft state."
            status={state}
            statusTone="neutral"
          >
            <pre>{formatJson({ snapshot, policyDrafts, budgetDraft, circuitDrafts, simulationForm, simulationHistory })}</pre>
          </AdvancedDiagnostics>
        </>
      ) : null}
    </section>
  );
}
