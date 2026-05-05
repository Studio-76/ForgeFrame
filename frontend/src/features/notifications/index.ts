/**
 * Notifications feature module — outbox delivery management.
 *
 * Provides the grouped outbox table, notification detail panel with
 * confirm/reject/retry actions, a create/edit form, shared types,
 * and helper utilities.
 *
 * @packageDocumentation
 */

export { NotificationList } from "./components/NotificationList";
export type { NotificationListProps } from "./components/NotificationList";

export { NotificationDetailPanel } from "./components/NotificationDetailPanel";
export type { NotificationDetailPanelProps } from "./components/NotificationDetailPanel";

export { NotificationCreateForm } from "./components/NotificationCreateForm";
export type { NotificationCreateFormProps } from "./components/NotificationCreateForm";

export type {
  DrawerMode,
  NotificationAction,
  OutboxGroupKey,
  CreateForm,
  EditForm,
  OutboxGroup,
} from "./types";

export {
  DELIVERY_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  OUTBOX_GROUPS,
  DRAWER_FORM_ID,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  formatTimestamp,
  notificationStatusTone,
  effectTone,
  notificationModeLabel,
  notificationLaneLabel,
  linkedContextLabel,
  attemptKindLabel,
  attemptTone,
  actionMessage,
} from "./helpers";
