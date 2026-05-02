import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createAutomation,
  fetchAutomationDetail,
  fetchAutomations,
  triggerAutomation,
  updateAutomation,
  type AutomationActionKind,
  type AutomationDetail,
  type AutomationStatus,
  type AutomationSummary,
} from "../api/domain/automations";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildChannelPath,
  buildConversationPath,
  buildInboxPath,
  buildNotificationPath,
  buildReminderPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseInteger, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

type ScheduleUnit = "minutes" | "hours" | "days";

const STATUS_OPTIONS: Array<AutomationStatus | "all"> = ["all", "active", "paused", "archived"];
const ACTION_KIND_OPTIONS: AutomationActionKind[] = ["create_follow_up", "create_reminder", "create_notification"];

const DEFAULT_CREATE_FORM = {
  automationId: "",
  title: "",
  summary: "",
  actionKind: "create_follow_up" as AutomationActionKind,
  cadenceMinutes: "60",
  nextRunAt: "",
  targetTaskId: "",
  targetConversationId: "",
  targetInboxId: "",
  targetWorkspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  previewRequired: "yes" as "yes" | "no",
  taskTemplateTitle: "",
  taskTemplateSummary: "",
  notificationTitle: "",
  notificationBody: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  title: "",
  summary: "",
  status: "active" as AutomationStatus,
  cadenceMinutes: "60",
  nextRunAt: "",
  targetTaskId: "",
  targetConversationId: "",
  targetInboxId: "",
  targetWorkspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  previewRequired: "yes" as "yes" | "no",
  taskTemplateTitle: "",
  taskTemplateSummary: "",
  notificationTitle: "",
  notificationBody: "",
  metadataJson: "{}",
};

function cadenceToStructured(cadenceMinutes: string | number): { every: string; unit: ScheduleUnit } {
  const minutes = typeof cadenceMinutes === "number"
    ? cadenceMinutes
    : parseInteger(String(cadenceMinutes), 60);
  if (minutes % 1440 === 0) {
    return { every: String(Math.max(1, minutes / 1440)), unit: "days" };
  }
  if (minutes % 60 === 0) {
    return { every: String(Math.max(1, minutes / 60)), unit: "hours" };
  }
  return { every: String(Math.max(1, minutes)), unit: "minutes" };
}

function structuredToCadence(every: string, unit: ScheduleUnit): string {
  const normalized = Math.max(1, parseInteger(every, 1));
  if (unit === "days") {
    return String(normalized * 1440);
  }
  if (unit === "hours") {
    return String(normalized * 60);
  }
  return String(normalized);
}

function automationStatusTone(status: AutomationStatus): "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }
  if (status === "paused") {
    return "warning";
  }
  return "danger";
}

function automationTargetLabel(automation: Pick<AutomationSummary, "target_task_id" | "target_conversation_id" | "target_inbox_id" | "target_workspace_id">): string {
  const parts = [
    automation.target_task_id ? `task ${automation.target_task_id}` : null,
    automation.target_conversation_id ? `conversation ${automation.target_conversation_id}` : null,
    automation.target_inbox_id ? `inbox ${automation.target_inbox_id}` : null,
    automation.target_workspace_id ? `workspace ${automation.target_workspace_id}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "no target";
}

function automationOutcomeLabel(automation: Pick<AutomationSummary, "last_notification_id" | "last_reminder_id" | "last_task_id">): string {
  if (automation.last_notification_id) {
    return `notification ${automation.last_notification_id}`;
  }
  if (automation.last_reminder_id) {
    return `reminder ${automation.last_reminder_id}`;
  }
  if (automation.last_task_id) {
    return `task ${automation.last_task_id}`;
  }
  return "none yet";
}

function automationHasExternalEffect(automation: Pick<AutomationSummary, "action_kind" | "channel_id" | "fallback_channel_id" | "preview_required">): boolean {
  return automation.action_kind === "create_notification" || Boolean(automation.channel_id || automation.fallback_channel_id || automation.preview_required === false);
}

export function AutomationsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedAutomationId = searchParams.get("automationId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AutomationStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [showCreateAdvancedSchedule, setShowCreateAdvancedSchedule] = useState(false);
  const [showEditAdvancedSchedule, setShowEditAdvancedSchedule] = useState(false);
  const [lastTriggerResult, setLastTriggerResult] = useState<{ triggeredAt: string; automation: AutomationDetail } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const createSchedule = cadenceToStructured(createForm.cadenceMinutes);
  const editSchedule = cadenceToStructured(editForm.cadenceMinutes);

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
        setError(loadError instanceof Error ? loadError.message : "Automation instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setAutomations([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchAutomations(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setAutomations(payload.automations);
        setListState("success");
        setError("");

        const nextAutomationId = payload.automations.some((automation) => automation.automation_id === selectedAutomationId)
          ? selectedAutomationId
          : payload.automations[0]?.automation_id ?? "";
        if (nextAutomationId !== selectedAutomationId) {
          updateRoute((next) => {
            if (nextAutomationId) {
              next.set("automationId", nextAutomationId);
            } else {
              next.delete("automationId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setAutomations([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Automation inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedAutomationId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedAutomationId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchAutomationDetail(selectedAutomationId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.automation);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Automation detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedAutomationId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setShowEditAdvancedSchedule(false);
      return;
    }

    setEditForm({
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      cadenceMinutes: String(detail.cadence_minutes),
      nextRunAt: detail.next_run_at,
      targetTaskId: detail.target_task_id ?? "",
      targetConversationId: detail.target_conversation_id ?? "",
      targetInboxId: detail.target_inbox_id ?? "",
      targetWorkspaceId: detail.target_workspace_id ?? "",
      channelId: detail.channel_id ?? "",
      fallbackChannelId: detail.fallback_channel_id ?? "",
      previewRequired: detail.preview_required ? "yes" : "no",
      taskTemplateTitle: "",
      taskTemplateSummary: "",
      notificationTitle: "",
      notificationBody: "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setShowEditAdvancedSchedule(false);
  }, [detail]);

  useEffect(() => {
    setLastTriggerResult(null);
  }, [selectedAutomationId]);

  const buildAutomationPayload = (form: typeof DEFAULT_CREATE_FORM | typeof DEFAULT_EDIT_FORM) => ({
    title: form.title.trim(),
    summary: form.summary.trim(),
    cadence_minutes: parseInteger(form.cadenceMinutes, 60),
    next_run_at: form.nextRunAt.trim(),
    target_task_id: normalizeOptional(form.targetTaskId),
    target_conversation_id: normalizeOptional(form.targetConversationId),
    target_inbox_id: normalizeOptional(form.targetInboxId),
    target_workspace_id: normalizeOptional(form.targetWorkspaceId),
    channel_id: normalizeOptional(form.channelId),
    fallback_channel_id: normalizeOptional(form.fallbackChannelId),
    preview_required: form.previewRequired === "yes",
    task_template_title: normalizeOptional(form.taskTemplateTitle),
    task_template_summary: normalizeOptional(form.taskTemplateSummary),
    notification_title: normalizeOptional(form.notificationTitle),
    notification_body: normalizeOptional(form.notificationBody),
    metadata: parseJsonObject(form.metadataJson, "Automation metadata"),
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createAutomation(instanceId, {
        automation_id: normalizeOptional(createForm.automationId),
        action_kind: createForm.actionKind,
        ...buildAutomationPayload(createForm),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setShowCreateAdvancedSchedule(false);
      updateRoute((next) => {
        next.set("automationId", payload.automation.automation_id);
      });
      setMessage(`Automation ${payload.automation.automation_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Automation creation failed.");
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
      const payload = await updateAutomation(instanceId, detail.automation_id, {
        status: editForm.status,
        ...buildAutomationPayload(editForm),
      });
      setMessage(`Automation ${payload.automation.automation_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Automation update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleTrigger = async () => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setTriggering(true);
    setError("");
    setMessage("");
    try {
      const payload = await triggerAutomation(instanceId, detail.automation_id);
      setLastTriggerResult({
        triggeredAt: new Date().toISOString(),
        automation: payload.automation,
      });
      setMessage(`Automation ${payload.automation.automation_id} tested now.`);
      setRefreshNonce((current) => current + 1);
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : "Automation trigger failed.");
    } finally {
      setTriggering(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Automations"
          description="ForgeFrame is restoring recurring-rule scope before exposing trigger truth."
          question="Which automation inventory should open once the active session is restored?"
          links={[
            { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect reminder truth while session state resolves." },
            { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect delivery truth once session scope returns." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Automations stay instance-scoped and must expose target linkage plus real trigger outcomes."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Automations"
          description="This route is reserved for operators and admins who can inspect real recurring-rule truth."
          question="Which adjacent surface should remain open while automation access is outside the current permission envelope?"
          links={[
            { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect reminder truth without opening automation rules." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Stay on the approval queue while automation truth is unavailable." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic automation shell when the session cannot inspect recurring-rule truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Automations"
        description="Persistent recurring rules with cadence, target linkage, trigger history, and last materialized task, reminder, or notification."
        question="Are recurring actions actually visible and controllable, or are follow-ups still hiding in cron-like folklore?"
        links={[
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Stay on the automation inventory and detail surface." },
          { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Inspect follow-up tasks materialized by these rules." },
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect reminders created by automation rules." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect delivery records created by automation rules." },
        ]}
        badges={[
          { label: `${automations.length} automation${automations.length === 1 ? "" : "s"}`, tone: automations.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Automations are first-class product rules. Cadence, targets, and last trigger outputs must remain visible and operator-controlled."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain recurring rules by lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Automation instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("automationId");
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
              aria-label="Automation status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("automationId");
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
              <h3>Automation inventory</h3>
              <p className="fg-muted">Each row is a persisted recurring rule with real schedule, target, and materialized outcome posture.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading automation inventory.</p> : null}
          {listState === "success" && automations.length === 0 ? <p className="fg-muted">No automations matched the selected filters.</p> : null}

          {automations.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Automation inventory">
                <thead>
                  <tr>
                    <th>Automation</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th>Next run</th>
                    <th>Last run</th>
                    <th>Target</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.map((automation) => (
                    <tr key={automation.automation_id} className={automation.automation_id === selectedAutomationId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => {
                            next.set("automationId", automation.automation_id);
                          })}
                        >
                          {automation.title}
                        </button>
                        <div className="fg-muted">{automation.automation_id} · {automation.action_kind}</div>
                      </td>
                      <td><span className="fg-pill" data-tone={automationStatusTone(automation.status)}>{automation.status}</span></td>
                      <td>every {cadenceToStructured(automation.cadence_minutes).every} {cadenceToStructured(automation.cadence_minutes).unit}</td>
                      <td>{automation.next_run_at}</td>
                      <td>{automation.last_run_at ?? "Never"}</td>
                      <td>{automationTargetLabel(automation)}</td>
                      <td>{automationOutcomeLabel(automation)}</td>
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
              <h3>Automation detail</h3>
              <p className="fg-muted">Target linkage, trigger history, governance posture, and latest test result converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.automation_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an automation to inspect recurring-rule truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading automation detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Status: {detail.status}</li>
                  <li>Action kind: {detail.action_kind}</li>
                  <li>Schedule: every {cadenceToStructured(detail.cadence_minutes).every} {cadenceToStructured(detail.cadence_minutes).unit}</li>
                  <li>Raw cadence minutes: {detail.cadence_minutes}</li>
                  <li>Next run: {detail.next_run_at}</li>
                  <li>Last run: {detail.last_run_at ?? "Never triggered"}</li>
                  <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
                </ul>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || triggering} onClick={() => void handleTrigger()}>
                    {triggering ? "Testing automation" : "Test now"}
                  </button>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Trigger history</h4>
                <ul className="fg-list">
                  <li>Last run at: {detail.last_run_at ?? "Never triggered"}</li>
                  <li>Next run at: {detail.next_run_at}</li>
                  <li>Last task output: {detail.last_task_id ?? "None"}</li>
                  <li>Last reminder output: {detail.last_reminder_id ?? "None"}</li>
                  <li>Last notification output: {detail.last_notification_id ?? "None"}</li>
                  <li>Historical run ledger: bridge-only in the current backend model</li>
                </ul>
                <div className="fg-actions">
                  {detail.last_task_id ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.last_task_id })}>Open last task</Link> : null}
                  {detail.last_reminder_id ? <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: detail.last_reminder_id })}>Open last reminder</Link> : null}
                  {detail.last_notification_id ? <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: detail.last_notification_id })}>Open last notification</Link> : null}
                </div>
                <p className="fg-muted">ForgeFrame currently receives the latest materialized outputs and `last_run_at`, but no full per-run ledger or run object linkage. That limit is shown explicitly instead of being faked as history.</p>
              </article>

              {lastTriggerResult ? (
                <article className="fg-subcard">
                  <h4>Latest test trigger</h4>
                  <ul className="fg-list">
                    <li>Triggered at: {lastTriggerResult.triggeredAt}</li>
                    <li>Last run after test: {lastTriggerResult.automation.last_run_at ?? "No last run returned"}</li>
                    <li>Resulting task: {lastTriggerResult.automation.last_task_id ?? "None"}</li>
                    <li>Resulting reminder: {lastTriggerResult.automation.last_reminder_id ?? "None"}</li>
                    <li>Resulting notification: {lastTriggerResult.automation.last_notification_id ?? "None"}</li>
                  </ul>
                  <div className="fg-actions">
                    {lastTriggerResult.automation.last_task_id ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: lastTriggerResult.automation.last_task_id })}>Open tested task</Link> : null}
                    {lastTriggerResult.automation.last_reminder_id ? <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: lastTriggerResult.automation.last_reminder_id })}>Open tested reminder</Link> : null}
                    {lastTriggerResult.automation.last_notification_id ? <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: lastTriggerResult.automation.last_notification_id })}>Open tested notification</Link> : null}
                  </div>
                </article>
              ) : null}

              <article className="fg-subcard">
                <h4>Target linkage</h4>
                <ul className="fg-list">
                  <li>Task: {detail.target_task_id ?? "Not linked"}</li>
                  <li>Conversation: {detail.target_conversation_id ?? "Not linked"}</li>
                  <li>Inbox: {detail.target_inbox_id ?? "Not linked"}</li>
                  <li>Workspace: {detail.target_workspace_id ?? "Not linked"}</li>
                  <li>Channel: {detail.channel_id ?? "Not linked"}</li>
                  <li>Fallback channel: {detail.fallback_channel_id ?? "Not configured"}</li>
                </ul>
                <div className="fg-actions">
                  {detail.target_task_id ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.target_task_id })}>Open target task</Link> : null}
                  {detail.target_conversation_id ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.target_conversation_id })}>Open conversation</Link> : null}
                  {detail.target_inbox_id ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.target_inbox_id })}>Open inbox item</Link> : null}
                  {detail.target_workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.target_workspace_id })}>Open workspace</Link> : null}
                  {detail.channel_id ? <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.channel_id })}>Open channel</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Governance</h4>
                <ul className="fg-list">
                  <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
                  <li>External effect: {automationHasExternalEffect(detail) ? "possible" : "internal only"}</li>
                  <li>Approval-specific governance: bridge-only in the current automation model</li>
                </ul>
                <p className="fg-muted">
                  {automationHasExternalEffect(detail)
                    ? (detail.preview_required
                      ? "This automation can create outward-facing delivery objects, but preview gating is still required before final delivery."
                      : "This automation can create outward-facing delivery objects without preview gating. Treat it as high-impact automation, not as harmless housekeeping.")
                    : "This automation currently materializes internal follow-up objects only and does not present as an external delivery rule."}
                </p>
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create automation</h3>
              <p className="fg-muted">Create a recurring rule with a structured schedule editor. Advanced raw cadence stays available, but it is not the default authoring path.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Automation ID
                <input value={createForm.automationId} onChange={(event) => setCreateForm((current) => ({ ...current, automationId: event.target.value }))} placeholder="automation_follow_up_alpha" />
              </label>
              <label>
                Action kind
                <select value={createForm.actionKind} onChange={(event) => setCreateForm((current) => ({ ...current, actionKind: event.target.value as AutomationActionKind }))}>
                  {ACTION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Create follow-up" />
            </label>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <section className="fg-subcard">
              <h4>Schedule editor</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Every
                  <input
                    value={createSchedule.every}
                    onChange={(event) => setCreateForm((current) => ({
                      ...current,
                      cadenceMinutes: structuredToCadence(event.target.value, cadenceToStructured(current.cadenceMinutes).unit),
                    }))}
                  />
                </label>
                <label>
                  Unit
                  <select
                    value={createSchedule.unit}
                    onChange={(event) => setCreateForm((current) => ({
                      ...current,
                      cadenceMinutes: structuredToCadence(cadenceToStructured(current.cadenceMinutes).every, event.target.value as ScheduleUnit),
                    }))}
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </label>
                <label>
                  Next run at
                  <input value={createForm.nextRunAt} onChange={(event) => setCreateForm((current) => ({ ...current, nextRunAt: event.target.value }))} placeholder="2026-04-23T10:30:00Z" />
                </label>
              </div>
              <div className="fg-actions">
                <button type="button" onClick={() => setShowCreateAdvancedSchedule((current) => !current)}>
                  {showCreateAdvancedSchedule ? "Hide advanced fields" : "Show advanced fields"}
                </button>
              </div>
              {showCreateAdvancedSchedule ? (
                <>
                  <label>
                    Advanced raw cadence minutes
                    <input value={createForm.cadenceMinutes} onChange={(event) => setCreateForm((current) => ({ ...current, cadenceMinutes: event.target.value }))} />
                  </label>
                  <label>
                    Metadata JSON
                    <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                  </label>
                </>
              ) : null}
            </section>
            <div className="fg-grid fg-grid-compact">
              <label>
                Target task ID
                <input value={createForm.targetTaskId} onChange={(event) => setCreateForm((current) => ({ ...current, targetTaskId: event.target.value }))} />
              </label>
              <label>
                Target conversation ID
                <input value={createForm.targetConversationId} onChange={(event) => setCreateForm((current) => ({ ...current, targetConversationId: event.target.value }))} />
              </label>
              <label>
                Target inbox ID
                <input value={createForm.targetInboxId} onChange={(event) => setCreateForm((current) => ({ ...current, targetInboxId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Target workspace ID
                <input value={createForm.targetWorkspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, targetWorkspaceId: event.target.value }))} />
              </label>
              <label>
                Channel ID
                <input value={createForm.channelId} onChange={(event) => setCreateForm((current) => ({ ...current, channelId: event.target.value }))} />
              </label>
              <label>
                Fallback channel ID
                <input value={createForm.fallbackChannelId} onChange={(event) => setCreateForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Preview required
                <select value={createForm.previewRequired} onChange={(event) => setCreateForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
              <label>
                Task template title
                <input value={createForm.taskTemplateTitle} onChange={(event) => setCreateForm((current) => ({ ...current, taskTemplateTitle: event.target.value }))} />
              </label>
              <label>
                Notification title
                <input value={createForm.notificationTitle} onChange={(event) => setCreateForm((current) => ({ ...current, notificationTitle: event.target.value }))} />
              </label>
            </div>
            <label>
              Task template summary
              <textarea rows={3} value={createForm.taskTemplateSummary} onChange={(event) => setCreateForm((current) => ({ ...current, taskTemplateSummary: event.target.value }))} />
            </label>
            <label>
              Notification body
              <textarea rows={3} value={createForm.notificationBody} onChange={(event) => setCreateForm((current) => ({ ...current, notificationBody: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.nextRunAt.trim()}>
                {savingCreate ? "Creating automation" : "Create automation"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit automation</h3>
              <p className="fg-muted">Keep cadence, targets, and preview posture coherent for the selected recurring rule. Structured schedule inputs stay primary; raw cadence is explicitly advanced.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.automation_id : "Select an automation"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <label>
                Title
                <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Summary
                <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as AutomationStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <section className="fg-subcard">
                <h4>Schedule editor</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Every
                    <input
                      value={editSchedule.every}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        cadenceMinutes: structuredToCadence(event.target.value, cadenceToStructured(current.cadenceMinutes).unit),
                      }))}
                    />
                  </label>
                  <label>
                    Unit
                    <select
                      value={editSchedule.unit}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        cadenceMinutes: structuredToCadence(cadenceToStructured(current.cadenceMinutes).every, event.target.value as ScheduleUnit),
                      }))}
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </label>
                  <label>
                    Next run at
                    <input value={editForm.nextRunAt} onChange={(event) => setEditForm((current) => ({ ...current, nextRunAt: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-actions">
                  <button type="button" onClick={() => setShowEditAdvancedSchedule((current) => !current)}>
                    {showEditAdvancedSchedule ? "Hide advanced fields" : "Show advanced fields"}
                  </button>
                </div>
                {showEditAdvancedSchedule ? (
                  <>
                    <label>
                      Advanced raw cadence minutes
                      <input value={editForm.cadenceMinutes} onChange={(event) => setEditForm((current) => ({ ...current, cadenceMinutes: event.target.value }))} />
                    </label>
                    <label>
                      Metadata JSON
                      <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                    </label>
                  </>
                ) : null}
              </section>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Target task ID
                  <input value={editForm.targetTaskId} onChange={(event) => setEditForm((current) => ({ ...current, targetTaskId: event.target.value }))} />
                </label>
                <label>
                  Target conversation ID
                  <input value={editForm.targetConversationId} onChange={(event) => setEditForm((current) => ({ ...current, targetConversationId: event.target.value }))} />
                </label>
                <label>
                  Target inbox ID
                  <input value={editForm.targetInboxId} onChange={(event) => setEditForm((current) => ({ ...current, targetInboxId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Target workspace ID
                  <input value={editForm.targetWorkspaceId} onChange={(event) => setEditForm((current) => ({ ...current, targetWorkspaceId: event.target.value }))} />
                </label>
                <label>
                  Channel ID
                  <input value={editForm.channelId} onChange={(event) => setEditForm((current) => ({ ...current, channelId: event.target.value }))} />
                </label>
                <label>
                  Fallback channel ID
                  <input value={editForm.fallbackChannelId} onChange={(event) => setEditForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Preview required
                  <select value={editForm.previewRequired} onChange={(event) => setEditForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </label>
                <label>
                  Task template title
                  <input value={editForm.taskTemplateTitle} onChange={(event) => setEditForm((current) => ({ ...current, taskTemplateTitle: event.target.value }))} />
                </label>
                <label>
                  Notification title
                  <input value={editForm.notificationTitle} onChange={(event) => setEditForm((current) => ({ ...current, notificationTitle: event.target.value }))} />
                </label>
              </div>
              <label>
                Task template summary
                <textarea rows={3} value={editForm.taskTemplateSummary} onChange={(event) => setEditForm((current) => ({ ...current, taskTemplateSummary: event.target.value }))} />
              </label>
              <label>
                Notification body
                <textarea rows={3} value={editForm.notificationBody} onChange={(event) => setEditForm((current) => ({ ...current, notificationBody: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving automation" : "Save automation"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select an automation before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
