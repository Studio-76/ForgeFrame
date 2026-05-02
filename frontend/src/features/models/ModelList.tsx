import { useMemo } from "react";

import type { AdminModelRegisterRecord } from "../../api/domain";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState, LoadingState } from "../../components/ui/StateBlocks";
import {
  deriveNextAction,
  deriveUsabilityState,
  formatCoverage,
  formatTimestamp,
  isPlaceholderModel,
  isStaleModel,
  modelKey,
  titleCase,
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
 * A scannable model inventory table.
 *
 * Each row shows: model name, primary usability state, routing coverage,
 * verification trust state, last-verified timestamp, and next action.
 * Placeholder and stale models are visually de-emphasized. The primary
 * status makes it clear whether a model is ready, needs attention, or is
 * inactive.
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
  const columns = useMemo(
    () => [
      { key: "model", label: "Model", width: "22%" },
      { key: "status", label: "Status", width: "14%" },
      { key: "routing", label: "Routing", width: "14%" },
      { key: "verification", label: "Trust", width: "16%" },
      { key: "lastVerified", label: "Last verified", width: "14%" },
      { key: "action", label: "Next action", width: "20%" },
    ],
    [],
  );

  if (state === "loading") {
    return (
      <LoadingState
        title="Loading model register"
        description="Fetching the latest routing, target, and verification data."
      />
    );
  }

  if (state === "error") {
    return (
      <div className="ff-state-block" data-state="error">
        <strong>Failed to load model register</strong>
        <p>{error || "Model register could not be loaded."}</p>
        <div className="ff-state-actions">
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state === "success" && models.length === 0) {
    return (
      <EmptyState
        title="No models match the current filters"
        description="Try adjusting the filter or search to find matching models."
      />
    );
  }

  return (
    <section className="ff-table-card">
      <div className="ff-table-card-header">
        <div>
          <h3>Model inventory</h3>
        </div>
        <div>
          <span className="fg-pill" data-tone="neutral">
            {models.length} of {totalCount}
          </span>
        </div>
      </div>

      {state === "success" && models.length > 0 ? (
        <div className="ff-table-scroll">
          <table className="ff-data-table" aria-label="Model register">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((model) => {
                const key = modelKey(model);
                const usability = deriveUsabilityState(model);
                const isSelected = key === selectedModelKey;
                const isPlaceholder = isPlaceholderModel(model);
                const isStale = isStaleModel(model);

                return (
                  <tr
                    key={key}
                    onClick={() => onSelectModel(key)}
                    className={
                      [
                        isSelected ? "is-selected" : "",
                        isPlaceholder || isStale ? "ff-table-row-muted" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    style={{ cursor: "pointer" }}
                    title={
                      isPlaceholder
                        ? "Placeholder model \u2014 replace with a real provider model"
                        : isStale
                          ? "Stale model \u2014 last sync was some time ago"
                          : `Select ${model.display_name}`
                    }
                  >
                    {/* Model name + provider */}
                    <td>
                      <div>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectModel(key);
                          }}
                        >
                          {model.display_name}
                        </button>
                        <p className="fg-muted" style={{ fontSize: "0.85em" }}>
                          {model.provider_label}
                        </p>
                      </div>
                    </td>

                    {/* Primary usability state */}
                    <td>
                      <StatusBadge tone={toneForUsability(usability)} status={usability}>
                        {titleCase(usability)}
                      </StatusBadge>
                      {isPlaceholder ? (
                        <span
                          className="fg-muted"
                          style={{
                            display: "block",
                            fontSize: "0.75em",
                            marginTop: "0.15rem",
                          }}
                        >
                          Not production-ready
                        </span>
                      ) : null}
                    </td>

                    {/* Routing coverage */}
                    <td>
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
                    </td>

                    {/* Verification trust state */}
                    <td>
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
                            : titleCase(model.trust_status)}
                      </StatusBadge>
                    </td>

                    {/* Last verified */}
                    <td>
                      <span className="fg-muted" style={{ fontSize: "0.85em" }}>
                        {formatTimestamp(model.last_probe_at ?? model.last_seen_at)}
                      </span>
                    </td>

                    {/* Next action */}
                    <td>
                      {(() => {
                        const action = deriveNextAction(model);
                        if (action !== "none") {
                          return (
                            <span
                              style={{
                                fontSize: "0.85em",
                                fontWeight: 500,
                                color: "var(--fg-color-status-warning)",
                              }}
                            >
                              {NEXT_ACTION_LABELS[action]}
                            </span>
                          );
                        }
                        if (usability === "ready") {
                          return (
                            <span
                              style={{
                                fontSize: "0.85em",
                                color: "var(--fg-color-status-success)",
                                fontWeight: 500,
                              }}
                            >
                              In service
                            </span>
                          );
                        }
                        if (isPlaceholder) {
                          return (
                            <span
                              className="fg-muted"
                              style={{ fontSize: "0.85em" }}
                            >
                              Replace placeholder
                            </span>
                          );
                        }
                        return (
                          <span className="fg-muted" style={{ fontSize: "0.85em" }}>
                            {"\u2014"}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {models.length > 0 ? (
        <div className="ff-table-card-footer">
          <p className="fg-muted">
            Click a row to inspect details and remediation options.
          </p>
        </div>
      ) : null}
    </section>
  );
}
