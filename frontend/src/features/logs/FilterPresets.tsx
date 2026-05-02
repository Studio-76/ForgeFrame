/**
 * Filter-preset buttons for the audit history view.
 *
 * Each preset maps to specific URL search param overrides that
 * narrow the result set — "Needs attention", "Errors only",
 * "Warnings", "Admin mutations", "Runtime events", and time windows.
 *
 * @packageDocumentation
 */

import { presetLabel } from "./utils";
import type { FilterPreset } from "./types";

/** Props for FilterPresets. */
export interface FilterPresetsProps {
  /** Currently active preset. */
  active: FilterPreset | null;
  /** Called when user clicks a preset. */
  onSelect: (preset: FilterPreset | null) => void;
}

const PRESETS: FilterPreset[] = [
  "needsAttention",
  "errorsOnly",
  "warnings",
  "adminMutations",
  "runtimeEvents",
  "last24h",
  "last7d",
];

/**
 * Horizontal filter-preset bar.
 *
 * Each preset is a compact pill-style button. The active preset
 * is visually distinguished. Clicking the same preset again clears it.
 *
 * @param props - Component props.
 * @returns The filter presets bar.
 */
export function FilterPresets({ active, onSelect }: FilterPresetsProps) {
  return (
    <div className="ff-filter-presets" role="group" aria-label="Filter presets">
      <span className="ff-filter-presets-label">Presets:</span>
      <div className="ff-filter-presets-list">
        <button
          type="button"
          className="ff-filter-preset"
          data-active={active === null ? "true" : undefined}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="ff-filter-preset"
            data-active={active === preset ? "true" : undefined}
            onClick={() => onSelect(active === preset ? null : preset)}
          >
            {presetLabel(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}
