/**
 * Compact filter bar for the contact inventory — instance scope, status filter.
 *
 * @packageDocumentation
 */

import { STATUS_OPTIONS } from "./types";

/** Props for ContactFilters. */
export interface ContactFiltersProps {
  /** Current instance ID. */
  instanceId: string;
  /** Current status filter value. */
  statusFilter: string;
  /** Available instances for the scope selector. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Instances loading state. */
  instancesState: string;
  /** Route updater function. */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
}

/**
 * Compact filter bar — instance scope selector and status dropdown.
 */
export function ContactFilters({
  instanceId,
  statusFilter,
  instances,
  instancesState,
  updateRoute,
}: ContactFiltersProps) {
  return (
    <div className="ff-contacts-filters">
      <label className="ff-contacts-filter-label">
        Instance
        <select
          className="ff-contacts-filter-select"
          aria-label="Contact instance"
          value={instanceId}
          onChange={(event) => updateRoute((next) => {
            next.set("instanceId", event.target.value);
            next.delete("contactId");
          })}
        >
          {instances.map((instance) => (
            <option key={instance.instance_id} value={instance.instance_id}>
              {instance.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="ff-contacts-filter-label">
        Status
        <select
          className="ff-contacts-filter-select"
          aria-label="Contact status filter"
          value={statusFilter}
          onChange={(event) => updateRoute((next) => {
            const nextValue = event.target.value;
            if (nextValue === "all") {
              next.delete("status");
            } else {
              next.set("status", nextValue);
            }
            next.delete("contactId");
          })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <span className="ff-contacts-admin-status" data-state={instancesState}>
        {instancesState === "loading" ? "Loading instances\u2026" : `${instances.length} instance${instances.length === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
