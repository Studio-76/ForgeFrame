import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createTask,
  fetchTaskDetail,
  fetchTasks,
  updateTask,
  type TaskDetail,
  type TaskKind,
  type TaskStatus,
  type TaskSummary,
  type WorkItemPriority,
} from "../api/domain/tasks";
import { createReminder } from "../api/domain/reminders";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildArtifactsPath,
  buildConversationPath,
  buildInboxPath,
  buildNotificationPath,
  buildReminderPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

type DrawerMode = "closed" | "create" | "edit";

const STATUS_OPTIONS: Array<TaskStatus | "all"> = ["all", "open", "in_progress", "blocked", "done", "cancelled"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
const TASK_KIND_OPTIONS: TaskKind[] = ["task", "follow_up"];
const DRAWER_FORM_ID = "task-drawer-form";

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

function taskStatusTone(status: TaskStatus): "success" | "danger" | "warning" | "neutral" {
  if (status === "done") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  if (status === "cancelled") {
    return "neutral";
  }
  if (status === "in_progress") {
    return "warning";
  }
  return "neutral";
}

function taskQueuePosture(status: TaskStatus): string {
  switch (status) {
    case "open":
      return "backlog";
    case "in_progress":
      return "active";
    case "blocked":
      return "blocked or waiting";
    case "done":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return status;
  }
}

function ownerLabel(ownerId?: string | null): string {
  return ownerId?.trim() ? ownerId : "unassigned";
}

function linkedContextLabel(task: Pick<TaskSummary, "conversation_id" | "inbox_id" | "workspace_id">): string {
  const parts = [
    task.conversation_id ? `conversation ${task.conversation_id}` : null,
    task.inbox_id ? `inbox ${task.inbox_id}` : null,
    task.workspace_id ? `workspace ${task.workspace_id}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "bridge-only";
}

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
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [statusActionState, setStatusActionState] = useState<Record<TaskStatus, boolean>>({
    open: false,
    in_progress: false,
    blocked: false,
    done: false,
    cancelled: false,
  });
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedReminder = detail?.reminders[0] ?? null;
  const selectedNotification = detail?.notifications[0] ?? null;

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
      closeDrawer();
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
      setDrawerMode("closed");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Task update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleStatusAction = async (nextStatus: TaskStatus) => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setStatusActionState((current) => ({ ...current, [nextStatus]: true }));
    setError("");
    setMessage("");
    try {
      const completedAt = nextStatus === "done"
        ? (detail.completed_at ?? new Date().toISOString())
        : nextStatus === "cancelled"
          ? detail.completed_at
          : null;

      const payload = await updateTask(instanceId, detail.task_id, {
        status: nextStatus,
        completed_at: completedAt,
      });
      setMessage(`Task ${payload.task.task_id} moved to ${nextStatus}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Task status action '${nextStatus}' failed.`);
    } finally {
      setStatusActionState((current) => ({ ...current, [nextStatus]: false }));
    }
  };

  const handleCreateReminder = async () => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }
    if (!detail.due_at) {
      setError("Task reminder creation is blocked until the task has a due date.");
      return;
    }

    setCreatingReminder(true);
    setError("");
    setMessage("");
    try {
      const payload = await createReminder(instanceId, {
        task_id: detail.task_id,
        title: `${detail.title} reminder`,
        summary: detail.summary || `Reminder for task ${detail.task_id}.`,
        due_at: detail.due_at,
        metadata: { source: "tasks_page" },
      });
      setMessage(`Reminder ${payload.reminder.reminder_id} created from task ${detail.task_id}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Task reminder creation failed.");
    } finally {
      setCreatingReminder(false);
    }
  };

  const drawerModeLabel = drawerMode === "create" ? "Create Task" : "Edit Task";
  const drawerStatus = drawerMode === "create"
    ? (createForm.title.trim() ? "form ready" : "title required")
    : (detail ? detail.task_id : "select task");
  const drawerStatusTone = drawerMode === "create"
    ? (createForm.title.trim() ? "success" : "danger")
    : detail
      ? taskStatusTone(detail.status)
      : "warning";

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Tasks"
          description="Restoring task scope."
          question="Open task inventory when session access resolves."
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." },
            { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Open triage once session scope is ready." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Tasks are instance-scoped and link back to conversation, inbox, reminder, notification, and workspace records."
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
          description="Task data is available to operators and admins."
          question="Use another surface until task access is available."
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth without opening the task surface." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while task truth stays closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="No placeholder task shell is rendered without scoped access."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Tasks"
        description="Track real tasks with owner, due date, status, and linked reminders and notifications."
        question="Select a task, then act from its current state."
        links={[
          { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Stay on the task inventory and detail surface." },
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect reminder truth linked from the selected task." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect outbox truth linked from the selected task." },
          { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Return to the triage queue that feeds task follow-up work." },
        ]}
        badges={[
          { label: `${tasks.length} task${tasks.length === 1 ? "" : "s"}`, tone: tasks.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Status values map directly to backend state: `open`, `in_progress`, `blocked`, `done`, `cancelled`."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
              <p className="fg-muted">Pick an instance, then filter by backend task status. `blocked` includes waiting cases.</p>
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
              <p className="fg-muted">State, owner, due date, priority, and linked context.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
              <button type="button" disabled={!canMutate} onClick={openCreateDrawer}>New task</button>
            </div>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading task inventory.</p> : null}
          {listState === "success" && tasks.length === 0 ? <p className="fg-muted">No tasks match this filter.</p> : null}

          {tasks.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Task inventory">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Due</th>
                    <th>Priority</th>
                    <th>Linked context</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.task_id} className={task.task_id === selectedTaskId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => {
                            next.set("taskId", task.task_id);
                          })}
                        >
                          {task.title}
                        </button>
                        <div className="fg-muted">{task.task_id} · {task.task_kind}</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={taskStatusTone(task.status)}>{task.status}</span>
                        <div className="fg-muted">{taskQueuePosture(task.status)}</div>
                      </td>
                      <td>{ownerLabel(task.owner_id)}</td>
                      <td>{task.due_at ?? "Unscheduled"}</td>
                      <td>{task.priority}</td>
                      <td>{linkedContextLabel(task)}</td>
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
              <h3>Task detail</h3>
              <p className="fg-muted">Owner, checkpoints, linked product objects, status actions, and reminder follow-up converge here.</p>
            </div>
            <div className="fg-actions">
              {detail ? <span className="fg-pill">{detail.task_id}</span> : null}
              <button type="button" disabled={!canMutate || !detail} onClick={openEditDrawer}>Edit selected task</button>
            </div>
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a task to inspect task truth, checkpoint state, and linked product objects.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading task detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={taskStatusTone(detail.status)}>Backend state {detail.status}</span>
                <span className="fg-pill">Queue posture {taskQueuePosture(detail.status)}</span>
                <span className="fg-pill">{detail.priority} priority</span>
                <span className="fg-pill">owner {ownerLabel(detail.owner_id)}</span>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Task kind: {detail.task_kind}</li>
                    <li>Status: {detail.status}</li>
                    <li>Queue posture: {taskQueuePosture(detail.status)}</li>
                    <li>Priority: {detail.priority}</li>
                    <li>Owner: {ownerLabel(detail.owner_id)}</li>
                    <li>Due at: {detail.due_at ?? "Not scheduled"}</li>
                    <li>Completed at: {detail.completed_at ?? "Not completed"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Checkpoints</h4>
                  <ul className="fg-list">
                    <li>Reminders: {detail.reminders.length}</li>
                    <li>Notifications: {detail.notifications.length}</li>
                    <li>First reminder: {selectedReminder ? `${selectedReminder.title} (${selectedReminder.status})` : "No reminder linked"}</li>
                    <li>First notification: {selectedNotification ? `${selectedNotification.title} (${selectedNotification.delivery_status})` : "No notification linked"}</li>
                  </ul>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Linked objects</h4>
                <ul className="fg-list">
                  <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
                  <li>Inbox item: {detail.inbox_id ?? "Not linked"}</li>
                  <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
                  <li>Run / approval / artifact: bridge-only via the linked conversation, inbox item, or workspace</li>
                </ul>
                <div className="fg-actions">
                  {detail.conversation_id ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id })}>Open conversation</Link> : null}
                  {detail.inbox_id ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_id })}>Open inbox item</Link> : null}
                  {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
                  {detail.workspace_id ? <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, workspaceId: detail.workspace_id })}>Open artifacts</Link> : null}
                </div>
                <p className="fg-muted">The current task backend model does not persist run or approval IDs directly on tasks. Artifact context is reachable through the linked workspace when present; otherwise the missing task-level linkage remains `bridge-only` instead of being faked.</p>
              </article>

              <article className="fg-subcard">
                <h4>Status actions</h4>
                <p className="fg-muted">Apply real lifecycle changes from the detail panel instead of opening the edit drawer for every state transition.</p>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || statusActionState.open} onClick={() => void handleStatusAction("open")}>
                    {statusActionState.open ? "Reopening" : "Reopen"}
                  </button>
                  <button type="button" disabled={!canMutate || statusActionState.in_progress} onClick={() => void handleStatusAction("in_progress")}>
                    {statusActionState.in_progress ? "Starting" : "Start work"}
                  </button>
                  <button type="button" disabled={!canMutate || statusActionState.blocked} onClick={() => void handleStatusAction("blocked")}>
                    {statusActionState.blocked ? "Blocking" : "Block task"}
                  </button>
                  <button type="button" disabled={!canMutate || statusActionState.done} onClick={() => void handleStatusAction("done")}>
                    {statusActionState.done ? "Completing" : "Complete task"}
                  </button>
                  <button type="button" disabled={!canMutate || statusActionState.cancelled} onClick={() => void handleStatusAction("cancelled")}>
                    {statusActionState.cancelled ? "Cancelling" : "Cancel task"}
                  </button>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Reminder path</h4>
                <p className="fg-muted">Tasks can create or link reminders directly when a due date exists.</p>
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={buildReminderPath({ instanceId })}>Open reminders</Link>
                  {selectedReminder ? <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: selectedReminder.reminder_id })}>Open first reminder</Link> : null}
                  {!selectedReminder && detail.due_at ? (
                    <button type="button" disabled={!canMutate || creatingReminder} onClick={() => void handleCreateReminder()}>
                      {creatingReminder ? "Creating reminder" : "Create reminder from task"}
                    </button>
                  ) : null}
                </div>
                {!selectedReminder && !detail.due_at ? (
                  <p className="fg-muted">Direct reminder creation is `not-ready` until the task has a due date. Set `due_at` in the drawer before creating the reminder.</p>
                ) : null}
              </article>

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
                          <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: reminder.reminder_id })}>{reminder.title}</Link>
                          {" · "}{reminder.status}
                          {" · due "}{reminder.due_at}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Notifications</h4>
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={buildNotificationPath({ instanceId })}>Open notifications</Link>
                    {selectedNotification ? <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: selectedNotification.notification_id })}>Open first notification</Link> : null}
                  </div>
                  {detail.notifications.length === 0 ? <p className="fg-muted">No notifications are linked to this task.</p> : (
                    <ul className="fg-list">
                      {detail.notifications.map((notification) => (
                        <li key={notification.notification_id}>
                          <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: notification.notification_id })}>{notification.title}</Link>
                          {" · "}{notification.delivery_status}
                          {" · "}{notification.priority}
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

      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerModeLabel}
        description={drawerMode === "create"
          ? "Create a task or follow-up without turning the main page back into a permanent form wall."
          : "Adjust the selected task, owner, due date, and linkage inside a focused drawer."}
        status={drawerStatus}
        statusTone={drawerStatusTone}
        properties={[
          { label: "Scope", value: instanceId || "No instance selected" },
          { label: "Backend state map", value: "open / in_progress / blocked / done / cancelled" },
          { label: "Reminder creation", value: "Direct create is available when due_at is set" },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={!canMutate || (drawerMode === "create" ? savingCreate || !createForm.title.trim() : savingUpdate || !detail)}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating task" : "Create task") : (savingUpdate ? "Saving task" : "Save task changes")}
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
                  Task ID
                  <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} placeholder="task_customer_pricing" />
                </label>
              ) : null}
              {drawerMode === "create" ? (
                <label>
                  Task kind
                  <select value={createForm.taskKind} onChange={(event) => setCreateForm((current) => ({ ...current, taskKind: event.target.value as TaskKind }))}>
                    {TASK_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ) : (
                <label>
                  Task kind
                  <input value={detail?.task_kind ?? "task"} disabled />
                </label>
              )}
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
                  placeholder="Review outbound message"
                />
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Workflow</h4>
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
              <label>
                Status
                <select
                  value={drawerMode === "create" ? createForm.status : editForm.status}
                  onChange={(event) => {
                    const nextValue = event.target.value as TaskStatus;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, status: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, status: nextValue }));
                  }}
                >
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={drawerMode === "create" ? createForm.priority : editForm.priority}
                  onChange={(event) => {
                    const nextValue = event.target.value as WorkItemPriority;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, priority: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, priority: nextValue }));
                  }}
                >
                  {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Owner ID
                <input
                  value={drawerMode === "create" ? createForm.ownerId : editForm.ownerId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, ownerId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, ownerId: nextValue }));
                  }}
                  placeholder="user-admin"
                />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
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
                  placeholder="2026-04-23T12:00:00Z"
                />
              </label>
              {drawerMode === "edit" ? (
                <label>
                  Completed at
                  <input value={editForm.completedAt} onChange={(event) => setEditForm((current) => ({ ...current, completedAt: event.target.value }))} />
                </label>
              ) : null}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Linked objects</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input
                  value={drawerMode === "create" ? createForm.conversationId : editForm.conversationId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, conversationId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, conversationId: nextValue }));
                  }}
                />
              </label>
              <label>
                Inbox ID
                <input
                  value={drawerMode === "create" ? createForm.inboxId : editForm.inboxId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, inboxId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, inboxId: nextValue }));
                  }}
                />
              </label>
              <label>
                Workspace ID
                <input
                  value={drawerMode === "create" ? createForm.workspaceId : editForm.workspaceId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, workspaceId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, workspaceId: nextValue }));
                  }}
                />
              </label>
            </div>
            <p className="fg-muted">Run, approval, and artifact linkage remain `bridge-only` on this page because the current task backend model does not persist those fields directly.</p>
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
