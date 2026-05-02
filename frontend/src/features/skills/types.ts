import type {
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
  SkillUsageOutcome,
} from "../../api/domain";

/**
 * Create skill form values — simplified for a guided creation flow.
 */
export interface CreateSkillForm {
  /** Unique skill identifier (e.g. "skill_pricing_review"). */
  skillId: string;
  /** Human-readable display name. */
  displayName: string;
  /** One-line summary of what the skill does. */
  summary: string;
  /** Scope the skill applies to. */
  scope: SkillScope;
  /** Agent ID when scope is "agent". */
  scopeAgentId: string;
  /** Initial status (draft or review). */
  status: SkillStatus;
  /** The core instruction the skill executes. */
  instructionCore: string;
  /** Provenance information (collapsed by default). */
  provenance: ProvenanceForm;
  /** Activation policy settings (collapsed by default). */
  activationSettings: ActivationSettingsForm;
  /** Raw metadata JSON (advanced, collapsed by default). */
  metadataJson: string;
}

/**
 * Edit skill form values (mirrors create form without skillId).
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
 * Provenance origin form values.
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
 * Activation policy form values.
 */
export interface ActivationSettingsForm {
  previewRequired: boolean;
  channelHint: string;
  note: string;
  extraJson: string;
}

/**
 * Activation form values for the explicit activate action.
 */
export interface ActivationForm {
  versionId: string;
  scope: SkillScope;
  scopeAgentId: string;
  settings: ActivationSettingsForm;
  metadataJson: string;
}

/**
 * Usage event form for recording telemetry.
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

// ─── Constants ───────────────────────────────────────────────────────────────

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

/** Human-readable labels for skill status values. */
export const STATUS_LABELS: Record<SkillStatus | "all", string> = {
  all: "All statuses",
  draft: "Draft",
  review: "Pending review",
  active: "Active",
  archived: "Archived",
};

/** Human-readable labels for skill scope values. */
export const SCOPE_LABELS: Record<SkillScope | "all", string> = {
  all: "All scopes",
  instance: "Instance scope",
  agent: "Agent scope",
};

/** Human-readable labels for provenance kind values. */
export const PROVENANCE_LABELS: Record<SkillProvenanceKind, string> = {
  operator: "Created by operator",
  learning: "Promoted from learning",
  memory: "Derived from memory",
  knowledge_source: "Referenced from knowledge source",
  plugin: "Plugin-managed",
  unknown: "Unknown origin",
};

/** Human-readable labels for usage outcomes. */
export const OUTCOME_LABELS: Record<SkillUsageOutcome, string> = {
  success: "Success",
  blocked: "Blocked",
  error: "Error",
};

/** Human-readable labels for activation preview requirement. */
export const PREVIEW_LABELS: Record<string, string> = {
  true: "Preview required",
  false: "Preview not required",
};

/** Human-readable labels for approval posture. */
export const APPROVAL_LABELS: Record<string, string> = {
  draft: "Draft — not yet submitted for review",
  review_required: "Review required before activation",
  approved: "Approved and ready for activation",
  archived: "Archived — no longer in use",
};

// ─── Default form values ──────────────────────────────────────────────────────

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
