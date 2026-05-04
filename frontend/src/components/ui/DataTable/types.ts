/**
 * Shared types for the ForgeFrame DataTable component system.
 *
 * Standard column definitions, filter presets, and row action
 * types used across all operational data tables.
 *
 * @packageDocumentation
 */

import type { ReactNode } from "react";

// ── Status filter presets ────────────────────────────────

/**
 * Standard filter preset for operational tables.
 * Every table supports these presets for consistent filtering.
 */
export type TableFilterPreset = {
  /** Unique key for this preset. */
  key: string;
  /** Short display label. */
  label: string;
  /** Optional filter predicate — returns true if row matches. */
  matches?: <T>(row: T) => boolean;
  /** Optional description shown in tooltip. */
  description?: string;
};

/**
 * Standard ForgeFrame filter presets that apply to all tables.
 * Tables can extend these with additional custom presets.
 */
export const STANDARD_FILTER_PRESETS: TableFilterPreset[] = [
  { key: "all", label: "All", description: "Show all items" },
  { key: "needs_attention", label: "Needs attention", description: "Items requiring operator action" },
  { key: "ready", label: "Ready", description: "Healthy and operational" },
  { key: "blocked", label: "Blocked", description: "Blocked and not progressing" },
  { key: "degraded", label: "Degraded", description: "Partially functional" },
  { key: "disabled", label: "Disabled", description: "Manually disabled" },
  { key: "warnings", label: "Warnings", description: "Non-critical warnings" },
  { key: "advanced", label: "Advanced", description: "Show all technical details" },
];

// ── Column definition ───────────────────────────────────

/**
 * Column definition for the ForgeFrame DataTable.
 *
 * Designed to be simpler than raw TanStack column definitions
 * while supporting the standard ForgeFrame column patterns.
 */
export type DataTableColumn<T> = {
  /** Unique column identifier. */
  id: string;
  /** Column header label. */
  header: string;
  /** Accessor function to extract the cell value. */
  accessorFn: (row: T) => ReactNode;
  /** Optional string accessor for sorting. Falls back to accessorFn. */
  sortingKey?: (row: T) => string | number | boolean | null | undefined;
  /** Optional className for the header and cell. */
  className?: string;
  /** Column visibility state. Default true. */
  visible?: boolean;
  /** Whether this column contains technical/internal data hidden by default. */
  isTechnical?: boolean;
  /** Prevents the column from being hidden via the visibility toggle. */
  alwaysVisible?: boolean;
  /** Width hint (e.g. "20%", "120px"). */
  width?: string;
  /** Whether sorting is enabled for this column. Default true for sortingKey columns. */
  enableSorting?: boolean;
};

// ── Row action ─────────────────────────────────────────

/**
 * A row-level action that appears as the primary action or in the overflow menu.
 */
export type DataTableRowAction<T> = {
  /** Unique action identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Called when the action is triggered. */
  onAction: (row: T) => void;
  /** Whether this is the primary (visible) row action. */
  isPrimary?: boolean;
  /** Whether this action is destructive. */
  isDestructive?: boolean;
  /** Whether the action is disabled. */
  disabled?: boolean;
  /** Optional icon name or element for the primary action. */
  icon?: ReactNode;
};

// ── Sort state ──────────────────────────────────────────

export type TableSortDirection = "asc" | "desc";

export type TableSortState = {
  columnId: string;
  direction: TableSortDirection;
} | null;

// ── Detail drawer config ────────────────────────────────

export type DetailDrawerConfig = {
  /** Whether the drawer is open. */
  open: boolean;
  /** Drawer title. */
  title: string;
  /** Optional status badge text. */
  status?: string;
  /** Status badge tone. */
  statusTone?: "success" | "warning" | "danger" | "info" | "neutral";
  /** Called when the drawer is dismissed. */
  onClose: () => void;
};

// ── Table presets ───────────────────────────────────────

/**
 * Preset column layouts for common ForgeFrame surfaces.
 * These provide standard column configurations that pages can
 * reference or extend.
 */
export const TABLE_PRESETS = {
  /** Identity columns: name + scope + status. */
  identity: (): DataTableColumn<{ display_name: string; [key: string]: unknown }>[] => [
    { id: "name", header: "Name", accessorFn: (row) => row.display_name, alwaysVisible: true },
    { id: "status", header: "Status", accessorFn: () => null, sortingKey: () => "" },
    { id: "scope", header: "Scope", accessorFn: () => null, isTechnical: true },
  ],

  /** Timestamp columns. */
  timestamps: (): DataTableColumn<{ created_at?: string | null; updated_at?: string | null }>[] => [
    { id: "created", header: "Created", accessorFn: (row) => row.created_at ?? "—", isTechnical: true, sortingKey: (row) => row.created_at ?? "" },
    { id: "updated", header: "Updated", accessorFn: (row) => row.updated_at ?? "—", isTechnical: true, sortingKey: (row) => row.updated_at ?? "" },
  ],

  /** Owner columns. */
  ownership: (): DataTableColumn<{ tenant_id?: string; company_id?: string; owned_by?: string }>[] => [
    { id: "tenant", header: "Tenant", accessorFn: (row) => row.tenant_id ?? "—", isTechnical: true },
    { id: "company", header: "Company", accessorFn: (row) => row.company_id ?? "—", isTechnical: true },
    { id: "owner", header: "Owner", accessorFn: (row) => row.owned_by ?? "—", isTechnical: true },
  ],
} as const;
