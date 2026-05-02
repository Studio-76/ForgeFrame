/**
 * Sectioned editor for creating and editing assistant profiles.
 *
 * Replaces the monolithic form with clearly grouped sections that
 * progressively disclose advanced controls. Only one mode (create/edit)
 * is active at a time — never both.
 *
 * Sections:
 * 1. Identity and status
 * 2. Scope and memory
 * 3. Contacts and channels
 * 4. Quiet hours
 * 5. Action permissions (permission matrix)
 * 6. Approval and policy rules
 * 7. Advanced JSON (collapsed by default)
 *
 * @packageDocumentation
 */

import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import type {
  AssistantActionKind,
  AssistantActionMode,
  AssistantMemoryScope,
  AssistantProfileScope,
  AssistantProfileStatus,
  AssistantTone,
  DirectActionPolicy,
  QuietHoursDay,
  WorkItemPriority,
} from "../../api/domain/assistant-profiles";
import {
  STATUS_OPTIONS,
  PROFILE_SCOPE_OPTIONS,
  MEMORY_SCOPE_OPTIONS,
  TONE_OPTIONS,
  DIRECT_ACTION_POLICY_OPTIONS,
  ACTION_MODE_OPTIONS,
  ACTION_KIND_OPTIONS,
  PRIORITY_OPTIONS,
  QUIET_DAY_OPTIONS,
  PERMISSION_GROUPS,
  type YesNo,
  type ProfileFormState,
  type EditorSection,
  EDITOR_SECTIONS,
} from "./types";

/** Props for {@link SectionedEditor}. */
export type SectionedEditorProps = {
  /** Title for the editor card. */
  title: string;
  /** Description shown below the title. */
  description: string;
  /** Whether to show the profile ID field (only on create). */
  showProfileId: boolean;
  /** Current form state. */
  form: ProfileFormState;
  /** Form state setter. */
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  /** Submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Whether a save operation is in progress. */
  busy: boolean;
  /** Whether the form is disabled. */
  disabled: boolean;
  /** Label for the submit button. */
  submitLabel: string;
  /** Called to cancel/close the editor. */
  onCancel: () => void;
};

// ---------------------------------------------------------------------------
// Field helper component
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  children: ReactNode;
  warning?: string;
};

function Field({ label, children, warning }: FieldProps) {
  return (
    <label>
      {label}
      {children}
      {warning ? <p className="fg-muted" style={{ fontSize: "0.75rem", marginTop: "2px" }}>{warning}</p> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Editor section component
// ---------------------------------------------------------------------------

type EditorSectionProps = {
  section: EditorSection;
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  showProfileId: boolean;
};

/** Render a single editor section based on its ID. */
function EditorSectionContent({ section, form, setForm, showProfileId }: EditorSectionProps) {
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

  switch (section) {
    // -----------------------------------------------------------------------
    // 1. Identity and status
    // -----------------------------------------------------------------------
    case "identity":
      return (
        <div className="fg-stack">
          <div className="fg-grid fg-grid-compact">
            {showProfileId ? (
              <Field label="Assistant profile ID">
                <input
                  value={form.assistantProfileId}
                  onChange={(e) => updateForm("assistantProfileId", e.target.value)}
                  placeholder="assistant_profile_primary"
                />
              </Field>
            ) : null}
            <Field label="Display name">
              <input
                value={form.displayName}
                onChange={(e) => updateForm("displayName", e.target.value)}
                placeholder="Primary assistant profile"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value as AssistantProfileStatus)}
              >
                {STATUS_OPTIONS.filter((o) => o !== "all").map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Summary">
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => updateForm("summary", e.target.value)}
              placeholder="Describe the purpose and scope of this assistant profile."
            />
          </Field>
          <div className="fg-grid fg-grid-compact">
            <Field label="Assistant mode">
              <select
                value={form.assistantModeEnabled}
                onChange={(e) => updateForm("assistantModeEnabled", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Default profile">
              <select
                value={form.isDefault}
                onChange={(e) => updateForm("isDefault", e.target.value as YesNo)}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>
        </div>
      );

    // -----------------------------------------------------------------------
    // 2. Scope and memory
    // -----------------------------------------------------------------------
    case "scope":
      return (
        <div className="fg-grid fg-grid-compact">
          <Field label="Profile scope">
            <select
              value={form.profileScope}
              onChange={(e) => updateForm("profileScope", e.target.value as AssistantProfileScope)}
            >
              {PROFILE_SCOPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Memory scope">
            <select
              value={form.memoryScope}
              onChange={(e) => updateForm("memoryScope", e.target.value as AssistantMemoryScope)}
            >
              {MEMORY_SCOPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Timezone">
            <input
              value={form.timezone}
              onChange={(e) => updateForm("timezone", e.target.value)}
              placeholder="UTC"
            />
          </Field>
          <Field label="Locale">
            <input
              value={form.locale}
              onChange={(e) => updateForm("locale", e.target.value)}
              placeholder="en-US"
            />
          </Field>
          <Field label="Communication tone">
            <select
              value={form.tone}
              onChange={(e) => updateForm("tone", e.target.value as AssistantTone)}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Signature">
            <input
              value={form.signature}
              onChange={(e) => updateForm("signature", e.target.value)}
              placeholder="Jordan"
            />
          </Field>
          <Field label="Style notes">
            <input
              value={form.styleNotes}
              onChange={(e) => updateForm("styleNotes", e.target.value)}
              placeholder="Brief, direct, factual"
            />
          </Field>
        </div>
      );

    // -----------------------------------------------------------------------
    // 3. Contacts and channels
    // -----------------------------------------------------------------------
    case "contacts":
      return (
        <div className="fg-stack">
          <div className="fg-grid fg-grid-compact">
            <Field label="Preferred contact ID">
              <input
                value={form.preferredContactId}
                onChange={(e) => updateForm("preferredContactId", e.target.value)}
                placeholder="contact_alpha"
              />
            </Field>
            <Field label="Delegate contact ID">
              <input
                value={form.delegateContactId}
                onChange={(e) => updateForm("delegateContactId", e.target.value)}
                placeholder="contact_delegate"
              />
            </Field>
            <Field label="Escalation contact ID">
              <input
                value={form.escalationContactId}
                onChange={(e) => updateForm("escalationContactId", e.target.value)}
                placeholder="contact_escalation"
              />
            </Field>
          </div>
          <div className="fg-grid fg-grid-compact">
            <Field label="Mail source ID">
              <input
                value={form.mailSourceId}
                onChange={(e) => updateForm("mailSourceId", e.target.value)}
                placeholder="source_mail_primary"
              />
            </Field>
            <Field label="Calendar source ID">
              <input
                value={form.calendarSourceId}
                onChange={(e) => updateForm("calendarSourceId", e.target.value)}
                placeholder="source_calendar_primary"
              />
            </Field>
          </div>
          <div className="fg-grid fg-grid-compact">
            <Field label="Primary channel ID">
              <input
                value={form.primaryChannelId}
                onChange={(e) => updateForm("primaryChannelId", e.target.value)}
                placeholder="channel_primary"
              />
            </Field>
            <Field label="Fallback channel ID">
              <input
                value={form.fallbackChannelId}
                onChange={(e) => updateForm("fallbackChannelId", e.target.value)}
                placeholder="channel_backup"
              />
            </Field>
            <Field label="Allowed channel IDs">
              <input
                value={form.allowedChannelIds}
                onChange={(e) => updateForm("allowedChannelIds", e.target.value)}
                placeholder="channel_primary, channel_backup"
              />
            </Field>
            <Field label="Direct channel IDs">
              <input
                value={form.directChannelIds}
                onChange={(e) => updateForm("directChannelIds", e.target.value)}
                placeholder="channel_primary"
              />
            </Field>
          </div>
        </div>
      );

    // -----------------------------------------------------------------------
    // 4. Quiet hours (compact schedule editor)
    // -----------------------------------------------------------------------
    case "quiet-hours":
      return (
        <div className="fg-stack">
          <div className="fg-grid fg-grid-compact">
            <Field label="Quiet hours">
              <select
                value={form.quietHoursEnabled}
                onChange={(e) => updateForm("quietHoursEnabled", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Timezone">
              <input
                value={form.quietHoursTimezone}
                onChange={(e) => updateForm("quietHoursTimezone", e.target.value)}
                placeholder="UTC"
              />
            </Field>
            <Field label="Start time">
              <input
                type="time"
                value={form.quietHoursStart}
                onChange={(e) => updateForm("quietHoursStart", e.target.value)}
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                value={form.quietHoursEnd}
                onChange={(e) => updateForm("quietHoursEnd", e.target.value)}
              />
            </Field>
          </div>
          <div>
            <p className="fg-muted" style={{ fontSize: "0.75rem", marginBottom: "var(--space-4, 4px)" }}>
              Active days
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8, 8px)" }}>
              {QUIET_DAY_OPTIONS.map((day) => (
                <label key={day.value} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.quietHoursDays.includes(day.value)}
                    onChange={() => toggleQuietDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
          <div className="fg-grid fg-grid-compact">
            <Field label="Allow priority override">
              <select
                value={form.allowPriorityOverride}
                onChange={(e) => updateForm("allowPriorityOverride", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Override minimum priority">
              <select
                value={form.overrideMinPriority}
                onChange={(e) => updateForm("overrideMinPriority", e.target.value as WorkItemPriority)}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="Preview by default">
              <select
                value={form.previewByDefault}
                onChange={(e) => updateForm("previewByDefault", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Mute during quiet hours">
              <select
                value={form.muteDuringQuietHours}
                onChange={(e) => updateForm("muteDuringQuietHours", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
          </div>
        </div>
      );

    // -----------------------------------------------------------------------
    // 5. Action permissions (permission matrix)
    // -----------------------------------------------------------------------
    case "permissions":
      return (
        <div className="fg-stack">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.id} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>{group.label}</h4>
                  <p className="fg-muted">{group.description}</p>
                </div>
              </div>
              <div className="fg-grid fg-grid-compact">
                {group.fields.map((field) => {
                  const value = form[field.key];
                  const isBoolField = typeof value === "string" && (value === "yes" || value === "no");

                  return (
                    <Field key={field.key} label={field.label} warning={field.warning}>
                      {isBoolField ? (
                        <select
                          value={value}
                          onChange={(e) => updateForm(field.key, e.target.value as YesNo)}
                        >
                          <option value="yes">Enabled</option>
                          <option value="no">Disabled</option>
                        </select>
                      ) : (
                        <select
                          value={value as string}
                          onChange={(e) => updateForm(field.key, e.target.value as DirectActionPolicy)}
                        >
                          {DIRECT_ACTION_POLICY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt === "never" ? "Blocked" : opt === "preview_required" ? "Preview required" : opt === "approval_required" ? "Approval required" : "Allowed"}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );

    // -----------------------------------------------------------------------
    // 6. Approval and policy rules
    // -----------------------------------------------------------------------
    case "approval":
      return (
        <div className="fg-stack">
          <div className="fg-grid fg-grid-compact">
            <Field label="Suggestions enabled">
              <select
                value={form.suggestionsEnabled}
                onChange={(e) => updateForm("suggestionsEnabled", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Questions enabled">
              <select
                value={form.questionsEnabled}
                onChange={(e) => updateForm("questionsEnabled", e.target.value as YesNo)}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </Field>
            <Field label="Direct-action policy">
              <select
                value={form.directActionPolicy}
                onChange={(e) => updateForm("directActionPolicy", e.target.value as DirectActionPolicy)}
              >
                {DIRECT_ACTION_POLICY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="Require approval reference">
              <select
                value={form.requireApprovalReference}
                onChange={(e) => updateForm("requireApprovalReference", e.target.value as YesNo)}
              >
                <option value="yes">Required</option>
                <option value="no">Not required</option>
              </select>
            </Field>
          </div>
        </div>
      );

    // -----------------------------------------------------------------------
    // 7. Advanced JSON (collapsed by default)
    // -----------------------------------------------------------------------
    case "advanced":
      return (
        <details open={false}>
          <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "var(--space-8, 8px)" }}>
            Advanced JSON configuration
          </summary>
          <div className="fg-stack" style={{ marginTop: "var(--space-8, 8px)" }}>
            <p className="fg-muted" style={{ fontSize: "0.875rem" }}>
              Raw JSON overrides for operators who need direct control. Changes here
              merge with the structured settings above.
            </p>
            <Field label="Preferences JSON">
              <textarea
                rows={4}
                value={form.preferencesJson}
                onChange={(e) => updateForm("preferencesJson", e.target.value)}
              />
            </Field>
            <Field label="Metadata JSON">
              <textarea
                rows={4}
                value={form.metadataJson}
                onChange={(e) => updateForm("metadataJson", e.target.value)}
              />
            </Field>
            <Field label="Policy overrides JSON">
              <textarea
                rows={6}
                value={form.policyOverridesJson}
                onChange={(e) => updateForm("policyOverridesJson", e.target.value)}
                placeholder={'{"action_policies":{"allow_calendar_actions":true}}'}
              />
            </Field>
          </div>
        </details>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sectioned editor main component
// ---------------------------------------------------------------------------

/**
 * Guided sectioned form for creating or editing an assistant profile.
 *
 * Sections are rendered vertically with progressive disclosure.
 * The advanced JSON section is collapsed by default.
 */
export function SectionedEditor({
  title,
  description,
  showProfileId,
  form,
  setForm,
  onSubmit,
  busy,
  disabled,
  submitLabel,
  onCancel,
}: SectionedEditorProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="fg-muted">{description}</p>
        </div>
      </div>
      <form className="fg-stack" onSubmit={onSubmit}>
        {EDITOR_SECTIONS.map((sectionDef) => (
          <details key={sectionDef.id} open={!sectionDef.optional}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                padding: "var(--space-8, 8px) 0",
                borderBottom: sectionDef.optional ? "1px solid var(--border-subtle, rgba(255,255,255,0.1))" : "none",
              }}
            >
              {sectionDef.label}
              {sectionDef.optional ? <span className="fg-muted" style={{ fontWeight: 400, marginLeft: "var(--space-8, 8px)", fontSize: "0.75rem" }}>(optional, collapsed)</span> : null}
            </summary>
            <div style={{ padding: "var(--space-8, 8px) 0 var(--space-16, 16px) 0" }}>
              <EditorSectionContent section={sectionDef.id} form={form} setForm={setForm} showProfileId={showProfileId} />
            </div>
          </details>
        ))}

        <div className="fg-actions" style={{ justifyContent: "space-between" }}>
          <button type="button" onClick={onCancel} style={{ background: "none", border: "1px solid var(--border-subtle, rgba(255,255,255,0.2))" }}>
            Cancel
          </button>
          <button type="submit" disabled={disabled || busy || !form.displayName.trim()}>
            {busy ? `${submitLabel}...` : submitLabel}
          </button>
        </div>
      </form>
    </article>
  );
}
