/**
 * Primary usability state for a model in the register.
 * Every model resolves to exactly one of these.
 */
export type ModelUsabilityState =
  | "ready"
  | "disabled"
  | "needs_verification"
  | "no_routable_target"
  | "declaration_only"
  | "degraded"
  | "placeholder";

/**
 * Recommended next action for an operator to take.
 */
export type ModelNextAction =
  | "enable_provider_target"
  | "run_verification"
  | "configure_routing"
  | "add_discovery_sync"
  | "review_provider"
  | "none";

/**
 * Filter group presets for the model list.
 */
export type ModelFilterKey =
  | "all"
  | "ready"
  | "needs_attention"
  | "disabled"
  | "no_routable_target"
  | "verification_failed"
  | "declaration_only";

/** Data-fetching lifecycle for model CRUD. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Sync-action lifecycle. */
export type SyncState = "idle" | "submitting" | "success" | "error";

/**
 * Runtime representation of a filter option.
 */
export interface FilterOption {
  readonly key: ModelFilterKey;
  readonly label: string;
  readonly description: string;
}

/**
 * All filter presets an operator may choose from.
 */
export const FILTER_OPTIONS: readonly FilterOption[] = [
  { key: "all", label: "All models", description: "Every model in the register" },
  { key: "ready", label: "Ready", description: "Routable and verified" },
  { key: "needs_attention", label: "Needs attention", description: "Blocked, degraded, or unverified" },
  { key: "disabled", label: "Disabled", description: "Manually disabled or removed" },
  { key: "no_routable_target", label: "No routable target", description: "Target exists but cannot route" },
  { key: "verification_failed", label: "Verification failed", description: "Provider checks failed" },
  { key: "declaration_only", label: "Declaration only", description: "No targets configured" },
] as const;

/**
 * Human-readable labels for usability states.
 */
export const USABILITY_LABELS: Record<ModelUsabilityState, string> = {
  ready: "Ready",
  disabled: "Disabled",
  needs_verification: "Needs verification",
  no_routable_target: "No routable target",
  declaration_only: "Declaration only",
  degraded: "Degraded",
  placeholder: "Placeholder",
};

/**
 * Human-readable labels for next actions.
 */
export const NEXT_ACTION_LABELS: Record<ModelNextAction, string> = {
  enable_provider_target: "Enable provider target",
  run_verification: "Run verification",
  configure_routing: "Configure routing",
  add_discovery_sync: "Add discovery sync",
  review_provider: "Review provider",
  none: "",
};

/**
 * Human-readable explanations for why a model is in a given state.
 */
export const USABILITY_EXPLANATIONS: Record<ModelUsabilityState, string> = {
  ready: "This model is routable and trusted. No action needed.",
  disabled: "This model has been manually disabled or removed from active routing.",
  needs_verification:
    "This model is routable but has not passed provider verification. Run verification to build trust.",
  no_routable_target:
    "Provider targets exist for this model but none are currently eligible for routing.",
  declaration_only:
    "This model exists in the provider catalog but has no instance-bound targets. Add targets before it can route traffic.",
  degraded:
    "This model is partially functional — some checks are failing or unavailable.",
  placeholder:
    "This is a generic harness placeholder model. Replace with a real provider model for production use.",
};
