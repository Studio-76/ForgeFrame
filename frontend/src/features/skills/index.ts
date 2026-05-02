/**
 * Skills feature module — redesigned skill lifecycle management.
 *
 * Provides a summary hero, empty state, compact filter bar, registry table,
 * guided creation flow, and a detail panel with lifecycle actions.
 *
 * @packageDocumentation
 */

export { SkillsSummaryHero } from "./SkillsSummaryHero";
export type { SkillsSummaryHeroProps } from "./SkillsSummaryHero";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { SkillFilters } from "./SkillFilters";
export type { SkillFiltersProps } from "./SkillFilters";

export { SkillTable } from "./SkillTable";
export type { SkillTableProps } from "./SkillTable";

export { CreateSkillPanel } from "./CreateSkillPanel";
export type { CreateSkillPanelProps } from "./CreateSkillPanel";

export { SkillDetailPanel } from "./SkillDetailPanel";
export type { SkillDetailPanelProps } from "./SkillDetailPanel";

export { useSkills } from "./useSkills";
export type { UseSkillsReturn, SkillSummaryCounts } from "./useSkills";

export type {
  CreateSkillForm,
  EditSkillForm,
  ProvenanceForm,
  ActivationSettingsForm,
  ActivationForm,
  UsageForm,
} from "./types";

export {
  STATUS_OPTIONS,
  CREATE_STATUS_OPTIONS,
  MUTABLE_STATUS_OPTIONS,
  SCOPE_OPTIONS,
  USAGE_OUTCOME_OPTIONS,
  PROVENANCE_KIND_OPTIONS,
  STATUS_LABELS,
  SCOPE_LABELS,
  PROVENANCE_LABELS,
  OUTCOME_LABELS,
  APPROVAL_LABELS,
  DEFAULT_PROVENANCE_FORM,
  DEFAULT_ACTIVATION_SETTINGS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_ACTIVATION_FORM,
  DEFAULT_USAGE_FORM,
} from "./types";

export {
  formatTimestamp,
  normalizeText,
  buildInventoryPath,
  buildSkillPath,
  buildRunPath,
  statusLabel,
  scopeLabel,
  provenanceKindLabel,
  outcomeLabel,
  previewLabel,
  approvalLabel,
  statusTone,
  outcomeTone,
  provenanceTone,
  scopeNeedsAgent,
  getLabeledAgent,
  activationLabel,
  splitObject,
  splitProvenanceForm,
  buildProvenancePayload,
  splitActivationSettings,
  buildActivationConditions,
  buildUsageDetails,
  validateScopedAgent,
} from "./utils";
