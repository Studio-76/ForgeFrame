import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createTask,
  fetchInstances,
  fetchTaskDetail,
  fetchTasks,
  updateTask,
  type TaskDetail,
  type TaskKind,
  type TaskStatus,
  type TaskSummary,
  type WorkItemPriority,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildConversationPath,
  buildInboxPath,
  buildNotificationPath,
  buildReminderPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<TaskStatus | "all"> = ["all", "open", "in_progress", "blocked", "done", "cancelled"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
const TASK_KIND_OPTIONS: TaskKind[] = ["task", "follow_up"];

const DEFAULT_CREATE_FORM = {
  taskId: "",
  taskKind: "task" as TaskKind,
  title: "",
  summary: "",
  status: "open" as TaskStatus,
  priority: "normal" as WorkItemPriority,
  ownerId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  dueAt: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  title: "",
  summary: "",
  status: "open" as TaskStatus,
  priority: "normal" as WorkItemPriority,
  ownerId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  dueAt: "",
  completedAt: "",
  metadataJson: "{}",
};

export function TasksPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedTaskId = searchParams.get("taskId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as TaskStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
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
        setError(loadError instanceof Error ? loadError.message : "Task instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setTasks([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchTasks(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setTasks(payload.tasks);
        setListState("success");
        setError("");

        const nextTaskId = payload.tasks.some((task) => task.task_id === selectedTaskId)
          ? selectedTaskId
          : payload.tasks[0]?.task_id ?? "";
        if (nextTaskId !== selectedTaskId) {
          updateRoute((next) => {
            if (nextTaskId) {
              next.set("taskId", nextTaskId);
            } else {
              next.delete("taskId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setTasks([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Task inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedTaskId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedTaskId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchTaskDetail(selectedTaskId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.task);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Task detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedTaskId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      priority: detail.priority,
      ownerId: detail.owner_id ?? "",
      conversationId: detail.conversation_id ?? "",
      inboxId: detail.inbox_id ?? "",
      workspaceId: detail.workspace_id ?? "",
      dueAt: detail.due_at ?? "",
      completedAt: detail.completed_at ?? "",
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
      const payload = await createTask(instanceId, {
        task_id: normalizeOptional(createForm.taskId),
        task_kind: createForm.taskKind,
        title: createForm.title.trim(),
        summary: createForm.summary.trim(),
        status: createForm.status,
        priority: createForm.priority,
        owner_id: normalizeOptional(createForm.ownerId),
        conversation_id: normalizeOptional(createForm.conversationId),
        inbox_id: normalizeOptional(createForm.inboxId),
        workspace_id: normalizeOptional(createForm.workspaceId),
        due_at: normalizeOptional(createForm.dueAt),
        metadata: parseJsonObject(createForm.metadataJson, "Task metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("taskId", payload.task.task_id);
      });
      setMessage(`Task ${payload.task.task_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Task creation failed.");
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
      const payload = await updateTask(instanceId, detail.task_id, {
        title: editForm.title.trim(),
        summary: editForm.summary.trim(),
        status: editForm.status,
        priority: editForm.priority,
        owner_id: normalizeOptional(editForm.ownerId),
        conversation_id: normalizeOptional(editForm.conversationId),
        inbox_id: normalizeOptional(editForm.inboxId),
        workspace_id: normalizeOptional(editForm.workspaceId),
        due_at: normalizeOptional(editForm.dueAt),
        completed_at: normalizeOptional(editForm.completedAt),
        metadata: parseJsonObject(editForm.metadataJson, "Task metadata"),
      });
      setMessage(`Task ${payload.task.task_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Task update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Tasks"
          description="ForgeFrame is restoring scoped task truth before opening follow-ups and reminder linkage."
          question="Which task inventory should open first once the active session is restored?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." },
            { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Open triage once session scope is ready." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Tasks stay instance-scoped and linkable back to conversations, inbox items, reminders, notifications, and workspaces."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Tasks"
          description="This route is reserved for operators and admins who can inspect real work-interaction truth."
          question="Which adjacent surface should remain open while task access is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth without opening the task surface." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while task truth stays closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic task shell when the session cannot inspect real task state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Tasks"
        description="Persistent tasks and follow-ups with reminder linkage, notification linkage, and direct connections back to conversation, inbox, and workspace truth."
        question="Is this work actually grounded in ForgeFrame state, or is it still dissolving into free-form notes and disconnected runtime evidence?"
        links={[
          { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Stay on the task inventory and detail surface." },
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect reminder truth linked from the selected task." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect outbox and notification truth linked from the selected task." },
          { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Return to the triage queue that feeds task follow-up work." },
        ]}
        badges={[
          { label: `${tasks.length} task${tasks.length === 1 ? "" : "s"}`, tone: tasks.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Tasks are first-class product records. Follow-up logic is not allowed to hide in inbox notes or orphaned runtime artifacts."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the task inventory by lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>
            {instancesState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Task instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("taskId");
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
              aria-label="Task status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("taskId");
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
              <h3>Task inventory</h3>
              <p className="fg-muted">Each row is a persisted task or follow-up, not a cosmetic note.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading task inventory.</p> : null}
          {listState === "success" && tasks.length === 0 ? <p className="fg-muted">No tasks matched the selected filters.</p> : null}

          {tasks.length > 0 ? (
            <div className="fg-stack">
              {tasks.map((task) => (
                <button
                  key={task.task_id}
                  type="button"
                  className={`fg-data-row${task.task_id === selectedTaskId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("taskId", task.task_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{task.task_id}</span>
                      <strong>{task.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={task.status === "done" ? "success" : task.status === "blocked" ? "danger" : "warning"}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{task.task_kind} · {task.priority} priority</span>
                    <span className="fg-muted">reminders {task.reminder_count} · notifications {task.notification_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Task detail</h3>
              <p className="fg-muted">Conversation, inbox, workspace, reminder, and notification truth converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.task_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a task to inspect linked work-interaction truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading task detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Task kind: {detail.task_kind}</li>
                    <li>Status: {detail.status}</li>
                    <li>Priority: {detail.priority}</li>
                    <li>Owner: {detail.owner_id ?? "Unassigned"}</li>
                    <li>Due at: {detail.due_at ?? "Not scheduled"}</li>
                    <li>Completed at: {detail.completed_at ?? "Not completed"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Links</h4>
                  <ul className="fg-list">
                    <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
                    <li>Inbox item: {detail.inbox_id ?? "Not linked"}</li>
                    <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.conversation_id ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id })}>Open conversation</Link> : null}
                    {detail.inbox_id ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_id })}>Open inbox item</Link> : null}
                    {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Summary text</h4>
                <p>{detail.summary || "No task summary was recorded."}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Reminders</h4>
                  {detail.reminders.length === 0 ? <p className="fg-muted">No reminders are linked to this task.</p> : (
                    <ul className="fg-list">
                      {detail.reminders.map((reminder) => (
                        <li key={reminder.reminder_id}>
                          <Link to={buildReminderPath({ instanceId, reminderId: reminder.reminder_id })}>{reminder.title}</Link>
                          {" · "}{reminder.status}{" · due "}{reminder.due_at}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="fg-subcard">
                  <h4>Notifications</h4>
                  {detail.notifications.length === 0 ? <p className="fg-muted">No notifications are linked to this task.</p> : (
                    <ul className="fg-list">
                      {detail.notifications.map((notification) => (
                        <li key={notification.notification_id}>
                          <Link to={buildNotificationPath({ instanceId, notificationId: notification.notification_id })}>{notification.title}</Link>
                          {" · "}{notification.delivery_status}{" · "}{notification.priority}
                        </li>
                      ))}
                    </ul>
                  )}
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
              <h3>Create task</h3>
              <p className="fg-muted">Create a durable task or follow-up instead of hiding work in loose triage notes.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Task ID
                <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} placeholder="task_customer_pricing" />
              </label>
              <label>
                Task kind
                <select value={createForm.taskKind} onChange={(event) => setCreateForm((current) => ({ ...current, taskKind: event.target.value as TaskKind }))}>
                  {TASK_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                  {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Review outbound message" />
            </label>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Owner ID
                <input value={createForm.ownerId} onChange={(event) => setCreateForm((current) => ({ ...current, ownerId: event.target.value }))} placeholder="user-admin" />
              </label>
              <label>
                Due at
                <input value={createForm.dueAt} onChange={(event) => setCreateForm((current) => ({ ...current, dueAt: event.target.value }))} placeholder="2026-04-23T10:30:00Z" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} />
              </label>
              <label>
                Inbox ID
                <input value={createForm.inboxId} onChange={(event) => setCreateForm((current) => ({ ...current, inboxId: event.target.value }))} />
              </label>
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim()}>
                {savingCreate ? "Creating task" : "Create task"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit task</h3>
              <p className="fg-muted">Keep the selected task coherent with linked conversation, inbox, reminder, and workspace truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.task_id : "Select a task"}</span>
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
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Priority
                  <select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                    {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Owner ID
                  <input value={editForm.ownerId} onChange={(event) => setEditForm((current) => ({ ...current, ownerId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Due at
                  <input value={editForm.dueAt} onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))} />
                </label>
                <label>
                  Completed at
                  <input value={editForm.completedAt} onChange={(event) => setEditForm((current) => ({ ...current, completedAt: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Conversation ID
                  <input value={editForm.conversationId} onChange={(event) => setEditForm((current) => ({ ...current, conversationId: event.target.value }))} />
                </label>
                <label>
                  Inbox ID
                  <input value={editForm.inboxId} onChange={(event) => setEditForm((current) => ({ ...current, inboxId: event.target.value }))} />
                </label>
                <label>
                  Workspace ID
                  <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving task" : "Save task"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a task before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
