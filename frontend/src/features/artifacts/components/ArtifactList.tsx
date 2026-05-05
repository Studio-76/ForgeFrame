/**
 * ArtifactList — inventory table for artifacts using the ForgeFrame DataTable.
 *
 * Renders artifact records with sorting, row click selection, and column
 * visibility. Each row shows the artifact label, type/status, scope,
 * size/checksum, version, linked objects, and creation timestamp.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import { DataTable } from "../../../components/ui/DataTable";
import type { DataTableColumn } from "../../../components/ui/DataTable";
import type { ArtifactRecord } from "../../../api/domain/artifacts";
import { formatBytes, formatChecksum, formatTimestamp, buildLinkedObjects, describeArtifactAccess } from "../helpers";

/**
 * Props for ArtifactList.
 */
export type ArtifactListProps = {
  /** Artifact records to display. */
  artifacts: ArtifactRecord[];
  /** Current instance ID for building links. */
  instanceId: string;
  /** Currently selected artifact ID. */
  selectedArtifactId: string;
  /** Loading state for the artifact list. */
  listState: "idle" | "loading" | "success" | "error";
  /** Called when a row is clicked. */
  onSelectArtifact: (artifactId: string) => void;
  /** Error message from the list fetch. */
  error?: string;
  /** Called to retry loading. */
  onRetry?: () => void;
};

/**
 * Artifact inventory table with sorting, search, and row selection.
 *
 * Uses the standard ForgeFrame DataTable component with TanStack Table.
 * Provides full-text search across all visible columns and row-click
 * selection to view artifact details.
 */
export function ArtifactList({
  artifacts,
  instanceId,
  selectedArtifactId,
  listState,
  onSelectArtifact,
  error,
  onRetry,
}: ArtifactListProps) {
  const columns: DataTableColumn<ArtifactRecord>[] = [
    {
      id: "artifact",
      header: "Artifact",
      accessorFn: (row) => (
        <div>
          <span className="font-medium text-primary">{row.label}</span>
          <div className="text-meta text-muted font-mono">{row.artifact_id}</div>
          <div className="text-meta text-muted">
            {describeArtifactAccess(row).surfaceState === "metadata-only"
              ? "metadata-only on this surface"
              : describeArtifactAccess(row).surfaceState}
          </div>
        </div>
      ),
      sortingKey: (row) => row.label,
      alwaysVisible: true,
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (row) => (
        <div>
          <div>{row.artifact_type}</div>
          <span
            className="ff-status-badge"
            data-tone={
              row.status === "active" ? "success"
              : row.status === "superseded" ? "warning"
              : "neutral"
            }
          >
            {row.status}
          </span>
        </div>
      ),
      sortingKey: (row) => row.artifact_type,
      className: "min-w-[100px]",
    },
    {
      id: "scope",
      header: "Scope",
      accessorFn: (row) => (
        <div>
          <div>{row.scope_label ?? (row.workspace_id ? "Workspace" : "Instance")}</div>
          <div className="text-meta text-muted font-mono">{row.workspace_id ?? row.instance_id}</div>
        </div>
      ),
      sortingKey: (row) => row.scope_label ?? row.workspace_id ?? row.instance_id,
      isTechnical: true,
    },
    {
      id: "size",
      header: "Size / checksum",
      accessorFn: (row) => (
        <div>
          <div>{formatBytes(row.size_bytes)}</div>
          <div className="text-meta text-muted">{formatChecksum(row.checksum_sha256)}</div>
        </div>
      ),
      sortingKey: (row) => row.size_bytes ?? 0,
      isTechnical: true,
    },
    {
      id: "version",
      header: "Version",
      accessorFn: (row) => (
        <span className="font-mono">{row.version ?? "—"}</span>
      ),
      sortingKey: (row) => row.version ?? "",
      isTechnical: true,
    },
    {
      id: "linked",
      header: "Linked objects",
      accessorFn: (row) => {
        const rowLinks = buildLinkedObjects(instanceId, row);
        if (rowLinks.length === 0) {
          return <span className="text-meta text-muted">No explicit links</span>;
        }
        return (
          <ul className="fg-list">
            {rowLinks.slice(0, 3).map((item) => (
              <li key={item.key}>
                {item.href
                  ? <Link className="ff-link" to={item.href}>{item.label}: {item.identifier}</Link>
                  : <span>{item.label}: <span className="font-mono">{item.identifier}</span></span>
                }
              </li>
            ))}
            {rowLinks.length > 3
              ? <li className="text-meta text-muted">+{rowLinks.length - 3} more linked objects</li>
              : null}
          </ul>
        );
      },
      sortingKey: (row) => (row.attachments?.length ?? 0).toString(),
    },
    {
      id: "created",
      header: "Created",
      accessorFn: (row) => (
        <span className="whitespace-nowrap text-meta text-muted">{formatTimestamp(row.created_at)}</span>
      ),
      sortingKey: (row) => row.created_at ?? "",
      isTechnical: true,
    },
  ];

  return (
    <DataTable
      data={artifacts}
      columns={columns}
      rowKey={(row) => row.artifact_id}
      selectedRowId={selectedArtifactId || undefined}
      onSelectedRowChange={(id) => {
        if (id) onSelectArtifact(id);
      }}
      onRowClick={(row) => onSelectArtifact(row.artifact_id)}
      loading={listState === "loading"}
      error={error ?? null}
      onRetry={onRetry}
      enablePagination
      pageSize={25}
      emptyTitle="No artifacts found"
      emptyDescription="No artifacts matched the current filters. Try adjusting the scope or filter criteria."
      showSearch={false}
      showPresets={false}
      enableColumnVisibility
      title="Artifact inventory"
      description="Type, scope, checksum, version, linked workspace/run/approval truth, and creation time."
    />
  );
}
