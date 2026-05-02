/**
 * Constants, labels, and shared types for the Learning feature module.
 *
 * @packageDocumentation
 */

import type {
  LearningDecision,
  LearningDecisionLane,
  LearningReviewBucket,
  LearningRiskLevel,
  LearningStatus,
  LearningTriggerKind,
} from "../../api/domain/learning";
import type {
  MemoryKind,
  MemorySensitivity,
  MemorySourceTrustClass,
} from "../../api/domain/memory";
import type { SkillScope } from "../../api/domain/skills";
import type { VisibilityScope } from "../../api/domain/contacts";

export type {
  LearningDecision,
  LearningDecisionLane,
  LearningReviewBucket,
  LearningRiskLevel,
  LearningStatus,
  LearningTriggerKind,
};

/** Data loading state. */
export type LoadState = "idle" | "loading" | "success" | "error";

export const STATUS_OPTIONS: Array<LearningStatus | "all"> = [
  "all",
  "pending",
  "applied",
  "discarded",
  "review_required",
];

export const TRIGGER_OPTIONS: Array<LearningTriggerKind | "all"> = [
  "all",
  "run_completion",
  "session_rotation",
  "pattern_detected",
  "operator_action",
];

export const DECISION_OPTIONS: LearningDecision[] = [
  "history_only",
  "boot_memory",
  "durable_memory",
  "skill_draft",
  "review_required",
  "discard",
];

export const REVIEW_BUCKET_ORDER: LearningReviewBucket[] = [
  "suggested",
  "review_required",
  "approved_promoted",
  "rejected",
];

export const MEMORY_KIND_OPTIONS: MemoryKind[] = [
  "fact",
  "preference",
  "constraint",
  "summary",
];

export const MEMORY_VISIBILITY_OPTIONS: VisibilityScope[] = [
  "instance",
  "team",
  "personal",
  "restricted",
];

export const MEMORY_SENSITIVITY_OPTIONS: MemorySensitivity[] = [
  "normal",
  "sensitive",
  "restricted",
];

export const MEMORY_TRUST_OPTIONS: MemorySourceTrustClass[] = [
  "human_verified",
  "runtime_inferred",
  "external_unverified",
];

export const SKILL_SCOPE_OPTIONS: SkillScope[] = ["instance", "agent"];

/** Human-readable labels for each learning decision. */
export const DECISION_LABELS: Record<LearningDecision, string> = {
  history_only: "Approve as history only",
  boot_memory: "Promote to boot memory",
  durable_memory: "Promote to durable memory",
  skill_draft: "Promote to skill draft",
  review_required: "Require human review",
  discard: "Reject learning event",
};

/** Explanatory help text for each learning decision. */
export const DECISION_HELP: Record<LearningDecision, string> = {
  history_only:
    "Record the review outcome without creating persistent memory or skill state.",
  boot_memory:
    "Create startup-facing memory that remains linked to the learning event.",
  durable_memory:
    "Promote the finding into long-term durable memory truth.",
  skill_draft:
    "Create a draft skill so operators can refine reusable behavior.",
  review_required:
    "Keep the event open for later review without promotion.",
  discard: "Reject the event and archive the suggestion.",
};

/** Human-readable labels for each review bucket. */
export const REVIEW_BUCKET_LABELS: Record<LearningReviewBucket, string> = {
  suggested: "Suggested",
  review_required: "Needs review",
  approved_promoted: "Promoted",
  rejected: "Rejected",
};

/** Default create form state. */
export const DEFAULT_CREATE_FORM = {
  triggerKind: "operator_action" as LearningTriggerKind,
  summary: "",
  explanation: "",
  suggestedDecision: "review_required" as LearningDecision,
  agentId: "",
  runId: "",
  conversationId: "",
  evidenceNote: "",
  evidenceSourceRef: "",
  memoryKind: "summary" as MemoryKind,
  memoryTitle: "",
  memoryBody: "",
  memoryVisibility: "team" as VisibilityScope,
  memorySensitivity: "normal" as MemorySensitivity,
  memoryTrust: "runtime_inferred" as MemorySourceTrustClass,
  memoryReviewAt: "",
  memoryReviewNote: "",
  skillDisplayName: "",
  skillSummary: "",
  skillScope: "instance" as SkillScope,
  skillScopeAgentId: "",
  skillInstructionCore: "",
};

/** Default decide form state. */
export const DEFAULT_DECIDE_FORM = {
  decision: "review_required" as LearningDecision,
  decisionNote: "",
  humanOverride: false,
  memoryKind: "summary" as MemoryKind,
  memoryTitle: "",
  memoryBody: "",
  memoryVisibility: "team" as VisibilityScope,
  memorySensitivity: "normal" as MemorySensitivity,
  memoryTrust: "runtime_inferred" as MemorySourceTrustClass,
  memoryReviewAt: "",
  memoryReviewNote: "",
  skillDisplayName: "",
  skillSummary: "",
  skillScope: "instance" as SkillScope,
  skillScopeAgentId: "",
  skillInstructionCore: "",
};
