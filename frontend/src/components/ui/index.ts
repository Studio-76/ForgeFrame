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

// ── UX Metadata ──────────────────────────────────────
export type { UxMetadata } from "./types";
export { uxAttributes } from "./types";

// ── UX Review Mode (dev-only) ─────────────────────────
export { UxReviewProvider, UxReviewOverlay, UxReviewPanel, useUxReview } from "../ux-review";

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
  SystemStatus,
  AttentionLevel,
  AttentionGrouping,
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
  groupAttentionItems,
} from "./models";

// ── Layout primitives ─────────────────────────────────
export { AppShell } from "../layout/AppShell";
export { PageHeader } from "./PageHeader";
export type { PageHeaderBadge } from "./PageHeader";
export { Section } from "./Section";
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
export { OverflowMenu } from "./OverflowMenu";
export type { OverflowAction } from "./OverflowMenu";

// ── Navigation primitives ─────────────────────────────
export { ContextNavStrip } from "./ContextNavStrip";
export type { ContextNavItem, ContextNavStripProps } from "./ContextNavStrip";

// ── Status primitives ─────────────────────────────────
export { StatusBadge } from "./StatusBadge";
export type { StatusTone as StatusBadgeTone } from "./types";
export { resolveStatusTone } from "./StatusBadge";
export { StatusPill } from "./StatusPill";
export { HealthState } from "./HealthState";
export { SeverityIndicator } from "./SeverityIndicator";
export { PrimaryBlockerCallout } from "./PrimaryBlockerCallout";
export { NextRecommendedAction } from "./NextRecommendedAction";

// ── Workflow primitives ───────────────────────────────
export { RemediationChecklist } from "./RemediationChecklist";
export type { ChecklistStep } from "./RemediationChecklist";

// ── Form primitives ───────────────────────────────────
export { TextField } from "./TextField";
export { TextArea } from "./TextArea";
export { Select } from "./Select";
export type { SelectItem } from "./Select";
export { SearchInput } from "./SearchInput";
export { FilterBar } from "./FilterBar";
export { Toggle } from "./Toggle";

// ── Data display ──────────────────────────────────────
export { EntityTable } from "./EntityTable";
export type { EntityTableColumn } from "./EntityTable";

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
