/**
 * ForgeFrame UI Primitive Library
 *
 * A library of reusable components built on React Aria / React Stately
 * for accessibility, and Tailwind CSS v4 for consistent styling.
 *
 * ## Usage
 *
 * ```tsx
 * import { Button, StatusBadge, PageHeader, Section, TextField, EmptyState } from "../components/ui";
 * ```
 *
 * ## Principles
 *
 * - Every page should have at most one primary action.
 * - Navigation actions must not look like mutation actions.
 * - Diagnostic actions are visually secondary.
 * - Raw/internal data goes into AdvancedDiagnostics by default.
 * - Empty states show: clear state, short explanation, one primary action.
 * - Blocked states show: what, why, how, where.
 *
 * For migration guides and detailed documentation, see:
 *   docs/ui-primitives.md
 */

// ── Shared types ──────────────────────────────────────
export type {
  StatusTone,
  Density,
  Size,
  Severity,
  Priority,
  LoadState,
} from "./types";
export { toneToTailwind } from "./types";

// ── Shared models (Action, Status, Attention) ─────────
export type {
  Action,
  ActionKind,
  ActionIntent,
  ActionGroup,
  ActionValidation,
  ActionViolation,
  AttentionPayload,
  AttentionVisibility,
  AttentionValidation,
  AttentionViolation,
} from "./models";
export {
  validateActions,
  defaultKindForIntent,
  labelHintForIntent,
  actionToButtonProps,
  SYSTEM_STATUS_TONE,
  statusLabel,
  statusDescription,
  normalizeSystemStatus,
  visibilityForLevel,
  toneForLevel,
  attentionLabel,
  validateAttention,
  heroItems,
  visibleItems,
  collapsedItems,
  advancedItems,
} from "./models";

// ── Layout primitives ─────────────────────────────────
export { AppShell } from "../layout/AppShell";
export { PageHeader } from "./PageHeader";
export type { PageHeaderBadge } from "./PageHeader";
export { PageSummary } from "./PageSummary";
export { PageTabs } from "./PageTabs";
export type { PageTab } from "./PageTabs";
export { Section } from "./Section";
export { SplitPane } from "./SplitPane";
export { DetailPanel } from "./DetailPanel";
export { DetailDrawer } from "./DetailDrawer";
export { EmptyState } from "./EmptyState";
export { AdvancedDiagnostics } from "./AdvancedDiagnostics";
export type { AdvancedDiagnosticsProps } from "./AdvancedDiagnostics";
export {
  DiagnosticSection,
  RawJson,
  PayloadViewer,
  EvidenceBlob,
  EnvVarsList,
  FilePath,
  InternalId,
  Timestamp,
  RouteKey,
  BlockerCode,
  RawLog,
} from "./AdvancedDiagnostics";
export type {
  DiagnosticSectionProps,
  RawJsonProps,
  PayloadViewerProps,
  EvidenceBlobProps,
  EnvVarsListProps,
  FilePathProps,
  InternalIdProps,
  TimestampProps,
  RouteKeyProps,
  BlockerCodeProps,
  RawLogProps,
} from "./AdvancedDiagnostics";
export { ActionBar } from "./ActionBar";
export { SummaryStrip } from "./SummaryStrip";
export type { SummaryStripItem } from "./SummaryStrip";

// ── Action primitives ─────────────────────────────────
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";
export { IconButton } from "./IconButton";
export { ButtonGroup } from "./ButtonGroup";
export { NavigationAction } from "./NavigationAction";
export { DestructiveAction } from "./DestructiveAction";
export { OverflowMenu } from "./OverflowMenu";
export type { OverflowAction } from "./OverflowMenu";

// ── Status primitives ─────────────────────────────────
export { StatusBadge } from "./StatusBadge";
export type { StatusTone as StatusBadgeTone } from "./StatusBadge";
export { resolveStatusTone } from "./StatusBadge";
export { StatusPill } from "./StatusPill";
export { HealthState } from "./HealthState";
export { SeverityIndicator } from "./SeverityIndicator";
export { PrimaryBlockerCallout } from "./PrimaryBlockerCallout";
export { NextRecommendedAction } from "./NextRecommendedAction";

// ── Workflow primitives ───────────────────────────────
export { RemediationChecklist } from "./RemediationChecklist";
export type { ChecklistStep } from "./RemediationChecklist";
export { ReadinessChecklist } from "./ReadinessChecklist";
export { GateChecklist } from "./GateChecklist";
export { IncidentList } from "./IncidentList";
export type { Incident } from "./IncidentList";
export { AuditTimeline } from "./AuditTimeline";
export type { AuditEvent } from "./AuditTimeline";
export { ActivityTimeline } from "./ActivityTimeline";
export { DiagnosticsSummary } from "./DiagnosticsSummary";
export type { DiagnosticFinding } from "./DiagnosticsSummary";

// ── Form primitives ───────────────────────────────────
export { TextField } from "./TextField";
export { TextArea } from "./TextArea";
export { Select } from "./Select";
export type { SelectItem } from "./Select";
export { SearchInput } from "./SearchInput";
export { FilterBar } from "./FilterBar";
export { Toggle } from "./Toggle";
export { ConfirmationDialog } from "./ConfirmationDialog";

// ── Data display ──────────────────────────────────────
export { EntityTable } from "./EntityTable";
export type { EntityTableColumn } from "./EntityTable";
export { DataTable as DataTableLegacy } from "./DataTableLegacy";
export type { DataTableColumn as DataTableColumnLegacy } from "./DataTableLegacy";

// ── TanStack DataTable ─────────────────────────────────
export { DataTable } from "./DataTable";
export type { DataTableProps } from "./DataTable";
export type {
  DataTableColumn,
  DataTableRowAction,
  TableFilterPreset,
  TableSortState,
  DetailDrawerConfig,
} from "./DataTable";
export {
  STANDARD_FILTER_PRESETS,
  TABLE_PRESETS,
  instanceTableColumns,
  modelTableColumns,
  auditTableColumns,
} from "./DataTable";
export type {
  InstanceTableRow,
  ModelTableRow,
  AuditTableRow,
} from "./DataTable";

// ── Overlays ──────────────────────────────────────────
export { DialogOverlay } from "./Dialog";
export type { DialogOverlayProps } from "./Dialog";
export { ComboBox, Item as ComboBoxItem } from "./ComboBox";
export type { ComboBoxItem as ComboBoxItemType } from "./ComboBox";

// ── Deprecated (backward compat) ──────────────────────
export {
  ErrorState,
  LoadingState,
  Skeleton,
  PermissionState,
  BlockedState,
} from "./StateBlocks";
