/**
 * Assistant Profiles feature types, constants, and default form values.
 *
 * @packageDocumentation
 */

import type {
  ActionPolicies,
  AssistantActionEvaluation,
  AssistantActionKind,
  AssistantActionMode,
  AssistantMemoryScope,
  AssistantProfileDetail,
  AssistantProfileScope,
  AssistantProfileStatus,
  AssistantProfileSummary,
  AssistantTone,
  CommunicationRules,
  DelegationRules,
  DeliveryPreferences,
  DirectActionPolicy,
  QuietHoursDay,
  QuietHoursSettings,
  RecordLink,
  WorkItemPriority,
} from "../../api/domain/assistant-profiles";

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------

/** Page view mode — only one form visible at a time. */
export type ViewMode = "browse" | "create" | "edit";

/** Evaluation modal visibility. */
export type EvaluationMode = "closed" | "open";

// ---------------------------------------------------------------------------
// Option constants
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS: Array<AssistantProfileStatus | "all"> = ["all", "active", "paused"];
export const PROFILE_SCOPE_OPTIONS: AssistantProfileScope[] = ["personal", "team"];
export const MEMORY_SCOPE_OPTIONS: AssistantMemoryScope[] = ["disabled", "personal", "team"];
export const TONE_OPTIONS: AssistantTone[] = ["neutral", "warm", "direct", "formal"];
export const DIRECT_ACTION_POLICY_OPTIONS: DirectActionPolicy[] = ["never", "preview_required", "approval_required", "allow"];
export const ACTION_MODE_OPTIONS: AssistantActionMode[] = ["suggest", "ask", "direct"];
export const ACTION_KIND_OPTIONS: AssistantActionKind[] = ["draft_message", "send_notification", "create_follow_up", "schedule_calendar", "delegate_follow_up"];
export const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
export const QUIET_DAY_OPTIONS: Array<{ value: QuietHoursDay; label: string }> = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];
export const POLICY_OVERRIDE_KEYS = new Set(["quiet_hours", "delivery_preferences", "action_policies", "delegation_rules"]);

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

export type YesNo = "yes" | "no";

export type PolicyOverrides = {
  quiet_hours?: Partial<QuietHoursSettings>;
  delivery_preferences?: Partial<DeliveryPreferences>;
  action_policies?: Partial<ActionPolicies>;
  delegation_rules?: Partial<DelegationRules>;
};

/** Full profile form state used for both create and edit. */
export type ProfileFormState = {
  assistantProfileId: string;
  displayName: string;
  summary: string;
  status: AssistantProfileStatus;
  assistantModeEnabled: YesNo;
  isDefault: YesNo;
  profileScope: AssistantProfileScope;
  memoryScope: AssistantMemoryScope;
  timezone: string;
  locale: string;
  tone: AssistantTone;
  preferredContactId: string;
  delegateContactId: string;
  escalationContactId: string;
  mailSourceId: string;
  calendarSourceId: string;
  primaryChannelId: string;
  fallbackChannelId: string;
  allowedChannelIds: string;
  directChannelIds: string;
  signature: string;
  styleNotes: string;
  quietHoursEnabled: YesNo;
  quietHoursTimezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursDays: QuietHoursDay[];
  allowPriorityOverride: YesNo;
  overrideMinPriority: WorkItemPriority;
  previewByDefault: YesNo;
  muteDuringQuietHours: YesNo;
  suggestionsEnabled: YesNo;
  questionsEnabled: YesNo;
  directActionPolicy: DirectActionPolicy;
  allowMailActions: YesNo;
  allowCalendarActions: YesNo;
  allowTaskActions: YesNo;
  requireApprovalReference: YesNo;
  allowExternalDelegation: YesNo;
  allowAutoFollowups: YesNo;
  preferencesJson: string;
  metadataJson: string;
  policyOverridesJson: string;
};

/** Evaluation form state. */
export type EvaluationFormState = {
  actionMode: AssistantActionMode;
  actionKind: AssistantActionKind;
  priority: WorkItemPriority;
  channelId: string;
  targetContactId: string;
  occurredAt: string;
  requiresExternalDelivery: YesNo;
  approvalReference: string;
  metadataJson: string;
};

// ---------------------------------------------------------------------------
// Editor section identifiers
// ---------------------------------------------------------------------------

export type EditorSection =
  | "identity"
  | "scope"
  | "contacts"
  | "quiet-hours"
  | "permissions"
  | "approval"
  | "advanced";

export const EDITOR_SECTIONS: Array<{ id: EditorSection; label: string; optional: boolean }> = [
  { id: "identity", label: "Identity and status", optional: false },
  { id: "scope", label: "Scope and memory", optional: false },
  { id: "contacts", label: "Contacts and channels", optional: false },
  { id: "quiet-hours", label: "Quiet hours", optional: false },
  { id: "permissions", label: "Action permissions", optional: false },
  { id: "approval", label: "Approval and policy rules", optional: false },
  { id: "advanced", label: "Advanced JSON", optional: true },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PROFILE_FORM: ProfileFormState = {
  assistantProfileId: "",
  displayName: "",
  summary: "",
  status: "active",
  assistantModeEnabled: "yes",
  isDefault: "no",
  profileScope: "personal",
  memoryScope: "personal",
  timezone: "UTC",
  locale: "en-US",
  tone: "neutral",
  preferredContactId: "",
  delegateContactId: "",
  escalationContactId: "",
  mailSourceId: "",
  calendarSourceId: "",
  primaryChannelId: "",
  fallbackChannelId: "",
  allowedChannelIds: "",
  directChannelIds: "",
  signature: "",
  styleNotes: "",
  quietHoursEnabled: "no",
  quietHoursTimezone: "UTC",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  quietHoursDays: ["mon", "tue", "wed", "thu", "fri"],
  allowPriorityOverride: "yes",
  overrideMinPriority: "critical",
  previewByDefault: "yes",
  muteDuringQuietHours: "yes",
  suggestionsEnabled: "yes",
  questionsEnabled: "yes",
  directActionPolicy: "preview_required",
  allowMailActions: "yes",
  allowCalendarActions: "no",
  allowTaskActions: "yes",
  requireApprovalReference: "yes",
  allowExternalDelegation: "no",
  allowAutoFollowups: "yes",
  preferencesJson: "{}",
  metadataJson: "{}",
  policyOverridesJson: "",
};

export const DEFAULT_EVALUATION_FORM: EvaluationFormState = {
  actionMode: "direct",
  actionKind: "send_notification",
  priority: "normal",
  channelId: "",
  targetContactId: "",
  occurredAt: "",
  requiresExternalDelivery: "yes",
  approvalReference: "",
  metadataJson: "{}",
};

// ---------------------------------------------------------------------------
// Permission matrix helpers
// ---------------------------------------------------------------------------

export type PermissionGroup = {
  id: string;
  label: string;
  description: string;
  fields: Array<{
    key: keyof ProfileFormState;
    label: string;
    warning?: string;
  }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "mail",
    label: "Mail actions",
    description: "Draft, send, and manage email on behalf of the profile owner.",
    fields: [{ key: "allowMailActions", label: "Mail actions" }],
  },
  {
    id: "calendar",
    label: "Calendar actions",
    description: "Schedule and modify calendar events.",
    fields: [{ key: "allowCalendarActions", label: "Calendar actions" }],
  },
  {
    id: "tasks",
    label: "Task actions",
    description: "Create and manage follow-up tasks.",
    fields: [{ key: "allowTaskActions", label: "Task actions" }],
  },
  {
    id: "delegation",
    label: "External delegation",
    description: "Allow delegation to external contacts outside the instance boundary.",
    fields: [{ key: "allowExternalDelegation", label: "External delegation", warning: "Permits outward delegation to unmanaged contacts." }],
  },
  {
    id: "followups",
    label: "Auto follow-ups",
    description: "Allow the assistant to automatically create follow-up items.",
    fields: [{ key: "allowAutoFollowups", label: "Auto follow-ups" }],
  },
  {
    id: "direct",
    label: "Direct actions",
    description: "Control how the assistant executes actions without preview.",
    fields: [{ key: "directActionPolicy", label: "Direct-action policy", warning: "Setting to 'allow' enables autonomous outward execution." }],
  },
];
