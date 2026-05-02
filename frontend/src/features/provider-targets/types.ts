import type { ProviderTargetRecord } from "../../api/domain/providers";

export type { ProviderTargetRecord };

/** Load states used across the provider targets page. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Primary status classification for a provider target. */
export type PrimaryTargetStatus =
  | "runtime-ready"
  | "ready"
  | "degraded"
  | "partial"
  | "blocked"
  | "disabled"
  | "bridge-only"
  | "unsupported";

/** Capability filter options. */
export type CapabilityFilter = "all" | "streaming" | "tool_calling" | "vision" | "queue_eligible";

/** Target status filter options. */
export type TargetStatusFilter = PrimaryTargetStatus | "all";

/** Editable target policy draft. */
export type TargetDraft = {
  enabled: boolean;
  priority: string;
  queueEligible: boolean;
  fallbackAllowed: boolean;
  fallbackTargetKeys: string[];
  escalationAllowed: boolean;
  escalationTargetKeys: string[];
  acknowledgeDefaultRisk: boolean;
};

/** Readiness summary computed from the full target list. */
export type ReadinessSummary = {
  totalTargets: number;
  runtimeReadyCount: number;
  enabledCount: number;
  primaryBlocker: string | null;
  nextAction: string | null;
};

/** Next-action descriptor for a non-ready target. */
export type TargetNextAction = {
  label: string;
  kind: "health-check" | "probe-config" | "enable-runtime" | "routing-policy" | "disable-placeholder" | "enable-target" | "none";
};
