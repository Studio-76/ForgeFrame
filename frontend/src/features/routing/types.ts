import type {
  RoutingBudgetRecord,
  RoutingBudgetScopeUpdateRecord,
  RoutingCircuitRecord,
  RoutingControlPlaneResponse,
  RoutingDecisionCandidateRecord,
  RoutingDecisionRecord,
  RoutingPolicyRecord,
} from "../../api/domain/routing";

export type {
  RoutingBudgetRecord,
  RoutingBudgetScopeUpdateRecord,
  RoutingCircuitRecord,
  RoutingControlPlaneResponse,
  RoutingDecisionCandidateRecord,
  RoutingDecisionRecord,
  RoutingPolicyRecord,
};

/** Load states used across the routing page. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Simulation scenario classification. */
export type SimulationScenario = "simple" | "non_simple";

/** Request path policy overrides. */
export type RequestPathPolicy =
  | "smart_routing"
  | "queue_background"
  | "local_only"
  | "pinned_target";

/** Editable policy draft fields. */
export type PolicyDraft = {
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

/** Form state for the dry-run simulation. */
export type SimulationFormState = {
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

/** Persisted result from a dry-run simulation. */
export type SimulationResultState = {
  status: string;
  decision?: RoutingDecisionRecord;
  error?: { type: string; message: string };
  form: SimulationFormState;
};

/** Budget draft editor state. */
export type BudgetDraftState = {
  hard_blocked: boolean;
  blocked_cost_classes: string;
  reason: string;
  scopes_json: string;
};

/** Aggregate status derived from the control-plane snapshot. */
export type RoutingHealth = "ready" | "partial" | "degraded" | "blocked";

/** Collapse-section open state keys. */
export type SectionKey = "policy" | "budget" | "simulation" | "decisions";
