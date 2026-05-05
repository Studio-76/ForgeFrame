/**
 * Automation registry table — shows automation inventory with schedule,
 * target linkage, and last outcome.
 *
 * Uses the ForgeFrame DataTable (TanStack Table).
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from "react";
import type { AutomationSummary } from "../../../api/domain/automations";
import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { automationOutcomeLabel, automationStatusTone, automationTargetLabel, cadenceToStructured } from "../helpers";

/** Props for AutomationList. */
export interface AutomationListProps {
  /** Loaded automation summaries. */
  automations: AutomationSummary[];
  /** Currently selected automation ID. */
  selectedAutomationId: string;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
  /** Called when a row is clicked. */
  onRowClick: (automation: AutomationSummary) => void;
}

/**
 * DataTable-based automation inventory with sortable columns.
 */
export function AutomationList({
  automations,
  selectedAutomationId,
  loading,
  error,
  onRowClick,
}: AutomationListProps) {
  const columns = useMemo<DataTableColumn<AutomationSummary>[]>(
    () => [
      {
        id: "automation",
        header: "Automation",
        accessorFn: (row) => (
          <div>
            <span className="font-medium text-primary">{row.title}</span>
            <div className="text-meta text-muted">
              {row.automation_id} · {row.action_kind}
            </div>
          </div>
        ),
        sortingKey: (row) => row.title,
        alwaysVisible: true,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => (
          <span className="fg-pill" data-tone={automationStatusTone(row.status)}>
            {row.status}
          </span>
        ),
        sortingKey: (row) => row.status,
      },
      {
        id: "schedule",
        header: "Schedule",
        accessorFn: (row) => {
          const s = cadenceToStructured(row.cadence_minutes);
          return `every ${s.every} ${s.unit}`;
        },
        sortingKey: (row) => String(row.cadence_minutes),
      },
      {
        id: "next_run",
        header: "Next run",
        accessorFn: (row) => row.next_run_at,
        sortingKey: (row) => row.next_run_at,
      },
      {
        id: "last_run",
        header: "Last run",
        accessorFn: (row) => row.last_run_at ?? "Never",
        sortingKey: (row) => row.last_run_at ?? "",
      },
      {
        id: "target",
        header: "Target",
        accessorFn: (row) => automationTargetLabel(row),
      },
      {
        id: "outcome",
        header: "Outcome",
        accessorFn: (row) => automationOutcomeLabel(row),
      },
    ],
    [],
  );

  const handleRowClick = useCallback(
    (row: AutomationSummary) => {
      onRowClick(row);
    },
    [onRowClick],
  );

  return (
    <DataTable
      data={automations}
      columns={columns}
      rowKey={(row) => row.automation_id}
      selectedRowId={selectedAutomationId}
      onRowClick={handleRowClick}
      loading={loading}
      error={error}
      title="Automation inventory"
      emptyTitle="No automations found"
      emptyDescription="No automations matched the selected filters. Try adjusting the status filter."
      showSearch={false}
      showPresets={false}
      enablePagination={false}
      density="compact"
    />
  );
}
