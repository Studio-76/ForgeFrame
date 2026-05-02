/**
 * Routing domain API surface extracted from admin API.
 */
export {
  fetchRoutingControlPlane,
  simulateRouting,
  updateRoutingBudget,
  updateRoutingCircuit,
  updateRoutingPolicy,
  type RoutingBudgetAnomalyRecord,
  type RoutingBudgetRecord,
  type RoutingBudgetScopeRecord,
  type RoutingBudgetScopeUpdateRecord,
  type RoutingBudgetUpdatePayload,
  type RoutingCircuitRecord,
  type RoutingControlPlaneResponse,
  type RoutingDecisionCandidateRecord,
  type RoutingDecisionRecord,
  type RoutingPolicyRecord,
} from "../admin/routing";
