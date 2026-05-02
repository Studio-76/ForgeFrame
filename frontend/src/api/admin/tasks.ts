/**
 * Task management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type WorkItemPriority,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { ReminderSummary } from "./reminders";
import type { NotificationSummary } from "./notifications";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { WorkItemPriority };

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

/** Task kind discriminator. */
export type TaskKind = "task" | "follow_up";

/** Task lifecycle status. */
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

/** Task summary. */
export type TaskSummary = {
  task_id: string;
  instance_id: string;
  company_id: string;
  task_kind: TaskKind;
  title: string;
  summary: string;
  status: TaskStatus;
  priority: WorkItemPriority;
  owner_id?: string | null;
  conversation_id?: string | null;
  inbox_id?: string | null;
  workspace_id?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  metadata: Record<string, unknown>;
  reminder_count: number;
  notification_count: number;
  created_at: string;
  updated_at: string;
};

/** Task detail. */
export type TaskDetail = TaskSummary & {
  reminders: ReminderSummary[];
  notifications: NotificationSummary[];
};

// ---------------------------------------------------------------------------
// Task API functions
// ---------------------------------------------------------------------------

/**
 * Fetch tasks for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit).
 * @returns Response with tasks list.
 */
export function fetchTasks(
  instanceId?: string | null,
  filters: {
    status?: TaskStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; tasks: TaskSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/tasks", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch task detail by ID.
 * @param taskId - The task ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with task detail.
 */
export function fetchTaskDetail(taskId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope(`/admin/tasks/${encodeURIComponent(taskId)}`, undefined, instanceId),
  );
}

/**
 * Create a new task.
 * @param instanceId - The instance ID or null.
 * @param payload - Task creation parameters.
 * @returns Response with the created task.
 */
export function createTask(
  instanceId: string | null | undefined,
  payload: {
    task_id?: string | null;
    task_kind?: TaskKind;
    title: string;
    summary?: string;
    status?: TaskStatus;
    priority?: WorkItemPriority;
    owner_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    due_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope("/admin/tasks", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing task.
 * @param instanceId - The instance ID or null.
 * @param taskId - The task ID.
 * @param payload - Fields to update.
 * @returns Response with the updated task.
 */
export function updateTask(
  instanceId: string | null | undefined,
  taskId: string,
  payload: {
    title?: string;
    summary?: string;
    status?: TaskStatus | null;
    priority?: WorkItemPriority | null;
    owner_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    due_at?: string | null;
    completed_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; task: TaskDetail }>(
    appendTenantScope(`/admin/tasks/${encodeURIComponent(taskId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
