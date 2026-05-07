/**
 * Compact filter bar for the skills registry table.
 *
 * Provides scope, status, active-only, and needs-review filters
 * in a single compact row using shared UI primitives.
 *
 * @packageDocumentation
 */

import { Select, Toggle, type SelectItem } from "../../components/ui";
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

const scopeItems: SelectItem[] = SCOPE_OPTIONS.map((key) => ({
  id: key,
  label: SCOPE_LABELS[key as keyof typeof SCOPE_LABELS],
}));

const statusItems: SelectItem[] = STATUS_OPTIONS.map((key) => ({
  id: key,
  label: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
}));

/**
 * Compact filter bar with shared Select and Toggle primitives.
 */
export function SkillFilters({
  statusFilter,
  scopeFilter,
  activeOnly,
  needsReview,
  updateRoute,
}: SkillFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-2">
      <Select
        label="Scope"
        items={scopeItems}
        selectedKey={scopeFilter}
        onSelectionChange={(key) =>
          updateRoute((next) => {
            if (!key || key === "all") next.delete("scope");
            else next.set("scope", key);
          })
        }
      />
      <Select
        label="Status"
        items={statusItems}
        selectedKey={statusFilter}
        onSelectionChange={(key) =>
          updateRoute((next) => {
            if (!key || key === "all") next.delete("status");
            else next.set("status", key);
          })
        }
      />
      <Toggle
        label="Active only"
        isSelected={activeOnly}
        onChange={(val) =>
          updateRoute((next) => {
            if (val) next.set("activeOnly", "1");
            else next.delete("activeOnly");
          })
        }
      />
      <Toggle
        label="Needs review"
        isSelected={needsReview}
        onChange={(val) =>
          updateRoute((next) => {
            if (val) next.set("needsReview", "1");
            else next.delete("needsReview");
          })
        }
      />
    </div>
  );
}
