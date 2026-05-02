import { StatusBadge } from "../../components/ui/StatusBadge";
import { EntityTable, type EntityTableColumn } from "../../components/ui/EntityTable";
import type { ProviderTargetRecord } from "./types";
import {
  contractStatusForTarget,
  formatTimestamp,
  nextActionForTarget,
  reasonForTargetStatus,
  statusLabelForTarget,
  toneForTargetStatus,
} from "./utils";

type TargetListViewProps = {
  targets: ProviderTargetRecord[];
  filteredTargets: ProviderTargetRecord[];
  totalCount: number;
  selectedTargetKey: string | null;
  onSelectTarget: (targetKey: string) => void;
};

/**
 * Provider targets table with streamlined, scannable columns.
 *
 * Each row shows one primary status, a clear reason, one next action,
 * and last probe timestamp. The goal: an operator knows which target
 * needs attention and what to do about it within 5 seconds.
 */
export function TargetListView({
  targets,
  filteredTargets,
  totalCount,
  selectedTargetKey,
  onSelectTarget,
}: TargetListViewProps) {
  const columns: EntityTableColumn<ProviderTargetRecord>[] = [
    {
      key: "target",
      header: "Target",
      render: (target) => (
        <div>
          <button
            className="fg-table-trigger"
            type="button"
            onClick={() => onSelectTarget(target.target_key)}
          >
            <strong>{target.label}</strong>
          </button>
          <div className="fg-muted">
            {target.provider_label ?? target.provider} · {target.model_display_name ?? target.model_id}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (target) => {
        const status = contractStatusForTarget(target);
        return (
          <StatusBadge tone={toneForTargetStatus(status)} status={status}>
            {statusLabelForTarget(target)}
          </StatusBadge>
        );
      },
    },
    {
      key: "reason",
      header: "Why not ready",
      render: (target) => {
        const status = contractStatusForTarget(target);
        if (status === "runtime-ready") {
          return <span className="fg-muted">—</span>;
        }
        return <span className="fg-muted">{reasonForTargetStatus(target)}</span>;
      },
    },
    {
      key: "next-action",
      header: "Next action",
      render: (target) => {
        const action = nextActionForTarget(target);
        if (action.kind === "none") {
          return <span className="fg-muted">—</span>;
        }
        return <span className="ff-next-action-chip">{action.label}</span>;
      },
    },
    {
      key: "probe",
      header: "Last probe",
      render: (target) => {
        if (!target.last_probe_at) {
          return <span className="fg-muted">No live probe recorded</span>;
        }
        return (
          <div>
            <div>{target.health_status === "healthy" ? "Healthy" : target.health_status}</div>
            <div className="fg-muted">{formatTimestamp(target.last_probe_at)}</div>
          </div>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (target) => target.priority,
    },
  ];

  return (
    <EntityTable
      title="Instance-bound target table"
      description="Each row shows one primary target state and a recommended next action. Select a row for detailed readiness checks and policy editing."
      columns={columns}
      rows={filteredTargets}
      rowKey={(target) => target.target_key}
      tableLabel="Provider targets table"
      getRowClassName={(target) => (
        selectedTargetKey && target.target_key === selectedTargetKey ? "is-selected" : undefined
      )}
      emptyTitle="No targets match the active filters"
      emptyDescription="Relax provider, status, cost, quality, capability, or health filters to bring matching targets back into view."
      footer={
        <p className="fg-muted">
          Showing {filteredTargets.length} of {totalCount} instance-bound provider targets.
        </p>
      }
    />
  );
}
