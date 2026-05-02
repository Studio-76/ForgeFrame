/**
 * Compact filter bar for the skills registry table.
 *
 * Provides scope, status, active-only, and needs-review filters
 * in a single compact row.
 *
 * @packageDocumentation
 */

import { SCOPE_OPTIONS, STATUS_OPTIONS, STATUS_LABELS, SCOPE_LABELS } from "./types";

/** Props for SkillFilters. */
export interface SkillFiltersProps {
  /** Current status filter value. */
  statusFilter: string;
  /** Current scope filter value. */
  scopeFilter: string;
  /** Active-only toggle state. */
  activeOnly: boolean;
  /** Needs-review toggle state. */
  needsReview: boolean;
  /** Update URL search params. */
  updateRoute: (mutate: (next: URLSearchParams) => void) => void;
}

/**
 * Compact filter bar with dropdowns and toggle switches.
 */
export function SkillFilters({
  statusFilter,
  scopeFilter,
  activeOnly,
  needsReview,
  updateRoute,
}: SkillFiltersProps) {
  return (
    <div className="ff-skills-filters">
      <label className="ff-skills-filter-label">
        Scope
        <select
          className="ff-skills-filter-select"
          value={scopeFilter}
          onChange={(event) =>
            updateRoute((next) => {
              const value = event.target.value;
              if (value === "all") next.delete("scope");
              else next.set("scope", value);
            })
          }
        >
          {SCOPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SCOPE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="ff-skills-filter-label">
        Status
        <select
          className="ff-skills-filter-select"
          value={statusFilter}
          onChange={(event) =>
            updateRoute((next) => {
              const value = event.target.value;
              if (value === "all") next.delete("status");
              else next.set("status", value);
            })
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="ff-skills-filter-toggle">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(event) =>
            updateRoute((next) => {
              if (event.target.checked) next.set("activeOnly", "1");
              else next.delete("activeOnly");
            })
          }
        />
        <span>Active only</span>
      </label>
      <label className="ff-skills-filter-toggle">
        <input
          type="checkbox"
          checked={needsReview}
          onChange={(event) =>
            updateRoute((next) => {
              if (event.target.checked) next.set("needsReview", "1");
              else next.delete("needsReview");
            })
          }
        />
        <span>Needs review</span>
      </label>
    </div>
  );
}
