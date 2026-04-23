import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createAssistantProfile,
  evaluateAssistantAction,
  fetchAssistantProfileDetail,
  fetchAssistantProfiles,
  fetchInstances,
  updateAssistantProfile,
  type AssistantActionEvaluation,
  type AssistantActionKind,
  type AssistantActionMode,
  type AssistantProfileDetail,
  type AssistantProfileStatus,
  type AssistantProfileSummary,
  type AssistantTone,
  type WorkItemPriority,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildChannelPath, buildContactPath, buildKnowledgeSourcePath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<AssistantProfileStatus | "all"> = ["all", "active", "paused"];
const TONE_OPTIONS: AssistantTone[] = ["neutral", "warm", "direct", "formal"];
const ACTION_MODE_OPTIONS: AssistantActionMode[] = ["suggest", "ask", "direct"];
const ACTION_KIND_OPTIONS: AssistantActionKind[] = ["draft_message", "send_notification", "create_follow_up", "schedule_calendar", "delegate_follow_up"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];

const DEFAULT_CREATE_FORM = {
  assistantProfileId: "",
  displayName: "",
  summary: "",
  status: "active" as AssistantProfileStatus,
  assistantModeEnabled: "yes" as "yes" | "no",
  isDefault: "no" as "yes" | "no",
  timezone: "UTC",
  locale: "en-US",
  tone: "neutral" as AssistantTone,
  preferredContactId: "",
  mailSourceId: "",
  calendarSourceId: "",
  preferencesJson: "{}",
  communicationRulesJson: "{}",
  quietHoursJson: "{}",
  deliveryPreferencesJson: "{}",
  actionPoliciesJson: "{}",
  delegationRulesJson: "{}",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  displayName: "",
  summary: "",
  status: "active" as AssistantProfileStatus,
  assistantModeEnabled: "yes" as "yes" | "no",
  isDefault: "no" as "yes" | "no",
  timezone: "UTC",
  locale: "en-US",
  tone: "neutral" as AssistantTone,
  preferredContactId: "",
  mailSourceId: "",
  calendarSourceId: "",
  preferencesJson: "{}",
  communicationRulesJson: "{}",
  quietHoursJson: "{}",
  deliveryPreferencesJson: "{}",
  actionPoliciesJson: "{}",
  delegationRulesJson: "{}",
  metadataJson: "{}",
};

const DEFAULT_EVALUATION_FORM = {
  actionMode: "suggest" as AssistantActionMode,
  actionKind: "draft_message" as AssistantActionKind,
  priority: "normal" as WorkItemPriority,
  channelId: "",
  targetContactId: "",
  occurredAt: "",
  requiresExternalDelivery: "yes" as "yes" | "no",
  approvalReference: "",
  metadataJson: "{}",
};

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
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
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [evaluationForm, setEvaluationForm] = useState(DEFAULT_EVALUATION_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<AssistantActionEvaluation | null>(null);
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
      setListState("idle");
      setProfiles([]);
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
      setDetailState("idle");
      setDetail(null);
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
      setEditForm(DEFAULT_EDIT_FORM);
      setEvaluationForm(DEFAULT_EVALUATION_FORM);
      setEvaluation(null);
      return;
    }

    setEditForm({
      displayName: detail.display_name,
      summary: detail.summary,
      status: detail.status,
      assistantModeEnabled: detail.assistant_mode_enabled ? "yes" : "no",
      isDefault: detail.is_default ? "yes" : "no",
      timezone: detail.timezone,
      locale: detail.locale,
      tone: detail.tone,
      preferredContactId: detail.preferred_contact_id ?? "",
      mailSourceId: detail.mail_source_id ?? "",
      calendarSourceId: detail.calendar_source_id ?? "",
      preferencesJson: formatJson(detail.preferences),
      communicationRulesJson: formatJson(detail.communication_rules),
      quietHoursJson: formatJson(detail.quiet_hours),
      deliveryPreferencesJson: formatJson(detail.delivery_preferences),
      actionPoliciesJson: formatJson(detail.action_policies),
      delegationRulesJson: formatJson(detail.delegation_rules),
      metadataJson: formatJson(detail.metadata),
    });
    setEvaluation(null);
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
      const payload = await createAssistantProfile(instanceId, {
        assistant_profile_id: normalizeOptional(createForm.assistantProfileId),
        display_name: createForm.displayName.trim(),
        summary: createForm.summary.trim(),
        status: createForm.status,
        assistant_mode_enabled: createForm.assistantModeEnabled === "yes",
        is_default: createForm.isDefault === "yes",
        timezone: createForm.timezone.trim(),
        locale: createForm.locale.trim(),
        tone: createForm.tone,
        preferred_contact_id: normalizeOptional(createForm.preferredContactId),
        mail_source_id: normalizeOptional(createForm.mailSourceId),
        calendar_source_id: normalizeOptional(createForm.calendarSourceId),
        preferences: parseJsonObject(createForm.preferencesJson, "Assistant preferences"),
        communication_rules: parseJsonObject(createForm.communicationRulesJson, "Communication rules"),
        quiet_hours: parseJsonObject(createForm.quietHoursJson, "Quiet hours"),
        delivery_preferences: parseJsonObject(createForm.deliveryPreferencesJson, "Delivery preferences"),
        action_policies: parseJsonObject(createForm.actionPoliciesJson, "Action policies"),
        delegation_rules: parseJsonObject(createForm.delegationRulesJson, "Delegation rules"),
        metadata: parseJsonObject(createForm.metadataJson, "Assistant metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
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
      const payload = await updateAssistantProfile(instanceId, detail.assistant_profile_id, {
        display_name: editForm.displayName.trim(),
        summary: editForm.summary.trim(),
        status: editForm.status,
        assistant_mode_enabled: editForm.assistantModeEnabled === "yes",
        is_default: editForm.isDefault === "yes",
        timezone: editForm.timezone.trim(),
        locale: editForm.locale.trim(),
        tone: editForm.tone,
        preferred_contact_id: normalizeOptional(editForm.preferredContactId),
        mail_source_id: normalizeOptional(editForm.mailSourceId),
        calendar_source_id: normalizeOptional(editForm.calendarSourceId),
        preferences: parseJsonObject(editForm.preferencesJson, "Assistant preferences"),
        communication_rules: parseJsonObject(editForm.communicationRulesJson, "Communication rules"),
        quiet_hours: parseJsonObject(editForm.quietHoursJson, "Quiet hours"),
        delivery_preferences: parseJsonObject(editForm.deliveryPreferencesJson, "Delivery preferences"),
        action_policies: parseJsonObject(editForm.actionPoliciesJson, "Action policies"),
        delegation_rules: parseJsonObject(editForm.delegationRulesJson, "Delegation rules"),
        metadata: parseJsonObject(editForm.metadataJson, "Assistant metadata"),
      });
      setMessage(`Assistant profile ${payload.profile.assistant_profile_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Assistant-profile update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleEvaluate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instanceId || !detail) {
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
          description="ForgeFrame is restoring scoped assistant-profile truth before exposing personal-assistant rules."
          question="Which assistant profile should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact truth once session scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Assistant Profiles stay instance-scoped and must surface quiet hours, delivery rules, and action governance on shared product truth."
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
          description="This route is reserved for operators and admins who can inspect real personal-assistant policy truth."
          question="Which adjacent surface should remain open while assistant-profile access is outside the current permission envelope?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact posture without opening assistant-profile records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while assistant-profile truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic assistant-profile shell when the session cannot inspect real personal-assistant state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Assistant Profiles"
        description="Personal-assistant profiles on shared Work-Interaction truth with personal preferences, communication rules, quiet hours, delivery preferences, and direct-action governance."
        question="Are personal-assistant actions still a side world, or are they now forced through the same visible product truth as every other work interaction?"
        links={[
          { label: "Assistant Profiles", to: CONTROL_PLANE_ROUTES.assistantProfiles, description: "Stay on the assistant-profile inventory and detail surface." },
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect personal contacts linked to the selected assistant profile." },
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery channels linked to the selected assistant profile." },
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect mail and calendar sources linked to the selected assistant profile." },
        ]}
        badges={[
          { label: `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`, tone: profiles.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Assistant Profiles are not a sidecar config bag. They must stay persistent, testable, and enforceable against shared work-interaction truth."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the assistant-profile inventory by lifecycle state.</p>
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
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
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
              <p className="fg-muted">Each row is a persisted assistant profile with personal-assistant posture, not an invisible mode flag.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading assistant-profile inventory.</p> : null}
          {listState === "success" && profiles.length === 0 ? <p className="fg-muted">No assistant profiles matched the selected filters.</p> : null}

          {profiles.length > 0 ? (
            <div className="fg-stack">
              {profiles.map((profile) => (
                <button
                  key={profile.assistant_profile_id}
                  type="button"
                  className={`fg-data-row${profile.assistant_profile_id === selectedAssistantProfileId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("assistantProfileId", profile.assistant_profile_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{profile.assistant_profile_id}</span>
                      <strong>{profile.display_name}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{profile.assistant_mode_enabled ? "assistant mode enabled" : "assistant mode disabled"} · {profile.tone}</span>
                    <span className="fg-muted">{profile.primary_channel_id ?? "no primary channel"} · {profile.preferred_contact_id ?? "no preferred contact"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Assistant-profile detail</h3>
              <p className="fg-muted">Personal preferences, links, quiet hours, delivery rules, and direct-action policy converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.assistant_profile_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an assistant profile to inspect personal-assistant truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading assistant-profile detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Status: {detail.status}</li>
                    <li>Assistant mode: {detail.assistant_mode_enabled ? "enabled" : "disabled"}</li>
                    <li>Default profile: {detail.is_default ? "yes" : "no"}</li>
                    <li>Timezone: {detail.timezone}</li>
                    <li>Locale: {detail.locale}</li>
                    <li>Tone: {detail.tone}</li>
                  </ul>
                  <p>{detail.summary || "No profile summary was recorded."}</p>
                </article>
                <article className="fg-subcard">
                  <h4>Linked records</h4>
                  <ul className="fg-list">
                    <li>
                      Preferred contact:{" "}
                      {detail.preferred_contact ? <Link to={buildContactPath({ instanceId, contactId: detail.preferred_contact.record_id })}>{detail.preferred_contact.label}</Link> : "Not linked"}
                    </li>
                    <li>
                      Delegate contact:{" "}
                      {detail.delegate_contact ? <Link to={buildContactPath({ instanceId, contactId: detail.delegate_contact.record_id })}>{detail.delegate_contact.label}</Link> : "Not linked"}
                    </li>
                    <li>
                      Primary channel:{" "}
                      {detail.primary_channel ? <Link to={buildChannelPath({ instanceId, channelId: detail.primary_channel.record_id })}>{detail.primary_channel.label}</Link> : "Not linked"}
                    </li>
                    <li>
                      Fallback channel:{" "}
                      {detail.fallback_channel ? <Link to={buildChannelPath({ instanceId, channelId: detail.fallback_channel.record_id })}>{detail.fallback_channel.label}</Link> : "Not linked"}
                    </li>
                    <li>
                      Mail source:{" "}
                      {detail.mail_source ? <Link to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.mail_source.record_id })}>{detail.mail_source.label}</Link> : "Not linked"}
                    </li>
                    <li>
                      Calendar source:{" "}
                      {detail.calendar_source ? <Link to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.calendar_source.record_id })}>{detail.calendar_source.label}</Link> : "Not linked"}
                    </li>
                  </ul>
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Quiet hours</h4>
                  <ul className="fg-list">
                    <li>Enabled: {detail.quiet_hours.enabled ? "yes" : "no"}</li>
                    <li>Timezone: {detail.quiet_hours.timezone}</li>
                    <li>Window: {detail.quiet_hours.start_minute} - {detail.quiet_hours.end_minute}</li>
                    <li>Days: {detail.quiet_hours.days.join(", ") || "none"}</li>
                    <li>Priority override: {detail.quiet_hours.allow_priority_override ? detail.quiet_hours.override_min_priority : "disabled"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Delivery and action policy</h4>
                  <ul className="fg-list">
                    <li>Preview by default: {detail.delivery_preferences.preview_by_default ? "yes" : "no"}</li>
                    <li>Mute during quiet hours: {detail.delivery_preferences.mute_during_quiet_hours ? "yes" : "no"}</li>
                    <li>Allowed channels: {detail.delivery_preferences.allowed_channel_ids.join(", ") || "not restricted"}</li>
                    <li>Direct-action policy: {detail.action_policies.direct_action_policy}</li>
                    <li>Suggestions enabled: {detail.action_policies.suggestions_enabled ? "yes" : "no"}</li>
                    <li>Questions enabled: {detail.action_policies.questions_enabled ? "yes" : "no"}</li>
                  </ul>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Preferences and rules</h4>
                <pre className="fg-code-block">{formatJson({
                  preferences: detail.preferences,
                  communication_rules: detail.communication_rules,
                  delegation_rules: detail.delegation_rules,
                })}</pre>
              </article>

              {evaluation ? (
                <article className="fg-subcard">
                  <h4>Last evaluation</h4>
                  <ul className="fg-list">
                    <li>Decision: {evaluation.decision}</li>
                    <li>Action: {evaluation.action_mode} / {evaluation.action_kind}</li>
                    <li>Priority: {evaluation.priority}</li>
                    <li>Quiet hours active: {evaluation.quiet_hours_active ? "yes" : "no"}</li>
                    <li>Preview required: {evaluation.preview_required ? "yes" : "no"}</li>
                    <li>Approval required: {evaluation.approval_required ? "yes" : "no"}</li>
                    <li>Effective channel: {evaluation.effective_channel_id ?? "none"}</li>
                    <li>Reasons: {evaluation.reasons.join(", ") || "none"}</li>
                  </ul>
                </article>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create assistant profile</h3>
              <p className="fg-muted">Create a durable personal-assistant profile with explicit policy JSON instead of hidden mode flags.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Assistant profile ID
                <input value={createForm.assistantProfileId} onChange={(event) => setCreateForm((current) => ({ ...current, assistantProfileId: event.target.value }))} placeholder="assistant_profile_primary" />
              </label>
              <label>
                Display name
                <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Primary assistant profile" />
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as AssistantProfileStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Assistant mode enabled
                <select value={createForm.assistantModeEnabled} onChange={(event) => setCreateForm((current) => ({ ...current, assistantModeEnabled: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
              <label>
                Default profile
                <select value={createForm.isDefault} onChange={(event) => setCreateForm((current) => ({ ...current, isDefault: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
              <label>
                Tone
                <select value={createForm.tone} onChange={(event) => setCreateForm((current) => ({ ...current, tone: event.target.value as AssistantTone }))}>
                  {TONE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Timezone
                <input value={createForm.timezone} onChange={(event) => setCreateForm((current) => ({ ...current, timezone: event.target.value }))} />
              </label>
              <label>
                Locale
                <input value={createForm.locale} onChange={(event) => setCreateForm((current) => ({ ...current, locale: event.target.value }))} />
              </label>
              <label>
                Preferred contact ID
                <input value={createForm.preferredContactId} onChange={(event) => setCreateForm((current) => ({ ...current, preferredContactId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Mail source ID
                <input value={createForm.mailSourceId} onChange={(event) => setCreateForm((current) => ({ ...current, mailSourceId: event.target.value }))} />
              </label>
              <label>
                Calendar source ID
                <input value={createForm.calendarSourceId} onChange={(event) => setCreateForm((current) => ({ ...current, calendarSourceId: event.target.value }))} />
              </label>
            </div>
            <label>
              Preferences JSON
              <textarea rows={4} value={createForm.preferencesJson} onChange={(event) => setCreateForm((current) => ({ ...current, preferencesJson: event.target.value }))} />
            </label>
            <label>
              Communication rules JSON
              <textarea rows={4} value={createForm.communicationRulesJson} onChange={(event) => setCreateForm((current) => ({ ...current, communicationRulesJson: event.target.value }))} />
            </label>
            <label>
              Quiet hours JSON
              <textarea rows={4} value={createForm.quietHoursJson} onChange={(event) => setCreateForm((current) => ({ ...current, quietHoursJson: event.target.value }))} />
            </label>
            <label>
              Delivery preferences JSON
              <textarea rows={4} value={createForm.deliveryPreferencesJson} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryPreferencesJson: event.target.value }))} />
            </label>
            <label>
              Action policies JSON
              <textarea rows={4} value={createForm.actionPoliciesJson} onChange={(event) => setCreateForm((current) => ({ ...current, actionPoliciesJson: event.target.value }))} />
            </label>
            <label>
              Delegation rules JSON
              <textarea rows={4} value={createForm.delegationRulesJson} onChange={(event) => setCreateForm((current) => ({ ...current, delegationRulesJson: event.target.value }))} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={4} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.displayName.trim()}>
                {savingCreate ? "Creating assistant profile" : "Create assistant profile"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit and evaluate assistant profile</h3>
              <p className="fg-muted">Keep the selected profile coherent, then evaluate a real assistant action against quiet hours and action policy truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.assistant_profile_id : "Select an assistant profile"}</span>
          </div>

          {detail ? (
            <div className="fg-stack">
              <form className="fg-stack" onSubmit={handleUpdate}>
                <h4>Save assistant profile</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Display name
                    <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                  </label>
                  <label>
                    Status
                    <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as AssistantProfileStatus }))}>
                      {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Tone
                    <select value={editForm.tone} onChange={(event) => setEditForm((current) => ({ ...current, tone: event.target.value as AssistantTone }))}>
                      {TONE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Summary
                  <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Assistant mode enabled
                    <select value={editForm.assistantModeEnabled} onChange={(event) => setEditForm((current) => ({ ...current, assistantModeEnabled: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>
                  <label>
                    Default profile
                    <select value={editForm.isDefault} onChange={(event) => setEditForm((current) => ({ ...current, isDefault: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>
                  <label>
                    Preferred contact ID
                    <input value={editForm.preferredContactId} onChange={(event) => setEditForm((current) => ({ ...current, preferredContactId: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Timezone
                    <input value={editForm.timezone} onChange={(event) => setEditForm((current) => ({ ...current, timezone: event.target.value }))} />
                  </label>
                  <label>
                    Locale
                    <input value={editForm.locale} onChange={(event) => setEditForm((current) => ({ ...current, locale: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Mail source ID
                    <input value={editForm.mailSourceId} onChange={(event) => setEditForm((current) => ({ ...current, mailSourceId: event.target.value }))} />
                  </label>
                  <label>
                    Calendar source ID
                    <input value={editForm.calendarSourceId} onChange={(event) => setEditForm((current) => ({ ...current, calendarSourceId: event.target.value }))} />
                  </label>
                </div>
                <label>
                  Preferences JSON
                  <textarea rows={4} value={editForm.preferencesJson} onChange={(event) => setEditForm((current) => ({ ...current, preferencesJson: event.target.value }))} />
                </label>
                <label>
                  Communication rules JSON
                  <textarea rows={4} value={editForm.communicationRulesJson} onChange={(event) => setEditForm((current) => ({ ...current, communicationRulesJson: event.target.value }))} />
                </label>
                <label>
                  Quiet hours JSON
                  <textarea rows={4} value={editForm.quietHoursJson} onChange={(event) => setEditForm((current) => ({ ...current, quietHoursJson: event.target.value }))} />
                </label>
                <label>
                  Delivery preferences JSON
                  <textarea rows={4} value={editForm.deliveryPreferencesJson} onChange={(event) => setEditForm((current) => ({ ...current, deliveryPreferencesJson: event.target.value }))} />
                </label>
                <label>
                  Action policies JSON
                  <textarea rows={4} value={editForm.actionPoliciesJson} onChange={(event) => setEditForm((current) => ({ ...current, actionPoliciesJson: event.target.value }))} />
                </label>
                <label>
                  Delegation rules JSON
                  <textarea rows={4} value={editForm.delegationRulesJson} onChange={(event) => setEditForm((current) => ({ ...current, delegationRulesJson: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={4} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>
                    {savingUpdate ? "Saving assistant profile" : "Save assistant profile"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleEvaluate}>
                <h4>Evaluate assistant action</h4>
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
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Requires external delivery
                    <select value={evaluationForm.requiresExternalDelivery} onChange={(event) => setEvaluationForm((current) => ({ ...current, requiresExternalDelivery: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>
                  <label>
                    Approval reference
                    <input value={evaluationForm.approvalReference} onChange={(event) => setEvaluationForm((current) => ({ ...current, approvalReference: event.target.value }))} />
                  </label>
                </div>
                <label>
                  Metadata JSON
                  <textarea rows={4} value={evaluationForm.metadataJson} onChange={(event) => setEvaluationForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={evaluating || !instanceId}>
                    {evaluating ? "Evaluating assistant action" : "Evaluate assistant action"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="fg-muted">Select an assistant profile before attempting a mutation or action evaluation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
