/**
 * ForgeFrame OperationalPage Templates
 *
 * Reusable page templates that enforce consistent hierarchy and layout
 * across all ForgeFrame pages. Each template maps to one of the six
 * page patterns defined in the ForgeFrame Page UX Rules.
 *
 * ## Available Templates
 *
 * - {@link SetupWorkflowPage} — Guided setup flows with progress tracking
 * - {@link RegistryManagementPage} — Browse, filter, create, edit registry entries
 * - {@link IncidentResponsePage} — Detect, diagnose, and resolve active incidents
 * - {@link SettingsManagementPage} — Configure system settings and policies
 * - {@link ReviewQueuePage} — Review, approve, reject, or triage queue items
 *
 * ## Usage
 *
 * ```tsx
 * import { RegistryManagementPage } from "../components/page-templates";
 * ```
 */
export { SetupWorkflowPage } from "./SetupWorkflowPage";
export type { SetupWorkflowPageProps, EmptyStateConfig } from "./SetupWorkflowPage";

export { RegistryManagementPage } from "./RegistryManagementPage";
export type { RegistryManagementPageProps, RegistrySearchConfig, ScopeConfig } from "./RegistryManagementPage";

export { IncidentResponsePage } from "./IncidentResponsePage";
export type { IncidentResponsePageProps, DegradedActionConfig, NoIncidentsConfig } from "./IncidentResponsePage";

export { SettingsManagementPage } from "./SettingsManagementPage";
export type { SettingsManagementPageProps } from "./SettingsManagementPage";

export { ReviewQueuePage } from "./ReviewQueuePage";
export type { ReviewQueuePageProps } from "./ReviewQueuePage";
