/**
 * Logs feature module — redesigned Errors, Activity, and Audit History UX.
 *
 * Provides a tabbed review surface with five modes (Incidents, Logs, Activity,
 * Audit History, Diagnostics), an operational summary hero, filter presets, row-selection
 * detail panels, and raw data hidden by default.
 *
 * Audit export is a separate, explicit workflow within the Audit tab.
 *
 * @packageDocumentation
 */

export { LogsPage } from "./LogsPage";

export { LogsSummaryHero } from "./LogsSummaryHero";
export type { LogsSummaryHeroProps } from "./LogsSummaryHero";

export { ErrorReviewPanel } from "./ErrorReviewPanel";
export type { ErrorReviewPanelProps } from "./ErrorReviewPanel";

export { LogsEvidencePanel } from "./LogsEvidencePanel";
export type { LogsEvidencePanelProps } from "./LogsEvidencePanel";

export { ActivityPanel } from "./ActivityPanel";
export type { ActivityPanelProps } from "./ActivityPanel";

export { AuditHistoryPanel } from "./AuditHistoryPanel";
export type { AuditHistoryPanelProps } from "./AuditHistoryPanel";

export { DiagnosticsPanel } from "./DiagnosticsPanel";
export type { DiagnosticsPanelProps } from "./DiagnosticsPanel";

export { AuditExportForm } from "./AuditExportForm";
export type { AuditExportFormProps } from "./AuditExportForm";

export { FilterPresets } from "./FilterPresets";
export type { FilterPresetsProps } from "./FilterPresets";

export { useLogs } from "./useLogs";
export type { UseLogsReturn } from "./useLogs";

export type {
  AuditHistoryResponse,
  LogTab,
  LogsSummaryCounts,
  FilterPreset,
  SummaryCardEntry,
  LoadState,
  TabPanelProps,
} from "./types";

export {
  buildSummaryCards,
  presetToParams,
  presetLabel,
  stringifyValue,
  formatBytes,
  getNextAction,
} from "./utils";
