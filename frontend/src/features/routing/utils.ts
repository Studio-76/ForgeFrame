import type {
  BudgetDraftState,
  PolicyDraft,
  RoutingHealth,
  RoutingBudgetScopeUpdateRecord,
  SimulationFormState,
  SimulationResultState,
  SimulationScenario,
} from "./types";
import type {
  RoutingBudgetRecord,
  RoutingControlPlaneResponse,
  RoutingDecisionCandidateRecord,
  RoutingDecisionRecord,
  RoutingPolicyRecord,
} from "../../api/domain/routing";
import type { StatusTone } from "../../components/ui/StatusBadge";

/**
 * Convert snake_case or kebab-case to Title Case.
 * @param value - Raw identifier string.
 * @returns Human-readable title.
 */
export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Map routing health to a status-badge tone.
 * @param status - Aggregate health key.
 * @returns Matching StatusTone.
 */
export function toneForStatus(status: RoutingHealth): StatusTone {
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

/**
 * Human-readable next-step label for each health level.
 * @param status - Aggregate health key.
 * @returns Action-oriented label.
 */
export function nextStepLabel(status: RoutingHealth): string {
  switch (status) {
    case "blocked":
      return "Next: resolve blockers";
    case "degraded":
      return "Next: review degraded circuits and decisions";
    case "partial":
      return "Next: persist both policy classes";
    case "ready":
      return "Routing is healthy";
    default:
      return "Next: load routing state";
  }
}

/**
 * Badge tone for the next-step label.
 * @param status - Aggregate health key.
 * @returns StatusTone for the next-step bar.
 */
export function nextStepTone(status: RoutingHealth): StatusTone {
  switch (status) {
    case "blocked":
      return "danger";
    case "degraded":
      return "warning";
    case "partial":
      return "warning";
    case "ready":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Join a string array or return "none".
 * @param value - Array of strings.
 * @returns Comma-joined string.
 */
export function listValue(value: string[]): string {
  return value.length > 0 ? value.join(", ") : "none";
}

/**
 * Parse a comma-separated target key string into a clean array.
 * @param value - Raw comma-separated input.
 * @returns Trimmed non-empty strings.
 */
export function parseTargetKeyList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Pretty-print a value as indented JSON.
 * @param value - Any serializable value.
 * @returns Formatted JSON string.
 */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Parse a JSON string into budget-scope update records.
 * @param value - Raw JSON string.
 * @returns Parsed scope array.
 * @throws If the value is not a valid JSON array.
 */
export function parseBudgetScopesJson(value: string): RoutingBudgetScopeUpdateRecord[] {
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

/**
 * Make budget scopes writable (strip read-only fields).
 * @param scopes - Source scopes from the API or draft.
 * @returns Mutable scope records.
 */
export function writableBudgetScopes(
  scopes: Array<RoutingBudgetScopeUpdateRecord | RoutingBudgetRecord["scopes"][number]>,
): RoutingBudgetScopeUpdateRecord[] {
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

/**
 * Convert a full policy record into an editable draft.
 * @param policy - Source policy.
 * @returns Mutable policy draft.
 */
export function toPolicyDraft(policy: RoutingPolicyRecord): PolicyDraft {
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

/**
 * Build a default simulation form for the given instance.
 * @param instanceId - Active instance ID (nullable).
 * @returns Default form state.
 */
export function defaultSimulationForm(instanceId: string | null): SimulationFormState {
  return {
    scenario: "simple",
    prompt: "Summarize the current provider health in two short sentences.",
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

/**
 * Apply a simulation scenario preset, preserving existing form values where possible.
 * @param current - Current form state.
 * @param scenario - Target scenario.
 * @param instanceId - Active instance ID.
 * @returns Updated form state.
 */
export function applySimulationScenario(
  current: SimulationFormState,
  scenario: SimulationScenario,
  instanceId: string | null,
): SimulationFormState {
  if (scenario === "non_simple") {
    return {
      ...current,
      scenario,
      prompt: current.scenario === scenario ? current.prompt : "Plan a multi-step failover, include tool-backed verification, and keep operator notes.",
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
    prompt: current.scenario === scenario ? current.prompt : "Summarize the current provider health in two short sentences.",
    budgetScopeType: current.budgetScopeType,
    budgetScopeKey: current.budgetScopeType === "instance" ? (instanceId ?? current.budgetScopeKey) : current.budgetScopeKey,
    requireToolCalling: false,
    requireVision: false,
    maxOutputTokens: "256",
    expectedLane: "sync_interactive",
  };
}

/**
 * Derive the aggregate routing health from a control-plane snapshot.
 * @param snapshot - Current routing state (nullable).
 * @returns Health level.
 */
export function liveStatus(snapshot: RoutingControlPlaneResponse | null): RoutingHealth {
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

/**
 * Build the list of active routing blockers.
 * @param snapshot - Current routing state (nullable).
 * @returns Human-readable blocker descriptions.
 */
export function routingBlockers(snapshot: RoutingControlPlaneResponse | null): string[] {
  if (!snapshot) {
    return ["Routing control plane has not been loaded yet."];
  }
  const blockers: string[] = [];
  const openCircuits = snapshot.circuits.filter((circuit) => circuit.state === "open");
  const blockedDecisions = snapshot.recent_decisions.filter((decision) => Boolean(decision.error_type));
  const readyTargets = snapshot.targets.filter(
    (target) => target.enabled && target.runtime_ready && target.readiness_status === "ready",
  );
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

/**
 * Safely cast a value to a record.
 * @param value - Unknown value.
 * @returns Record or null.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Safely cast a value to a string array.
 * @param value - Unknown value.
 * @returns Array of strings.
 */
export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

/**
 * Extract the selection-basis record from a decision.
 * @param decision - Routing decision (optional).
 * @returns Selection basis map.
 */
export function selectionBasis(decision: RoutingDecisionRecord | undefined): Record<string, unknown> {
  if (!decision) {
    return {};
  }
  return asRecord(decision.raw_details.selection_basis) ?? {};
}

/**
 * Extract the selected candidate from a decision.
 * @param decision - Routing decision (optional).
 * @returns Selected candidate or null.
 */
export function selectedCandidate(decision: RoutingDecisionRecord | undefined): RoutingDecisionCandidateRecord | null {
  if (!decision) {
    return null;
  }
  return decision.candidates.find((candidate) => candidate.selected) ?? null;
}

/**
 * Extract rejected candidates with reasons from a decision.
 * @param decision - Routing decision (optional).
 * @returns Rejected candidates with non-empty exclusion reasons.
 */
export function rejectedCandidates(decision: RoutingDecisionRecord | undefined): RoutingDecisionCandidateRecord[] {
  if (!decision) {
    return [];
  }
  return decision.candidates.filter(
    (candidate) => candidate.selected === false && candidate.exclusion_reasons.length > 0,
  );
}

/**
 * Human-readable label for the simulation scenario.
 * @param form - Current simulation form.
 * @returns Label string.
 */
export function requestedScenarioLabel(form: SimulationFormState): string {
  return form.scenario === "simple" ? "Simple request class" : "Non-simple request class";
}

/**
 * Describe expected-vs-actual lane match.
 * @param form - Simulation form with expected lane.
 * @param decision - Simulation decision (optional).
 * @returns Human-readable match description.
 */
export function laneMatchLabel(
  form: SimulationFormState,
  decision: RoutingDecisionRecord | undefined,
): string {
  if (!decision || form.expectedLane === "either") {
    return "No expected lane check";
  }
  return form.expectedLane === decision.execution_lane
    ? `Expected lane matched: ${decision.execution_lane}`
    : `Expected ${form.expectedLane}, actual ${decision.execution_lane}`;
}

/**
 * Build simulation messages array from form state.
 * @param form - Simulation form.
 * @returns Array of message-like objects.
 */
export function buildSimulationMessages(form: SimulationFormState): Array<Record<string, unknown>> {
  if (form.scenario === "non_simple") {
    return [
      { role: "system", content: "Operator simulation for a multi-step request." },
      { role: "user", content: form.prompt.trim() || "Plan a multi-step failover, include tool-backed verification, and keep operator notes." },
    ];
  }
  return [{ role: "user", content: form.prompt.trim() || "Summarize the current provider health in two short sentences." }];
}

/**
 * Build a route-context override object from the simulation form.
 * @param form - Simulation form.
 * @param instanceId - Active instance ID.
 * @returns Context object or undefined.
 */
export function buildSimulationRouteContext(
  form: SimulationFormState,
  instanceId: string | null,
): Record<string, string> | undefined {
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

/**
 * Summarize a simulation result into a one-liner.
 * @param run - Simulation result (optional).
 * @returns Short summary string.
 */
export function simulationSummary(run: SimulationResultState | undefined): string {
  if (!run?.decision) {
    return run?.error ? `${run.error.type}: ${run.error.message}` : "No simulation recorded yet.";
  }
  return `${run.decision.selected_target_key ?? "no target"} on ${run.decision.policy_stage} / ${run.decision.execution_lane}`;
}
