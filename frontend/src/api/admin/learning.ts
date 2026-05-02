/**
 * Learning event API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type RecordLink,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Learning types
// ---------------------------------------------------------------------------

/** Learning trigger kind. */
export type LearningTriggerKind = "run_completion" | "session_rotation" | "pattern_detected" | "operator_action";
/** Learning decision. */
export type LearningDecision = "discard" | "history_only" | "boot_memory" | "durable_memory" | "skill_draft" | "review_required";
/** Learning status. */
export type LearningStatus = "pending" | "applied" | "discarded" | "review_required";
/** Learning review bucket. */
export type LearningReviewBucket = "suggested" | "review_required" | "approved_promoted" | "rejected";
/** Learning decision lane. */
export type LearningDecisionLane = "auto_reject" | "auto_draft" | "auto_suggest" | "review_required" | "auto_promote";
/** Learning risk level. */
export type LearningRiskLevel = "low" | "medium" | "high";
/** Learning proposal surface. */
export type LearningProposalSurface = "memory" | "skill" | "history" | "rejection" | "review";
/** Learning outcome surface. */
export type LearningOutcomeSurface = "pending" | "memory" | "skill" | "history" | "rejection" | "review";

/** Source summary for a learning event. */
export type LearningSourceSummary = {
  kind: string;
  label: string;
  detail?: string | null;
};

/** Proposal summary for a learning event. */
export type LearningProposalSummary = {
  target_kind: LearningDecision;
  target_label: string;
  surface: LearningProposalSurface;
  scope_label: string;
  content_summary: string;
  trust_label?: string | null;
};

/** Outcome summary for a learning event. */
export type LearningOutcomeSummary = {
  target_kind?: LearningDecision | null;
  target_label: string;
  surface: LearningOutcomeSurface;
  scope_label?: string | null;
};

/** Risk summary for a learning event. */
export type LearningRiskSummary = {
  level: LearningRiskLevel;
  reasons: string[];
};

/** Summary view of a learning event. */
export type LearningEventSummary = {
  learning_event_id: string;
  instance_id: string;
  company_id: string;
  trigger_kind: LearningTriggerKind;
  suggested_decision: LearningDecision;
  status: LearningStatus;
  summary: string;
  explanation: string;
  agent_id?: string | null;
  run_id?: string | null;
  conversation_id?: string | null;
  evidence: Record<string, unknown>;
  proposed_memory: Record<string, unknown>;
  proposed_skill: Record<string, unknown>;
  promoted_memory_id?: string | null;
  promoted_skill_id?: string | null;
  human_override: boolean;
  decision_note?: string | null;
  review_bucket: LearningReviewBucket;
  review_bucket_label: string;
  suggested_lane: LearningDecisionLane;
  suggested_lane_label: string;
  source: LearningSourceSummary;
  proposal: LearningProposalSummary;
  outcome: LearningOutcomeSummary;
  risk: LearningRiskSummary;
  created_at: string;
  decided_at?: string | null;
};

/** Detailed learning event view. */
export type LearningEventDetail = LearningEventSummary & {
  agent?: RecordLink | null;
  run?: RecordLink | null;
  conversation?: RecordLink | null;
  promoted_memory?: RecordLink | null;
  promoted_skill?: RecordLink | null;
};

// ---------------------------------------------------------------------------
// Learning API functions
// ---------------------------------------------------------------------------

/**
 * Fetch learning events for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, triggerKind, limit).
 * @returns Response with learning events list.
 */
export function fetchLearningEvents(
  instanceId?: string | null,
  filters: {
    status?: LearningStatus | "all";
    triggerKind?: LearningTriggerKind | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; events: LearningEventSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/learning", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      triggerKind: filters.triggerKind && filters.triggerKind !== "all" ? filters.triggerKind : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch learning event detail by ID.
 * @param eventId - The learning event ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with event detail.
 */
export function fetchLearningEventDetail(eventId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; event: LearningEventDetail }>(
    appendTenantScope(`/admin/learning/${encodeURIComponent(eventId)}`, undefined, instanceId),
  );
}

/**
 * Create a new learning event.
 * @param instanceId - The instance ID or null.
 * @param payload - Learning event parameters.
 * @returns Response with the created event.
 */
export function createLearningEvent(
  instanceId: string | null | undefined,
  payload: {
    trigger_kind: LearningTriggerKind;
    summary: string;
    explanation?: string;
    suggested_decision?: LearningDecision;
    agent_id?: string | null;
    run_id?: string | null;
    conversation_id?: string | null;
    evidence?: Record<string, unknown>;
    proposed_memory?: Record<string, unknown>;
    proposed_skill?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; event: LearningEventDetail }>(
    appendTenantScope("/admin/learning", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Scan for learning patterns.
 * @param instanceId - The instance ID or null.
 * @returns Response with discovered learning events.
 */
export function scanLearningPatterns(instanceId: string | null | undefined) {
  return fetchJson<{ status: string; events: LearningEventSummary[] }>(
    appendTenantScope("/admin/learning/pattern-scan", undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Decide on a learning event (accept/reject).
 * @param instanceId - The instance ID or null.
 * @param eventId - The learning event ID.
 * @param payload - Decision parameters.
 * @returns Response with the updated event.
 */
export function decideLearningEvent(
  instanceId: string | null | undefined,
  eventId: string,
  payload: {
    decision: LearningDecision;
    decision_note?: string | null;
    human_override?: boolean;
    memory_payload?: Record<string, unknown>;
    skill_payload?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; event: LearningEventDetail }>(
    appendTenantScope(`/admin/learning/${encodeURIComponent(eventId)}/decide`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
