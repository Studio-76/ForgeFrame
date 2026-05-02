/**
 * Reminder management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { TaskSummary } from "./tasks";
import type { NotificationSummary } from "./notifications";

// ---------------------------------------------------------------------------
// Reminder types
// ---------------------------------------------------------------------------

/** Reminder lifecycle status. */
export type ReminderStatus = "scheduled" | "due" | "triggered" | "dismissed" | "cancelled";

/** Reminder summary. */
export type ReminderSummary = {
  reminder_id: string;
  instance_id: string;
  company_id: string;
  task_id?: string | null;
  automation_id?: string | null;
  notification_id?: string | null;
  title: string;
  summary: string;
  status: ReminderStatus;
  due_at: string;
  triggered_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Reminder detail. */
export type ReminderDetail = ReminderSummary & {
  task?: TaskSummary | null;
  notification?: NotificationSummary | null;
};

// ---------------------------------------------------------------------------
// Reminder API functions
// ---------------------------------------------------------------------------

/**
 * Fetch reminders for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit).
 * @returns Response with reminders list.
 */
export function fetchReminders(
  instanceId?: string | null,
  filters: {
    status?: ReminderStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; reminders: ReminderSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/reminders", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch reminder detail by ID.
 * @param reminderId - The reminder ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with reminder detail.
 */
export function fetchReminderDetail(reminderId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope(`/admin/reminders/${encodeURIComponent(reminderId)}`, undefined, instanceId),
  );
}

/**
 * Create a new reminder.
 * @param instanceId - The instance ID or null.
 * @param payload - Reminder creation parameters.
 * @returns Response with the created reminder.
 */
export function createReminder(
  instanceId: string | null | undefined,
  payload: {
    reminder_id?: string | null;
    task_id?: string | null;
    automation_id?: string | null;
    title: string;
    summary?: string;
    due_at: string;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope("/admin/reminders", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing reminder.
 * @param instanceId - The instance ID or null.
 * @param reminderId - The reminder ID.
 * @param payload - Fields to update.
 * @returns Response with the updated reminder.
 */
export function updateReminder(
  instanceId: string | null | undefined,
  reminderId: string,
  payload: {
    task_id?: string | null;
    title?: string;
    summary?: string;
    status?: ReminderStatus | null;
    due_at?: string | null;
    triggered_at?: string | null;
    notification_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; reminder: ReminderDetail }>(
    appendTenantScope(`/admin/reminders/${encodeURIComponent(reminderId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
