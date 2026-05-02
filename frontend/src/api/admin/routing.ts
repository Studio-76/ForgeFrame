/**
 * Routing management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type ProviderTargetRecord,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Routing types
// ---------------------------------------------------------------------------

/** Routing policy record. */
export type RoutingPolicyRecord = {
  classification: "simple" | "non_simple";
  display_name: string;
  description: string;
  execution_lane: "sync_interactive" | "queued_background";
  prefer_local: boolean;
  prefer_low_latency: boolean;
  allow_premium: boolean;
  allow_fallback: boolean;
  allow_escalation: boolean;
  require_queue_eligible: boolean;
  preferred_target_keys: string[];
  fallback_target_keys: string[];
  escalation_target_keys: string[];
};

/** Routing budget record. */
export type RoutingBudgetRecord = {
  hard_blocked: boolean;
  blocked_cost_classes: string[];
  reason?: string | null;
  updated_at?: string | null;
  scopes: RoutingBudgetScopeRecord[];
  anomalies: RoutingBudgetAnomalyRecord[];
  last_evaluated_at?: string | null;
};

/** Routing budget scope record. */
export type RoutingBudgetScopeRecord = {
  scope_type: "instance" | "agent" | "task";
  scope_key: string;
  window: "1h" | "24h" | "7d" | "30d";
  enabled: boolean;
  soft_cost_limit?: number | null;
  hard_cost_limit?: number | null;
  soft_token_limit?: number | null;
  hard_token_limit?: number | null;
  soft_blocked_cost_classes: string[];
  note?: string | null;
  observed_cost?: number;
  observed_tokens?: number;
  previous_window_cost?: number | null;
  previous_window_tokens?: number | null;
  soft_limit_exceeded: boolean;
  hard_limit_exceeded: boolean;
  last_evaluated_at?: string | null;
};

/** Routing budget anomaly record. */
export type RoutingBudgetAnomalyRecord = {
  scope_type: "instance" | "agent" | "task";
  scope_key: string;
  window: "1h" | "24h" | "7d" | "30d";
  anomaly_type: "soft_limit_exceeded" | "hard_limit_exceeded" | "cost_spike" | "token_spike";
  severity: "warning" | "critical";
  observed_cost?: number;
  observed_tokens?: number;
  threshold_cost?: number | null;
  threshold_tokens?: number | null;
  details: Record<string, unknown>;
  detected_at: string;
};

/** Routing budget scope update payload. */
export type RoutingBudgetScopeUpdateRecord = {
  scope_type: "instance" | "agent" | "task";
  scope_key: string;
  window: "1h" | "24h" | "7d" | "30d";
  enabled: boolean;
  soft_cost_limit?: number | null;
  hard_cost_limit?: number | null;
  soft_token_limit?: number | null;
  hard_token_limit?: number | null;
  soft_blocked_cost_classes: string[];
  note?: string | null;
};

/** Routing budget update payload. */
export type RoutingBudgetUpdatePayload = Partial<
  Pick<RoutingBudgetRecord, "hard_blocked" | "blocked_cost_classes" | "reason">
> & {
  scopes?: RoutingBudgetScopeUpdateRecord[];
};

/** Routing circuit breaker record. */
export type RoutingCircuitRecord = {
  target_key: string;
  state: "closed" | "open";
  reason?: string | null;
  updated_at?: string | null;
};

/** Routing decision candidate record. */
export type RoutingDecisionCandidateRecord = {
  target_key: string;
  provider: string;
  model_id: string;
  label: string;
  stage_eligible: boolean;
  selected: boolean;
  priority: number;
  cost_class: string;
  latency_class: string;
  availability_status: string;
  health_status: string;
  queue_eligible: boolean;
  capability_match: boolean;
  exclusion_reasons: string[];
  selection_reasons: string[];
};

/** Routing decision record. */
export type RoutingDecisionRecord = {
  decision_id: string;
  source: "runtime_dispatch" | "admin_simulation";
  instance_id: string;
  requested_model?: string | null;
  selected_target_key?: string | null;
  classification: "simple" | "non_simple";
  classification_summary: string;
  classification_rules: string[];
  policy_stage: string;
  execution_lane: string;
  summary: string;
  structured_details: Record<string, unknown>;
  raw_details: Record<string, unknown>;
  candidates: RoutingDecisionCandidateRecord[];
  error_type?: string | null;
  created_at: string;
};

/** Routing control-plane response. */
export type RoutingControlPlaneResponse = {
  status: "ok";
  object: "routing_control_plane";
  instance?: InstanceRecord;
  policies: RoutingPolicyRecord[];
  budget: RoutingBudgetRecord;
  circuits: RoutingCircuitRecord[];
  targets: ProviderTargetRecord[];
  recent_decisions: RoutingDecisionRecord[];
  summary: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Routing API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the routing control-plane data.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Routing control-plane response.
 */
export function fetchRoutingControlPlane(instanceId?: string | null): Promise<RoutingControlPlaneResponse> {
  return fetchJson<RoutingControlPlaneResponse>(appendTenantScope("/admin/routing/", undefined, instanceId));
}

/**
 * Update a routing policy.
 * @param classification - Policy classification (simple or non_simple).
 * @param payload - Policy fields to update.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated policy.
 */
export function updateRoutingPolicy(
  classification: "simple" | "non_simple",
  payload: Partial<RoutingPolicyRecord>,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; policy: RoutingPolicyRecord }>(
    appendTenantScope(`/admin/routing/policies/${classification}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update the routing budget.
 * @param payload - Budget update payload.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated budget.
 */
export function updateRoutingBudget(
  payload: RoutingBudgetUpdatePayload,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; budget: RoutingBudgetRecord }>(
    appendTenantScope("/admin/routing/budget", undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update a routing circuit breaker.
 * @param targetKey - The target key for the circuit.
 * @param payload - New circuit state and optional reason.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the updated circuit.
 */
export function updateRoutingCircuit(
  targetKey: string,
  payload: Pick<RoutingCircuitRecord, "state" | "reason">,
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; circuit: RoutingCircuitRecord }>(
    appendTenantScope(`/admin/routing/circuits/${encodeURIComponent(targetKey)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Simulate a routing decision for a given request.
 * @param payload - Simulation parameters.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the routing decision or error.
 */
export function simulateRouting(
  payload: {
    requested_model?: string | null;
    prompt?: string | null;
    messages?: Array<Record<string, unknown>>;
    stream?: boolean;
    tools?: Array<Record<string, unknown>>;
    require_vision?: boolean;
    max_output_tokens?: number | null;
    allowed_providers?: string[];
    route_context?: Record<string, string>;
  },
  instanceId?: string | null,
) {
  return fetchJson<{ status: string; decision?: RoutingDecisionRecord; error?: { type: string; message: string } }>(
    appendTenantScope("/admin/routing/simulate", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
