/**
 * Agents feature module — agent registry lifecycle management.
 *
 * Provides a summary hero, agent registry table (DataTable),
 * detail panel with coordinator posture and profile linkage,
 * and a drawer-based create/edit form.
 *
 * @packageDocumentation
 */

export { AgentList } from "./components/AgentList";
export type { AgentListProps } from "./components/AgentList";

export { AgentDetailPanel } from "./components/AgentDetailPanel";
export type { AgentDetailPanelProps } from "./components/AgentDetailPanel";

export { AgentCreateForm } from "./components/AgentCreateForm";
export type { AgentCreateFormProps } from "./components/AgentCreateForm";

export type {
  AgentCreateForm as AgentCreateFormType,
  AgentEditForm as AgentEditFormType,
  DrawerMode,
} from "./types";

export {
  STATUS_OPTIONS,
  DRAWER_FORM_ID,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  PARTICIPATION_OPTIONS,
  UNSUPPORTED_PARTICIPATION_MODES,
} from "./types";

export {
  agentStatusTone,
  formatTimestamp,
  participationLabel,
  participationDescription,
  addressabilityTone,
} from "./helpers";
