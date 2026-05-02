import type {
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
  SkillUsageOutcome,
} from "../../api/domain";

/**
 * Filter controls for the skills list view.
 */
export interface SkillFilters {
  statusFilter: SkillStatus | "all";
  scopeFilter: SkillScope | "all";
}

/**
 * Provenance form values for skill creation and editing.
 */
export interface ProvenanceForm {
  originKind: SkillProvenanceKind;
  learningEventId: string;
  memoryId: string;
  sourceId: string;
  pluginName: string;
  note: string;
  extraJson: string;
}

/**
 * Activation settings form values for skill activation conditions.
 */
export interface ActivationSettingsForm {
  previewRequired: boolean;
  channelHint: string;
  note: string;
  extraJson: string;
}

/**
 * Create skill form values.
 */
export interface CreateSkillForm {
  skillId: string;
  displayName: string;
  summary: string;
  scope: SkillScope;
  scopeAgentId: string;
  status: SkillStatus;
  instructionCore: string;
  provenance: ProvenanceForm;
  activationSettings: ActivationSettingsForm;
  metadataJson: string;
}

/**
 * Edit skill form values.
 */
export interface EditSkillForm {
  displayName: string;
  summary: string;
  scope: SkillScope;
  scopeAgentId: string;
  status: SkillStatus;
  instructionCore: string;
  provenance: ProvenanceForm;
  activationSettings: ActivationSettingsForm;
  metadataJson: string;
}

/**
 * Activation form values for activating a skill version.
 */
export interface ActivationForm {
  versionId: string;
  scope: SkillScope;
  scopeAgentId: string;
  settings: ActivationSettingsForm;
  metadataJson: string;
}

/**
 * Usage form values for recording skill usage telemetry.
 */
export interface UsageForm {
  versionId: string;
  activationId: string;
  agentId: string;
  runId: string;
  conversationId: string;
  outcome: SkillUsageOutcome;
  decision: string;
  note: string;
  detailsJson: string;
}

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (SkillStatus | "all")[] = [
  "all", "draft", "review", "active", "archived",
] as const;

/** Status options available at skill creation time. */
export const CREATE_STATUS_OPTIONS: readonly SkillStatus[] = [
  "draft", "review",
] as const;

/** Status options that can be set via editing. */
export const MUTABLE_STATUS_OPTIONS: readonly SkillStatus[] = [
  "draft", "review", "active",
] as const;

/** Scope filter options including "all". */
export const SCOPE_OPTIONS: readonly (SkillScope | "all")[] = [
  "all", "instance", "agent",
] as const;

/** Usage outcome option values. */
export const USAGE_OUTCOME_OPTIONS: readonly SkillUsageOutcome[] = [
  "success", "blocked", "error",
] as const;

/** Provenance origin kind option values. */
export const PROVENANCE_KIND_OPTIONS: readonly SkillProvenanceKind[] = [
  "operator", "learning", "memory", "knowledge_source", "plugin", "unknown",
] as const;

/** Default empty provenance form. */
export const DEFAULT_PROVENANCE_FORM: ProvenanceForm = {
  originKind: "operator",
  learningEventId: "",
  memoryId: "",
  sourceId: "",
  pluginName: "",
  note: "",
  extraJson: "{}",
};

/** Default empty activation settings form. */
export const DEFAULT_ACTIVATION_SETTINGS: ActivationSettingsForm = {
  previewRequired: false,
  channelHint: "",
  note: "",
  extraJson: "{}",
};

/** Default empty create skill form. */
export const DEFAULT_CREATE_FORM: CreateSkillForm = {
  skillId: "",
  displayName: "",
  summary: "",
  scope: "instance",
  scopeAgentId: "",
  status: "draft",
  instructionCore: "",
  provenance: DEFAULT_PROVENANCE_FORM,
  activationSettings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

/** Default empty edit skill form. */
export const DEFAULT_EDIT_FORM: EditSkillForm = {
  displayName: "",
  summary: "",
  scope: "instance",
  scopeAgentId: "",
  status: "draft",
  instructionCore: "",
  provenance: DEFAULT_PROVENANCE_FORM,
  activationSettings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

/** Default empty activation form. */
export const DEFAULT_ACTIVATION_FORM: ActivationForm = {
  versionId: "",
  scope: "instance",
  scopeAgentId: "",
  settings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

/** Default empty usage form. */
export const DEFAULT_USAGE_FORM: UsageForm = {
  versionId: "",
  activationId: "",
  agentId: "",
  runId: "",
  conversationId: "",
  outcome: "success",
  decision: "",
  note: "",
  detailsJson: "{}",
};
