/**
 * Assistant Profiles feature module.
 *
 * @packageDocumentation
 */

export { ProfileSummary } from "./ProfileSummary";
export type { ProfileSummaryProps } from "./ProfileSummary";
export { ProfileEmptyState } from "./ProfileEmptyState";
export type { ProfileEmptyStateProps } from "./ProfileEmptyState";
export { ProfileInventory } from "./ProfileInventory";
export type { ProfileInventoryProps } from "./ProfileInventory";
export { ProfileDetailPanel } from "./ProfileDetailPanel";
export type { ProfileDetailPanelProps } from "./ProfileDetailPanel";
export { SectionedEditor } from "./SectionedEditor";
export type { SectionedEditorProps } from "./SectionedEditor";
export { EvaluationModal } from "./EvaluationModal";
export type { EvaluationModalProps } from "./EvaluationModal";

export type {
  ProfileFormState,
  EvaluationFormState,
  ViewMode,
  EvaluationMode,
  YesNo,
  PolicyOverrides,
  PermissionGroup,
  EditorSection,
} from "./types";
export {
  STATUS_OPTIONS,
  PROFILE_SCOPE_OPTIONS,
  MEMORY_SCOPE_OPTIONS,
  TONE_OPTIONS,
  DIRECT_ACTION_POLICY_OPTIONS,
  ACTION_MODE_OPTIONS,
  ACTION_KIND_OPTIONS,
  PRIORITY_OPTIONS,
  QUIET_DAY_OPTIONS,
  DEFAULT_PROFILE_FORM,
  DEFAULT_EVALUATION_FORM,
  PERMISSION_GROUPS,
  EDITOR_SECTIONS,
} from "./types";

export {
  formatJson,
  buildProfilePayload,
  hydrateProfileForm,
  summarizeEvaluation,
  profileCountTone,
  directActionPolicyLabel,
} from "./utils";
