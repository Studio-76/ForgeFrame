/**
 * Instance inventory table with TanStack DataTable.
 *
 * Replaces the legacy native `<table>` with the standardized
 * ForgeFrame DataTable providing sorting, search, filtering,
 * column visibility, pagination, and row-click detail.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from "react";

import type { InstanceRecord } from "../../api/domain/instances";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  DataTable,
  type DataTableColumn,
  type TableFilterPreset,
} from "../../components/ui/DataTable";

import {
  toneForSetupStatus,
  formatReadinessSummary,
} from "./utils";
import type {
  LoadState,
  StatusFilter,
  ModeFilter,
  ReadinessFilter,
} from "./types";

/**
 * Props for the InstanceInventoryTable component.
 */
export type InstanceInventoryTableProps = {
  /** Current load state. */
  loadState: LoadState;
  /** All loaded instances. */
  instances: InstanceRecord[];
  /** Filtered instances for display. */
  filteredInstances: InstanceRecord[];
  /** The currently selected instance. */
  selectedInstance: InstanceRecord | null;
  /** Search input value. */
  searchValue: string;
  /** Status filter value. */
  statusFilter: StatusFilter;
  /** Mode filter value. */
  modeFilter: ModeFilter;
  /** Readiness filter value. */
  readinessFilter: ReadinessFilter;
  /** Scope filter value. */
  scopeFilter: string;
  /** Whether the scoped instance is filtered out of view. */
  scopedInstanceFilteredOut: boolean;
  /** Refresh the instance list. */
  onRefresh: () => void;
  /** Select an instance. */
  onSelectInstance: (instanceId: string) => void;
  /** Update search value. */
  onSearchChange: (value: string) => void;
  /** Update status filter. */
  onStatusFilterChange: (value: StatusFilter) => void;
  /** Update mode filter. */
  onModeFilterChange: (value: ModeFilter) => void;
  /** Update readiness filter. */
  onReadinessFilterChange: (value: ReadinessFilter) => void;
  /** Update scope filter. */
  onScopeFilterChange: (value: string) => void;
};

/**
 * Instance inventory table with TanStack DataTable.
 *
 * Provides sortable columns, search, standard filter presets,
 * column visibility toggling, pagination, and row-click
 * selection for the instance detail drawer.
 */
export function InstanceInventoryTable({
  loadState,
  instances,
  filteredInstances,
  selectedInstance,
  searchValue,
  statusFilter,
  modeFilter,
  readinessFilter,
  scopeFilter,
  scopedInstanceFilteredOut,
  onSearchChange,
  onSelectInstance,
}: InstanceInventoryTableProps) {
  // ── Custom filter presets for instances ──
  const customPresets: TableFilterPreset[] = useMemo(
    () => [
      {
        key: "active",
        label: "Active",
        description: "Active instances only",
      },
      {
        key: "disabled_status",
        label: "Disabled",
        description: "Disabled instances",
      },
      {
        key: "ready_readiness",
        label: "Ready",
        description: "Instances with ready readiness status",
      },
      {
        key: "not_ready",
        label: "Not ready",
        description: "Instances that are not ready",
      },
      {
        key: "needs_operator",
        label: "Needs operator",
        description: "Instances without a ready operator agent",
      },
    ],
    [],
  );

  const [activePreset, setActivePreset] = useState<string | null>(null);

  // ── Column definitions ──
  const columns: DataTableColumn<InstanceRecord>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Instance",
        accessorFn: (row: InstanceRecord) => (
          <div>
            <div className="font-medium text-primary">{row.display_name}</div>
            <div className="text-muted text-xs font-mono mt-0.5">{row.instance_id}</div>
          </div>
        ),
        sortingKey: (row: InstanceRecord) => row.display_name,
        alwaysVisible: true,
      },
      {
        id: "scope",
        header: "Scope",
        accessorFn: (row: InstanceRecord) => (
          <div>
            <div className="text-primary text-sm">{row.tenant_id}</div>
            {row.company_id ? (
              <div className="text-muted text-xs">{row.company_id}</div>
            ) : null}
          </div>
        ),
        sortingKey: (row: InstanceRecord) => row.tenant_id,
        isTechnical: true,
      },
      {
        id: "mode",
        header: "Mode",
        accessorFn: (row: InstanceRecord) => (
          <div>
            <div className="text-primary text-sm">{row.deployment_mode}</div>
            <div className="text-muted text-xs">{row.exposure_mode}</div>
          </div>
        ),
        sortingKey: (row: InstanceRecord) => row.deployment_mode,
      },
      {
        id: "readiness",
        header: "Readiness",
        accessorFn: (row: InstanceRecord) => (
          <div>
            <StatusBadge tone={toneForSetupStatus(row.readiness?.status)}>
              {row.readiness?.status ?? "unknown"}
            </StatusBadge>
            <div className="text-muted text-xs mt-0.5">
              {formatReadinessSummary(row.readiness)}
            </div>
          </div>
        ),
        sortingKey: (row: InstanceRecord) => row.readiness?.status ?? "",
      },
      {
        id: "operator",
        header: "Operator",
        accessorFn: (row: InstanceRecord) => (
          <div>
            {row.operator_agent?.display_name ? (
              <div className="text-primary text-sm">{row.operator_agent.display_name}</div>
            ) : (
              <div className="text-danger text-sm font-medium">Missing Operator</div>
            )}
            <div className="text-muted text-xs">
              {row.operator_agent?.reason ?? "No operator detail."}
            </div>
          </div>
        ),
        sortingKey: (row: InstanceRecord) => row.operator_agent?.display_name ?? "",
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row: InstanceRecord) => (
          <StatusBadge tone={row.status === "disabled" ? "neutral" : "success"}>
            {row.status}
          </StatusBadge>
        ),
        sortingKey: (row: InstanceRecord) => row.status,
      },
    ],
    [],
  );

  // ── Handle row click → select instance ──
  const handleRowClick = useCallback((row: InstanceRecord) => {
    onSelectInstance(row.instance_id);
  }, [onSelectInstance]);

  // ── Search handler ──
  const handleSearchChange = useCallback((value: string) => {
    onSearchChange(value);
  }, [onSearchChange]);

  // ── Scoped instance warning ──
  const scopeWarning =
    scopedInstanceFilteredOut ? (
      <div className="px-4 py-2 text-xs text-warning bg-warning-soft border-b border-warning-border">
        The current scoped instance{" "}
        <span className="font-mono">{selectedInstance?.instance_id}</span>{" "}
        is outside the filtered table. Clear or change filters to bring it back.
      </div>
    ) : null;

  // ── Compute the display data based on filters ──
  const displayData = filteredInstances;

  // Filter presets handler
  const handlePresetChange = useCallback((key: string | null) => {
    setActivePreset(key);
    if (key === "active") {
      onSelectInstance("");
    } else if (key === "disabled_status") {
      onSelectInstance("");
    }
  }, [onSelectInstance]);

  return (
    <div>
      <DataTable<InstanceRecord>
        data={displayData}
        columns={columns}
        rowKey={(row) => row.instance_id}
        // Search
        globalFilter={searchValue}
        onGlobalFilterChange={handleSearchChange}
        searchPlaceholder="ID, name, operator, reason"
        // Presets
        showPresets={true}
        customPresets={customPresets}
        activePreset={activePreset}
        onPresetChange={handlePresetChange}
        // Selection
        selectedRowId={selectedInstance?.instance_id ?? null}
        onSelectedRowChange={(id) => id && onSelectInstance(id)}
        // Row click
        onRowClick={handleRowClick}
        // Sorting
        enablePagination={true}
        pageSize={20}
        // States
        loading={loadState === "loading"}
        error={loadState === "error" ? "Failed to load instances." : null}
        onRetry={() => {
          /* refresh handled by parent */
        }}
        emptyTitle={
          instances.length === 0
            ? "No instances recorded"
            : "No instances match the current filters"
        }
        emptyDescription={
          instances.length === 0
            ? "Use the create form below to add the first one."
            : "Try adjusting filters or search terms."
        }
        // Layout
        title="Instance Inventory"
        description="Filter the registry, select an instance, and inspect its readiness state below."
        density="default"
        enableColumnVisibility={true}
        showSearch={true}
      />

      {scopeWarning}
    </div>
  );
}
