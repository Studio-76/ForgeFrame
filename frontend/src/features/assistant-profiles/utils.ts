/**
 * Utility functions for the Assistant Profiles feature.
 *
 * @packageDocumentation
 */

import type {
  ActionPolicies,
  AssistantActionEvaluation,
  AssistantProfileDetail,
  AssistantTone,
  CommunicationRules,
  DelegationRules,
  DeliveryPreferences,
  DirectActionPolicy,
  QuietHoursDay,
  QuietHoursSettings,
  WorkItemPriority,
} from "../../api/domain/assistant-profiles";
import {
  POLICY_OVERRIDE_KEYS,
  type PolicyOverrides,
  type ProfileFormState,
  type YesNo,
} from "./types";

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Format a value as JSON with 2-space indentation.
 * @param value - The value to format.
 * @returns Pretty-printed JSON string.
 */
export function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

/**
 * Parse a JSON string into an object.
 * @param rawValue - The JSON string.
 * @param label - Label for error context.
 * @returns Parsed object.
 * @throws {Error} If parsing fails.
 */
export function parseJsonObject(rawValue: string, label: string): Record<string, unknown> {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} contains invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Strip managed metadata fields (governance, last_evaluation).
 * @param metadata - The metadata object.
 * @returns Clean metadata.
 */
export function stripManagedMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next.governance;
  delete next.last_evaluation;
  return next;
}

// ---------------------------------------------------------------------------
// CSV / list helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a comma-separated string into a unique array of trimmed values.
 * @param rawValue - The raw CSV string.
 * @returns Array of trimmed non-empty values.
 */
export function normalizeCsvList(rawValue: string): string[] {
  return Array.from(new Set(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

// ---------------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------------

/**
 * Format minute-of-day to HH:MM string.
 * @param minuteOfDay - Minutes since midnight (0–1439).
 * @returns HH:MM formatted string.
 */
export function formatClock(minuteOfDay: number): string {
  const safeMinute = Number.isFinite(minuteOfDay) ? Math.max(0, Math.min(1439, minuteOfDay)) : 0;
  const hours = Math.floor(safeMinute / 60);
  const minutes = safeMinute % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Parse HH:MM string to minute-of-day.
 * @param rawValue - The HH:MM string.
 * @param fieldLabel - Label for error context.
 * @returns Minutes since midnight.
 * @throws {Error} If format is invalid.
 */
export function parseClock(rawValue: string, fieldLabel: string): number {
  const normalized = rawValue.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) {
    throw new Error(`${fieldLabel} must use HH:MM format.`);
  }
  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  if (hours > 23 || minutes > 59) {
    throw new Error(`${fieldLabel} must stay within a 24-hour clock.`);
  }
  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// Policy override parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate policy overrides JSON string.
 * @param rawValue - The raw JSON string.
 * @returns Parsed policy overrides.
 * @throws {Error} If validation fails.
 */
export function parsePolicyOverrides(rawValue: string): PolicyOverrides {
  const overrides = parseJsonObject(rawValue, "Policy overrides");
  for (const key of Object.keys(overrides)) {
    if (!POLICY_OVERRIDE_KEYS.has(key)) {
      throw new Error(`Policy overrides may only contain ${Array.from(POLICY_OVERRIDE_KEYS).join(", ")}.`);
    }
  }
  return overrides as PolicyOverrides;
}

// ---------------------------------------------------------------------------
// Profile payload building
// ---------------------------------------------------------------------------

/**
 * Build the API payload from a profile form state.
 * @param form - The current form state.
 * @returns API-ready payload object.
 */
export function buildProfilePayload(form: ProfileFormState) {
  const policyOverrides = parsePolicyOverrides(form.policyOverridesJson);

  const communicationRules: CommunicationRules = {
    tone: form.tone,
    locale: form.locale.trim(),
    signature: form.signature || null,
    style_notes: form.styleNotes || null,
  };
  const quietHours: QuietHoursSettings = {
    enabled: form.quietHoursEnabled === "yes",
    timezone: form.quietHoursTimezone.trim(),
    start_minute: parseClock(form.quietHoursStart, "Quiet start"),
    end_minute: parseClock(form.quietHoursEnd, "Quiet end"),
    days: form.quietHoursDays,
    allow_priority_override: form.allowPriorityOverride === "yes",
    override_min_priority: form.overrideMinPriority,
    ...(policyOverrides.quiet_hours ?? {}),
  };
  const deliveryPreferences: DeliveryPreferences = {
    primary_channel_id: form.primaryChannelId || null,
    fallback_channel_id: form.fallbackChannelId || null,
    allowed_channel_ids: normalizeCsvList(form.allowedChannelIds),
    preview_by_default: form.previewByDefault === "yes",
    mute_during_quiet_hours: form.muteDuringQuietHours === "yes",
    ...(policyOverrides.delivery_preferences ?? {}),
  };
  const actionPolicies: ActionPolicies = {
    suggestions_enabled: form.suggestionsEnabled === "yes",
    questions_enabled: form.questionsEnabled === "yes",
    direct_action_policy: form.directActionPolicy,
    allow_mail_actions: form.allowMailActions === "yes",
    allow_calendar_actions: form.allowCalendarActions === "yes",
    allow_task_actions: form.allowTaskActions === "yes",
    require_approval_reference: form.requireApprovalReference === "yes",
    direct_channel_ids: normalizeCsvList(form.directChannelIds),
    ...(policyOverrides.action_policies ?? {}),
  };
  const delegationRules: DelegationRules = {
    delegate_contact_id: form.delegateContactId || null,
    escalation_contact_id: form.escalationContactId || null,
    allow_external_delegation: form.allowExternalDelegation === "yes",
    allow_auto_followups: form.allowAutoFollowups === "yes",
    ...(policyOverrides.delegation_rules ?? {}),
  };

  return {
    assistant_profile_id: form.assistantProfileId || null,
    display_name: form.displayName.trim(),
    summary: form.summary.trim(),
    status: form.status,
    assistant_mode_enabled: form.assistantModeEnabled === "yes",
    is_default: form.isDefault === "yes",
    profile_scope: form.profileScope,
    memory_scope: form.memoryScope,
    timezone: form.timezone.trim(),
    locale: form.locale.trim(),
    tone: form.tone,
    preferred_contact_id: form.preferredContactId || null,
    mail_source_id: form.mailSourceId || null,
    calendar_source_id: form.calendarSourceId || null,
    communication_rules: communicationRules,
    quiet_hours: quietHours,
    delivery_preferences: deliveryPreferences,
    action_policies: actionPolicies,
    delegation_rules: delegationRules,
    preferences: parseJsonObject(form.preferencesJson, "Preferences JSON"),
    metadata: parseJsonObject(form.metadataJson, "Metadata JSON"),
  };
}

// ---------------------------------------------------------------------------
// Profile form hydration
// ---------------------------------------------------------------------------

/**
 * Hydrate a profile form state from an API detail object.
 * @param detail - The profile detail from the API.
 * @returns Form state ready for editing.
 */
export function hydrateProfileForm(detail: AssistantProfileDetail): ProfileFormState {
  return {
    assistantProfileId: detail.assistant_profile_id,
    displayName: detail.display_name,
    summary: detail.summary,
    status: detail.status,
    assistantModeEnabled: detail.assistant_mode_enabled ? "yes" : "no",
    isDefault: detail.is_default ? "yes" : "no",
    profileScope: detail.profile_scope,
    memoryScope: detail.memory_scope,
    timezone: detail.timezone,
    locale: detail.locale,
    tone: detail.tone,
    preferredContactId: detail.preferred_contact_id ?? "",
    delegateContactId: detail.delegation_rules.delegate_contact_id ?? "",
    escalationContactId: detail.delegation_rules.escalation_contact_id ?? "",
    mailSourceId: detail.mail_source_id ?? "",
    calendarSourceId: detail.calendar_source_id ?? "",
    primaryChannelId: detail.delivery_preferences.primary_channel_id ?? "",
    fallbackChannelId: detail.delivery_preferences.fallback_channel_id ?? "",
    allowedChannelIds: detail.delivery_preferences.allowed_channel_ids.join(", "),
    directChannelIds: detail.action_policies.direct_channel_ids.join(", "),
    signature: detail.communication_rules.signature ?? "",
    styleNotes: detail.communication_rules.style_notes ?? "",
    quietHoursEnabled: detail.quiet_hours.enabled ? "yes" : "no",
    quietHoursTimezone: detail.quiet_hours.timezone,
    quietHoursStart: formatClock(detail.quiet_hours.start_minute),
    quietHoursEnd: formatClock(detail.quiet_hours.end_minute),
    quietHoursDays: detail.quiet_hours.days,
    allowPriorityOverride: detail.quiet_hours.allow_priority_override ? "yes" : "no",
    overrideMinPriority: detail.quiet_hours.override_min_priority,
    previewByDefault: detail.delivery_preferences.preview_by_default ? "yes" : "no",
    muteDuringQuietHours: detail.delivery_preferences.mute_during_quiet_hours ? "yes" : "no",
    suggestionsEnabled: detail.action_policies.suggestions_enabled ? "yes" : "no",
    questionsEnabled: detail.action_policies.questions_enabled ? "yes" : "no",
    directActionPolicy: detail.action_policies.direct_action_policy,
    allowMailActions: detail.action_policies.allow_mail_actions ? "yes" : "no",
    allowCalendarActions: detail.action_policies.allow_calendar_actions ? "yes" : "no",
    allowTaskActions: detail.action_policies.allow_task_actions ? "yes" : "no",
    requireApprovalReference: detail.action_policies.require_approval_reference ? "yes" : "no",
    allowExternalDelegation: detail.delegation_rules.allow_external_delegation ? "yes" : "no",
    allowAutoFollowups: detail.delegation_rules.allow_auto_followups ? "yes" : "no",
    preferencesJson: formatJson(detail.preferences),
    metadataJson: formatJson(stripManagedMetadata(detail.metadata)),
    policyOverridesJson: "",
  };
}

// ---------------------------------------------------------------------------
// Evaluation summary
// ---------------------------------------------------------------------------

/**
 * Summarize an evaluation result for display.
 * @param evaluation - The evaluation or null.
 * @returns Readable summary string.
 */
export function summarizeEvaluation(evaluation: AssistantActionEvaluation | null | undefined): string {
  if (!evaluation) {
    return "Not evaluated yet";
  }
  return `${evaluation.decision} | ${evaluation.action_mode}/${evaluation.action_kind} | ${new Date(evaluation.evaluated_at).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Tone helpers
// ---------------------------------------------------------------------------

/**
 * Get the tone for a profile count display.
 * @param count - The number of profiles.
 * @returns Tone identifier.
 */
export function profileCountTone(count: number): "success" | "warning" | "neutral" {
  if (count > 0) return "success";
  return "warning";
}

/**
 * Get a human-readable label for a direct-action policy value.
 * @param policy - The policy value.
 * @returns Human-readable label.
 */
export function directActionPolicyLabel(policy: DirectActionPolicy): string {
  switch (policy) {
    case "never":
      return "Blocked";
    case "preview_required":
      return "Preview required";
    case "approval_required":
      return "Approval required";
    case "allow":
      return "Allowed";
  }
}
