/**
 * Agent registry table — shows agent inventory with role, status,
 * participation mode, profile linkage, and activity.
 *
 * Uses the ForgeFrame DataTable (TanStack Table).
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import type { AgentSummary } from "../../../api/domain/agents";
import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { agentStatusTone, formatTimestamp, participationLabel } from "../helpers";

/** Props for AgentList. */
export interface AgentListProps {
  /** Loaded agent summaries. */
  agents: AgentSummary[];
  /** Currently selected agent ID. */
  selectedAgentId: string;
  /** Current instance ID. */
  instanceId: string;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
  /** Called when a row is clicked. */
  onRowClick: (agent: AgentSummary) => void;
}

/**
 * DataTable-based agent registry with sortable columns.
 */
export function AgentList({
  agents,
  selectedAgentId,
  instanceId,
  loading,
  error,
  onRowClick,
}: AgentListProps) {
  const columns = useMemo<DataTableColumn<AgentSummary>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => (
          <div>
            <span className="font-medium text-primary">{row.display_name}</span>
            <div className="text-meta text-muted">
              {row.agent_id}
              {row.is_default_operator ? " · Coordinator / lead Operator" : ""}
            </div>
            <div className="text-meta text-muted">
              {row.addressable_in_conversations ? "Addressable in conversations" : "Not addressable in live conversations"}
            </div>
          </div>
        ),
        sortingKey: (row) => row.display_name,
        alwaysVisible: true,
      },
      {
        id: "role_kind",
        header: "Role kind",
        accessorFn: (row) => row.role_kind,
        sortingKey: (row) => row.role_kind,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => (
          <span className="fg-pill" data-tone={agentStatusTone(row.status)}>
            {row.status}
          </span>
        ),
        sortingKey: (row) => row.status,
      },
      {
        id: "participation",
        header: "Participation mode",
        accessorFn: (row) => (
          <div>
            <span>{participationLabel(row.participation_mode)}</span>
            <div className="text-meta text-muted">{row.addressability_reason}</div>
          </div>
        ),
        sortingKey: (row) => row.participation_mode,
      },
      {
        id: "profile",
        header: "Profile",
        accessorFn: (row) =>
          row.assistant_profile_id ? (
            <Link
              className="fg-nav-link"
              to={`/assistant-profiles?instanceId=${instanceId}&assistantProfileId=${row.assistant_profile_id}`}
              onClick={(e) => e.stopPropagation()}
            >
              {row.assistant_profile_id}
            </Link>
          ) : (
            "Not linked"
          ),
      },
      {
        id: "last_activity",
        header: "Last activity",
        accessorFn: (row) => (
          <div>
            <span>{formatTimestamp(row.last_activity_at, row.updated_at)}</span>
            <div className="text-meta text-muted">
              conversations {row.conversation_count} · mentions {row.mention_count}
            </div>
          </div>
        ),
        sortingKey: (row) => row.last_activity_at ?? row.updated_at ?? "",
      },
    ],
    [instanceId],
  );

  const handleRowClick = useCallback(
    (row: AgentSummary) => {
      onRowClick(row);
    },
    [onRowClick],
  );

  return (
    <DataTable
      data={agents}
      columns={columns}
      rowKey={(row) => row.agent_id}
      selectedRowId={selectedAgentId}
      onRowClick={handleRowClick}
      loading={loading}
      error={error}
      emptyTitle="No agents found for this instance."
      emptyDescription="No agents matched the current filters. Try adjusting the status filter."
      showSearch={false}
      showPresets={false}
      enablePagination={false}
      density="compact"
    />
  );
}
