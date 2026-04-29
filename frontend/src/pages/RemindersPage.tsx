import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createReminder,
  fetchInstances,
  fetchReminderDetail,
  fetchReminders,
  updateReminder,
  type ReminderDetail,
  type ReminderStatus,
  type ReminderSummary,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildAutomationPath,
  buildConversationPath,
  buildNotificationPath,
  buildReminderPath,
  buildTaskPath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

type DrawerMode = "closed" | "create" | "edit";
type ReminderGroupKey = "overdue" | "due_now" | "upcoming" | "completed_cancelled";

const STATUS_OPTIONS: Array<ReminderStatus | "all"> = ["all", "scheduled", "due", "triggered", "dismissed", "cancelled"];
const DRAWER_FORM_ID = "reminder-drawer-form";

const DEFAULT_CREATE_FORM = {
  reminderId: "",
  taskId: "",
  automationId: "",
  title: "",
  summary: "",
  dueAt: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  taskId: "",
  title: "",
  summary: "",
  status: "scheduled" as ReminderStatus,
  dueAt: "",
  triggeredAt: "",
  notificationId: "",
  metadataJson: "{}",
};

function reminderStatusTone(status: ReminderStatus): "success" | "danger" | "warning" | "neutral" {
  if (status === "triggered" || status === "dismissed") {
    return "success";
  }
  if (status === "cancelled") {
    return "neutral";
  }
  if (status === "due") {
    return "danger";
  }
  return "warning";
}

function reminderGroupKey(reminder: Pick<ReminderSummary, "status" | "due_at">, nowMs: number): ReminderGroupKey {
  if (reminder.status === "triggered" || reminder.status === "dismissed" || reminder.status === "cancelled") {
    return "completed_cancelled";
  }

  const dueMs = Date.parse(reminder.due_at);
  if (Number.isNaN(dueMs)) {
    return "upcoming";
  }
  if (dueMs < nowMs) {
    return "overdue";
  }
  if (reminder.status === "due" || dueMs <= nowMs + (60 * 60 * 1000)) {
    return "due_now";
  }
  return "upcoming";
}

function reminderGroupHeading(group: ReminderGroupKey): string {
  switch (group) {
    case "overdue":
      return "Overdue";
    case "due_now":
      return "Due now";
    case "upcoming":
      return "Upcoming";
    case "completed_cancelled":
      return "Completed / cancelled";
    default:
      return group;
  }
}

function reminderDueBucket(detail: Pick<ReminderSummary, "status" | "due_at">, nowMs: number): string {
  return reminderGroupHeading(reminderGroupKey(detail, nowMs));
}

function reminderIsClosed(status: ReminderStatus): boolean {
  return status === "triggered" || status === "dismissed" || status === "cancelled";
}

export function RemindersPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedReminderId = searchParams.get("reminderId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ReminderStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [detail, setDetail] = useState<ReminderDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [actionState, setActionState] = useState<Record<"snooze" | "complete" | "cancel", boolean>>({
    snooze: false,
    complete: false,
    cancel: false,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const nowMs = Date.now();
  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const originConversationId = detail?.task?.conversation_id ?? detail?.notification?.conversation_id ?? null;
  const groupedReminders: Record<ReminderGroupKey, ReminderSummary[]> = {
    overdue: [],
    due_now: [],
    upcoming: [],
    completed_cancelled: [],
  };

  reminders.forEach((reminder) => {
    groupedReminders[reminderGroupKey(reminder, nowMs)].push(reminder);
  });

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
        setError(loadError instanceof Error ? loadError.message : "Reminder instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setReminders([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchReminders(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setReminders(payload.reminders);
        setListState("success");
        setError("");

        const nextReminderId = payload.reminders.some((reminder) => reminder.reminder_id === selectedReminderId)
          ? selectedReminderId
          : payload.reminders[0]?.reminder_id ?? "";
        if (nextReminderId !== selectedReminderId) {
          updateRoute((next) => {
            if (nextReminderId) {
              next.set("reminderId", nextReminderId);
            } else {
              next.delete("reminderId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setReminders([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Reminder inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedReminderId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedReminderId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchReminderDetail(selectedReminderId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.reminder);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Reminder detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedReminderId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      taskId: detail.task_id ?? "",
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      dueAt: detail.due_at,
      triggeredAt: detail.triggered_at ?? "",
      notificationId: detail.notification_id ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
  }, [detail]);

  const closeDrawer = () => {
    setDrawerMode("closed");
    setCreateForm(DEFAULT_CREATE_FORM);
  };

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!detail) {
      return;
    }
    setDrawerMode("edit");
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createReminder(instanceId, {
        reminder_id: normalizeOptional(createForm.reminderId),
        task_id: normalizeOptional(createForm.taskId),
        automation_id: normalizeOptional(createForm.automationId),
        title: createForm.title.trim(),
        summary: createForm.summary.trim(),
        due_at: createForm.dueAt.trim(),
        metadata: parseJsonObject(createForm.metadataJson, "Reminder metadata"),
      });
      closeDrawer();
      updateRoute((next) => {
        next.set("reminderId", payload.reminder.reminder_id);
      });
      setMessage(`Reminder ${payload.reminder.reminder_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Reminder creation failed.");
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
      const payload = await updateReminder(instanceId, detail.reminder_id, {
        task_id: normalizeOptional(editForm.taskId),
        title: editForm.title.trim(),
        summary: editForm.summary.trim(),
        status: editForm.status,
        due_at: normalizeOptional(editForm.dueAt),
        triggered_at: normalizeOptional(editForm.triggeredAt),
        notification_id: normalizeOptional(editForm.notificationId),
        metadata: parseJsonObject(editForm.metadataJson, "Reminder metadata"),
      });
      setMessage(`Reminder ${payload.reminder.reminder_id} updated.`);
      setRefreshNonce((current) => current + 1);
      setDrawerMode("closed");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Reminder update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAction = async (action: "snooze" | "complete" | "cancel") => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setActionState((current) => ({ ...current, [action]: true }));
    setError("");
    setMessage("");
    try {
      if (action === "snooze") {
        const nextDue = new Date(detail.due_at);
        if (Number.isNaN(nextDue.getTime())) {
          throw new Error("Reminder due_at is invalid and cannot be snoozed.");
        }
        nextDue.setUTCDate(nextDue.getUTCDate() + 1);
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "scheduled",
          due_at: nextDue.toISOString(),
          triggered_at: null,
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} snoozed by one day.`);
      } else if (action === "complete") {
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "dismissed",
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} marked complete.`);
      } else {
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "cancelled",
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} cancelled.`);
      }
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Reminder action '${action}' failed.`);
    } finally {
      setActionState((current) => ({ ...current, [action]: false }));
    }
  };

  const drawerModeLabel = drawerMode === "create" ? "Create Reminder" : "Edit Reminder";
  const drawerStatus = drawerMode === "create"
    ? (createForm.title.trim() && createForm.dueAt.trim() ? "form ready" : "title and due date required")
    : (detail ? detail.reminder_id : "select reminder");
  const drawerStatusTone = drawerMode === "create"
    ? (createForm.title.trim() && createForm.dueAt.trim() ? "success" : "danger")
    : detail
      ? reminderStatusTone(detail.status)
      : "warning";

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Reminders"
          description="ForgeFrame is restoring reminder scope before exposing due-state truth."
          question="Which reminder queue should open once the active session is restored?"
          links={[
            { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Return to task inventory while session state resolves." },
            { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Open delivery truth once the session is ready." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Reminders stay instance-scoped and must reconcile task, automation, and notification linkage."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Reminders"
          description="This route is reserved for operators and admins who can inspect real reminder truth."
          question="Which adjacent surface should remain open while reminder access is outside the current permission envelope?"
          links={[
            { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Review linked task truth instead." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Stay on the approval queue while reminder truth is unavailable." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic reminder shell when the session cannot inspect due-state truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Reminders"
        description="Reminder control plane grouped by due pressure, with direct snooze, complete, cancel, and linkage back to tasking, notification, conversation, and automation truth."
        question="Are overdue follow-ups visible and steerable, or is operator work still hidden behind generic reminder CRUD?"
        links={[
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Stay on the reminder inventory and detail surface." },
          { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Open the task layer linked to these reminders." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Open delivery truth linked to reminder actions." },
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Review recurring rules that generate reminders." },
        ]}
        badges={[
          { label: `${reminders.length} reminder${reminders.length === 1 ? "" : "s"}`, tone: reminders.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Reminders are not optional UI hints. They are persisted due-state objects with real linkage to tasking and delivery truth."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then filter by backend reminder status. ForgeFrame additionally groups the visible results into overdue, due now, upcoming, and completed / cancelled.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Reminder instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("reminderId");
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
              aria-label="Reminder status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("reminderId");
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
              <h3>Reminder inventory</h3>
              <p className="fg-muted">Visible reminders are grouped by urgency so overdue follow-ups surface before background upkeep.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
              <button type="button" disabled={!canMutate} onClick={openCreateDrawer}>New reminder</button>
            </div>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading reminder inventory.</p> : null}
          {listState === "success" && reminders.length === 0 ? <p className="fg-muted">No reminders matched the selected filters.</p> : null}

          {reminders.length > 0 ? (
            <div className="fg-stack">
              {(["overdue", "due_now", "upcoming", "completed_cancelled"] as ReminderGroupKey[]).map((group) => (
                groupedReminders[group].length > 0 ? (
                  <article key={group} className="fg-subcard">
                    <div className="fg-panel-heading">
                      <div>
                        <h4>{reminderGroupHeading(group)}</h4>
                        <p className="fg-muted">{groupedReminders[group].length} reminder{groupedReminders[group].length === 1 ? "" : "s"} in this bucket.</p>
                      </div>
                    </div>
                    <div className="fg-stack">
                      {groupedReminders[group].map((reminder) => (
                        <button
                          key={reminder.reminder_id}
                          type="button"
                          className={`fg-data-row${reminder.reminder_id === selectedReminderId ? " is-current" : ""}`}
                          onClick={() => updateRoute((next) => {
                            next.set("reminderId", reminder.reminder_id);
                          })}
                        >
                          <div className="fg-panel-heading fg-data-row-heading">
                            <div className="fg-page-header">
                              <span className="fg-code">{reminder.reminder_id}</span>
                              <strong>{reminder.title}</strong>
                            </div>
                            <div className="fg-actions">
                              <span className="fg-pill" data-tone={reminderStatusTone(reminder.status)}>{reminder.status}</span>
                            </div>
                          </div>
                          <div className="fg-detail-grid">
                            <span className="fg-muted">task {reminder.task_id ?? "none"} · automation {reminder.automation_id ?? "none"} · notification {reminder.notification_id ?? "none"}</span>
                            <span className="fg-muted">due {reminder.due_at} · timezone UTC</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                ) : null
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Reminder detail</h3>
              <p className="fg-muted">Origin, exact due timing, steering actions, and delivery linkage converge here.</p>
            </div>
            <div className="fg-actions">
              {detail ? <span className="fg-pill">{detail.reminder_id}</span> : null}
              <button type="button" disabled={!canMutate || !detail} onClick={openEditDrawer}>Edit selected reminder</button>
            </div>
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a reminder to inspect due-state truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading reminder detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={reminderStatusTone(detail.status)}>{detail.status}</span>
                <span className="fg-pill">{reminderDueBucket(detail, nowMs)}</span>
                <span className="fg-pill">timezone {viewerTimeZone}</span>
              </div>

              <article className="fg-subcard">
                <h4>Timing</h4>
                <ul className="fg-list">
                  <li>Exact due at: {detail.due_at}</li>
                  <li>Viewer time zone: {viewerTimeZone}</li>
                  <li>Due bucket: {reminderDueBucket(detail, nowMs)}</li>
                  <li>Triggered at: {detail.triggered_at ?? "Not triggered"}</li>
                </ul>
                <p className="fg-muted">ForgeFrame shows the raw ISO deadline from the backend and labels the effective urgency bucket separately so overdue reminders are immediately visible.</p>
              </article>

              <article className="fg-subcard">
                <h4>Origin</h4>
                <ul className="fg-list">
                  <li>Task: {detail.task_id ?? "Not linked"}</li>
                  <li>Conversation: {originConversationId ?? "Bridge-only through task or notification"}</li>
                  <li>Automation: {detail.automation_id ?? "Not linked"}</li>
                  <li>Notification: {detail.notification_id ?? "Not linked"}</li>
                </ul>
                <div className="fg-actions">
                  {detail.task ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.task_id })}>Open task</Link> : null}
                  {originConversationId ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: originConversationId })}>Open conversation</Link> : null}
                  {detail.automation_id ? <Link className="fg-nav-link" to={buildAutomationPath({ instanceId, automationId: detail.automation_id })}>Open automation</Link> : null}
                  {detail.notification ? <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: detail.notification.notification_id })}>Open notification</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Reminder actions</h4>
                <p className="fg-muted">Snooze, complete, and cancel use the real reminder update API. Closed reminders stay visible but are no longer presented as actively steerable.</p>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || reminderIsClosed(detail.status) || actionState.snooze} onClick={() => void handleAction("snooze")}>
                    {actionState.snooze ? "Snoozing" : "Snooze 1 day"}
                  </button>
                  <button type="button" disabled={!canMutate || reminderIsClosed(detail.status) || actionState.complete} onClick={() => void handleAction("complete")}>
                    {actionState.complete ? "Completing" : "Complete reminder"}
                  </button>
                  <button type="button" disabled={!canMutate || reminderIsClosed(detail.status) || actionState.cancel} onClick={() => void handleAction("cancel")}>
                    {actionState.cancel ? "Cancelling" : "Cancel reminder"}
                  </button>
                </div>
                {reminderIsClosed(detail.status) ? (
                  <p className="fg-muted">This reminder is already completed or cancelled. Use the drawer only for corrective metadata edits, not as a fake active control surface.</p>
                ) : null}
              </article>

              <article className="fg-subcard">
                <h4>Summary text</h4>
                <p>{detail.summary || "No reminder summary was recorded."}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Task linkage</h4>
                  {detail.task ? (
                    <div className="fg-stack">
                      <p>
                        <strong>{detail.task.title}</strong>
                        {" · "}{detail.task.status}
                      </p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.task_id })}>Open task</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No task is linked to this reminder.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Notification linkage</h4>
                  {detail.notification ? (
                    <div className="fg-stack">
                      <p>
                        <strong>{detail.notification.title}</strong>
                        {" · "}{detail.notification.delivery_status}
                      </p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: detail.notification.notification_id })}>Open notification</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No notification is linked to this reminder.</p>}
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerModeLabel}
        description={drawerMode === "create"
          ? "Create a persisted follow-up without turning the reminder page back into a permanent form wall."
          : "Adjust linkage, timing, and metadata inside a focused drawer."}
        status={drawerStatus}
        statusTone={drawerStatusTone}
        properties={[
          { label: "Scope", value: instanceId || "No instance selected" },
          { label: "Direct controls", value: "snooze / complete / cancel via reminder PATCH" },
          { label: "Time display", value: `Raw due_at plus viewer timezone (${viewerTimeZone})` },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={!canMutate || (drawerMode === "create" ? savingCreate || !createForm.title.trim() || !createForm.dueAt.trim() : savingUpdate || !detail)}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating reminder" : "Create reminder") : (savingUpdate ? "Saving reminder" : "Save reminder changes")}
            </button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          <section className="fg-subcard">
            <h4>Identity</h4>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "create" ? (
                <label>
                  Reminder ID
                  <input value={createForm.reminderId} onChange={(event) => setCreateForm((current) => ({ ...current, reminderId: event.target.value }))} placeholder="reminder_customer_pricing" />
                </label>
              ) : null}
              <label>
                Task ID
                <input
                  value={drawerMode === "create" ? createForm.taskId : editForm.taskId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, taskId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, taskId: nextValue }));
                  }}
                />
              </label>
              {drawerMode === "create" ? (
                <label>
                  Automation ID
                  <input value={createForm.automationId} onChange={(event) => setCreateForm((current) => ({ ...current, automationId: event.target.value }))} />
                </label>
              ) : (
                <label>
                  Notification ID
                  <input value={editForm.notificationId} onChange={(event) => setEditForm((current) => ({ ...current, notificationId: event.target.value }))} />
                </label>
              )}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Timing and state</h4>
            <label>
              Title
              <input
                value={drawerMode === "create" ? createForm.title : editForm.title}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, title: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, title: nextValue }));
                }}
                placeholder="Follow up now"
              />
            </label>
            <label>
              Summary
              <textarea
                rows={4}
                value={drawerMode === "create" ? createForm.summary : editForm.summary}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, summary: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, summary: nextValue }));
                }}
              />
            </label>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "edit" ? (
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ReminderStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ) : null}
              <label>
                Due at
                <input
                  value={drawerMode === "create" ? createForm.dueAt : editForm.dueAt}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, dueAt: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, dueAt: nextValue }));
                  }}
                  placeholder="2026-04-23T10:30:00Z"
                />
              </label>
              {drawerMode === "edit" ? (
                <label>
                  Triggered at
                  <input value={editForm.triggeredAt} onChange={(event) => setEditForm((current) => ({ ...current, triggeredAt: event.target.value }))} />
                </label>
              ) : null}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Metadata</h4>
            <label>
              Metadata JSON
              <textarea
                rows={6}
                value={drawerMode === "create" ? createForm.metadataJson : editForm.metadataJson}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, metadataJson: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, metadataJson: nextValue }));
                }}
              />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </section>
  );
}
