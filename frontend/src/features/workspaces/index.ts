/**
 * Workspaces feature module.
 *
 * @packageDocumentation
 */

export { WorkspaceList } from "./components/WorkspaceList";
export type { WorkspaceListProps } from "./components/WorkspaceList";

export { WorkspaceDetailPanel } from "./components/WorkspaceDetailPanel";
export type { WorkspaceDetailPanelProps } from "./components/WorkspaceDetailPanel";

export { WorkspaceCreateForm } from "./components/WorkspaceCreateForm";
export type { WorkspaceCreateFormProps } from "./components/WorkspaceCreateForm";

export type {
  LoadState,
  DrawerMode,
  WorkspaceActionState,
  WorkspaceActionKey,
  WorkspaceAction,
  CreateWorkspaceForm,
  EditWorkspaceForm,
} from "./types";

export {
  DRAWER_FORM_ID,
  STATUS_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  buildExecutionRoute,
  buildApprovalRoute,
  parseMetadata,
  statusTone,
  actionTone,
  formatTimestamp,
  getWorkspaceAction,
} from "./helpers";
