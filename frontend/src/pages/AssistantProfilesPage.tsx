import {
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createAssistantProfile,
  evaluateAssistantAction,
  fetchAssistantProfileDetail,
  fetchAssistantProfiles,
  fetchInstances,
  updateAssistantProfile,
  type ActionPolicies,
  type AssistantActionEvaluation,
  type AssistantActionKind,
  type AssistantActionMode,
  type AssistantMemoryScope,
  type AssistantProfileDetail,
  type AssistantProfileScope,
  type AssistantProfileStatus,
  type AssistantProfileSummary,
  type AssistantTone,
  type CommunicationRules,
  type DelegationRules,
  type DeliveryPreferences,
  type DirectActionPolicy,
  type QuietHoursDay,
  type QuietHoursSettings,
  type RecordLink,
  type WorkItemPriority,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { buildChannelPath, buildContactPath, buildKnowledgeSourcePath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<AssistantProfileStatus | "all"> = ["all", "active", "paused"];
const PROFILE_SCOPE_OPTIONS: AssistantProfileScope[] = ["personal", "team"];
const MEMORY_SCOPE_OPTIONS: AssistantMemoryScope[] = ["disabled", "personal", "team"];
const TONE_OPTIONS: AssistantTone[] = ["neutral", "warm", "direct", "formal"];
const DIRECT_ACTION_POLICY_OPTIONS: DirectActionPolicy[] = ["never", "preview_required", "approval_required", "allow"];
const ACTION_MODE_OPTIONS: AssistantActionMode[] = ["suggest", "ask", "direct"];
const ACTION_KIND_OPTIONS: AssistantActionKind[] = ["draft_message", "send_notification", "create_follow_up", "schedule_calendar", "delegate_follow_up"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
const QUIET_DAY_OPTIONS: Array<{ value: QuietHoursDay; label: string }> = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];
const POLICY_OVERRIDE_KEYS = new Set(["quiet_hours", "delivery_preferences", "action_policies", "delegation_rules"]);

type YesNo = "yes" | "no";

type PolicyOverrides = {
  quiet_hours?: Partial<QuietHoursSettings>;
  delivery_preferences?: Partial<DeliveryPreferences>;
  action_policies?: Partial<ActionPolicies>;
  delegation_rules?: Partial<DelegationRules>;
};

type ProfileFormState = {
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

type EvaluationFormState = {
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

const DEFAULT_PROFILE_FORM: ProfileFormState = {
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

const DEFAULT_EVALUATION_FORM: EvaluationFormState = {
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

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function stripManagedMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next.governance;
  delete next.last_evaluation;
  return next;
}

function normalizeCsvList(rawValue: string): string[] {
  return Array.from(new Set(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

function formatClock(minuteOfDay: number): string {
  const safeMinute = Number.isFinite(minuteOfDay) ? Math.max(0, Math.min(1439, minuteOfDay)) : 0;
  const hours = Math.floor(safeMinute / 60);
  const minutes = safeMinute % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function parseClock(rawValue: string, fieldLabel: string): number {
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

function parsePolicyOverrides(rawValue: string): PolicyOverrides {
  const overrides = parseJsonObject(rawValue, "Policy overrides");
  for (const key of Object.keys(overrides)) {
    if (!POLICY_OVERRIDE_KEYS.has(key)) {
      throw new Error(`Policy overrides may only contain ${Array.from(POLICY_OVERRIDE_KEYS).join(", ")}.`);
    }
  }
  return overrides as PolicyOverrides;
}

function buildProfilePayload(form: ProfileFormState) {
  const policyOverrides = parsePolicyOverrides(form.policyOverridesJson);

  const communicationRules: CommunicationRules = {
    tone: form.tone,
    locale: form.locale.trim(),
    signature: normalizeOptional(form.signature),
    style_notes: normalizeOptional(form.styleNotes),
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
    primary_channel_id: normalizeOptional(form.primaryChannelId),
    fallback_channel_id: normalizeOptional(form.fallbackChannelId),
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
    delegate_contact_id: normalizeOptional(form.delegateContactId),
    escalation_contact_id: normalizeOptional(form.escalationContactId),
    allow_external_delegation: form.allowExternalDelegation === "yes",
    allow_auto_followups: form.allowAutoFollowups === "yes",
    ...(policyOverrides.delegation_rules ?? {}),
  };

  return {
    assistant_profile_id: normalizeOptional(form.assistantProfileId),
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
    preferred_contact_id: normalizeOptional(form.preferredContactId),
    mail_source_id: normalizeOptional(form.mailSourceId),
    calendar_source_id: normalizeOptional(form.calendarSourceId),
    communication_rules: communicationRules,
    quiet_hours: quietHours,
    delivery_preferences: deliveryPreferences,
    action_policies: actionPolicies,
    delegation_rules: delegationRules,
    preferences: parseJsonObject(form.preferencesJson, "Preferences JSON"),
    metadata: parseJsonObject(form.metadataJson, "Metadata JSON"),
  };
}

function hydrateProfileForm(detail: AssistantProfileDetail): ProfileFormState {
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

function summarizeEvaluation(evaluation: AssistantActionEvaluation | null | undefined): string {
  if (!evaluation) {
    return "Not evaluated yet";
  }
  return `${evaluation.decision} | ${evaluation.action_mode}/${evaluation.action_kind} | ${new Date(evaluation.evaluated_at).toLocaleString()}`;
}

function renderLinkedList(
  items: RecordLink[],
  buildPath: (recordId: string) => string,
): ReactNode {
  if (items.length === 0) {
    return "None";
  }
  return items.map((item, index) => (
    <span key={item.record_id}>
      {index > 0 ? ", " : null}
      <Link to={buildPath(item.record_id)}>{item.label}</Link>
    </span>
  ));
}

function renderOptionalLink(
  item: RecordLink | null | undefined,
  buildPath: (recordId: string) => string,
) {
  if (!item) {
    return "Not linked";
  }
  return <Link to={buildPath(item.record_id)}>{item.label}</Link>;
}

function EvaluationResult({ evaluation, instanceId }: { evaluation: AssistantActionEvaluation; instanceId: string }) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Last evaluation</h4>
          <p className="fg-muted">Persisted policy verdict for the most recent example action.</p>
        </div>
        <span className="fg-pill" data-tone={evaluation.decision === "blocked" ? "danger" : evaluation.decision === "allow" ? "success" : "warning"}>
          {evaluation.decision}
        </span>
      </div>
      <ul className="fg-list">
        <li>Action: {evaluation.action_mode} / {evaluation.action_kind}</li>
        <li>Priority: {evaluation.priority}</li>
        <li>Evaluated at: {new Date(evaluation.evaluated_at).toLocaleString()}</li>
        <li>Quiet hours active: {evaluation.quiet_hours_active ? "yes" : "no"}</li>
        <li>Preview required: {evaluation.preview_required ? "yes" : "no"}</li>
        <li>Approval required: {evaluation.approval_required ? "yes" : "no"}</li>
        <li>
          Effective channel:{" "}
          {evaluation.effective_channel_id ? <Link to={buildChannelPath({ instanceId, channelId: evaluation.effective_channel_id })}>{evaluation.effective_channel_id}</Link> : "none"}
        </li>
        <li>
          Fallback channel:{" "}
          {evaluation.fallback_channel_id ? <Link to={buildChannelPath({ instanceId, channelId: evaluation.fallback_channel_id })}>{evaluation.fallback_channel_id}</Link> : "none"}
        </li>
        <li>
          Delegate contact:{" "}
          {evaluation.delegate_contact_id ? <Link to={buildContactPath({ instanceId, contactId: evaluation.delegate_contact_id })}>{evaluation.delegate_contact_id}</Link> : "none"}
        </li>
      </ul>
      <p className="fg-muted">Reasons: {evaluation.reasons.join(", ") || "no additional reasons"}</p>
      {Object.keys(evaluation.metadata ?? {}).length > 0 ? <pre className="fg-code-block">{formatJson(evaluation.metadata)}</pre> : null}
    </article>
  );
}

type ProfileFormProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  disabled: boolean;
  submitLabel: string;
  title: string;
  description: string;
  showProfileId: boolean;
};

function AssistantProfileFormSection({
  form,
  setForm,
  onSubmit,
  busy,
  disabled,
  submitLabel,
  title,
  description,
  showProfileId,
}: ProfileFormProps) {
  const updateForm = <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleQuietDay = (day: QuietHoursDay) => {
    setForm((current) => ({
      ...current,
      quietHoursDays: current.quietHoursDays.includes(day)
        ? current.quietHoursDays.filter((candidate) => candidate !== day)
        : [...current.quietHoursDays, day],
    }));
  };

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="fg-muted">{description}</p>
        </div>
        <span className="fg-pill" data-tone={disabled ? "warning" : "success"}>{disabled ? "Admin only" : "Writable"}</span>
      </div>
      <form className="fg-stack" onSubmit={onSubmit}>
        <div className="fg-grid fg-grid-compact">
          {showProfileId ? (
            <label>
              Assistant profile ID
              <input value={form.assistantProfileId} onChange={(event) => updateForm("assistantProfileId", event.target.value)} placeholder="assistant_profile_primary" />
            </label>
          ) : null}
          <label>
            Display name
            <input value={form.displayName} onChange={(event) => updateForm("displayName", event.target.value)} placeholder="Primary assistant profile" />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateForm("status", event.target.value as AssistantProfileStatus)}>
              {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <label>
          Summary
          <textarea rows={3} value={form.summary} onChange={(event) => updateForm("summary", event.target.value)} />
        </label>

        <div className="fg-grid fg-grid-compact">
          <label>
            Profile scope
            <select value={form.profileScope} onChange={(event) => updateForm("profileScope", event.target.value as AssistantProfileScope)}>
              {PROFILE_SCOPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Memory scope
            <select value={form.memoryScope} onChange={(event) => updateForm("memoryScope", event.target.value as AssistantMemoryScope)}>
              {MEMORY_SCOPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Assistant mode enabled
            <select value={form.assistantModeEnabled} onChange={(event) => updateForm("assistantModeEnabled", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Default profile
            <select value={form.isDefault} onChange={(event) => updateForm("isDefault", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Tone
            <select value={form.tone} onChange={(event) => updateForm("tone", event.target.value as AssistantTone)}>
              {TONE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Timezone
            <input value={form.timezone} onChange={(event) => updateForm("timezone", event.target.value)} />
          </label>
          <label>
            Locale
            <input value={form.locale} onChange={(event) => updateForm("locale", event.target.value)} />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Signature
            <input value={form.signature} onChange={(event) => updateForm("signature", event.target.value)} placeholder="Jordan" />
          </label>
          <label>
            Style notes
            <input value={form.styleNotes} onChange={(event) => updateForm("styleNotes", event.target.value)} placeholder="Brief, direct, factual" />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Preferred contact ID
            <input value={form.preferredContactId} onChange={(event) => updateForm("preferredContactId", event.target.value)} />
          </label>
          <label>
            Delegate contact ID
            <input value={form.delegateContactId} onChange={(event) => updateForm("delegateContactId", event.target.value)} />
          </label>
          <label>
            Escalation contact ID
            <input value={form.escalationContactId} onChange={(event) => updateForm("escalationContactId", event.target.value)} />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Mail source ID
            <input value={form.mailSourceId} onChange={(event) => updateForm("mailSourceId", event.target.value)} />
          </label>
          <label>
            Calendar source ID
            <input value={form.calendarSourceId} onChange={(event) => updateForm("calendarSourceId", event.target.value)} />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Primary channel ID
            <input value={form.primaryChannelId} onChange={(event) => updateForm("primaryChannelId", event.target.value)} />
          </label>
          <label>
            Fallback channel ID
            <input value={form.fallbackChannelId} onChange={(event) => updateForm("fallbackChannelId", event.target.value)} />
          </label>
          <label>
            Allowed channel IDs
            <input value={form.allowedChannelIds} onChange={(event) => updateForm("allowedChannelIds", event.target.value)} placeholder="channel_primary, channel_backup" />
          </label>
          <label>
            Direct channel IDs
            <input value={form.directChannelIds} onChange={(event) => updateForm("directChannelIds", event.target.value)} placeholder="channel_primary" />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Quiet hours enabled
            <select value={form.quietHoursEnabled} onChange={(event) => updateForm("quietHoursEnabled", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Quiet timezone
            <input value={form.quietHoursTimezone} onChange={(event) => updateForm("quietHoursTimezone", event.target.value)} />
          </label>
          <label>
            Quiet start
            <input type="time" value={form.quietHoursStart} onChange={(event) => updateForm("quietHoursStart", event.target.value)} />
          </label>
          <label>
            Quiet end
            <input type="time" value={form.quietHoursEnd} onChange={(event) => updateForm("quietHoursEnd", event.target.value)} />
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          {QUIET_DAY_OPTIONS.map((day) => (
            <label key={day.value}>
              <input
                type="checkbox"
                checked={form.quietHoursDays.includes(day.value)}
                onChange={() => toggleQuietDay(day.value)}
              />
              Quiet {day.label}
            </label>
          ))}
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Allow priority override
            <select value={form.allowPriorityOverride} onChange={(event) => updateForm("allowPriorityOverride", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Override minimum priority
            <select value={form.overrideMinPriority} onChange={(event) => updateForm("overrideMinPriority", event.target.value as WorkItemPriority)}>
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Preview by default
            <select value={form.previewByDefault} onChange={(event) => updateForm("previewByDefault", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Mute during quiet hours
            <select value={form.muteDuringQuietHours} onChange={(event) => updateForm("muteDuringQuietHours", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Suggestions enabled
            <select value={form.suggestionsEnabled} onChange={(event) => updateForm("suggestionsEnabled", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Questions enabled
            <select value={form.questionsEnabled} onChange={(event) => updateForm("questionsEnabled", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Direct-action policy
            <select value={form.directActionPolicy} onChange={(event) => updateForm("directActionPolicy", event.target.value as DirectActionPolicy)}>
              {DIRECT_ACTION_POLICY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Require approval reference
            <select value={form.requireApprovalReference} onChange={(event) => updateForm("requireApprovalReference", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
            Allow mail actions
            <select value={form.allowMailActions} onChange={(event) => updateForm("allowMailActions", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Allow calendar actions
            <select value={form.allowCalendarActions} onChange={(event) => updateForm("allowCalendarActions", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Allow task actions
            <select value={form.allowTaskActions} onChange={(event) => updateForm("allowTaskActions", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Allow external delegation
            <select value={form.allowExternalDelegation} onChange={(event) => updateForm("allowExternalDelegation", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
          <label>
            Allow auto followups
            <select value={form.allowAutoFollowups} onChange={(event) => updateForm("allowAutoFollowups", event.target.value as YesNo)}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
        </div>

        <details>
          <summary>Advanced JSON</summary>
          <div className="fg-stack">
            <label>
              Preferences JSON
              <textarea rows={4} value={form.preferencesJson} onChange={(event) => updateForm("preferencesJson", event.target.value)} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={4} value={form.metadataJson} onChange={(event) => updateForm("metadataJson", event.target.value)} />
            </label>
            <label>
              Policy overrides JSON
              <textarea
                rows={6}
                value={form.policyOverridesJson}
                onChange={(event) => updateForm("policyOverridesJson", event.target.value)}
                placeholder={'{"action_policies":{"allow_calendar_actions":true}}'}
              />
            </label>
          </div>
        </details>

          <div className="fg-actions">
            <button type="submit" disabled={disabled || busy || !form.displayName.trim()}>
            {busy ? `${submitLabel}...` : submitLabel}
            </button>
          </div>
      </form>
    </article>
  );
}

export function AssistantProfilesPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedAssistantProfileId = searchParams.get("assistantProfileId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AssistantProfileStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [profiles, setProfiles] = useState<AssistantProfileSummary[]>([]);
  const [detail, setDetail] = useState<AssistantProfileDetail | null>(null);
  const [createForm, setCreateForm] = useState<ProfileFormState>(DEFAULT_PROFILE_FORM);
  const [editForm, setEditForm] = useState<ProfileFormState>(DEFAULT_PROFILE_FORM);
  const [evaluationForm, setEvaluationForm] = useState<EvaluationFormState>(DEFAULT_EVALUATION_FORM);
  const [evaluation, setEvaluation] = useState<AssistantActionEvaluation | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setProfiles([]);
      setListState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchAssistantProfiles(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setProfiles(payload.profiles);
        setListState("success");
        setError("");

        const nextAssistantProfileId = payload.profiles.some((profile) => profile.assistant_profile_id === selectedAssistantProfileId)
          ? selectedAssistantProfileId
          : payload.profiles[0]?.assistant_profile_id ?? "";
        if (nextAssistantProfileId !== selectedAssistantProfileId) {
          updateRoute((next) => {
            if (nextAssistantProfileId) {
              next.set("assistantProfileId", nextAssistantProfileId);
            } else {
              next.delete("assistantProfileId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setProfiles([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedAssistantProfileId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedAssistantProfileId) {
      setDetail(null);
      setDetailState("idle");
      setEvaluation(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchAssistantProfileDetail(selectedAssistantProfileId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.profile);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedAssistantProfileId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_PROFILE_FORM);
      setEvaluationForm(DEFAULT_EVALUATION_FORM);
      setEvaluation(null);
      return;
    }

    setEditForm(hydrateProfileForm(detail));
    setEvaluationForm({
      actionMode: "direct",
      actionKind: detail.action_policies.allow_mail_actions ? "send_notification" : "create_follow_up",
      priority: "normal",
      channelId: detail.delivery_preferences.primary_channel_id ?? "",
      targetContactId: detail.preferred_contact_id ?? "",
      occurredAt: "",
      requiresExternalDelivery: "yes",
      approvalReference: "",
      metadataJson: "{}",
    });
    setEvaluation(detail.last_evaluation ?? null);
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createAssistantProfile(instanceId, buildProfilePayload(createForm));
      setCreateForm(DEFAULT_PROFILE_FORM);
      updateRoute((next) => {
        next.set("assistantProfileId", payload.profile.assistant_profile_id);
      });
      setMessage(`Assistant profile ${payload.profile.assistant_profile_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Assistant-profile creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      await updateAssistantProfile(instanceId, detail.assistant_profile_id, buildProfilePayload(editForm));
      setMessage(`Assistant profile ${detail.assistant_profile_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Assistant-profile update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleEvaluate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setEvaluating(true);
    setError("");
    setMessage("");
    try {
      const payload = await evaluateAssistantAction(instanceId, detail.assistant_profile_id, {
        action_mode: evaluationForm.actionMode,
        action_kind: evaluationForm.actionKind,
        priority: evaluationForm.priority,
        channel_id: normalizeOptional(evaluationForm.channelId),
        target_contact_id: normalizeOptional(evaluationForm.targetContactId),
        occurred_at: normalizeOptional(evaluationForm.occurredAt),
        requires_external_delivery: evaluationForm.requiresExternalDelivery === "yes",
        approval_reference: normalizeOptional(evaluationForm.approvalReference),
        metadata: parseJsonObject(evaluationForm.metadataJson, "Evaluation metadata"),
      });
      setEvaluation(payload.evaluation);
      setMessage(`Assistant action ${payload.evaluation.decision}.`);
      setRefreshNonce((current) => current + 1);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Assistant-action evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Assistant Profiles"
          description="ForgeFrame is restoring assistant-profile governance before exposing personal or team assistant rules."
          question="Which governed assistant profile should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact truth once session scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Assistant Profiles stay instance-scoped and must surface quiet hours, delivery rules, direct-action controls, and memory scope on shared product truth."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Assistant Profiles"
          description="This route is reserved for operators and admins who can inspect real assistant-governance truth."
          question="Which adjacent surface should stay open while assistant-profile access is outside the current permission envelope?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact posture without opening assistant-profile records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while assistant-profile truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic assistant-profile shell when the session cannot inspect real personal-assistant governance."
        />
      </section>
    );
  }

  const riskCount = profiles.filter((profile) => profile.risk_warning).length;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Assistant Profiles"
        description="Governed assistant behavior for personal and team profiles with scope, quiet hours, delivery rules, action permissions, memory scope, and policy evaluation."
        question="If this profile executed a real outward action right now, would the page show exactly why it is allowed, gated, or blocked?"
        links={[
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contacts referenced by profile delivery and delegation rules." },
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery channels and direct-action boundaries." },
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect mail and calendar sources linked to the profile." },
        ]}
        badges={[
          { label: `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`, tone: profiles.length > 0 ? "success" : "warning" },
          { label: `${riskCount} with external rights`, tone: riskCount > 0 ? "warning" : "neutral" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Assistant Profiles are governance objects, not private JSON bags. Every primary action on this page must reflect real persisted policy truth."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then inspect assistant profiles by lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Assistant-profile instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("assistantProfileId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Assistant-profile status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                if (event.target.value === "all") {
                  next.delete("status");
                } else {
                  next.set("status", event.target.value);
                }
                next.delete("assistantProfileId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Assistant-profile inventory</h3>
              <p className="fg-muted">Profile, scope, operating mode, quiet-hour posture, direct-action rights, and the most recent evaluation all stay visible here.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading assistant-profile inventory.</p> : null}
          {listState === "success" && profiles.length === 0 ? <p className="fg-muted">No assistant profiles matched the selected filters.</p> : null}

          {profiles.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Assistant profile inventory">
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Scope</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Quiet hours</th>
                    <th>Direct actions</th>
                    <th>Last evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.assistant_profile_id}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => next.set("assistantProfileId", profile.assistant_profile_id))}
                        >
                          {profile.display_name}
                        </button>
                        <div className="fg-code">{profile.assistant_profile_id}</div>
                        {profile.risk_warning ? (
                          <span className="fg-pill" data-tone={profile.risk_warning.level === "high" ? "danger" : "warning"}>
                            {profile.risk_warning.title}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div>{profile.profile_scope_label}</div>
                        <div className="fg-muted">{profile.memory_scope_label}</div>
                      </td>
                      <td>
                        <div>{profile.operating_mode_label}</div>
                        <div className="fg-muted">{profile.direct_action_policy_label}</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={profile.status === "active" && profile.assistant_mode_enabled ? "success" : "warning"}>
                          {profile.status}
                        </span>
                        <div className="fg-muted">{profile.assistant_mode_enabled ? "assistant mode enabled" : "assistant mode disabled"}</div>
                      </td>
                      <td>{profile.quiet_hours_summary}</td>
                      <td>
                        <div>{profile.direct_action_policy_label}</div>
                        <div className="fg-muted">{profile.primary_channel_id ?? "no primary channel"}</div>
                      </td>
                      <td>{summarizeEvaluation(profile.last_evaluation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Assistant-profile detail</h3>
              <p className="fg-muted">Rules, allowed and blocked actions, channels, contacts, delivery behavior, and memory scope converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.assistant_profile_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an assistant profile to inspect real governance truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading assistant-profile detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              {detail.risk_warning ? (
                <article className="fg-subcard">
                  <h4>{detail.risk_warning.title}</h4>
                  <p className={detail.risk_warning.level === "high" ? "fg-danger" : ""}>
                    {detail.risk_warning.level === "high" ? "High-risk outward execution is enabled on this profile." : "Outward execution is permitted when profile gates are satisfied."}
                  </p>
                  <ul className={detail.risk_warning.level === "high" ? "fg-list fg-danger" : "fg-list"}>
                    {detail.risk_warning.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </article>
              ) : null}

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Scope and mode</h4>
                  <ul className="fg-list">
                    <li>Status: {detail.status}</li>
                    <li>Assistant mode: {detail.assistant_mode_enabled ? "enabled" : "disabled"}</li>
                    <li>Default profile: {detail.is_default ? "yes" : "no"}</li>
                    <li>Profile scope: {detail.profile_scope_label}</li>
                    <li>Memory scope: {detail.memory_scope_label}</li>
                    <li>Operating mode: {detail.operating_mode_label}</li>
                  </ul>
                  <p>{detail.summary || "No profile summary was recorded."}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Quiet hours and communication</h4>
                  <ul className="fg-list">
                    <li>Timezone: {detail.timezone}</li>
                    <li>Locale: {detail.locale}</li>
                    <li>Tone: {detail.tone}</li>
                    <li>Signature: {detail.communication_rules.signature ?? "none"}</li>
                    <li>Style notes: {detail.communication_rules.style_notes ?? "none"}</li>
                    <li>Quiet hours: {detail.quiet_hours_summary}</li>
                    <li>Quiet override: {detail.quiet_hours.allow_priority_override ? detail.quiet_hours.override_min_priority : "disabled"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Delivery and channels</h4>
                  <ul className="fg-list">
                    <li>Primary channel: {renderOptionalLink(detail.primary_channel, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
                    <li>Fallback channel: {renderOptionalLink(detail.fallback_channel, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
                    <li>Allowed channels: {renderLinkedList(detail.allowed_channels, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
                    <li>Direct channels: {renderLinkedList(detail.direct_channels, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
                    <li>Preview by default: {detail.delivery_preferences.preview_by_default ? "yes" : "no"}</li>
                    <li>Mute during quiet hours: {detail.delivery_preferences.mute_during_quiet_hours ? "yes" : "no"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Contacts and sources</h4>
                  <ul className="fg-list">
                    <li>Preferred contact: {renderOptionalLink(detail.preferred_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
                    <li>Delegate contact: {renderOptionalLink(detail.delegate_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
                    <li>Escalation contact: {renderOptionalLink(detail.escalation_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
                    <li>Mail source: {renderOptionalLink(detail.mail_source, (recordId) => buildKnowledgeSourcePath({ instanceId, sourceId: recordId }))}</li>
                    <li>Calendar source: {renderOptionalLink(detail.calendar_source, (recordId) => buildKnowledgeSourcePath({ instanceId, sourceId: recordId }))}</li>
                  </ul>
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Action governance</h4>
                  <ul className="fg-list">
                    <li>Suggestions enabled: {detail.action_policies.suggestions_enabled ? "yes" : "no"}</li>
                    <li>Questions enabled: {detail.action_policies.questions_enabled ? "yes" : "no"}</li>
                    <li>Direct-action policy: {detail.direct_action_policy_label}</li>
                    <li>Require approval reference: {detail.action_policies.require_approval_reference ? "yes" : "no"}</li>
                    <li>Allowed actions: {detail.allowed_action_kinds.join(", ") || "none"}</li>
                    <li>Blocked actions: {detail.blocked_action_kinds.join(", ") || "none"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Advanced policy snapshot</h4>
                  <pre className="fg-code-block">{formatJson({
                    communication_rules: detail.communication_rules,
                    quiet_hours: detail.quiet_hours,
                    delivery_preferences: detail.delivery_preferences,
                    action_policies: detail.action_policies,
                    delegation_rules: detail.delegation_rules,
                    metadata: detail.metadata,
                  })}</pre>
                </article>
              </div>

              {evaluation ? <EvaluationResult evaluation={evaluation} instanceId={instanceId} /> : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <AssistantProfileFormSection
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          busy={savingCreate}
          disabled={!canMutate || !instanceId}
          submitLabel="Create assistant profile"
          title="Create assistant profile"
          description="Create a governed personal or team assistant profile with visible scope, quiet hours, delivery rules, action permissions, and memory posture."
          showProfileId
        />

        <AssistantProfileFormSection
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          busy={savingUpdate}
          disabled={!canMutate || !detail}
          submitLabel="Save assistant profile"
          title="Edit assistant profile"
          description="Update the selected profile through structured controls first; raw policy overrides stay available only in the advanced section."
          showProfileId={false}
        />
      </div>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Evaluate assistant action</h3>
            <p className="fg-muted">Run a real policy check against the selected profile and persist the latest governance verdict.</p>
          </div>
          <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
        </div>
        <form className="fg-stack" onSubmit={handleEvaluate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Action mode
              <select value={evaluationForm.actionMode} onChange={(event) => setEvaluationForm((current) => ({ ...current, actionMode: event.target.value as AssistantActionMode }))}>
                {ACTION_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Action kind
              <select value={evaluationForm.actionKind} onChange={(event) => setEvaluationForm((current) => ({ ...current, actionKind: event.target.value as AssistantActionKind }))}>
                {ACTION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={evaluationForm.priority} onChange={(event) => setEvaluationForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Requires external delivery
              <select value={evaluationForm.requiresExternalDelivery} onChange={(event) => setEvaluationForm((current) => ({ ...current, requiresExternalDelivery: event.target.value as YesNo }))}>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
          </div>

          <div className="fg-grid fg-grid-compact">
            <label>
              Channel ID
              <input value={evaluationForm.channelId} onChange={(event) => setEvaluationForm((current) => ({ ...current, channelId: event.target.value }))} />
            </label>
            <label>
              Target contact ID
              <input value={evaluationForm.targetContactId} onChange={(event) => setEvaluationForm((current) => ({ ...current, targetContactId: event.target.value }))} />
            </label>
            <label>
              Occurred at
              <input value={evaluationForm.occurredAt} onChange={(event) => setEvaluationForm((current) => ({ ...current, occurredAt: event.target.value }))} placeholder="2026-04-23T02:00:00Z" />
            </label>
            <label>
              Approval reference
              <input value={evaluationForm.approvalReference} onChange={(event) => setEvaluationForm((current) => ({ ...current, approvalReference: event.target.value }))} placeholder="approval-123" />
            </label>
          </div>

          <label>
            Evaluation metadata JSON
            <textarea rows={4} value={evaluationForm.metadataJson} onChange={(event) => setEvaluationForm((current) => ({ ...current, metadataJson: event.target.value }))} />
          </label>

          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || !detail || evaluating}>
              {evaluating ? "Evaluating assistant action..." : "Evaluate assistant action"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
