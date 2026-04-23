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
import { buildNotificationPath, buildTaskPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<ReminderStatus | "all"> = ["all", "scheduled", "due", "triggered", "dismissed", "cancelled"];

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
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
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
      setCreateForm(DEFAULT_CREATE_FORM);
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Reminder update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

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
        description="Persistent reminder inventory with due-state truth, task linkage, notification linkage, and trigger timestamps."
        question="Are follow-ups actually scheduled and visible, or is work still relying on memory and operator guesswork?"
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
            <p className="fg-muted">Choose the instance boundary, then constrain the reminder inventory by due-state posture.</p>
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
              <p className="fg-muted">Each row is a persisted due-state object, not a mental note.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading reminder inventory.</p> : null}
          {listState === "success" && reminders.length === 0 ? <p className="fg-muted">No reminders matched the selected filters.</p> : null}

          {reminders.length > 0 ? (
            <div className="fg-stack">
              {reminders.map((reminder) => (
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
                      <span className="fg-pill" data-tone={reminder.status === "triggered" ? "success" : reminder.status === "cancelled" ? "danger" : "warning"}>{reminder.status}</span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">task {reminder.task_id ?? "none"} · automation {reminder.automation_id ?? "none"}</span>
                    <span className="fg-muted">due {reminder.due_at}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Reminder detail</h3>
              <p className="fg-muted">Task linkage, notification linkage, and trigger truth converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.reminder_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a reminder to inspect due-state truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading reminder detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Status: {detail.status}</li>
                  <li>Due at: {detail.due_at}</li>
                  <li>Triggered at: {detail.triggered_at ?? "Not triggered"}</li>
                  <li>Task: {detail.task_id ?? "Not linked"}</li>
                  <li>Automation: {detail.automation_id ?? "Not linked"}</li>
                  <li>Notification: {detail.notification_id ?? "Not linked"}</li>
                </ul>
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

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create reminder</h3>
              <p className="fg-muted">Create a persisted due-state object instead of relying on operator memory.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Reminder ID
                <input value={createForm.reminderId} onChange={(event) => setCreateForm((current) => ({ ...current, reminderId: event.target.value }))} placeholder="reminder_customer_pricing" />
              </label>
              <label>
                Task ID
                <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} />
              </label>
              <label>
                Automation ID
                <input value={createForm.automationId} onChange={(event) => setCreateForm((current) => ({ ...current, automationId: event.target.value }))} />
              </label>
            </div>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Follow up now" />
            </label>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <label>
              Due at
              <input value={createForm.dueAt} onChange={(event) => setCreateForm((current) => ({ ...current, dueAt: event.target.value }))} placeholder="2026-04-23T10:30:00Z" />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.dueAt.trim()}>
                {savingCreate ? "Creating reminder" : "Create reminder"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit reminder</h3>
              <p className="fg-muted">Keep the selected reminder aligned with task, notification, and trigger truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.reminder_id : "Select a reminder"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Task ID
                  <input value={editForm.taskId} onChange={(event) => setEditForm((current) => ({ ...current, taskId: event.target.value }))} />
                </label>
                <label>
                  Notification ID
                  <input value={editForm.notificationId} onChange={(event) => setEditForm((current) => ({ ...current, notificationId: event.target.value }))} />
                </label>
              </div>
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
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ReminderStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Due at
                  <input value={editForm.dueAt} onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))} />
                </label>
                <label>
                  Triggered at
                  <input value={editForm.triggeredAt} onChange={(event) => setEditForm((current) => ({ ...current, triggeredAt: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving reminder" : "Save reminder"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a reminder before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
