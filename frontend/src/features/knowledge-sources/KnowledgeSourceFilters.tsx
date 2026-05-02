/**
 * Compact filter bar for the knowledge source inventory.
 *
 * @packageDocumentation
 */

import type { KnowledgeSourceKind, KnowledgeSourceStatus } from "../../api/domain";
import {
  SOURCE_KIND_LABELS,
  SOURCE_KIND_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from "./types";

/** Props for KnowledgeSourceFilters. */
export interface KnowledgeSourceFiltersProps {
  /** Current source kind filter value. */
  sourceKindFilter: string;
  /** Current status filter value. */
  statusFilter: string;
  /** Function to update URL search params. */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
}

/**
 * Compact filter bar with source-type and status selectors.
 */
export function KnowledgeSourceFilters({
  sourceKindFilter,
  statusFilter,
  updateRoute,
}: KnowledgeSourceFiltersProps) {
  return (
    <div className="ff-sources-filters">
      <label className="ff-sources-filter-label">
        Source type
        <select
          className="ff-sources-filter-select"
          aria-label="Filter by source type"
          value={sourceKindFilter}
          onChange={(event) => updateRoute((next) => {
            const value = event.target.value;
            if (value === "all") {
              next.delete("sourceKind");
            } else {
              next.set("sourceKind", value);
            }
            next.delete("sourceId");
          })}
        >
          {SOURCE_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SOURCE_KIND_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="ff-sources-filter-label">
        Status
        <select
          className="ff-sources-filter-select"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => updateRoute((next) => {
            const value = event.target.value;
            if (value === "all") {
              next.delete("status");
            } else {
              next.set("status", value);
            }
            next.delete("sourceId");
          })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
