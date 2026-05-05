/**
 * Automations feature module — automation lifecycle management.
 *
 * Provides a summary hero, automation inventory table (DataTable),
 * detail panel with trigger history and governance, and guided
 * create/edit forms for recurring rules.
 *
 * @packageDocumentation
 */

export { AutomationList } from "./components/AutomationList";
export type { AutomationListProps } from "./components/AutomationList";

export { AutomationDetailPanel } from "./components/AutomationDetailPanel";
export type { AutomationDetailPanelProps } from "./components/AutomationDetailPanel";

export { AutomationCreateForm } from "./components/AutomationCreateForm";
export type { AutomationCreateFormProps } from "./components/AutomationCreateForm";

export { AutomationEditForm } from "./components/AutomationEditForm";
export type { AutomationEditFormProps } from "./components/AutomationEditForm";

export type {
  AutomationCreateForm as AutomationCreateFormType,
  AutomationEditForm as AutomationEditFormType,
  ScheduleUnit,
} from "./types";

export {
  STATUS_OPTIONS,
  ACTION_KIND_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  cadenceToStructured,
  structuredToCadence,
  automationStatusTone,
  automationTargetLabel,
  automationOutcomeLabel,
  automationHasExternalEffect,
  buildAutomationPayload,
} from "./helpers";
