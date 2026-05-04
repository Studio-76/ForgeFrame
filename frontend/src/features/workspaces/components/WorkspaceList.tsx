/**
 * WorkspaceList — DataTable-based workspace inventory.
 *
 * @packageDocumentation
 */

import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { WorkspaceSummary } from "../../../api/domain/workspaces";
import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import type { DataTableColumn } from "../../../components/ui/DataTable";
import { buildConversationPath } from "../../../app/workInteractionRoutes";
import {
  statusTone,
  actionTone,
  formatTimestamp,
  getWorkspaceAction,
} from "../helpers";
import type { LoadState } from "../types";

/**
 * Props for the WorkspaceList component.
 */
export type WorkspaceListProps = {
  /** Workspaces to display. */
  workspaces: WorkspaceSummary[];
  /** Currently selected workspace ID. */
  selectedWorkspaceId: string;
  /** Called when a workspace is selected. */
  onSelectWorkspace: (workspaceId: string) => void;
  /** Data load state. */
  listState: LoadState;
  /** Error message. */
  error?: string;
  /** Retry callback. */
  onRetry?: () => void;
  /** Instance ID for link building. */
  instanceId: string;
};

/**
 * Workspace inventory table using DataTable.
 */
export function WorkspaceList({
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
  listState,
  error,
  onRetry,
  instanceId,
}: WorkspaceListProps) {
  const navigate = useNavigate();

  const columns = useMemo<DataTableColumn<WorkspaceSummary>[]>(() => [
    {
      id: "workspace",
      header: "Workspace",
      accessorFn: (ws: WorkspaceSummary): ReactNode => (
        <div>
          <div className="font-medium">{ws.title}</div>
          <div className="text-meta text-muted font-mono">{ws.workspace_id}</div>
          <div className="text-meta text-muted">{ws.summary || "No summary"}</div>
        </div>
      ),
      sortingKey: (ws: WorkspaceSummary) => ws.title,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (ws: WorkspaceSummary): ReactNode => (
        <div>
          <span
            className="ff-pill"
            data-tone={statusTone(ws.status)}
          >
            {ws.status}
          </span>
          <div className="text-meta text-muted mt-0.5">{ws.owner_id ?? "No owner"}</div>
        </div>
      ),
      sortingKey: (ws: WorkspaceSummary) => ws.status,
    },
    {
      id: "issue",
      header: "Issue / conversation",
      accessorFn: (ws: WorkspaceSummary): ReactNode => (
        <div>
          <div className="text-meta">Issue: {ws.issue_id ?? "Not linked"}</div>
          <div className="text-meta">
            Conversation:{" "}
            {ws.latest_conversation_id ? (
              <Button
                variant="navigation"
                density="compact"
                onPress={() => navigate(
                  buildConversationPath({
                    instanceId,
                    conversationId: ws.latest_conversation_id!,
                  }),
                )}
              >
                {ws.latest_conversation_subject ?? ws.latest_conversation_id}
              </Button>
            ) : "Not linked"}
          </div>
        </div>
      ),
      sortingKey: (ws: WorkspaceSummary) => ws.issue_id ?? "",
    },
    {
      id: "lifecycle",
      header: "Preview / review / handoff",
      accessorFn: (ws: WorkspaceSummary): ReactNode => (
        <div className="text-meta">
          <div>Preview: {ws.preview_status}</div>
          <div>Review: {ws.review_status}</div>
          <div>Handoff: {ws.handoff_status}</div>
        </div>
      ),
      sortingKey: (ws: WorkspaceSummary) => ws.preview_status,
    },
    {
      id: "nextAction",
      header: "Next action",
      accessorFn: (ws: WorkspaceSummary): ReactNode => {
        const action = getWorkspaceAction(ws);
        return (
          <div>
            <span
              className="ff-pill"
              data-tone={actionTone(action.state)}
            >
              {action.state}
            </span>
            <div className="text-meta mt-0.5">{action.label}</div>
            <div className="text-meta text-muted">{action.reason}</div>
          </div>
        );
      },
      sortingKey: (ws: WorkspaceSummary) => ws.next_action_state ?? "",
    },
    {
      id: "lastActivity",
      header: "Last activity",
      accessorFn: (ws: WorkspaceSummary): ReactNode => (
        formatTimestamp(ws.last_activity_at ?? ws.latest_event_at ?? ws.updated_at)
      ),
      sortingKey: (ws: WorkspaceSummary) => ws.last_activity_at ?? ws.latest_event_at ?? ws.updated_at,
    },
  ], [instanceId, navigate]);

  return (
    <DataTable
      title="Workspace inventory"
      data={workspaces as unknown as Record<string, unknown>[]}
      columns={columns as DataTableColumn<Record<string, unknown>>[]}
      rowKey={(row) => (row as unknown as WorkspaceSummary).workspace_id}
      selectedRowId={selectedWorkspaceId || null}
      onSelectedRowChange={(id) => onSelectWorkspace(id ?? "")}
      onRowClick={(row) => onSelectWorkspace((row as unknown as WorkspaceSummary).workspace_id)}
      loading={listState === "loading"}
      error={error ?? null}
      onRetry={onRetry}
      emptyTitle="No workspaces found"
      emptyDescription={
        workspaces.length === 0 && listState === "success"
          ? "No workspaces matched the selected instance and status filter."
          : undefined
      }
      showSearch={false}
      showPresets={false}
      enableColumnVisibility={false}
      enablePagination={workspaces.length > 10}
    />
  );
}
