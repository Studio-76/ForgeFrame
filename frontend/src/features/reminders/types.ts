/**
 * Reminders feature module — types and constants.
 *
 * @packageDocumentation
 */

import type { ReminderStatus } from "../../api/domain/reminders";

// ── Drawer modes ──────────────────────────────────────────────────────────

/**
 * Drawer open mode for create/edit forms.
 */
export type DrawerMode = "closed" | "create" | "edit";

// ── Reminder group ─────────────────────────────────────────────────────────

/**
 * Urgency group keys for reminder organisation.
 */
export type ReminderGroupKey = "overdue" | "due_now" | "upcoming" | "completed_cancelled";

// ── Form types ────────────────────────────────────────────────────────────

/**
 * Create reminder form values.
 */
export interface CreateReminderForm {
  reminderId: string;
  taskId: string;
  automationId: string;
  title: string;
  summary: string;
  dueAt: string;
  metadataJson: string;
}

/**
 * Edit reminder form values.
 */
export interface EditReminderForm {
  taskId: string;
  title: string;
  summary: string;
  status: ReminderStatus;
  dueAt: string;
  triggeredAt: string;
  notificationId: string;
  metadataJson: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (ReminderStatus | "all")[] = [
  "all", "scheduled", "due", "triggered", "dismissed", "cancelled",
] as const;

/** HTML form ID for the reminder drawer form. */
export const DRAWER_FORM_ID = "reminder-drawer-form";

// ── Default form values ───────────────────────────────────────────────────

/** Default empty create reminder form. */
export const DEFAULT_CREATE_FORM: CreateReminderForm = {
  reminderId: "",
  taskId: "",
  automationId: "",
  title: "",
  summary: "",
  dueAt: "",
  metadataJson: "{}",
};

/** Default empty edit reminder form. */
export const DEFAULT_EDIT_FORM: EditReminderForm = {
  taskId: "",
  title: "",
  summary: "",
  status: "scheduled",
  dueAt: "",
  triggeredAt: "",
  notificationId: "",
  metadataJson: "{}",
};
