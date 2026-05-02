/**
 * Knowledge source inventory table — compact display of source summaries.
 *
 * @packageDocumentation
 */

import type { KnowledgeSourceSummary } from "../../api/domain";
import type { LoadState } from "../../pages/workInteractionPageSupport";
import { formatTimestamp, statusTone, syncTone } from "./utils";

/** Props for KnowledgeSourceTable. */
export interface KnowledgeSourceTableProps {
  /** List of source summaries. */
  sources: KnowledgeSourceSummary[];
  /** Currently selected source ID. */
  selectedSourceId: string;
  /** Load state for the sources list. */
  listState: LoadState;
  /** Function to update URL search params. */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
}

/**
 * Compact knowledge source inventory table.
 */
export function KnowledgeSourceTable({
  sources,
  selectedSourceId,
  listState,
  updateRoute,
}: KnowledgeSourceTableProps) {
  if (listState === "loading") {
    return (
      <div className="ff-sources-table-container">
        <p className="ff-sources-table-status">Loading knowledge sources\u2026</p>
      </div>
    );
  }

  if (listState === "error") {
    return (
      <div className="ff-sources-table-container">
        <p className="ff-sources-table-status ff-sources-table-status-error">
          Failed to load knowledge sources.
        </p>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="ff-sources-table-container">
        <p className="ff-sources-table-empty">
          No knowledge sources matched the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="ff-sources-table-container">
      <table className="ff-sources-table" aria-label="Knowledge source inventory">
        <thead>
          <tr>
            <th>Name</th>
            <th>Source type</th>
            <th>Scope</th>
            <th>Sync status</th>
            <th>Last sync</th>
            <th>Visibility</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr
              key={source.source_id}
              className={source.source_id === selectedSourceId ? "ff-sources-table-row-selected" : undefined}
              onClick={() => updateRoute((next) => next.set("sourceId", source.source_id))}
            >
              <td>
                <button
                  className="ff-sources-table-trigger"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    updateRoute((next) => next.set("sourceId", source.source_id));
                  }}
                >
                  {source.label}
                </button>
                <div className="ff-sources-table-meta">{source.source_id}</div>
              </td>
              <td>
                <span className="ff-sources-pill">{source.source_kind}</span>
              </td>
              <td>{source.scope_label}</td>
              <td>
                <span className="ff-sources-pill" data-tone={syncTone(source.sync.state)}>
                  {source.sync.state}
                </span>
              </td>
              <td className="ff-sources-table-micro">
                {formatTimestamp(source.last_synced_at, "Never synced")}
              </td>
              <td className="ff-sources-table-micro">{source.visibility_scope}</td>
              <td>
                <span className="ff-sources-pill" data-tone={statusTone(source.status)}>
                  {source.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
