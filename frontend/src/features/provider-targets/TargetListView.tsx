import { StatusBadge } from "../../components/ui/StatusBadge";
import { EntityTable, type EntityTableColumn } from "../../components/ui/EntityTable";
import type { ProviderTargetRecord } from "./types";
import {
  contractStatusForTarget,
  formatTimestamp,
  nextActionForTarget,
  reasonForTargetStatus,
  statusLabelForTarget,
  titleCase,
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
 * Provider targets table with streamlined columns.
 * Shows target name (no raw key), primary status, reason, next action, and health.
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
      key: "health",
      header: "Health",
      render: (target) => (
        <div>
          <div>{titleCase(target.health_status)} · {titleCase(target.availability_status)}</div>
          <div className="fg-muted">Probe {formatTimestamp(target.last_probe_at)}</div>
        </div>
      ),
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
      description="Each row shows the primary target state and a recommended next action. Raw identifiers and capability metadata stay in the detail panel."
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
