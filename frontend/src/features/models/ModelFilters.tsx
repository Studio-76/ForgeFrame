import { useMemo } from "react";

import {
  FILTER_OPTIONS,
  type ModelFilterKey,
} from "./types";
import { deriveUsabilityState } from "./utils";
import type { AdminModelRegisterRecord } from "../../api/domain";

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
 * Compact filter controls for the model list.
 *
 * Quick-filter pills, a search input, and a provider dropdown — all in a
 * minimal single-card layout. Each pill shows the count of matching models.
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
    <div
      className="fg-card"
      style={{
        padding: "var(--fg-space-3) var(--fg-space-4)",
      }}
    >
      {/* Filter chips row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--fg-space-1)",
          marginBottom: "var(--fg-space-2)",
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
                padding: "0.25rem 0.65rem",
                fontWeight: isActive ? 600 : 400,
                border: isActive
                  ? "1px solid var(--fg-color-border-focus, var(--fg-color-action-primary))"
                  : "1px solid var(--fg-color-border-default)",
                background: isActive
                  ? "var(--fg-color-surface-active, var(--fg-color-action-primary-soft))"
                  : "transparent",
                color: isActive
                  ? "var(--fg-color-text-primary)"
                  : "var(--fg-color-text-secondary)",
                borderRadius: "var(--fg-radius-md)",
                cursor: "pointer",
                transition: "border-color var(--fg-motion-fast) var(--fg-ease-standard), background var(--fg-motion-fast) var(--fg-ease-standard)",
              }}
            >
              {option.label}
              <span
                style={{
                  marginLeft: "0.3rem",
                  opacity: 0.55,
                  fontSize: "0.85em",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline search + provider filter */}
      <div
        className="fg-inline-form"
        aria-label="Model search and provider filter"
        style={{
          display: "flex",
          gap: "var(--fg-space-2)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={{ flex: "1 1 180px", minWidth: 0 }}>
          <input
            aria-label="Search models"
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, provider, or routing key..."
            style={{ fontSize: "var(--fg-type-size-meta)" }}
          />
        </label>
        <label style={{ flex: "0 0 auto", minWidth: 140 }}>
          <select
            aria-label="Filter by provider"
            value={providerFilter}
            onChange={(event) => onProviderFilterChange(event.target.value)}
            style={{ fontSize: "var(--fg-type-size-meta)" }}
          >
            {providerOptions.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All providers" : item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
