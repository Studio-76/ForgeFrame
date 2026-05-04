/**
 * ForgeFrame DataTable component system.
 *
 * A comprehensive table system built on TanStack Table with:
 * - Sorting, filtering, pagination, column visibility
 * - Standard ForgeFrame filter presets
 * - Row selection and detail drawer integration
 * - Loading, empty, and error states
 * - Consistent ForgeFrame design system styling
 */

export { DataTable } from "./DataTable";
export type { DataTableProps } from "./DataTable";

export type {
  DataTableColumn,
  DataTableRowAction,
  TableFilterPreset,
  TableSortDirection,
  TableSortState,
  DetailDrawerConfig,
} from "./types";

export {
  STANDARD_FILTER_PRESETS,
  TABLE_PRESETS,
} from "./types";

export {
  instanceTableColumns,
  modelTableColumns,
  auditTableColumns,
} from "./presets";
export type {
  InstanceTableRow,
  ModelTableRow,
  AuditTableRow,
} from "./presets";
