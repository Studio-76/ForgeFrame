/**
 * ForgeFrame DataTable — headless TanStack Table wrapper.
 *
 * Provides standard ForgeFrame operational table layout with:
 * - Sorting (click-to-sort column headers)
 * - Global search / text filter
 * - Column visibility toggling
 * - Pagination with page controls
 * - Row selection (single-select)
 * - Empty / loading / error states
 * - Detail drawer trigger on row click
 * - Standard filter presets
 * - Compact or default density
 * - Consistent ForgeFrame styling via Tailwind + CSS custom properties
 *
 * @packageDocumentation
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type Row as TanStackRow,
} from "@tanstack/react-table";
import type {
  DataTableColumn,
  DataTableRowAction,
  TableSortState,
  TableFilterPreset,
} from "./types";
import { STANDARD_FILTER_PRESETS } from "./types";

// ── Props ───────────────────────────────────────────────

export type DataTableProps<T> = {
  /** Table data rows. */
  data: T[];
  /** Column definitions. */
  columns: DataTableColumn<T>[];
  /** Unique key function for each row. */
  rowKey: (row: T) => string;

  // ── Search / Filter ──
  /** Global search text — filters all visible string columns. */
  globalFilter?: string;
  /** Called when the global search text changes. */
  onGlobalFilterChange?: (value: string) => void;
  /** Active filter preset key. */
  activePreset?: string | null;
  /** Called when a filter preset is selected. */
  onPresetChange?: (key: string | null) => void;
  /** Custom filter presets (appended to standard presets). */
  customPresets?: TableFilterPreset[];
  /** Whether the built-in filter preset bar is shown. */
  showPresets?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;

  // ── Selection ──
  /** The currently selected row ID. */
  selectedRowId?: string | null;
  /** Called when a row is selected. Pass `null` to deselect. */
  onSelectedRowChange?: (rowId: string | null) => void;
  /** Enable checkbox column for multi-select. */
  enableCheckboxSelection?: boolean;

  // ── Sorting ──
  /** Controlled sort state. */
  sortState?: TableSortState;
  /** Called when sort changes. */
  onSortChange?: (sort: TableSortState) => void;

  // ── Pagination ──
  /** Enable pagination (default: true for >10 rows). */
  enablePagination?: boolean;
  /** Page size (default: 20). */
  pageSize?: number;
  /** Available page size options. */
  pageSizeOptions?: number[];

  // ── Detail drawer / Row click ──
  /** Called when a row is clicked. Receives the row data. */
  onRowClick?: (row: T) => void;

  // ── Row actions ──
  /** Primary row action (visible button on each row). */
  primaryAction?: DataTableRowAction<T>;
  /** Secondary actions (shown in overflow menu). */
  secondaryActions?: DataTableRowAction<T>[];

  // ── States ──
  /** Whether the table data is loading. */
  loading?: boolean;
  /** Error message if data loading failed. */
  error?: string | null;
  /** Called when the user retries after an error. */
  onRetry?: () => void;
  /** Custom empty state title. */
  emptyTitle?: string;
  /** Custom empty state description. */
  emptyDescription?: string;

  // ── Layout ──
  /** Table title (rendered in the header). */
  title?: string;
  /** Table subtitle / description. */
  description?: string;
  /** Actions rendered in the table header (right side). */
  actions?: ReactNode;
  /** Compact row density. */
  density?: "default" | "compact";
  /** Whether column visibility toggling is enabled. */
  enableColumnVisibility?: boolean;
  /** Whether to show the search input. */
  showSearch?: boolean;
  /** Minimum search input width. */
  searchMinWidth?: string;
};

// ── Sort indicator icons ────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  return (
    <span className="inline-flex flex-col leading-none ml-1 opacity-40 group-hover:opacity-70 transition-opacity" aria-hidden="true">
      <svg
        width="8"
        height="5"
        viewBox="0 0 8 5"
        className={direction === "asc" ? "text-accent opacity-100" : ""}
        fill="currentColor"
      >
        <path d="M4 0L8 5H0z" />
      </svg>
      <svg
        width="8"
        height="5"
        viewBox="0 0 8 5"
        className={direction === "desc" ? "text-accent opacity-100" : ""}
        fill="currentColor"
      >
        <path d="M4 5L0 0h8z" />
      </svg>
    </span>
  );
}

// ── Preset filter bar ───────────────────────────────────

function PresetFilters({
  presets,
  activeKey,
  onChange,
}: {
  presets: TableFilterPreset[];
  activeKey: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter presets">
      {presets.map((preset) => {
        const isActive = activeKey === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            title={preset.description}
            onClick={() => onChange(isActive ? null : preset.key)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-100
              ${isActive
                ? "bg-accent/10 text-accent border-accent/30 shadow-sm"
                : "bg-surface text-muted border-border hover:border-accent/40 hover:text-primary"
              }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Column visibility dropdown ──────────────────────────

function ColumnVisibilityDropdown<T>({
  tableColumns,
  visibleColumns,
  onToggleColumn,
}: {
  tableColumns: DataTableColumn<T>[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggleable = tableColumns.filter((col) => !col.alwaysVisible);

  if (toggleable.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-muted hover:border-accent/40 hover:text-primary transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Columns
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface border border-border rounded-lg shadow-panel py-1">
            {toggleable.map((col) => {
              const isVisible = visibleColumns.has(col.id);
              return (
                <label
                  key={col.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-body text-primary cursor-pointer hover:bg-surface-subtle transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggleColumn(col.id)}
                    className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/30"
                  />
                  {col.header}
                </label>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────

function TablePagination({
  pageIndex,
  pageSize,
  totalRows,
  pageCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: number[];
}) {
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);
  const canGoBack = pageIndex > 0;
  const canGoForward = pageIndex < pageCount - 1;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border text-xs text-muted">
      <div className="flex items-center gap-2">
        <span>
          {from}–{to} of {totalRows}
        </span>
        <span className="text-border">|</span>
        <label className="flex items-center gap-1">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-primary"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onPageChange(0)}
          className="p-1 rounded hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-default"
          aria-label="First page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 20-8-8 8-8"/><path d="M5 4v16"/></svg>
        </button>
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onPageChange(pageIndex - 1)}
          className="p-1 rounded hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-default"
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="px-2 font-medium text-primary text-body">
          {pageCount > 0 ? `${pageIndex + 1} of ${pageCount}` : "—"}
        </span>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onPageChange(pageIndex + 1)}
          className="p-1 rounded hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-default"
          aria-label="Next page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onPageChange(pageCount - 1)}
          className="p-1 rounded hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-default"
          aria-label="Last page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 20 8-8-8-8"/><path d="M19 4v16"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Main DataTable component ────────────────────────────

/**
 * ForgeFrame DataTable — standard operational table with
 * sorting, filtering, pagination, selection, and detail drawer support.
 */
export function DataTable<T extends Record<string, unknown>>({
  // Data
  data,
  columns,
  rowKey,

  // Search / Filter
  globalFilter = "",
  onGlobalFilterChange,
  activePreset,
  onPresetChange,
  customPresets,
  showPresets = true,
  searchPlaceholder = "Search...",

  // Selection
  selectedRowId,
  onSelectedRowChange,
  enableCheckboxSelection = false,

  // Sorting
  sortState,
  onSortChange,

  // Pagination
  enablePagination = true,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],

  // Row click
  onRowClick,

  // Row actions
  primaryAction,
  secondaryActions,

  // States
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "There is no data matching the current filters or view.",

  // Layout
  title,
  description,
  actions,
  density = "default",
  enableColumnVisibility = true,
  showSearch = true,
  searchMinWidth,
}: DataTableProps<T>) {
  // ── Hidden columns state ──
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const technicalIds = columns.filter((c) => c.isTechnical && !c.alwaysVisible).map((c) => c.id);
    return new Set(technicalIds);
  });

  // Merge standard + custom presets
  const allPresets = useMemo(
    () => [...STANDARD_FILTER_PRESETS, ...(customPresets ?? [])],
    [customPresets],
  );

  // ── TanStack Table setup ──
  const tanstackColumns = useMemo(
    () =>
      columns
        .filter((col) => !hiddenColumns.has(col.id))
        .map((col) => ({
          id: col.id,
          accessorFn: col.accessorFn as (row: T) => unknown,
          header: col.header,
          cell: (info: { getValue: () => unknown }) => info.getValue() as ReactNode,
          enableSorting: col.enableSorting ?? !!col.sortingKey,
          sortingFn: col.sortingKey
            ? (rowA: TanStackRow<T>, rowB: TanStackRow<T>) => {
                const a = col.sortingKey!(rowA.original);
                const b = col.sortingKey!(rowB.original);
                if (a == null && b == null) return 0;
                if (a == null) return -1;
                if (b == null) return 1;
                if (typeof a === "string" && typeof b === "string") {
                  return a.localeCompare(b);
                }
                if (typeof a === "number" && typeof b === "number") {
                  return a - b;
                }
                return String(a).localeCompare(String(b));
              }
            : undefined,
        })),
    [columns, hiddenColumns],
  );

  // Global filter applied via TanStack's built-in filter model
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (sortState) {
      return [{ id: sortState.columnId, desc: sortState.direction === "desc" }];
    }
    return [];
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination: enablePagination ? pagination : undefined,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      onSortChange?.(
        next.length > 0
          ? { columnId: next[0].id, direction: next[0].desc ? "desc" : "asc" }
          : null,
      );
    },
    onColumnFiltersChange: setColumnFilters,
    // Note: onGlobalFilterChange is NOT wired here to prevent
    // re-render loops when the parent controls globalFilter externally.
    // The input onChange handler calls the prop directly instead.
    onPaginationChange: enablePagination ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    globalFilterFn: "includesString",
    enableSortingRemoval: false,
  });

  // ── Derived state ──
  const rows = table.getRowModel().rows;
  const totalRows = data.length;
  const { pageIndex } = table.getState().pagination;
  const currentPageSize = table.getState().pagination.pageSize;
  const pageCount = enablePagination ? table.getPageCount() : 1;
  const visibleColumnIds = new Set(
    columns.filter((c) => !hiddenColumns.has(c.id)).map((c) => c.id),
  );

  // ── Handlers ──
  const handleRowClick = useCallback(
    (row: T) => {
      onRowClick?.(row);
    },
    [onRowClick],
  );

  const handleToggleColumn = useCallback(
    (columnId: string) => {
      setHiddenColumns((prev) => {
        const next = new Set(prev);
        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }
        return next;
      });
    },
    [],
  );

  // ── Render helpers ──

  /** Renders the search input and filter preset bar. */
  function renderToolbar() {
    const showToolbar = showSearch || showPresets || enableColumnVisibility || actions;
    if (!showToolbar) return null;

    return (
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-border">
        {/* Search + column visibility row */}
        <div className="flex items-center gap-3 flex-wrap">
          {showSearch ? (
            <div
              className="relative flex-1 min-w-[180px] max-w-sm"
              style={searchMinWidth ? { minWidth: searchMinWidth } : undefined}
            >
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.8-3.8" />
              </svg>
              <input
                type="search"
                value={globalFilter}
                onChange={(e) => onGlobalFilterChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-field border border-border rounded-md text-primary placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                aria-label="Search table"
              />
              {globalFilter ? (
                <button
                  type="button"
                  onClick={() => onGlobalFilterChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary p-0.5"
                  aria-label="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              ) : null}
            </div>
          ) : null}

          {actions ? <div className="flex items-center gap-2 ml-auto">{actions}</div> : null}

          {enableColumnVisibility ? (
            <ColumnVisibilityDropdown
              tableColumns={columns}
              visibleColumns={visibleColumnIds}
              onToggleColumn={handleToggleColumn}
            />
          ) : null}
        </div>

        {/* Preset filter bar */}
        {showPresets ? (
          <PresetFilters
            presets={allPresets}
            activeKey={activePreset ?? null}
            onChange={(key) => onPresetChange?.(key)}
          />
        ) : null}
      </div>
    );
  }

  /** Renders the table header row. */
  function renderHeader() {
    return (
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sortDirection = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  className={`
                    text-left font-semibold text-muted bg-surface-strong
                    ${density === "compact" ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}
                    border-b border-border
                    ${canSort ? "cursor-pointer select-none group hover:bg-surface-subtle" : ""}
                  `}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  aria-sort={
                    sortDirection === "asc"
                      ? "ascending"
                      : sortDirection === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort ? <SortIcon direction={sortDirection} /> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
    );
  }

  /** Renders the table body rows. */
  function renderBody() {
    if (rows.length === 0) return null;

    return (
      <tbody>
        {rows.map((row) => {
          const key = rowKey(row.original);
          const isSelected = selectedRowId === key;
          return (
            <tr
              key={key}
              onClick={() => handleRowClick(row.original)}
              className={`
                border-b border-border last:border-b-0
                transition-colors duration-75
                ${onRowClick ? "cursor-pointer" : ""}
                ${isSelected ? "bg-accent/5" : "hover:bg-surface-subtle/60"}
              `}
              data-selected={isSelected ? "true" : undefined}
            >
              {row.getVisibleCells().map((cell) => {
                const columnId = cell.column.id;
                const colDef = columns.find((c) => c.id === columnId);
                return (
                  <td
                    key={cell.id}
                    className={`
                      ${density === "compact" ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}
                      ${colDef?.className ?? ""}
                    `}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    );
  }

  // ── Main render ──

  return (
    <section className="ff-table-card">
      {/* Title / header */}
      {title || description ? (
        <div className="ff-table-card-header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
        </div>
      ) : null}

      {/* Toolbar: search, presets, column visibility */}
      {renderToolbar()}

      {/* Error state */}
      {error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-danger font-medium mb-1">Failed to load data</p>
          <p className="text-muted text-sm mb-3">{error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="ff-btn-secondary ff-btn-sm">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <div className="px-4 py-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-surface-subtle animate-pulse"
              style={{ width: `${85 - i * 8}%`, opacity: Math.max(0.3, 1 - i * 0.12) }}
            />
          ))}
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && rows.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-muted font-medium">{emptyTitle}</p>
          <p className="text-muted/70 text-sm mt-1">{emptyDescription}</p>
        </div>
      ) : null}

      {/* Table */}
      {!loading && !error && rows.length > 0 ? (
        <div className="ff-table-scroll">
          <table
            className="ff-data-table"
            aria-label={title ?? "Data table"}
          >
            {renderHeader()}
            {renderBody()}
          </table>
        </div>
      ) : null}

      {/* Pagination */}
      {!loading && !error && rows.length > 0 && enablePagination && pageCount > 1 ? (
        <TablePagination
          pageIndex={pageIndex}
          pageSize={currentPageSize}
          totalRows={totalRows}
          pageCount={pageCount}
          onPageChange={(page) => table.setPageIndex(page)}
          onPageSizeChange={(size) => table.setPageSize(size)}
          pageSizeOptions={pageSizeOptions}
        />
      ) : null}

      {/* Row count footer */}
      {!loading && !error && rows.length > 0 ? (
        <div className="ff-table-card-footer">
          <p className="text-muted text-xs">
            {totalRows} row{totalRows === 1 ? "" : "s"}
            {globalFilter ? ` (${rows.length} filtered)` : ""}
            {onRowClick ? " · Click a row to inspect" : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
