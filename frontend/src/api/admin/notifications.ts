/**
 * Notification management API functions and types.
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

import type { TaskSummary } from "./tasks";
import type { ReminderSummary } from "./reminders";
import type { DeliveryChannelSummary } from "./channels";

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

/** Notification delivery status. */
export type NotificationDeliveryStatus =
  | "draft"
  | "preview"
  | "confirmed"
  | "queued"
  | "delivering"
  | "delivered"
  | "failed"
  | "fallback_queued"
  | "rejected"
  | "cancelled";

/** Notification attempt kind. */
export type NotificationAttemptKind = "preview" | "approval" | "retry" | "fallback" | "manual_override" | "terminal";

/** Notification delivery effect. */
export type NotificationDeliveryEffect = "preview_only" | "queued" | "sent" | "failed" | "rejected" | "cancelled";

/** Notification summary. */
export type NotificationSummary = {
  notification_id: string;
  instance_id: string;
  company_id: string;
  task_id?: string | null;
  reminder_id?: string | null;
  conversation_id?: string | null;
  inbox_id?: string | null;
  workspace_id?: string | null;
  channel_id?: string | null;
  configured_channel_id?: string | null;
  fallback_channel_id?: string | null;
  title: string;
  body: string;
  delivery_status: NotificationDeliveryStatus;
  priority: WorkItemPriority;
  preview_required: boolean;
  retry_count: number;
  max_retries: number;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  rejected_at?: string | null;
  last_error?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Notification delivery attempt. */
export type NotificationDeliveryAttempt = {
  attempt_id: string;
  attempt_kind: NotificationAttemptKind;
  delivery_status: NotificationDeliveryStatus;
  happened_at: string;
  channel_id?: string | null;
  channel_label?: string | null;
  channel_target?: string | null;
  detail: string;
  next_step?: string | null;
};

/** Notification delivery evidence. */
export type NotificationDeliveryEvidence = {
  effect_state: NotificationDeliveryEffect;
  live_delivery: boolean;
  current_target?: string | null;
  next_step: string;
  evidence_note: string;
};

/** Notification detail. */
export type NotificationDetail = NotificationSummary & {
  task?: TaskSummary | null;
  reminder?: ReminderSummary | null;
  channel?: DeliveryChannelSummary | null;
  configured_channel?: DeliveryChannelSummary | null;
  fallback_channel?: DeliveryChannelSummary | null;
  delivery_attempts: NotificationDeliveryAttempt[];
  delivery_evidence?: NotificationDeliveryEvidence | null;
};

// ---------------------------------------------------------------------------
// Notification API functions
// ---------------------------------------------------------------------------

/**
 * Fetch notifications for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (deliveryStatus, priority, limit).
 * @returns Response with notifications list.
 */
export function fetchNotifications(
  instanceId?: string | null,
  filters: {
    deliveryStatus?: NotificationDeliveryStatus | "all";
    priority?: WorkItemPriority | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; notifications: NotificationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/notifications", undefined, instanceId), {
      deliveryStatus: filters.deliveryStatus && filters.deliveryStatus !== "all" ? filters.deliveryStatus : null,
      priority: filters.priority && filters.priority !== "all" ? filters.priority : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch notification detail by ID.
 * @param notificationId - The notification ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with notification detail.
 */
export function fetchNotificationDetail(notificationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}`, undefined, instanceId),
  );
}

/**
 * Create a new notification.
 * @param instanceId - The instance ID or null.
 * @param payload - Notification creation parameters.
 * @returns Response with the created notification.
 */
export function createNotification(
  instanceId: string | null | undefined,
  payload: {
    notification_id?: string | null;
    task_id?: string | null;
    reminder_id?: string | null;
    conversation_id?: string | null;
    inbox_id?: string | null;
    workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    title: string;
    body: string;
    priority?: WorkItemPriority;
    preview_required?: boolean;
    max_retries?: number;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope("/admin/notifications", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing notification.
 * @param instanceId - The instance ID or null.
 * @param notificationId - The notification ID.
 * @param payload - Fields to update.
 * @returns Response with the updated notification.
 */
export function updateNotification(
  instanceId: string | null | undefined,
  notificationId: string,
  payload: {
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    title?: string;
    body?: string;
    delivery_status?: NotificationDeliveryStatus | null;
    priority?: WorkItemPriority | null;
    preview_required?: boolean | null;
    max_retries?: number | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Confirm a notification (preview to queued transition).
 * @param instanceId - The instance ID or null.
 * @param notificationId - The notification ID.
 * @returns Response with the confirmed notification.
 */
export function confirmNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/confirm`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Reject a notification (cancel delivery).
 * @param instanceId - The instance ID or null.
 * @param notificationId - The notification ID.
 * @returns Response with the rejected notification.
 */
export function rejectNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/reject`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Retry a failed notification delivery.
 * @param instanceId - The instance ID or null.
 * @param notificationId - The notification ID.
 * @returns Response with the retried notification.
 */
export function retryNotification(instanceId: string | null | undefined, notificationId: string) {
  return fetchJson<{ status: string; action: string; notification: NotificationDetail }>(
    appendTenantScope(`/admin/notifications/${encodeURIComponent(notificationId)}/retry`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}
