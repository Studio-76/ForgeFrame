/**
 * Knowledge Sources feature module — redesigned lifecycle management UX.
 *
 * Provides a summary hero, empty state, compact filter bar, inventory table,
 * guided creation flow, and a detail panel with sync diagnostics, recall
 * information, linked entities, and explicit edit controls.
 *
 * @packageDocumentation
 */

export { KnowledgeSourcesSummaryHero } from "./KnowledgeSourcesSummaryHero";
export type { KnowledgeSourcesSummaryHeroProps } from "./KnowledgeSourcesSummaryHero";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { KnowledgeSourceFilters } from "./KnowledgeSourceFilters";
export type { KnowledgeSourceFiltersProps } from "./KnowledgeSourceFilters";

export { KnowledgeSourceTable } from "./KnowledgeSourceTable";
export type { KnowledgeSourceTableProps } from "./KnowledgeSourceTable";

export { KnowledgeSourceDetailPanel } from "./KnowledgeSourceDetailPanel";
export type { KnowledgeSourceDetailPanelProps } from "./KnowledgeSourceDetailPanel";

export { CreateKnowledgeSourcePanel } from "./CreateKnowledgeSourcePanel";
export type { CreateKnowledgeSourcePanelProps } from "./CreateKnowledgeSourcePanel";

export { useKnowledgeSources } from "./hooks";
export type { UseKnowledgeSourcesReturn } from "./hooks";

export type {
  CreateKnowledgeSourceForm,
  EditKnowledgeSourceForm,
  KnowledgeSourceSummaryCounts,
  SourceKindConfig,
} from "./types";

export {
  SOURCE_KIND_LABELS,
  STATUS_LABELS,
  VISIBILITY_LABELS,
  SOURCE_KIND_CONFIG,
  CREATE_STEP_LABELS,
  SOURCE_KIND_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_STRUCTURED_FIELDS,
} from "./types";

export {
  formatTimestamp,
  normalizeText,
  buildInventoryPath,
  buildSkillPath,
  buildContactPath,
  buildMemoryPath,
  buildConversationPath,
  statusTone,
  syncTone,
  splitSourceMetadata,
  buildSourceMetadata,
  computeSummaryCounts,
} from "./utils";
