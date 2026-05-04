/**
 * Tasks feature module — task lifecycle management.
 *
 * Provides types, helpers, task table, and task detail panel components
 * for the task inventory and management surface.
 *
 * @packageDocumentation
 */

export { TaskTable } from "./components/TaskTable";
export type { TaskTableProps } from "./components/TaskTable";

export { TaskDetailPanel } from "./components/TaskDetailPanel";
export type { TaskDetailPanelProps } from "./components/TaskDetailPanel";

export type {
  DrawerMode,
  CreateTaskForm,
  EditTaskForm,
} from "./types";

export {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TASK_KIND_OPTIONS,
  DRAWER_FORM_ID,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  taskStatusTone,
  taskQueuePosture,
  ownerLabel,
  linkedContextLabel,
} from "./helpers";
