import { useMemo } from "react";

import {
  FILTER_OPTIONS,
  type ModelFilterKey,
} from "./types";
import { deriveUsabilityState } from "./utils";
import type { AdminModelRegisterRecord } from "../../api/admin";

/**
 * Props for the {@link ModelFilters} component.
 */
export interface ModelFiltersProps {
  /** All models for computing per-filter counts. */
  readonly models: AdminModelRegisterRecord[];
  /** Current active filter key. */
  readonly filterKey: ModelFilterKey;
  /** Current search text. */
  readonly searchValue: string;
  /** Current provider filter value. */
  readonly providerFilter: string;
  /** Available provider options (includes "all"). */
  readonly providerOptions: string[];
  /** Called when the filter key changes. */
  readonly onFilterKeyChange: (key: ModelFilterKey) => void;
  /** Called when the search text changes. */
  readonly onSearchChange: (value: string) => void;
  /** Called when the provider filter changes. */
  readonly onProviderFilterChange: (value: string) => void;
}

/**
 * Filter controls for the model list.
 *
 * Provides quick-filter pills, a search input, and a provider dropdown.
 * Each filter pill shows the count of matching models.
 */
export function ModelFilters({
  models,
  filterKey,
  searchValue,
  providerFilter,
  providerOptions,
  onFilterKeyChange,
  onSearchChange,
  onProviderFilterChange,
}: ModelFiltersProps) {
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: models.length };

    let needsAttention = 0;
    let verificationFailed = 0;

    for (const model of models) {
      const state = deriveUsabilityState(model);
      result[state] = (result[state] ?? 0) + 1;

      if (
        state === "needs_verification" ||
        state === "no_routable_target" ||
        state === "declaration_only" ||
        state === "degraded"
      ) {
        needsAttention++;
      }
      if (model.trust_status === "verification_failed") {
        verificationFailed++;
      }
    }

    result.needs_attention = needsAttention;
    result.verification_failed = verificationFailed;
    return result;
  }, [models]);

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <h3>Filter models</h3>
        <div className="fg-actions">
          <button
            type="button"
            onClick={() => onFilterKeyChange("all")}
            style={{
              fontSize: "var(--fg-type-size-meta)",
              padding: "0.3rem 0.7rem",
              opacity: filterKey !== "all" ? 0.6 : 1,
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--fg-space-2)",
          marginBottom: "var(--fg-space-3)",
        }}
        role="group"
        aria-label="Quick filter tabs"
      >
        {FILTER_OPTIONS.map((option) => {
          const count = counts[option.key] ?? 0;
          const isActive = filterKey === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterKeyChange(option.key)}
              title={option.description}
              aria-pressed={isActive}
              style={{
                fontSize: "var(--fg-type-size-meta)",
                padding: "0.35rem 0.85rem",
                fontWeight: isActive ? 600 : 400,
                border: isActive
                  ? "1px solid var(--fg-color-border-focus)"
                  : "1px solid var(--fg-color-border-default)",
                background: isActive
                  ? "var(--fg-color-surface-active)"
                  : "var(--fg-color-surface-field)",
                color: isActive
                  ? "var(--fg-color-text-primary)"
                  : "var(--fg-color-text-secondary)",
                borderRadius: "var(--fg-radius-md)",
                cursor: "pointer",
              }}
            >
              {option.label}
              <span
                style={{
                  marginLeft: "0.4rem",
                  opacity: 0.6,
                  fontSize: "0.85em",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="fg-inline-form"
        aria-label="Model search and provider filter"
      >
        <label>
          Search models
          <input
            aria-label="Search models"
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, provider, or routing key..."
          />
        </label>
        <label>
          Filter by provider
          <select
            aria-label="Filter by provider"
            value={providerFilter}
            onChange={(event) => onProviderFilterChange(event.target.value)}
          >
            {providerOptions.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All providers" : item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
