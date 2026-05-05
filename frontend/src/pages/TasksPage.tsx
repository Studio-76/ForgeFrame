/**
 * TasksPage — task lifecycle management surface.
 *
 * Migrated to use the ReviewQueuePage template with summary items,
 * attention items, task table, detail panel, and collapsible diagnostics.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

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
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { Button } from "../components/ui/Button";
import { DiagnosticSection, RawJson } from "../components/ui/AdvancedDiagnostics";
import { ReviewQueuePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";
import {
  TaskTable,
  TaskDetailPanel,
  type DrawerMode,
  type CreateTaskForm,
  type EditTaskForm,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DRAWER_FORM_ID,
} from "../features/tasks";

/**
 * Tasks page component.
 */
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
  const [createForm, setCreateForm] = useState<CreateTaskForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditTaskForm>(DEFAULT_EDIT_FORM);
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

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  // ── Instance scope ────────────────────────────────────────────────

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

  // ── Task list ─────────────────────────────────────────────────────

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

  // ── Task detail ───────────────────────────────────────────────────

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

  // ── Edit form sync ────────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────

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

  // ── Template props ────────────────────────────────────────────────

  const overdueCount = tasks.filter((t) => t.status === "blocked").length;
  const pendingCount = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  const summaryItems = [
    { key: "pending", label: "Pending", value: pendingCount, tone: pendingCount > 0 ? "warning" as const : "success" as const },
    { key: "overdue", label: "Blocked", value: overdueCount, tone: overdueCount > 0 ? "danger" as const : "neutral" as const },
    { key: "total", label: "Total tasks", value: tasks.length, tone: tasks.length > 0 ? "info" as const : "neutral" as const },
    { key: "access", label: "Access", value: canMutate ? "Writable" : "Read only", tone: canMutate ? "success" as const : "warning" as const },
  ];

  const actions: Action[] = [
    {
      label: "New task",
      kind: "primary",
      intent: "configure",
      onClick: openCreateDrawer,
      disabled: !canMutate,
    },
  ];

  const attentionItems: AttentionPayload[] = [];
  if (overdueCount > 0) {
    attentionItems.push({
      key: "blocked-tasks",
      level: "warning",
      title: `${overdueCount} blocked task${overdueCount === 1 ? "" : "s"}`,
      description: "Blocked tasks may need intervention to unblock.",
    });
  }
  if (detailState === "error") {
    attentionItems.push({
      key: "detail-error",
      level: "diagnostic",
      title: "Task detail load failed",
      description: error || "An error occurred loading task detail.",
    });
  }

  const diagnosticsContent = (
    <>
      <DiagnosticSection label="Tasks list payload">
        <RawJson data={tasks} />
      </DiagnosticSection>
      <DiagnosticSection label="Task detail payload">
        <RawJson data={detail} />
      </DiagnosticSection>
      {error ? (
        <DiagnosticSection label="Error state">
          <p className="fg-danger">{error}</p>
        </DiagnosticSection>
      ) : null}
      {message ? (
        <DiagnosticSection label="Status message">
          <p>{message}</p>
        </DiagnosticSection>
      ) : null}
    </>
  );

  const drawerModeLabel = drawerMode === "create" ? "Create Task" : "Edit Task";
  const drawerStatus = drawerMode === "create"
    ? (createForm.title.trim() ? "form ready" : "title required")
    : (detail ? detail.task_id : "select task");
  const drawerStatusTone = drawerMode === "create"
    ? (createForm.title.trim() ? "success" : "danger")
    : detail
      ? (detail.status === "done" ? "success" as const : detail.status === "blocked" ? "danger" as const : detail.status === "cancelled" ? "neutral" as const : detail.status === "in_progress" ? "warning" as const : "neutral" as const)
      : "warning";

  // ── Session guard returns ─────────────────────────────────────────

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

  // ── Main content ──────────────────────────────────────────────────

  return (
    <ReviewQueuePage
      eyebrow="Work Interaction"
      title="Tasks"
      description="Track real tasks with owner, due date, status, and linked reminders and notifications."
      summaryItems={summaryItems}
      actions={actions}
      attentionItems={attentionItems}
      isEmpty={listState === "success" && tasks.length === 0}
      emptyTitle="No tasks found"
      emptyDescription="No tasks matched the selected filters. Adjust the status filter or create a new task."
      selectedItemContent={
        <TaskDetailPanel
          detail={detail}
          detailState={detailState}
          instanceId={instanceId}
          canMutate={canMutate}
          statusActionState={statusActionState}
          creatingReminder={creatingReminder}
          onOpenEdit={openEditDrawer}
          onStatusAction={(nextStatus) => void handleStatusAction(nextStatus as TaskStatus)}
          onCreateReminder={() => void handleCreateReminder()}
        />
      }
      hasSelection={Boolean(detail)}
      emptyDetailHint="Select a task from the queue to inspect task truth, checkpoint state, and linked product objects."
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Task diagnostics"
    >
      {/* Error and message banners */}
      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {/* Task table with filters */}
      <TaskTable
        listState={listState}
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        instanceId={instanceId}
        statusFilter={statusFilter}
        instances={instances}
        instancesState={instancesState}
        canMutate={canMutate}
        updateRoute={updateRoute}
        onOpenCreate={openCreateDrawer}
        onSelectTask={(taskId) => updateRoute((next) => { next.set("taskId", taskId); })}
      />

      {/* Create / Edit drawer */}
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
        actions={
          <>
            <Button variant="tertiary" onPress={closeDrawer}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form={DRAWER_FORM_ID}
              isDisabled={!canMutate || (drawerMode === "create" ? savingCreate || !createForm.title.trim() : savingUpdate || !detail)}
              onPress={() => {
                // Form submission is handled by the form's onSubmit
                const form = document.getElementById(DRAWER_FORM_ID) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating task" : "Create task") : (savingUpdate ? "Saving task" : "Save task changes")}
            </Button>
          </>
        }
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
                    <option value="task">task</option>
                    <option value="follow_up">follow_up</option>
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
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="blocked">blocked</option>
                  <option value="done">done</option>
                  <option value="cancelled">cancelled</option>
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
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
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
    </ReviewQueuePage>
  );
}
