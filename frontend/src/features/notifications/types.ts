/**
 * Notifications feature types, constants, and default form values.
 *
 * @packageDocumentation
 */

import type { NotificationDeliveryStatus, WorkItemPriority } from "../../api/domain/notifications";

// ─── Page-level types ─────────────────────────────────────────────────

/** Drawer mode for create/edit forms. */
export type DrawerMode = "closed" | "create" | "edit";

/** Notification lifecycle action. */
export type NotificationAction = "confirm" | "reject" | "retry";

/** Outbox grouping key. */
export type OutboxGroupKey = "pending_preview" | "queued" | "sent" | "failed" | "rejected";

// ─── Filter option constants ──────────────────────────────────────────

/** Delivery status filter options including "all". */
export const DELIVERY_STATUS_OPTIONS: readonly (NotificationDeliveryStatus | "all")[] = [
  "all",
  "draft",
  "preview",
  "confirmed",
  "queued",
  "delivering",
  "delivered",
  "failed",
  "fallback_queued",
  "rejected",
  "cancelled",
] as const;

/** Priority filter options including "all". */
export const PRIORITY_OPTIONS: readonly (WorkItemPriority | "all")[] = [
  "all", "low", "normal", "high", "critical",
] as const;

/** Outbox group definition. */
export interface OutboxGroup {
  key: OutboxGroupKey;
  label: string;
  description: string;
  statuses: NotificationDeliveryStatus[];
}

/** Outbox group definitions with status filters. */
export const OUTBOX_GROUPS: OutboxGroup[] = [
  {
    key: "pending_preview",
    label: "Pending approval / preview",
    description: "Draft and preview-only notifications.",
    statuses: ["draft", "preview"],
  },
  {
    key: "queued",
    label: "Queued",
    description: "Notifications queued, delivering, or in fallback.",
    statuses: ["confirmed", "queued", "delivering", "fallback_queued"],
  },
  {
    key: "sent",
    label: "Sent",
    description: "Notifications with recorded delivery success.",
    statuses: ["delivered"],
  },
  {
    key: "failed",
    label: "Failed",
    description: "Notifications failed or cancelled before delivery.",
    statuses: ["failed", "cancelled"],
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Notifications explicitly rejected.",
    statuses: ["rejected"],
  },
];

// ─── IDs ──────────────────────────────────────────────────────────────

/** Form ID for the create/edit drawer form. */
export const DRAWER_FORM_ID = "notifications-drawer-form";

// ─── Default form values ──────────────────────────────────────────────

/** Create notification form values. */
export interface CreateForm {
  notificationId: string;
  taskId: string;
  reminderId: string;
  conversationId: string;
  inboxId: string;
  workspaceId: string;
  channelId: string;
  fallbackChannelId: string;
  title: string;
  body: string;
  priority: WorkItemPriority;
  previewRequired: "yes" | "no";
  maxRetries: string;
  metadataJson: string;
}

/** Edit notification form values. */
export interface EditForm {
  channelId: string;
  fallbackChannelId: string;
  title: string;
  body: string;
  deliveryStatus: NotificationDeliveryStatus;
  priority: WorkItemPriority;
  previewRequired: "yes" | "no";
  maxRetries: string;
  lastError: string;
  metadataJson: string;
}

/** Default empty create form. */
export const DEFAULT_CREATE_FORM: CreateForm = {
  notificationId: "",
  taskId: "",
  reminderId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  title: "",
  body: "",
  priority: "normal",
  previewRequired: "yes",
  maxRetries: "0",
  metadataJson: "{}",
};

/** Default empty edit form. */
export const DEFAULT_EDIT_FORM: EditForm = {
  channelId: "",
  fallbackChannelId: "",
  title: "",
  body: "",
  deliveryStatus: "preview",
  priority: "normal",
  previewRequired: "yes",
  maxRetries: "0",
  lastError: "",
  metadataJson: "{}",
};
