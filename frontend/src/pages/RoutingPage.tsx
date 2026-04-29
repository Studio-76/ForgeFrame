import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import {
  fetchRoutingControlPlane,
  simulateRouting,
  updateRoutingBudget,
  updateRoutingCircuit,
  updateRoutingPolicy,
  type RoutingBudgetRecord,
  type RoutingBudgetScopeUpdateRecord,
  type RoutingCircuitRecord,
  type RoutingControlPlaneResponse,
  type RoutingDecisionCandidateRecord,
  type RoutingDecisionRecord,
  type RoutingPolicyRecord,
} from "../api/admin";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type SimulationScenario = "simple" | "non_simple";
type RequestPathPolicy = "smart_routing" | "queue_background" | "local_only" | "pinned_target";

type PolicyDraft = {
  execution_lane: RoutingPolicyRecord["execution_lane"];
  prefer_local: boolean;
  prefer_low_latency: boolean;
  allow_premium: boolean;
  allow_fallback: boolean;
  allow_escalation: boolean;
  require_queue_eligible: boolean;
  preferred_target_keys: string;
  fallback_target_keys: string;
  escalation_target_keys: string;
};

type SimulationFormState = {
  scenario: SimulationScenario;
  prompt: string;
  requestedProvider: string;
  requestedModel: string;
  requestPathPolicy: RequestPathPolicy;
  pinnedTargetKey: string;
  budgetScopeType: "instance" | "agent" | "task";
  budgetScopeKey: string;
  requireStreaming: boolean;
  requireToolCalling: boolean;
  requireVision: boolean;
  maxOutputTokens: string;
  expectedLane: "either" | RoutingPolicyRecord["execution_lane"];
};

type SimulationResultState = {
  status: string;
  decision?: RoutingDecisionRecord;
  error?: { type: string; message: string };
  form: SimulationFormState;
};

const SIMPLE_SIMULATION_PROMPT = "Summarize the current provider health in two short sentences.";
const NON_SIMPLE_SIMULATION_PROMPT = "Plan a multi-step failover, include tool-backed verification, and keep operator notes.";

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toneForStatus(status: "ready" | "partial" | "degraded" | "blocked"): StatusTone {
  switch (status) {
    case "ready":
      return "success";
    case "partial":
      return "warning";
    case "degraded":
      return "warning";
    case "blocked":
      return "danger";
    default:
      return "neutral";
  }
}

function listValue(value: string[]): string {
  return value.length > 0 ? value.join(", ") : "none";
}

function parseTargetKeyList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseBudgetScopesJson(value: string): RoutingBudgetScopeUpdateRecord[] {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }
  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed)) {
    throw new Error("Budget scopes must be a JSON array.");
  }
  return parsed as RoutingBudgetScopeUpdateRecord[];
}

function writableBudgetScopes(scopes: Array<RoutingBudgetScopeUpdateRecord | RoutingBudgetRecord["scopes"][number]>): RoutingBudgetScopeUpdateRecord[] {
  return scopes.map((scope) => ({
    scope_type: scope.scope_type,
    scope_key: scope.scope_key,
    window: scope.window,
    enabled: scope.enabled,
    soft_cost_limit: scope.soft_cost_limit ?? null,
    hard_cost_limit: scope.hard_cost_limit ?? null,
    soft_token_limit: scope.soft_token_limit ?? null,
    hard_token_limit: scope.hard_token_limit ?? null,
    soft_blocked_cost_classes: [...scope.soft_blocked_cost_classes],
    note: scope.note ?? null,
  }));
}

function toPolicyDraft(policy: RoutingPolicyRecord): PolicyDraft {
  return {
    execution_lane: policy.execution_lane,
    prefer_local: policy.prefer_local,
    prefer_low_latency: policy.prefer_low_latency,
    allow_premium: policy.allow_premium,
    allow_fallback: policy.allow_fallback,
    allow_escalation: policy.allow_escalation,
    require_queue_eligible: policy.require_queue_eligible,
    preferred_target_keys: policy.preferred_target_keys.join(", "),
    fallback_target_keys: policy.fallback_target_keys.join(", "),
    escalation_target_keys: policy.escalation_target_keys.join(", "),
  };
}

function defaultSimulationForm(instanceId: string | null): SimulationFormState {
  return {
    scenario: "simple",
    prompt: SIMPLE_SIMULATION_PROMPT,
    requestedProvider: "all",
    requestedModel: "",
    requestPathPolicy: "smart_routing",
    pinnedTargetKey: "",
    budgetScopeType: "instance",
    budgetScopeKey: instanceId ?? "",
    requireStreaming: false,
    requireToolCalling: false,
    requireVision: false,
    maxOutputTokens: "256",
    expectedLane: "sync_interactive",
  };
}

function applySimulationScenario(
  current: SimulationFormState,
  scenario: SimulationScenario,
  instanceId: string | null,
): SimulationFormState {
  if (scenario === "non_simple") {
    return {
      ...current,
      scenario,
      prompt: current.scenario === scenario ? current.prompt : NON_SIMPLE_SIMULATION_PROMPT,
      requestPathPolicy: current.requestPathPolicy === "local_only" ? "smart_routing" : current.requestPathPolicy,
      budgetScopeType: current.budgetScopeType,
      budgetScopeKey: current.budgetScopeType === "instance" ? (instanceId ?? current.budgetScopeKey) : current.budgetScopeKey,
      requireToolCalling: true,
      requireVision: false,
      maxOutputTokens: Number(current.maxOutputTokens) > 0 ? current.maxOutputTokens : "800",
      expectedLane: "queued_background",
    };
  }
  return {
    ...current,
    scenario,
    prompt: current.scenario === scenario ? current.prompt : SIMPLE_SIMULATION_PROMPT,
    budgetScopeType: current.budgetScopeType,
    budgetScopeKey: current.budgetScopeType === "instance" ? (instanceId ?? current.budgetScopeKey) : current.budgetScopeKey,
    requireToolCalling: false,
    requireVision: false,
    maxOutputTokens: "256",
    expectedLane: "sync_interactive",
  };
}

function liveStatus(snapshot: RoutingControlPlaneResponse | null): "ready" | "partial" | "degraded" | "blocked" {
  if (!snapshot) {
    return "partial";
  }
  const openCircuits = snapshot.circuits.filter((circuit) => circuit.state === "open").length;
  const blockedDecisions = snapshot.recent_decisions.filter((decision) => Boolean(decision.error_type)).length;
  if (snapshot.budget.hard_blocked) {
    return "blocked";
  }
  if (openCircuits > 0 || blockedDecisions > 0) {
    return "degraded";
  }
  return snapshot.policies.length >= 2 ? "ready" : "partial";
}

function routingBlockers(snapshot: RoutingControlPlaneResponse | null): string[] {
  if (!snapshot) {
    return ["Routing control plane has not been loaded yet."];
  }
  const blockers: string[] = [];
  const openCircuits = snapshot.circuits.filter((circuit) => circuit.state === "open");
  const blockedDecisions = snapshot.recent_decisions.filter((decision) => Boolean(decision.error_type));
  const readyTargets = snapshot.targets.filter((target) => target.enabled && target.runtime_ready && target.readiness_status === "ready");
  if (snapshot.budget.hard_blocked) {
    blockers.push(`Budget is hard-blocking all routing. Reason: ${snapshot.budget.reason ?? "none recorded"}.`);
  }
  if (snapshot.budget.blocked_cost_classes.length > 0) {
    blockers.push(`Blocked cost classes currently constrain selection: ${snapshot.budget.blocked_cost_classes.join(", ")}.`);
  }
  if (openCircuits.length > 0) {
    blockers.push(`${openCircuits.length} target circuit(s) are open: ${openCircuits.map((circuit) => circuit.target_key).join(", ")}.`);
  }
  if (readyTargets.length === 0) {
    blockers.push("No runtime-ready enabled target is currently available for routing.");
  }
  if (blockedDecisions.length > 0) {
    blockers.push(`${blockedDecisions.length} recent routing decision(s) were blocked and need review.`);
  }
  if (snapshot.policies.length < 2) {
    blockers.push("Simple and non-simple policies are not both persisted for this instance.");
  }
  return blockers;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function selectionBasis(decision: RoutingDecisionRecord | undefined): Record<string, unknown> {
  if (!decision) {
    return {};
  }
  return asRecord(decision.raw_details.selection_basis) ?? {};
}

function selectedCandidate(decision: RoutingDecisionRecord | undefined): RoutingDecisionCandidateRecord | null {
  if (!decision) {
    return null;
  }
  return decision.candidates.find((candidate) => candidate.selected) ?? null;
}

function rejectedCandidates(decision: RoutingDecisionRecord | undefined): RoutingDecisionCandidateRecord[] {
  if (!decision) {
    return [];
  }
  return decision.candidates.filter((candidate) => candidate.selected === false && candidate.exclusion_reasons.length > 0);
}

function requestedScenarioLabel(form: SimulationFormState): string {
  return form.scenario === "simple" ? "Simple request class" : "Non-simple request class";
}

function laneMatchLabel(form: SimulationFormState, decision: RoutingDecisionRecord | undefined): string {
  if (!decision || form.expectedLane === "either") {
    return "No expected lane check";
  }
  return form.expectedLane === decision.execution_lane
    ? `Expected lane matched: ${decision.execution_lane}`
    : `Expected ${form.expectedLane}, actual ${decision.execution_lane}`;
}

function buildSimulationMessages(form: SimulationFormState): Array<Record<string, unknown>> {
  if (form.scenario === "non_simple") {
    return [
      { role: "system", content: "Operator simulation for a multi-step request." },
      { role: "user", content: form.prompt.trim() || NON_SIMPLE_SIMULATION_PROMPT },
    ];
  }
  return [{ role: "user", content: form.prompt.trim() || SIMPLE_SIMULATION_PROMPT }];
}

function buildSimulationRouteContext(form: SimulationFormState, instanceId: string | null): Record<string, string> | undefined {
  const routeContext: Record<string, string> = {};
  if (instanceId) {
    routeContext.instance_id = instanceId;
  }
  if (form.requestPathPolicy !== "smart_routing") {
    routeContext.request_path_policy = form.requestPathPolicy;
  }
  if (form.requestPathPolicy === "pinned_target" && form.pinnedTargetKey.trim()) {
    routeContext.pinned_target_key = form.pinnedTargetKey.trim();
  }
  if (form.budgetScopeType === "agent" && form.budgetScopeKey.trim()) {
    routeContext.agent_id = form.budgetScopeKey.trim();
  }
  if (form.budgetScopeType === "task" && form.budgetScopeKey.trim()) {
    routeContext.task_id = form.budgetScopeKey.trim();
  }
  return Object.keys(routeContext).length > 0 ? routeContext : undefined;
}

function simulationSummary(run: SimulationResultState | undefined): string {
  if (!run?.decision) {
    return run?.error ? `${run.error.type}: ${run.error.message}` : "No simulation recorded yet.";
  }
  return `${run.decision.selected_target_key ?? "no target"} on ${run.decision.policy_stage} / ${run.decision.execution_lane}`;
}

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
  const [budgetDraft, setBudgetDraft] = useState<{
    hard_blocked: boolean;
    blocked_cost_classes: string;
    reason: string;
    scopes_json: string;
  }>({
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

  const canReadRouting = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "routing.read");
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
    setSimulationForm((current) => (
      current.budgetScopeType === "instance"
        ? { ...current, budgetScopeKey: instanceId ?? "" }
        : current
    ));
  }, [instanceId]);

  const targets = snapshot?.targets ?? [];
  const policies = snapshot?.policies ?? [];
  const circuits = snapshot?.circuits ?? [];
  const recentDecisions = snapshot?.recent_decisions ?? [];
  const budget = snapshot?.budget;
  const openCircuits = circuits.filter((circuit) => circuit.state === "open");
  const blockedDecisions = recentDecisions.filter((decision) => Boolean(decision.error_type));
  const liveStatusKey = liveStatus(snapshot);
  const blockers = routingBlockers(snapshot);
  const providerOptions = useMemo(
    () => Array.from(new Set(targets.map((target) => target.provider))).sort(),
    [targets],
  );
  const summaryItems: SummaryStripItem[] = [
    {
      key: "instance",
      label: "Active instance",
      value: selectedInstance?.display_name ?? snapshot?.instance?.display_name ?? "No instance selected",
      meta: snapshot?.instance?.instance_id ?? "Routing scope follows the chosen instance.",
      status: snapshot ? "ready" : "partial",
      tone: snapshot ? "success" : "warning",
    },
    {
      key: "policy",
      label: "Policy posture",
      value: policies.length >= 2 ? "Simple + non-simple persisted" : `${policies.length} policy record(s) loaded`,
      meta: "Routing class and execution lane stay separate. Simple/non-simple select policy, then the policy drives lane intent.",
      status: policies.length >= 2 ? "ready" : "partial",
      tone: policies.length >= 2 ? "success" : "warning",
    },
    {
      key: "blockers",
      label: "Primary blockers",
      value: blockers.length === 0 ? "No active blockers" : `${blockers.length} blocker(s) visible`,
      meta: blockers.length === 0 ? "Budget, circuits, and target readiness are not currently blocking the instance." : blockers[0],
      status: blockers.length === 0 ? "ready" : liveStatusKey === "blocked" ? "blocked" : "degraded",
      tone: blockers.length === 0 ? "success" : liveStatusKey === "blocked" ? "danger" : "warning",
    },
    {
      key: "ledger",
      label: "Decision ledger",
      value: `${recentDecisions.length} recent decision(s)`,
      meta: blockedDecisions.length > 0 ? `${blockedDecisions.length} blocked decision(s) need operator review.` : "No recent blocked routing decisions are recorded.",
      status: blockedDecisions.length > 0 ? "degraded" : "ready",
      tone: blockedDecisions.length > 0 ? "warning" : "success",
    },
  ];

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

  const primaryActionRoute = withInstanceScope(
    `${CONTROL_PLANE_ROUTES.routing}#${canMutate ? "routing-policy-editor" : "routing-simulation"}`,
    instanceId,
  );
  const activeSimulation = simulationResult?.decision;
  const activeSelectedCandidate = selectedCandidate(activeSimulation);
  const activeRejectedCandidates = rejectedCandidates(activeSimulation);
  const activeSelectionBasis = selectionBasis(activeSimulation);
  const matchingScopes = Array.isArray(activeSelectionBasis.budget_matching_scopes)
    ? activeSelectionBasis.budget_matching_scopes as Array<Record<string, unknown>>
    : [];
  const openCircuitExplainability = Array.isArray(activeSelectionBasis.open_circuits)
    ? activeSelectionBasis.open_circuits as Array<Record<string, unknown>>
    : [];
  const blockedCostClasses = asStringList(activeSelectionBasis.blocked_cost_classes);
  const simpleHistory = simulationHistory.simple;
  const nonSimpleHistory = simulationHistory.non_simple;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Smart Execution Routing"
        description="Routing is the instance-bound policy editor and simulator for ForgeFrame: deterministic request classification, explicit target stages, visible budget and circuit gates, and explainable decision history."
        question="Which routing class applies, which targets are allowed to compete, and what will block or redirect traffic before runtime touches a provider?"
        badges={[
          { label: `${policies.length} policies`, tone: policies.length >= 2 ? "success" : "warning" },
          { label: `${openCircuits.length} open circuits`, tone: openCircuits.length === 0 ? "success" : "warning" },
          { label: budget?.hard_blocked ? "Budget hard blocked" : "Budget open", tone: budget?.hard_blocked ? "danger" : "success" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(session ? [{ label: canMutate ? `${session.role} can edit routing` : "Read-only routing review", tone: canMutate ? "success" as const : "warning" as const }] : []),
        ]}
        note="Simulation and recent-decision explainability are backed by persisted routing policy, budget state, target truth, and the routing ledger. This page does not fake target selection or blocked states."
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

      <ActionBar
        title="Routing operator actions"
        description="Jump straight into editing policy, running simulations, or auditing the runtime surfaces that prove why a route was selected or blocked."
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={() => void load()} disabled={!canReadRouting}>
              Refresh
            </button>
            <Link className="fg-nav-link" to={primaryActionRoute}>
              {canMutate ? "Policy bearbeiten" : "Simulation starten"}
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.models, instanceId)}>Models</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>Costs</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>Logs</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId)}>Execution Review</Link>
          </div>
        )}
      >
        <p className="fg-muted">
          Request class decides whether the simple or non-simple policy applies. Execution lane is downstream policy intent. Request-path controls such as local-only, queue-background, or pinned-target are shown separately so the page never conflates them.
        </p>
      </ActionBar>

      {!canReadRouting ? (
        <PermissionState
          title="Routing review unavailable"
          description="This session does not hold routing.read on the active instance scope, so ForgeFrame will not pretend the routing control plane is open."
        />
      ) : null}

      {state === "loading" && !snapshot ? (
        <LoadingState
          title="Loading routing control plane"
          description="ForgeFrame is restoring policy truth, budget posture, circuit state, target inventory, and recent decision explainability."
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
          {state === "loading" ? <p className="fg-muted">Refreshing routing policy, budget posture, and ledger truth.</p> : null}
          {actionError ? <p className="fg-danger">{actionError}</p> : null}
          <SummaryStrip items={summaryItems} />

          <div className="ff-operator-layout">
            <div className="ff-operator-main">
              <article id="routing-policy-editor" className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Policy editor</h3>
                    <p className="fg-muted">Edit the simple and non-simple routing classes in structured sections: classification intent, target pools, fallback/escalation, and budget/circuit behavior.</p>
                  </div>
                  <StatusBadge tone={toneForStatus(policies.length >= 2 ? "ready" : "partial")} status={policies.length >= 2 ? "ready" : "partial"}>
                    {policies.length >= 2 ? "policy ready" : "policy partial"}
                  </StatusBadge>
                </div>

                {policies.length === 0 ? (
                  <EmptyState
                    title="No routing policies are available"
                    description="This instance has no persisted routing policy records, so simulation cannot be trusted until the policy layer exists."
                  />
                ) : (
                  <div className="fg-card-grid">
                    {policies.map((policy) => {
                      const draft = policyDrafts[policy.classification] ?? toPolicyDraft(policy);
                      return (
                        <article key={policy.classification} className="fg-subcard">
                          <div className="fg-panel-heading">
                            <div>
                              <h4>{policy.display_name}</h4>
                              <p className="fg-muted">{policy.description}</p>
                            </div>
                            <StatusBadge tone={policy.classification === "simple" ? "success" : "warning"} status={policy.classification === "simple" ? "ready" : "partial"}>
                              {titleCase(policy.classification)}
                            </StatusBadge>
                          </div>

                          <section className="fg-subcard">
                            <h5>Classification and lane</h5>
                            <p>Routing class: {titleCase(policy.classification)}.</p>
                            <p>Execution lane: {policy.execution_lane}. This is policy intent after classification, not the classification itself.</p>
                            <div className="fg-inline-form">
                              <label>
                                Execution lane
                                <select
                                  aria-label={`${policy.classification} execution lane`}
                                  value={draft.execution_lane}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: {
                                      ...draft,
                                      execution_lane: event.target.value as PolicyDraft["execution_lane"],
                                    },
                                  }))}
                                >
                                  <option value="sync_interactive">sync_interactive</option>
                                  <option value="queued_background">queued_background</option>
                                </select>
                              </label>
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.prefer_local}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, prefer_local: event.target.checked },
                                  }))}
                                />
                                Prefer local targets
                              </label>
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.prefer_low_latency}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, prefer_low_latency: event.target.checked },
                                  }))}
                                />
                                Prefer low latency
                              </label>
                            </div>
                          </section>

                          <section className="fg-subcard">
                            <h5>Allowed target pool</h5>
                            <p className="fg-muted">Preferred stage order is the comma order below. Use exact target keys so the stage list remains explicit and auditable.</p>
                            <div className="fg-inline-form">
                              <label>
                                Preferred target keys
                                <input
                                  aria-label={`${policy.classification} preferred target keys`}
                                  value={draft.preferred_target_keys}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, preferred_target_keys: event.target.value },
                                  }))}
                                />
                              </label>
                            </div>
                            <div className="fg-detail-grid">
                              {targets.map((target) => (
                                <p key={`${policy.classification}:${target.target_key}`}>
                                  {target.target_key} to {target.label} · readiness={target.readiness_status} · cost={target.cost_class}
                                </p>
                              ))}
                            </div>
                          </section>

                          <section className="fg-subcard">
                            <h5>Fallback and escalation</h5>
                            <div className="fg-inline-form">
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.allow_fallback}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, allow_fallback: event.target.checked },
                                  }))}
                                />
                                Allow fallback stage
                              </label>
                              <label>
                                Fallback target keys
                                <input
                                  aria-label={`${policy.classification} fallback target keys`}
                                  value={draft.fallback_target_keys}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, fallback_target_keys: event.target.value },
                                  }))}
                                />
                              </label>
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.allow_escalation}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, allow_escalation: event.target.checked },
                                  }))}
                                />
                                Allow escalation stage
                              </label>
                              <label>
                                Escalation target keys
                                <input
                                  aria-label={`${policy.classification} escalation target keys`}
                                  value={draft.escalation_target_keys}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, escalation_target_keys: event.target.value },
                                  }))}
                                />
                              </label>
                            </div>
                          </section>

                          <section className="fg-subcard">
                            <h5>Budget and circuit behavior</h5>
                            <div className="fg-inline-form">
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.allow_premium}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, allow_premium: event.target.checked },
                                  }))}
                                />
                                Premium targets allowed
                              </label>
                              <label className="fg-checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.require_queue_eligible}
                                  onChange={(event) => setPolicyDrafts((current) => ({
                                    ...current,
                                    [policy.classification]: { ...draft, require_queue_eligible: event.target.checked },
                                  }))}
                                />
                                Require queue-eligible targets
                              </label>
                            </div>
                            <ul className="fg-list">
                              <li>Blocked cost classes and hard-budget posture are enforced after this policy is chosen.</li>
                              <li>Open circuits remove targets before stage selection and can force fallback or escalation.</li>
                              <li>Request-path controls such as queue-background or pinned-target remain separate from the routing class.</li>
                            </ul>
                          </section>

                          <div className="fg-actions fg-actions-end">
                            <button type="button" onClick={() => void savePolicy(policy.classification)}>
                              Save {policy.display_name}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>

              <article id="routing-budget-circuits" className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Budget and circuit guardrails</h3>
                    <p className="fg-muted">These controls explain and enforce when routing blocks, downgrades, or leaves the preferred path. They are operator-editable because the API persists them.</p>
                  </div>
                  <StatusBadge tone={toneForStatus(liveStatusKey)} status={liveStatusKey}>
                    {titleCase(liveStatusKey)}
                  </StatusBadge>
                </div>

                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <h4>What blocks routing right now</h4>
                    {blockers.length === 0 ? (
                      <p className="fg-muted">No active budget, circuit, or target-readiness blocker is visible for this instance.</p>
                    ) : (
                      <ul className="fg-list">
                        {blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="fg-subcard">
                    <h4>Budget gate editor</h4>
                    <p className="fg-muted">Hard block stops all routing. Blocked cost classes only remove matching candidates. Only writable scope fields belong in this editor; observed usage, anomaly flags, and evaluation timestamps are server-calculated and remain read-only below.</p>
                    <div className="fg-inline-form">
                      <label className="fg-checkbox">
                        <input
                          type="checkbox"
                          checked={budgetDraft.hard_blocked}
                          onChange={(event) => setBudgetDraft((current) => ({ ...current, hard_blocked: event.target.checked }))}
                        />
                        Hard block routing
                      </label>
                      <label>
                        Blocked cost classes
                        <input
                          aria-label="Blocked cost classes"
                          value={budgetDraft.blocked_cost_classes}
                          onChange={(event) => setBudgetDraft((current) => ({ ...current, blocked_cost_classes: event.target.value }))}
                        />
                      </label>
                      <label>
                        Reason
                        <input
                          aria-label="Budget reason"
                          value={budgetDraft.reason}
                          onChange={(event) => setBudgetDraft((current) => ({ ...current, reason: event.target.value }))}
                        />
                      </label>
                      <label>
                        Scoped budget rules (writable JSON)
                        <textarea
                          aria-label="Scoped budget rules writable JSON"
                          value={budgetDraft.scopes_json}
                          rows={10}
                          onChange={(event) => setBudgetDraft((current) => ({ ...current, scopes_json: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="fg-actions fg-actions-end">
                      <button type="button" onClick={() => void saveBudget()}>
                        Save budget posture
                      </button>
                    </div>
                  </article>

                  <article className="fg-subcard">
                    <h4>Budget scope truth</h4>
                    <ul className="fg-list">
                      <li>Configured scope rules: {budget?.scopes.length ?? 0}</li>
                      <li>Matching anomalies: {budget?.anomalies.length ?? 0}</li>
                      <li>Last evaluated at: {budget?.last_evaluated_at ?? "n/a"}</li>
                    </ul>
                    <div className="fg-detail-grid">
                      {(budget?.scopes ?? []).map((scope) => (
                        <p key={`${scope.scope_type}:${scope.scope_key}:${scope.window}`}>
                          {scope.scope_type}:{scope.scope_key} · {scope.window} · enabled={String(scope.enabled)} · soft={scope.soft_cost_limit ?? "n/a"} · hard={scope.hard_cost_limit ?? "n/a"} · observed cost={scope.observed_cost ?? 0} · observed tokens={scope.observed_tokens ?? 0} · soft exceeded={String(scope.soft_limit_exceeded)} · hard exceeded={String(scope.hard_limit_exceeded)}
                        </p>
                      ))}
                      {(budget?.scopes ?? []).length === 0 ? <p className="fg-muted">No scoped budget rules are configured.</p> : null}
                    </div>
                    <div className="fg-detail-grid">
                      {(budget?.anomalies ?? []).map((anomaly, index) => (
                        <p key={`${anomaly.scope_type}:${anomaly.scope_key}:${anomaly.window}:${anomaly.anomaly_type}:${index}`}>
                          {anomaly.severity} · {anomaly.anomaly_type} · {anomaly.scope_type}:{anomaly.scope_key} · threshold cost={anomaly.threshold_cost ?? "n/a"} · threshold tokens={anomaly.threshold_tokens ?? "n/a"}
                        </p>
                      ))}
                      {(budget?.anomalies ?? []).length === 0 ? <p className="fg-muted">No budget anomalies are recorded.</p> : null}
                    </div>
                  </article>

                  <article className="fg-subcard">
                    <h4>Target circuit breakers</h4>
                    <p className="fg-muted">Open circuits immediately exclude targets before stage ordering chooses between preferred, fallback, or escalation.</p>
                    <div className="fg-detail-grid">
                      {targets.map((target) => {
                        const circuit = circuits.find((item) => item.target_key === target.target_key);
                        const circuitState = circuit?.state ?? "closed";
                        return (
                          <div key={target.target_key} className="fg-subcard">
                            <p>{target.label} · {target.target_key}</p>
                            <p className="fg-muted">Circuit={circuitState} · cost={target.cost_class} · readiness={target.readiness_status}</p>
                            <label>
                              Circuit reason
                              <input
                                aria-label={`Circuit reason ${target.target_key}`}
                                value={circuitDrafts[target.target_key] ?? ""}
                                onChange={(event) => setCircuitDrafts((current) => ({ ...current, [target.target_key]: event.target.value }))}
                              />
                            </label>
                            <div className="fg-actions fg-actions-end">
                              <button type="button" onClick={() => void saveCircuit(target.target_key, "open")}>
                                Open circuit
                              </button>
                              <button type="button" onClick={() => void saveCircuit(target.target_key, "closed")}>
                                Close circuit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </div>
              </article>

              <article id="routing-simulation" className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Dry-run simulation</h3>
                    <p className="fg-muted">Simulate request classification, provider/model scope, request-path controls, budget scope context, and expected lane. Result output stays split into short decision, decision factors, and raw details.</p>
                  </div>
                  <StatusBadge tone={simulationPending ? "warning" : simulationResult?.status === "blocked" ? "danger" : simulationResult ? "success" : "neutral"} status={simulationResult?.status === "blocked" ? "blocked" : simulationResult ? "ready" : "partial"}>
                    {simulationPending ? "running" : simulationResult?.status ?? "not run"}
                  </StatusBadge>
                </div>

                <div className="fg-inline-form">
                  <label>
                    Request class
                    <select
                      aria-label="Simulation request class"
                      value={simulationForm.scenario}
                      onChange={(event) => setSimulationForm((current) => applySimulationScenario(current, event.target.value as SimulationScenario, instanceId))}
                    >
                      <option value="simple">Simple</option>
                      <option value="non_simple">Non-simple</option>
                    </select>
                  </label>
                  <label>
                    Requested provider
                    <select
                      aria-label="Simulation provider"
                      value={simulationForm.requestedProvider}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requestedProvider: event.target.value }))}
                    >
                      <option value="all">All providers</option>
                      {providerOptions.map((provider) => (
                        <option key={provider} value={provider}>{provider}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Requested model
                    <input
                      aria-label="Simulation model"
                      value={simulationForm.requestedModel}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requestedModel: event.target.value }))}
                    />
                  </label>
                  <label>
                    Request path policy
                    <select
                      aria-label="Request path policy"
                      value={simulationForm.requestPathPolicy}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requestPathPolicy: event.target.value as RequestPathPolicy }))}
                    >
                      <option value="smart_routing">smart_routing</option>
                      <option value="queue_background">queue_background</option>
                      <option value="local_only">local_only</option>
                      <option value="pinned_target">pinned_target</option>
                    </select>
                  </label>
                  {simulationForm.requestPathPolicy === "pinned_target" ? (
                    <label>
                      Pinned target key
                      <select
                        aria-label="Pinned target key"
                        value={simulationForm.pinnedTargetKey}
                        onChange={(event) => setSimulationForm((current) => ({ ...current, pinnedTargetKey: event.target.value }))}
                      >
                        <option value="">Choose target</option>
                        {targets.map((target) => (
                          <option key={target.target_key} value={target.target_key}>{target.target_key}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Budget scope type
                    <select
                      aria-label="Budget scope type"
                      value={simulationForm.budgetScopeType}
                      onChange={(event) => setSimulationForm((current) => {
                        const nextScopeType = event.target.value as SimulationFormState["budgetScopeType"];
                        return {
                          ...current,
                          budgetScopeType: nextScopeType,
                          budgetScopeKey: nextScopeType === "instance"
                            ? (instanceId ?? "")
                            : current.budgetScopeType === "instance"
                              ? ""
                              : current.budgetScopeKey,
                        };
                      })}
                    >
                      <option value="instance">instance</option>
                      <option value="agent">agent</option>
                      <option value="task">task</option>
                    </select>
                  </label>
                  <label>
                    Budget scope key
                    <input
                      aria-label="Budget scope key"
                      value={simulationForm.budgetScopeType === "instance" ? (instanceId ?? "") : simulationForm.budgetScopeKey}
                      disabled={simulationForm.budgetScopeType === "instance"}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, budgetScopeKey: event.target.value }))}
                    />
                  </label>
                  <label>
                    Expected execution lane
                    <select
                      aria-label="Expected execution lane"
                      value={simulationForm.expectedLane}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, expectedLane: event.target.value as SimulationFormState["expectedLane"] }))}
                    >
                      <option value="either">either</option>
                      <option value="sync_interactive">sync_interactive</option>
                      <option value="queued_background">queued_background</option>
                    </select>
                  </label>
                  <label>
                    Prompt
                    <textarea
                      aria-label="Simulation prompt"
                      value={simulationForm.prompt}
                      rows={4}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, prompt: event.target.value }))}
                    />
                  </label>
                  <label>
                    Max output tokens
                    <input
                      aria-label="Simulation max output tokens"
                      value={simulationForm.maxOutputTokens}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, maxOutputTokens: event.target.value }))}
                    />
                  </label>
                  <label className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={simulationForm.requireStreaming}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requireStreaming: event.target.checked }))}
                    />
                    Streaming required
                  </label>
                  <label className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={simulationForm.requireToolCalling}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requireToolCalling: event.target.checked }))}
                    />
                    Tool calling required
                  </label>
                  <label className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={simulationForm.requireVision}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, requireVision: event.target.checked }))}
                    />
                    Vision required
                  </label>
                </div>

                <div className="fg-actions">
                  <button type="button" onClick={() => void runScenarioSimulation("simple")} disabled={simulationPending}>
                    {simulationPending ? "Running simulation" : "Run simple simulation"}
                  </button>
                  <button type="button" onClick={() => void runScenarioSimulation("non_simple")} disabled={simulationPending}>
                    {simulationPending ? "Running simulation" : "Run non-simple simulation"}
                  </button>
                  <button type="button" onClick={() => void runSimulation()} disabled={simulationPending}>
                    {simulationPending ? "Running simulation" : "Run configured simulation"}
                  </button>
                </div>

                {simulationResult ? (
                  <div className="fg-card-grid fg-mt-sm">
                    <article className="fg-subcard">
                      <h4>Short decision</h4>
                      {simulationResult.error ? <p className="fg-danger">{simulationResult.error.type}: {simulationResult.error.message}</p> : null}
                      <ul className="fg-list">
                        <li>Requested scenario: {requestedScenarioLabel(simulationResult.form)}</li>
                        <li>Classification result: {simulationResult.decision ? titleCase(simulationResult.decision.classification) : "No decision persisted"}</li>
                        <li>Selected target: {simulationResult.decision?.selected_target_key ?? "none"}</li>
                        <li>Policy stage: {simulationResult.decision?.policy_stage ?? "blocked"}</li>
                        <li>Execution lane: {simulationResult.decision?.execution_lane ?? "n/a"}</li>
                        <li>{laneMatchLabel(simulationResult.form, simulationResult.decision)}</li>
                      </ul>
                      {simulationResult.decision ? <p className="fg-muted">{simulationResult.decision.summary}</p> : null}
                    </article>

                    <article className="fg-subcard">
                      <h4>Decision factors</h4>
                      {simulationResult.decision ? (
                        <ul className="fg-list">
                          <li>{simulationResult.decision.classification_summary}</li>
                          <li>Classification rules: {listValue(simulationResult.decision.classification_rules)}</li>
                          <li>Request path policy: {String(activeSelectionBasis.request_path_policy ?? "smart_routing")}</li>
                          <li>Provider scope: {simulationResult.form.requestedProvider === "all" ? "all providers" : simulationResult.form.requestedProvider}</li>
                          <li>Selected candidate reasons: {activeSelectedCandidate?.selection_reasons.length ? activeSelectedCandidate.selection_reasons.join(", ") : "none recorded"}</li>
                          <li>Rejected candidates: {activeRejectedCandidates.length}</li>
                          <li>Blocked cost classes in effect: {blockedCostClasses.length > 0 ? blockedCostClasses.join(", ") : "none"}</li>
                          <li>Matching budget scopes: {matchingScopes.length > 0 ? matchingScopes.map((scope) => `${String(scope.scope_type)}:${String(scope.scope_key)}`).join(", ") : "none"}</li>
                          <li>Open circuits in effect: {openCircuitExplainability.length > 0 ? openCircuitExplainability.map((circuit) => String(circuit.target_key)).join(", ") : "none"}</li>
                        </ul>
                      ) : (
                        <p className="fg-muted">No decision factors are available because the simulation did not persist a routing decision.</p>
                      )}
                    </article>

                    <article className="fg-subcard">
                      <h4>Rejected candidates</h4>
                      {activeRejectedCandidates.length > 0 ? (
                        <ul className="fg-list">
                          {activeRejectedCandidates.map((candidate) => (
                            <li key={candidate.target_key}>
                              {candidate.label} · {candidate.target_key} · {candidate.exclusion_reasons.join(", ")}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="fg-muted">No rejected candidates were recorded for this simulation.</p>
                      )}
                    </article>

                    <article className="fg-subcard">
                      <h4>Simple vs non-simple comparison</h4>
                      <ul className="fg-list">
                        <li>Simple: {simulationSummary(simpleHistory)}</li>
                        <li>Non-simple: {simulationSummary(nonSimpleHistory)}</li>
                        <li>
                          {simpleHistory?.decision && nonSimpleHistory?.decision
                            ? simpleHistory.decision.selected_target_key !== nonSimpleHistory.decision.selected_target_key
                              ? "Simple and non-simple simulations currently resolve to different targets, which matches the expected routing split."
                              : "Simple and non-simple simulations currently land on the same target. Inspect target pools, request-path controls, or budget/circuit gates before trusting this posture."
                            : "Run both quick simulations to compare the current simple and non-simple routing posture."}
                        </li>
                      </ul>
                    </article>
                  </div>
                ) : null}

                {simulationResult ? (
                  <AdvancedDiagnostics
                    title="Raw simulation details"
                    description="Structured explainability stays in the short decision and factor views. Raw payloads remain collapsed here for technical debugging and extension."
                    status={simulationResult.status}
                    statusTone={simulationResult.status === "blocked" ? "danger" : "neutral"}
                  >
                    <pre>{formatJson(simulationResult)}</pre>
                  </AdvancedDiagnostics>
                ) : null}
              </article>

              <article id="routing-recent-decisions" className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Recent decisions</h3>
                    <p className="fg-muted">Recent routing history shows why a target was selected, what got rejected, and where to continue investigation in logs or execution review.</p>
                  </div>
                  <StatusBadge tone={recentDecisions.length > 0 ? "success" : "warning"} status={recentDecisions.length > 0 ? "ready" : "partial"}>
                    {recentDecisions.length} decisions
                  </StatusBadge>
                </div>

                {recentDecisions.length === 0 ? (
                  <EmptyState
                    title="No routing decisions are persisted yet"
                    description="Run a simulation or wait for runtime dispatch traffic to create explainable routing history."
                  />
                ) : (
                  <div className="fg-card-grid">
                    {recentDecisions.map((decision) => {
                      const chosenCandidate = selectedCandidate(decision);
                      const rejected = rejectedCandidates(decision);
                      return (
                        <article key={decision.decision_id} className="fg-subcard">
                          <div className="fg-panel-heading">
                            <div>
                              <h4>{decision.summary}</h4>
                              <p className="fg-muted">{decision.created_at} · {titleCase(decision.classification)} · stage={decision.policy_stage}</p>
                            </div>
                            <StatusBadge tone={decision.error_type ? "danger" : decision.policy_stage === "preferred" ? "success" : "warning"} status={decision.error_type ? "blocked" : decision.policy_stage === "preferred" ? "ready" : "partial"}>
                              {decision.error_type ?? decision.policy_stage}
                            </StatusBadge>
                          </div>

                          <ul className="fg-list">
                            <li>{decision.classification_summary}</li>
                            <li>Selected target: {decision.selected_target_key ?? "none"}</li>
                            <li>Execution lane: {decision.execution_lane}</li>
                            <li>Classification rules: {listValue(decision.classification_rules)}</li>
                            <li>Chosen because: {chosenCandidate?.selection_reasons.length ? chosenCandidate.selection_reasons.join(", ") : "no selected-candidate reason recorded"}</li>
                          </ul>

                          <section className="fg-subcard">
                            <h5>Rejected candidates</h5>
                            {rejected.length > 0 ? (
                              <ul className="fg-list">
                                {rejected.map((candidate) => (
                                  <li key={candidate.target_key}>
                                    {candidate.label} · {candidate.target_key} · {candidate.exclusion_reasons.join(", ")}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="fg-muted">No rejected candidates were recorded for this decision.</p>
                            )}
                          </section>

                          <div className="fg-actions">
                            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, decision.instance_id)}>Open Logs</Link>
                            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, decision.instance_id)}>Execution Review</Link>
                            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, decision.instance_id)}>Provider Targets</Link>
                          </div>

                          <AdvancedDiagnostics
                            title="Raw decision payload"
                            description="Raw structured and technical details remain collapsed so the main card stays decision-oriented."
                            status={decision.error_type ? "blocked" : "decision"}
                            statusTone={decision.error_type ? "danger" : "neutral"}
                          >
                            <pre>{formatJson(decision)}</pre>
                          </AdvancedDiagnostics>
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>

            <div className="ff-operator-sidebar">
              <DetailPanel
                title="Live routing posture"
                description="The sidebar keeps the active instance, blockers, budget posture, and ledger pressure visible while policy and simulation work happen on the main surface."
                status={titleCase(liveStatusKey)}
                statusTone={toneForStatus(liveStatusKey)}
                statusKey={liveStatusKey}
                sticky
                actions={(
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>Logs</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId)}>Execution</Link>
                  </div>
                )}
              >
                <div className="fg-stack">
                  <section className="fg-subcard">
                    <h4>Primary blockers</h4>
                    {blockers.length > 0 ? (
                      <ul className="fg-list">
                        {blockers.map((blocker) => (
                          <li key={`sidebar-${blocker}`}>{blocker}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fg-muted">No active blocker is visible from budget, circuit, readiness, or ledger state.</p>
                    )}
                  </section>

                  <section className="fg-subcard">
                    <h4>Budget posture</h4>
                    <p>Hard blocked: {String(budget?.hard_blocked ?? false)}</p>
                    <p>Blocked cost classes: {budget?.blocked_cost_classes.length ? budget.blocked_cost_classes.join(", ") : "none"}</p>
                    <p>Reason: {budget?.reason ?? "none recorded"}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Circuit posture</h4>
                    <p>Open circuits: {openCircuits.length}</p>
                    <p className="fg-muted">{openCircuits.length > 0 ? openCircuits.map((circuit) => `${circuit.target_key} (${circuit.reason ?? "no reason"})`).join(", ") : "No target circuit is open."}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Ledger pressure</h4>
                    <p>Blocked decisions: {blockedDecisions.length}</p>
                    <p>Recent decisions: {recentDecisions.length}</p>
                    <p className="fg-muted">Use the decision ledger below to inspect selected targets, rejected candidates, and follow-up links.</p>
                  </section>
                </div>
              </DetailPanel>

              <div id="routing-target-reference">
                <DetailPanel
                  title="Direct target reference"
                  description="Use exact target keys when editing preferred, fallback, or escalation stage lists."
                  status={`${targets.length} targets`}
                  statusTone="neutral"
                >
                  <div className="fg-stack">
                    {targets.map((target) => (
                      <section key={target.target_key} className="fg-subcard">
                        <h4>{target.target_key}</h4>
                        <p>{target.label}</p>
                        <p className="fg-muted">{target.provider} · readiness={target.readiness_status} · runtime ready={String(target.runtime_ready)} · cost={target.cost_class}</p>
                      </section>
                    ))}
                    {targets.length === 0 ? <p className="fg-muted">No routing targets are registered for this instance.</p> : null}
                  </div>
                </DetailPanel>
              </div>
            </div>
          </div>

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
