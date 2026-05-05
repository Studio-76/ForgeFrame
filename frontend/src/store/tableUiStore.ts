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
   * Value is a Set of row IDs that are currently expanded.
   * Note: Set is used for O(1) lookup but must be re-created immutably.
   */
  expandedRows: Record<string, Set<string>>;

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

// ── Helpers ─────────────────────────────────────────────────────────────

/** Clone expanded rows record immutably for a specific table key. */
function cloneExpanded(
  expanded: Record<string, Set<string>>,
  tableKey: string,
): Record<string, Set<string>> {
  return {
    ...expanded,
    [tableKey]: new Set(expanded[tableKey]),
  };
}

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
      const currentSet = state.expandedRows[tableKey];
      if (!currentSet) {
        return {
          expandedRows: {
            ...state.expandedRows,
            [tableKey]: new Set([rowId]),
          },
        };
      }
      const next = new Set(currentSet);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: next,
        },
      };
    }),

  expandRow: (tableKey: string, rowId: string) =>
    set((state) => {
      const currentSet = state.expandedRows[tableKey];
      if (currentSet?.has(rowId)) {
        return state; // already expanded, no-op
      }
      const next = new Set(currentSet ?? []);
      next.add(rowId);
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: next,
        },
      };
    }),

  collapseRow: (tableKey: string, rowId: string) =>
    set((state) => {
      const currentSet = state.expandedRows[tableKey];
      if (!currentSet?.has(rowId)) {
        return state; // not expanded, no-op
      }
      const next = new Set(currentSet);
      next.delete(rowId);
      return {
        expandedRows: {
          ...state.expandedRows,
          [tableKey]: next,
        },
      };
    }),

  collapseAllRows: (tableKey: string) =>
    set((state) => {
      if (!state.expandedRows[tableKey]?.size) {
        return state; // nothing to collapse
      }
      const next = { ...state.expandedRows };
      next[tableKey] = new Set();
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
