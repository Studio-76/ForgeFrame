/**
 * useTablePanelSync — connects DataTable row selection to the shared panel
 * store so that the selected row and detail drawer state survive component
 * boundaries (e.g. table on one side, detail drawer on another).
 *
 * Uses the {@link useTableUiStore} for the selected row ID and the
 * {@link usePanelStore} for the drawer open/close state.
 *
 * **Ownership rules:**
 * - The table key is scoped to a page + table combination so that multiple
 *   tables on different pages don't collide.
 * - URL-owned filter state is NOT stored in Zustand.
 * - Server data (the row's detail object) stays in TanStack Query — only the
 *   selected row ID and drawer open state go into Zustand.
 *
 * @module
 */

import { useCallback } from "react";

import { useTableUiStore, usePanelStore } from "../store";

/**
 * Result of the useTablePanelSync hook.
 */
export type TablePanelSyncResult = {
  /** The currently selected row ID for this table key, or null. */
  selectedRowId: string | null;

  /** Select a row. Also opens a drawer for that row. */
  selectRow: (rowId: string) => void;

  /** Deselect the current row and close the drawer. */
  clearSelection: () => void;

  /** Whether the detail drawer is currently open. */
  isDrawerOpen: boolean;

  /** Manually close the drawer. */
  closeDrawer: () => void;

  /** Extra drawer context data. */
  drawerData: Record<string, unknown> | null;
};

/**
 * Connect a DataTable's selected row to the shared panel store.
 *
 * @param tableKey - Unique identifier for this table (e.g. `"skills:main"`).
 * @returns Selected row state and drawer control callbacks.
 *
 * @example
 * ```tsx
 * const { selectedRowId, selectRow, clearSelection, isDrawerOpen } =
 *   useTablePanelSync("skills:main");
 *
 * return (
 *   <>
 *     <DataTable
 *       data={data}
 *       columns={columns}
 *       rowKey={(r) => r.id}
 *       selectedRowId={selectedRowId}
 *       onRowClick={(row) => selectRow(row.id)}
 *     />
 *     <DetailDrawer open={isDrawerOpen} onClose={clearSelection} ...>
 *       ...
 *     </DetailDrawer>
 *   </>
 * );
 * ```
 */
export function useTablePanelSync(tableKey: string): TablePanelSyncResult {
  const selectedRowId: string | null = useTableUiStore(
    useCallback((s) => s.selectedRowId[tableKey] ?? null, [tableKey]),
  );

  const activeDrawer = usePanelStore((s) => s.activeDrawer);
  const drawerData = usePanelStore((s) => s.drawerData);

  const setSelectedRow = useTableUiStore((s) => s.setSelectedRow);
  const clearSelectedRow = useTableUiStore((s) => s.clearSelectedRow);

  const openDrawer = usePanelStore((s) => s.openDrawer);
  const closeDrawerStore = usePanelStore((s) => s.closeDrawer);
  const resetTable = useTableUiStore((s) => s.resetTable);

  const drawerKey = `drawer:${tableKey}`;
  const isDrawerOpen = activeDrawer === drawerKey;

  const selectRow = useCallback(
    (rowId: string) => {
      setSelectedRow(tableKey, rowId);
      openDrawer(drawerKey);
    },
    [tableKey, drawerKey, setSelectedRow, openDrawer],
  );

  const clearSelection = useCallback(() => {
    clearSelectedRow(tableKey);
    closeDrawerStore();
  }, [tableKey, clearSelectedRow, closeDrawerStore]);

  const closeDrawer = useCallback(() => {
    closeDrawerStore();
  }, [closeDrawerStore]);

  return {
    selectedRowId,
    selectRow,
    clearSelection,
    isDrawerOpen,
    closeDrawer,
    drawerData,
  };
}
