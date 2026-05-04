/**
 * Tasks feature module — types and constants.
 *
 * @packageDocumentation
 */

import type { TaskKind, TaskStatus, WorkItemPriority } from "../../api/domain/tasks";

// ── Drawer modes ──────────────────────────────────────────────────────────

/**
 * Drawer open mode for create/edit forms.
 */
export type DrawerMode = "closed" | "create" | "edit";

// ── Form types ────────────────────────────────────────────────────────────

/**
 * Create task form values.
 */
export interface CreateTaskForm {
  taskId: string;
  taskKind: TaskKind;
  title: string;
  summary: string;
  status: TaskStatus;
  priority: WorkItemPriority;
  ownerId: string;
  conversationId: string;
  inboxId: string;
  workspaceId: string;
  dueAt: string;
  metadataJson: string;
}

/**
 * Edit task form values.
 */
export interface EditTaskForm {
  title: string;
  summary: string;
  status: TaskStatus;
  priority: WorkItemPriority;
  ownerId: string;
  conversationId: string;
  inboxId: string;
  workspaceId: string;
  dueAt: string;
  completedAt: string;
  metadataJson: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (TaskStatus | "all")[] = [
  "all", "open", "in_progress", "blocked", "done", "cancelled",
] as const;

/** Priority option values. */
export const PRIORITY_OPTIONS: readonly WorkItemPriority[] = [
  "low", "normal", "high", "critical",
] as const;

/** Task kind option values. */
export const TASK_KIND_OPTIONS: readonly TaskKind[] = [
  "task", "follow_up",
] as const;

/** HTML form ID for the task drawer form. */
export const DRAWER_FORM_ID = "task-drawer-form";

// ── Default form values ───────────────────────────────────────────────────

/** Default empty create task form. */
export const DEFAULT_CREATE_FORM: CreateTaskForm = {
  taskId: "",
  taskKind: "task",
  title: "",
  summary: "",
  status: "open",
  priority: "normal",
  ownerId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  dueAt: "",
  metadataJson: "{}",
};

/** Default empty edit task form. */
export const DEFAULT_EDIT_FORM: EditTaskForm = {
  title: "",
  summary: "",
  status: "open",
  priority: "normal",
  ownerId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  dueAt: "",
  completedAt: "",
  metadataJson: "{}",
};
