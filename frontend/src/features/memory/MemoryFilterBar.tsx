/**
 * Compact scope selector and memory category tabs.
 *
 * @packageDocumentation
 */

import type { LoadState, MemoryCategoryKey } from "./types";
import { MEMORY_CATEGORIES } from "./types";

/** Props for MemoryFilterBar. */
export interface MemoryFilterBarProps {
  /** Currently selected instance ID. */
  instanceId: string;
  /** Instances list. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Instance loading state. */
  instancesState: LoadState;
  /** Active memory category filter. */
  activeCategory: string;
  /** Callback when instance changes. */
  onInstanceChange: (instanceId: string) => void;
  /** Callback when category changes. */
  onCategoryChange: (category: string) => void;
  /** Number of entries per category. */
  categoryCounts: Record<string, number>;
  /** Whether multiple instances exist (show selector). */
  showInstanceSelector: boolean;
}

/**
 * Compact scope selector with memory category tabs.
 */
export function MemoryFilterBar({
  instanceId,
  instances,
  instancesState,
  activeCategory,
  onInstanceChange,
  onCategoryChange,
  categoryCounts,
  showInstanceSelector,
}: MemoryFilterBarProps) {
  return (
    <article className="fg-card ff-memory-filter-bar" aria-label="Memory scope and filters">
      {showInstanceSelector ? (
        <label className="ff-memory-instance-label">
          Instance
          <select
            aria-label="Memory instance"
            value={instanceId}
            onChange={(event) => onInstanceChange(event.target.value)}
          >
            {instances.map((instance) => (
              <option key={instance.instance_id} value={instance.instance_id}>
                {instance.display_name} ({instance.instance_id})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="ff-memory-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`ff-memory-tab${activeCategory === "all" ? " ff-memory-tab-active" : ""}`}
          onClick={() => onCategoryChange("all")}
          aria-selected={activeCategory === "all"}
        >
          All ({(categoryCounts.all ?? 0)})
        </button>
        {MEMORY_CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            role="tab"
            className={`ff-memory-tab${activeCategory === category.key ? " ff-memory-tab-active" : ""}`}
            onClick={() => onCategoryChange(category.key)}
            aria-selected={activeCategory === category.key}
          >
            {category.label} ({(categoryCounts[category.key] ?? 0)})
          </button>
        ))}
      </div>
    </article>
  );
}
