import { useState, type FormEvent } from "react";

import { LANE_OPTIONS, type ExecutionFilterOption } from "../execution/helpers";

/** Queue state filter option. */
type QueueStateOption = {
  value: string;
  label: string;
};

const QUEUE_STATE_OPTIONS: readonly QueueStateOption[] = [
  { value: "all", label: "All states" },
  { value: "admitted", label: "Runnable" },
  { value: "waiting_external", label: "Running" },
  { value: "leased", label: "Leased" },
  { value: "paused", label: "Paused" },
  { value: "quarantined", label: "Quarantined" },
  { value: "waiting_on_approval", label: "Waiting on approval" },
  { value: "retry_scheduled", label: "Retry scheduled" },
  { value: "cancel_requested", label: "Cancel requested" },
  { value: "dead_lettered", label: "Dead-lettered" },
] as const;

const QUEUE_AGE_OPTIONS: readonly ExecutionFilterOption[] = [
  { value: "all", label: "Any age" },
  { value: "1h", label: "Older than 1 hour" },
  { value: "6h", label: "Older than 6 hours" },
  { value: "24h", label: "Older than 24 hours" },
  { value: "72h", label: "Older than 72 hours" },
  { value: "7d", label: "Older than 7 days" },
] as const;

/**
 * Queue filters props.
 */
type QueueFiltersProps = {
  /** Current lane filter value. */
  laneDraft: string;
  /** Current state filter value. */
  stateDraft: string;
  /** Current target filter value. */
  targetDraft: string;
  /** Current age filter value. */
  ageDraft: string;
  /** Current exact instance ID draft. */
  instanceDraft: string;
  /** Lane filter change handler. */
  onLaneChange: (value: string) => void;
  /** State filter change handler. */
  onStateChange: (value: string) => void;
  /** Target filter change handler. */
  onTargetChange: (value: string) => void;
  /** Age filter change handler. */
  onAgeChange: (value: string) => void;
  /** Instance draft change handler. */
  onInstanceDraftChange: (value: string) => void;
  /** Form submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Clear filters handler. */
  onClear: () => void;
};

/**
 * Queue filter bar with basic filters visible and advanced filters
 * behind a toggle. Replaces the previous large filter card.
 */
export function QueueFilters({
  laneDraft,
  stateDraft,
  targetDraft,
  ageDraft,
  instanceDraft,
  onLaneChange,
  onStateChange,
  onTargetChange,
  onAgeChange,
  onInstanceDraftChange,
  onSubmit,
  onClear,
}: QueueFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <form className="ff-queue-filters" onSubmit={onSubmit}>
      <div className="ff-queue-filters-basic">
        <label className="ff-queue-filter-label">
          Lane
          <select
            aria-label="Queue lane filter"
            className="ff-queue-filter-select"
            value={laneDraft}
            onChange={(e) => onLaneChange(e.target.value)}
          >
            {LANE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.value === "" ? "All lanes" : option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ff-queue-filter-label">
          State
          <select
            aria-label="Queue state filter"
            className="ff-queue-filter-select"
            value={stateDraft}
            onChange={(e) => onStateChange(e.target.value)}
          >
            {QUEUE_STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ff-queue-filter-label">
          Age
          <select
            aria-label="Queue age filter"
            className="ff-queue-filter-select"
            value={ageDraft}
            onChange={(e) => onAgeChange(e.target.value)}
          >
            {QUEUE_AGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ff-queue-filter-actions">
          <button type="submit" className="ff-queue-filter-btn">
            Refresh queues
          </button>
          <button type="button" className="ff-queue-filter-btn-secondary" onClick={onClear}>
            Clear filters
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`ff-queue-advanced-toggle${showAdvanced ? " is-open" : ""}`}
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
      </button>

      <div
        className="ff-queue-filters-advanced"
        data-visible={showAdvanced ? "true" : undefined}
      >
        <label className="ff-queue-filter-label">
          Exact instance ID
          <input
            aria-label="Queue instance ID"
            className="ff-queue-filter-input"
            value={instanceDraft}
            onChange={(e) => onInstanceDraftChange(e.target.value)}
          />
        </label>
        <label className="ff-queue-filter-label">
          Target or issue
          <input
            aria-label="Queue target filter"
            className="ff-queue-filter-input"
            placeholder="openai_api::gpt-4.1-mini"
            value={targetDraft}
            onChange={(e) => onTargetChange(e.target.value)}
          />
        </label>
      </div>
    </form>
  );
}
