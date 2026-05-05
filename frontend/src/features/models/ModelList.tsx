/**
 * Model inventory table — standardized TanStack DataTable.
 *
 * Shows: model name, primary usability state, routing coverage,
 * verification trust state, last-verified timestamp, and next action.
 *
 * @packageDocumentation
 */

import { useMemo } from "react";

import type { AdminModelRegisterRecord } from "../../api/domain";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  DataTable,
  type DataTableColumn,
} from "../../components/ui/DataTable";
import {
  deriveNextAction,
  deriveUsabilityState,
  formatCoverage,
  formatTimestamp as formatModelTimestamp,
  isPlaceholderModel,
  isStaleModel,
  modelKey,
  toneForUsability,
} from "./utils";
import { NEXT_ACTION_LABELS, type LoadState } from "./types";

/**
 * Props for the {@link ModelList} component.
 */
export interface ModelListProps {
  /** Filtered models to display. */
  readonly models: AdminModelRegisterRecord[];
  /** Total unfiltered model count. */
  readonly totalCount: number;
  /** Load state for the data fetch. */
  readonly state: LoadState;
  /** Error message if loading failed. */
  readonly error: string;
  /** Currently selected model key. */
  readonly selectedModelKey: string | null;
  /** Called when a model row is clicked. */
  readonly onSelectModel: (key: string) => void;
  /** Called when the user clicks retry. */
  readonly onRetry: () => void;
}

/**
 * A scannable model inventory table built with TanStack DataTable.
 *
 * Each row shows: model name, primary usability state, routing coverage,
 * verification trust state, last-verified timestamp, and next action.
 * Sorting, search, pagination, and column visibility are built in.
 */
export function ModelList({
  models,
  totalCount,
  state,
  error,
  selectedModelKey,
  onSelectModel,
  onRetry,
}: ModelListProps) {
  // ── Column definitions ──
  const columns: DataTableColumn<AdminModelRegisterRecord>[] = useMemo(
    () => [
      {
        id: "model",
        header: "Model",
        accessorFn: (model: AdminModelRegisterRecord) => {
          const isPlaceholder = isPlaceholderModel(model);
          const isStale = isStaleModel(model);
          return (
            <div className={isPlaceholder || isStale ? "opacity-60" : ""}>
              <div className="font-medium text-primary">{model.display_name}</div>
              <div className="text-muted text-xs mt-0.5">{model.provider_label}</div>
            </div>
          );
        },
        sortingKey: (model: AdminModelRegisterRecord) => model.display_name,
        alwaysVisible: true,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (model: AdminModelRegisterRecord) => {
          const usability = deriveUsabilityState(model);
          const isPlaceholder = isPlaceholderModel(model);
          return (
            <div>
              <StatusBadge tone={toneForUsability(usability)} status={usability}>
                {usability.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </StatusBadge>
              {isPlaceholder ? (
                <div className="text-muted text-xs mt-0.5">Not production-ready</div>
              ) : null}
            </div>
          );
        },
        sortingKey: (model: AdminModelRegisterRecord) => deriveUsabilityState(model),
      },
      {
        id: "routing",
        header: "Routing",
        accessorFn: (model: AdminModelRegisterRecord) => (
          <StatusBadge
            tone={
              model.target_count === 0
                ? "neutral"
                : model.routing_target_count === model.target_count
                  ? "success"
                  : model.routing_target_count > 0
                    ? "warning"
                    : "danger"
            }
            status={
              model.target_count === 0
                ? "unconfigured"
                : model.routing_target_count === model.target_count
                  ? "covered"
                  : "partial"
            }
          >
            {formatCoverage(model)}
          </StatusBadge>
        ),
        sortingKey: (model: AdminModelRegisterRecord) =>
          `${model.routing_target_count}/${model.target_count}`,
      },
      {
        id: "trust",
        header: "Trust",
        accessorFn: (model: AdminModelRegisterRecord) => (
          <StatusBadge
            tone={
              model.trust_status === "tested"
                ? "success"
                : model.trust_status === "observed"
                  ? "info"
                  : model.trust_status === "verification_failed"
                    ? "danger"
                    : "warning"
            }
            status={model.trust_status}
          >
            {model.trust_status === "tested"
              ? "Verified"
              : model.trust_status === "declared_only"
                ? "Not verified"
                : model.trust_status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Unknown"}
          </StatusBadge>
        ),
        sortingKey: (model: AdminModelRegisterRecord) => model.trust_status ?? "",
      },
      {
        id: "last_verified",
        header: "Last verified",
        accessorFn: (model: AdminModelRegisterRecord) => (
          <span className="text-muted text-xs">
            {formatModelTimestamp(model.last_probe_at ?? model.last_seen_at)}
          </span>
        ),
        sortingKey: (model: AdminModelRegisterRecord) =>
          model.last_probe_at ?? model.last_seen_at ?? "",
        isTechnical: true,
      },
      {
        id: "next_action",
        header: "Next action",
        accessorFn: (model: AdminModelRegisterRecord) => {
          const usability = deriveUsabilityState(model);
          const action = deriveNextAction(model);
          const isPlaceholder = isPlaceholderModel(model);

          if (action !== "none") {
            return (
              <span className="text-xs font-medium text-warning">
                {NEXT_ACTION_LABELS[action]}
              </span>
            );
          }
          if (usability === "ready") {
            return (
              <span className="text-xs font-medium text-success">
                In service
              </span>
            );
          }
          if (isPlaceholder) {
            return (
              <span className="text-xs text-muted">Replace placeholder</span>
            );
          }
          return <span className="text-xs text-muted">{"\u2014"}</span>;
        },
        sortingKey: (model: AdminModelRegisterRecord) => deriveNextAction(model),
      },
    ],
    [],
  );

  // ── Handle row click → select model ──
  const handleRowClick = (model: AdminModelRegisterRecord) => {
    onSelectModel(modelKey(model));
  };

  return (
    <DataTable<AdminModelRegisterRecord>
      data={models}
      columns={columns}
      rowKey={(model) => modelKey(model)}
      // Selection
      selectedRowId={selectedModelKey}
      onRowClick={handleRowClick}
      // States
      loading={state === "loading"}
      error={state === "error" ? error || "Failed to load model register." : null}
      onRetry={onRetry}
      emptyTitle="No models match the current filters"
      emptyDescription="Try adjusting the filter or search to find matching models."
      // Pagination
      enablePagination={true}
      pageSize={20}
      // Layout
      title={`Model inventory (${models.length} of ${totalCount})`}
      density="default"
      enableColumnVisibility={true}
      showSearch={true}
      searchPlaceholder="Search models..."
    />
  );
}
