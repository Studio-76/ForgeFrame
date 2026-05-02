/**
 * Learning feature module — decomposed components for the learning review workflow.
 *
 * @packageDocumentation
 */

export { LearningSummaryHero } from "./LearningSummaryHero";
export type { LearningSummaryHeroProps } from "./LearningSummaryHero";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { LearningLifecycle } from "./LearningLifecycle";

export { EventList } from "./EventList";
export type { EventListProps } from "./EventList";

export { EventDetail } from "./EventDetail";
export type { EventDetailProps } from "./EventDetail";

export { DecisionForm } from "./DecisionForm";
export type { DecisionFormProps } from "./DecisionForm";

export { CreateManualForm } from "./CreateManualForm";
export type { CreateManualFormProps } from "./CreateManualForm";

export { useLearningPage } from "./hooks";
export type { UseLearningPageReturn } from "./hooks";

export type {
  LearningDecision,
  LearningDecisionLane,
  LearningReviewBucket,
  LearningRiskLevel,
  LearningStatus,
  LearningTriggerKind,
} from "./types";

export {
  STATUS_OPTIONS,
  TRIGGER_OPTIONS,
  DECISION_OPTIONS,
  REVIEW_BUCKET_ORDER,
  MEMORY_KIND_OPTIONS,
  MEMORY_VISIBILITY_OPTIONS,
  MEMORY_SENSITIVITY_OPTIONS,
  MEMORY_TRUST_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  DECISION_LABELS,
  DECISION_HELP,
  REVIEW_BUCKET_LABELS,
  DEFAULT_CREATE_FORM,
  DEFAULT_DECIDE_FORM,
} from "./types";

export {
  formatTimestamp,
  normalizeText,
  isMemoryDecision,
  isSkillDecision,
  bucketTone,
  laneTone,
  riskTone,
  describeOutcome,
  validateMemoryPromotion,
  evidenceEntries,
} from "./utils";
