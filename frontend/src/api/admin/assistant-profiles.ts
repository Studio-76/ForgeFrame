/**
 * Assistant profile management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type RecordLink,
  type WorkItemPriority,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { RecordLink, WorkItemPriority };

// ---------------------------------------------------------------------------
// Assistant profile types
// ---------------------------------------------------------------------------

/** Assistant profile lifecycle status. */
export type AssistantProfileStatus = "active" | "paused";
/** Assistant tone. */
export type AssistantTone = "neutral" | "warm" | "direct" | "formal";
/** Assistant profile scope. */
export type AssistantProfileScope = "personal" | "team";
/** Assistant memory scope. */
export type AssistantMemoryScope = "disabled" | "personal" | "team";
/** Quiet hours day. */
export type QuietHoursDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
/** Direct action policy. */
export type DirectActionPolicy = "never" | "preview_required" | "approval_required" | "allow";
/** Assistant action mode. */
export type AssistantActionMode = "suggest" | "ask" | "direct";
/** Assistant action kind. */
export type AssistantActionKind = "draft_message" | "send_notification" | "create_follow_up" | "schedule_calendar" | "delegate_follow_up";
/** Assistant action decision. */
export type AssistantActionDecision = "allow" | "requires_preview" | "requires_approval" | "blocked";
/** Assistant operating mode. */
export type AssistantOperatingMode =
  | "disabled"
  | "suggest_only"
  | "ask_first"
  | "advisory_only"
  | "preview_gated"
  | "approval_gated"
  | "direct_autonomous";
/** Assistant risk level. */
export type AssistantRiskLevel = "guarded" | "high";

/** Quiet hours settings. */
export type QuietHoursSettings = {
  enabled: boolean;
  timezone: string;
  start_minute: number;
  end_minute: number;
  days: QuietHoursDay[];
  allow_priority_override: boolean;
  override_min_priority: WorkItemPriority;
};

/** Delivery preferences. */
export type DeliveryPreferences = {
  primary_channel_id?: string | null;
  fallback_channel_id?: string | null;
  allowed_channel_ids: string[];
  preview_by_default: boolean;
  mute_during_quiet_hours: boolean;
};

/** Communication rules for the assistant. */
export type CommunicationRules = {
  tone: AssistantTone;
  locale: string;
  signature?: string | null;
  style_notes?: string | null;
};

/** Action policies for the assistant. */
export type ActionPolicies = {
  suggestions_enabled: boolean;
  questions_enabled: boolean;
  direct_action_policy: DirectActionPolicy;
  allow_mail_actions: boolean;
  allow_calendar_actions: boolean;
  allow_task_actions: boolean;
  require_approval_reference: boolean;
  direct_channel_ids: string[];
};

/** Delegation rules for the assistant. */
export type DelegationRules = {
  delegate_contact_id?: string | null;
  escalation_contact_id?: string | null;
  allow_external_delegation: boolean;
  allow_auto_followups: boolean;
};

/** Assistant profile risk warning. */
export type AssistantProfileRiskWarning = {
  level: AssistantRiskLevel;
  title: string;
  reasons: string[];
};

/** Assistant profile summary. */
export type AssistantProfileSummary = {
  assistant_profile_id: string;
  instance_id: string;
  company_id: string;
  display_name: string;
  summary: string;
  status: AssistantProfileStatus;
  assistant_mode_enabled: boolean;
  is_default: boolean;
  timezone: string;
  locale: string;
  tone: AssistantTone;
  preferred_contact_id?: string | null;
  primary_channel_id?: string | null;
  fallback_channel_id?: string | null;
  mail_source_id?: string | null;
  calendar_source_id?: string | null;
  profile_scope: AssistantProfileScope;
  profile_scope_label: string;
  memory_scope: AssistantMemoryScope;
  memory_scope_label: string;
  operating_mode: AssistantOperatingMode;
  operating_mode_label: string;
  quiet_hours_summary: string;
  direct_action_policy: DirectActionPolicy;
  direct_action_policy_label: string;
  last_evaluation?: AssistantActionEvaluation | null;
  risk_warning?: AssistantProfileRiskWarning | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Assistant action evaluation. */
export type AssistantActionEvaluation = {
  assistant_profile_id: string;
  decision: AssistantActionDecision;
  action_mode: AssistantActionMode;
  action_kind: AssistantActionKind;
  priority: WorkItemPriority;
  evaluated_at: string;
  effective_channel_id?: string | null;
  fallback_channel_id?: string | null;
  quiet_hours_active: boolean;
  preview_required: boolean;
  approval_required: boolean;
  delegate_contact_id?: string | null;
  reasons: string[];
  metadata: Record<string, unknown>;
};

/** Assistant profile detail. */
export type AssistantProfileDetail = AssistantProfileSummary & {
  preferred_contact?: RecordLink | null;
  delegate_contact?: RecordLink | null;
  escalation_contact?: RecordLink | null;
  primary_channel?: RecordLink | null;
  fallback_channel?: RecordLink | null;
  mail_source?: RecordLink | null;
  calendar_source?: RecordLink | null;
  preferences: Record<string, unknown>;
  communication_rules: CommunicationRules;
  quiet_hours: QuietHoursSettings;
  delivery_preferences: DeliveryPreferences;
  action_policies: ActionPolicies;
  delegation_rules: DelegationRules;
  allowed_action_kinds: AssistantActionKind[];
  blocked_action_kinds: AssistantActionKind[];
  allowed_channels: RecordLink[];
  direct_channels: RecordLink[];
};

// ---------------------------------------------------------------------------
// Assistant profile API functions
// ---------------------------------------------------------------------------

/**
 * Fetch assistant profiles for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit).
 * @returns Response with assistant profiles list.
 */
export function fetchAssistantProfiles(
  instanceId?: string | null,
  filters: {
    status?: AssistantProfileStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; profiles: AssistantProfileSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/assistant-profiles", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch assistant profile detail by ID.
 * @param assistantProfileId - The assistant profile ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with profile detail.
 */
export function fetchAssistantProfileDetail(assistantProfileId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}`, undefined, instanceId),
  );
}

/**
 * Create a new assistant profile.
 * @param instanceId - The instance ID or null.
 * @param payload - Profile creation parameters.
 * @returns Response with the created profile.
 */
export function createAssistantProfile(
  instanceId: string | null | undefined,
  payload: {
    assistant_profile_id?: string | null;
    display_name: string;
    summary?: string;
    status?: AssistantProfileStatus;
    assistant_mode_enabled?: boolean;
    is_default?: boolean;
    timezone?: string;
    locale?: string;
    tone?: AssistantTone;
    profile_scope?: AssistantProfileScope;
    memory_scope?: AssistantMemoryScope;
    preferred_contact_id?: string | null;
    mail_source_id?: string | null;
    calendar_source_id?: string | null;
    preferences?: Record<string, unknown>;
    communication_rules?: Partial<CommunicationRules>;
    quiet_hours?: Partial<QuietHoursSettings>;
    delivery_preferences?: Partial<DeliveryPreferences>;
    action_policies?: Partial<ActionPolicies>;
    delegation_rules?: Partial<DelegationRules>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope("/admin/assistant-profiles", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing assistant profile.
 * @param instanceId - The instance ID or null.
 * @param assistantProfileId - The assistant profile ID.
 * @param payload - Fields to update.
 * @returns Response with the updated profile.
 */
export function updateAssistantProfile(
  instanceId: string | null | undefined,
  assistantProfileId: string,
  payload: {
    display_name?: string;
    summary?: string;
    status?: AssistantProfileStatus;
    assistant_mode_enabled?: boolean;
    is_default?: boolean;
    timezone?: string;
    locale?: string;
    tone?: AssistantTone;
    profile_scope?: AssistantProfileScope;
    memory_scope?: AssistantMemoryScope;
    preferred_contact_id?: string | null;
    mail_source_id?: string | null;
    calendar_source_id?: string | null;
    preferences?: Record<string, unknown>;
    communication_rules?: Partial<CommunicationRules>;
    quiet_hours?: Partial<QuietHoursSettings>;
    delivery_preferences?: Partial<DeliveryPreferences>;
    action_policies?: Partial<ActionPolicies>;
    delegation_rules?: Partial<DelegationRules>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; profile: AssistantProfileDetail }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Evaluate an assistant action.
 * @param instanceId - The instance ID or null.
 * @param assistantProfileId - The assistant profile ID.
 * @param payload - Evaluation parameters.
 * @returns Response with the evaluation result.
 */
export function evaluateAssistantAction(
  instanceId: string | null | undefined,
  assistantProfileId: string,
  payload: {
    action_mode: AssistantActionMode;
    action_kind: AssistantActionKind;
    priority?: WorkItemPriority;
    channel_id?: string | null;
    target_contact_id?: string | null;
    occurred_at?: string | null;
    requires_external_delivery?: boolean;
    approval_reference?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; evaluation: AssistantActionEvaluation }>(
    appendTenantScope(`/admin/assistant-profiles/${encodeURIComponent(assistantProfileId)}/evaluate-action`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
