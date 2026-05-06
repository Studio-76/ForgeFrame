/**
 * useTableUiStore — shared table UI state that must survive component
 * boundaries (e.g. table on one part of the page, detail panel on another).
 *
 * Manages selected row IDs per table/panel key, expanded rows, and
 * active filter states that are not owned by URL search params.
 *
 * **Ownership rules:**
 * - Column visibility is local to the DataTable component (internal state).
 * - Filter presets that need bookmarking go into URL search params.
 * - Transient active filters live here.
 * - Selected row state lives here when the detail panel is separate from
 *   the table and must persist across re-renders.
 *
 * @module
 */

import { create } from "zustand";

// ── State shape ─────────────────────────────────────────────────────────

export type TableUiState = {
  /**
   * Tracks the selected row ID per table or panel key.
   * Key format: `"pageId:tableId"` (e.g. `"skills:main"`).
   * Allows multiple tables on the same page to each have their own
   * selected row without collision.
   */
  selectedRowId: Record<string, string | null>;

  /**
   * Expanded row IDs per table key.
   * Inner object maps expanded row IDs to `true` so selectors can compare
   * plain immutable records instead of always-new Set instances.
   */
  expandedRows: Record<string, Record<string, boolean>>;

  /**
   * Active transient filter key per table.
   * For filters that are NOT owned by URL search params.
   * Value is the filter preset key (e.g. `"needs_attention"`) or null.
   */
  activeFilters: Record<string, string | null>;
};

export type TableUiActions = {
  /**
   * Set the selected row ID for a given table/panel key.
   * @param tableKey - Unique key for the table (e.g. `"skills:main"`).
   * @param rowId - Row ID to select, or null to deselect.
   */
  setSelectedRow: (tableKey: string, rowId: string | null) => void;

  /** Deselect the current row for a table key. */
  clearSelectedRow: (tableKey: string) => void;

  /** Toggle expanded state of a row. */
  toggleRowExpanded: (tableKey: string, rowId: string) => void;

  /** Set a row as expanded (no-op if already expanded). */
  expandRow: (tableKey: string, rowId: string) => void;

  /** Collapse a specific row. */
  collapseRow: (tableKey: string, rowId: string) => void;

  /** Collapse all rows for a table. */
  collapseAllRows: (tableKey: string) => void;

  /** Set the active filter preset for a table. */
  setActiveFilter: (tableKey: string, filterKey: string | null) => void;

  /** Clear all selected rows across all tables. */
  clearAllSelections: () => void;

  /** Reset all state for a specific table key. */
  resetTable: (tableKey: string) => void;
};

export type TableUiStore = TableUiState & TableUiActions;

// ── Default state ───────────────────────────────────────────────────────

const defaultTableUiState: TableUiState = {
  selectedRowId: {},
  expandedRows: {},
  activeFilters: {},
};

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Shared store for table UI state that crosses component boundaries.
 *
 * @example
 * ```tsx
 * // Read selected row for a table
 * const selectedRowId = useTableUiStore((s) => s.selectedRowId["skills:main"]);
 *
 * // Select a row
 * const setSelected = useTableUiStore((s) => s.setSelectedRow);
 * setSelected("skills:main", "skill-abc");
 * ```
 */
export const useTableUiStore = create<TableUiStore>((set) => ({
  ...defaultTableUiState,

  setSelectedRow: (tableKey: string, rowId: string | null) =>
    set((state) => ({
      selectedRowId: {
        ...state.selectedRowId,
        [tableKey]: rowId,
      },
    })),

  clearSelectedRow: (tableKey: string) =>
    set((state) => {
      const next = { ...state.selectedRowId };
      delete next[tableKey];
      return { selectedRowId: next };
    }),

  toggleRowExpanded: (tableKey: string, rowId: string) =>
    set((state) => {
      const currentRows = state.expandedRows[tableKey] ?? {};
      const nextRows = { ...currentRows };
      if (nextRows[rowId]) {
        delete nextRows[rowId];
      } else {
        nextRows[rowId] = true;
      }
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: nextRows,
        },
      };
    }),

  expandRow: (tableKey: string, rowId: string) =>
    set((state) => {
      const currentRows = state.expandedRows[tableKey] ?? {};
      if (currentRows[rowId]) {
        return state; // already expanded, no-op
      }
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: {
            ...currentRows,
            [rowId]: true,
          },
        },
      };
    }),

  collapseRow: (tableKey: string, rowId: string) =>
    set((state) => {
      const currentRows = state.expandedRows[tableKey] ?? {};
      if (!currentRows[rowId]) {
        return state; // not expanded, no-op
      }
      const nextRows = { ...currentRows };
      delete nextRows[rowId];
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: nextRows,
        },
      };
    }),

  collapseAllRows: (tableKey: string) =>
    set((state) => {
      if (Object.keys(state.expandedRows[tableKey] ?? {}).length === 0) {
        return state; // nothing to collapse
      }
      const next = { ...state.expandedRows };
      next[tableKey] = {};
      return { expandedRows: next };
    }),

  setActiveFilter: (tableKey: string, filterKey: string | null) =>
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        [tableKey]: filterKey,
      },
    })),

  clearAllSelections: () => set({ selectedRowId: {} }),

  resetTable: (tableKey: string) =>
    set((state) => {
      const nextSelected = { ...state.selectedRowId };
      delete nextSelected[tableKey];

      const nextExpanded = { ...state.expandedRows };
      delete nextExpanded[tableKey];

      const nextFilters = { ...state.activeFilters };
      delete nextFilters[tableKey];

      return {
        selectedRowId: nextSelected,
        expandedRows: nextExpanded,
        activeFilters: nextFilters,
      };
    }),
}));
