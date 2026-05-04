/**
 * Reminders feature module — reminder lifecycle management.
 *
 * Provides types, helpers, reminder table, and reminder detail panel
 * components for the reminder inventory and management surface.
 *
 * @packageDocumentation
 */

export { ReminderTable } from "./components/ReminderTable";
export type { ReminderTableProps } from "./components/ReminderTable";

export { ReminderDetailPanel } from "./components/ReminderDetailPanel";
export type { ReminderDetailPanelProps } from "./components/ReminderDetailPanel";

export type {
  DrawerMode,
  ReminderGroupKey,
  CreateReminderForm,
  EditReminderForm,
} from "./types";

export {
  STATUS_OPTIONS,
  DRAWER_FORM_ID,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  reminderStatusTone,
  reminderGroupKey,
  reminderGroupHeading,
  reminderDueBucket,
  reminderIsClosed,
} from "./helpers";
