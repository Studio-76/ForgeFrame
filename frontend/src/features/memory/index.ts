/**
 * Memory feature module — decomposed components for memory governance workflow.
 *
 * @packageDocumentation
 */

export { MemorySummaryHero } from "./MemorySummaryHero";
export type { MemorySummaryHeroProps } from "./MemorySummaryHero";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { MemoryFilterBar } from "./MemoryFilterBar";
export type { MemoryFilterBarProps } from "./MemoryFilterBar";

export { MemoryList } from "./MemoryList";
export type { MemoryListProps } from "./MemoryList";

export { MemoryDetailPanel } from "./MemoryDetailPanel";
export type { MemoryDetailPanelProps } from "./MemoryDetailPanel";

export { CreateMemoryForm } from "./CreateMemoryForm";
export type { CreateMemoryFormProps } from "./CreateMemoryForm";

export { GovernanceActions } from "./GovernanceActions";
export type { GovernanceActionsProps } from "./GovernanceActions";

export { MemoryLifecycle } from "./MemoryLifecycle";

export { useMemoryPage } from "./hooks";
export type { UseMemoryPageReturn } from "./hooks";

export type { LoadState, MemoryCategoryKey, MemoryCategory } from "./types";

export {
  MEMORY_CATEGORIES,
  MEMORY_LAYER_LABELS,
  MEMORY_KIND_LABELS,
  VISIBILITY_LABELS,
  SENSITIVITY_LABELS,
  TRUST_LABELS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  MEMORY_KIND_OPTIONS,
  SENSITIVITY_OPTIONS,
  MEMORY_LAYER_OPTIONS,
  SOURCE_TRUST_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_CORRECTION_FORM,
  DEFAULT_DELETE_FORM,
  DEFAULT_REVOKE_FORM,
} from "./types";

export {
  formatTimestamp,
  normalizeOptional,
  isRetiredMemory,
  classifyMemory,
  usageSummary,
  splitMemoryMetadata,
  buildMemoryMetadata,
  validateMemoryGovernance,
  lifecycleTone,
  reviewTone,
  buildInventoryPath,
  buildSkillPath,
} from "./utils";
