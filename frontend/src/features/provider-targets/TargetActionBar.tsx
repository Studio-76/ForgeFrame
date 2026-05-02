import { useState } from "react";
import { Link } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { CapabilityFilter, ProviderTargetRecord, TargetStatusFilter } from "./types";
import { titleCase } from "./utils";

type TargetActionBarProps = {
  instanceId: string | null;
  canReadTargets: boolean;
  onRefresh: () => void;

  // Filters
  providerFilter: string;
  onProviderFilterChange: (value: string) => void;
  providerOptions: string[];
  statusFilter: TargetStatusFilter;
  onStatusFilterChange: (value: TargetStatusFilter) => void;
  costClassFilter: string;
  onCostClassFilterChange: (value: string) => void;
  costClassOptions: string[];
  qualityTierFilter: string;
  onQualityTierFilterChange: (value: string) => void;
  qualityTierOptions: string[];
  capabilityFilter: CapabilityFilter;
  onCapabilityFilterChange: (value: CapabilityFilter) => void;
  healthFilter: string;
  onHealthFilterChange: (value: string) => void;
  healthOptions: string[];
};

/**
 * Simplified action bar for the provider targets page.
 *
 * Separates page actions (refresh, diagnostics) from filters.
 * Filters are collapsed by default unless one is active.
 */
export function TargetActionBar({
  instanceId,
  canReadTargets,
  onRefresh,
  providerFilter,
  onProviderFilterChange,
  providerOptions,
  statusFilter,
  onStatusFilterChange,
  costClassFilter,
  onCostClassFilterChange,
  costClassOptions,
  qualityTierFilter,
  onQualityTierFilterChange,
  qualityTierOptions,
  capabilityFilter,
  onCapabilityFilterChange,
  healthFilter,
  onHealthFilterChange,
  healthOptions,
}: TargetActionBarProps) {
  const hasActiveFilters = providerFilter !== "all"
    || statusFilter !== "all"
    || costClassFilter !== "all"
    || qualityTierFilter !== "all"
    || capabilityFilter !== "all"
    || healthFilter !== "all";
  const [filtersExpanded, setFiltersExpanded] = useState(hasActiveFilters);

  return (
    <section className="ff-action-bar">
      <div className="ff-action-bar-header">
        <div className="ff-action-bar-copy">
          <h2>Target controls</h2>
          <p>Refresh live truth, run diagnostics, or filter targets.</p>
        </div>
        <div className="fg-actions">
          <button type="button" onClick={onRefresh} disabled={!canReadTargets}>
            Refresh
          </button>
        </div>
      </div>

      <div className="ff-operator-actions-row">
        <div className="ff-operator-actions-group">
          <strong className="ff-operator-actions-label">Diagnostics</strong>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}
          >
            Provider Health
          </Link>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-dry-run`, instanceId)}
          >
            Routing Dry Run
          </Link>
        </div>
        <div className="ff-operator-actions-group ff-operator-actions-group-secondary">
          <strong className="ff-operator-actions-label">Related pages</strong>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}
          >
            Setup progress
          </Link>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.models, instanceId)}
          >
            Models
          </Link>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}
          >
            Routing
          </Link>
        </div>
      </div>

      <div className="ff-action-bar-body">
        <button
          type="button"
          className="ff-filter-toggle"
          onClick={() => setFiltersExpanded((prev) => !prev)}
          aria-expanded={filtersExpanded}
        >
          {filtersExpanded ? "Hide filters" : "Filter targets"}
          {hasActiveFilters && !filtersExpanded ? (
            <span className="ff-filter-toggle-badge">{[
              providerFilter !== "all" && "provider",
              statusFilter !== "all" && "status",
              costClassFilter !== "all" && "cost",
              qualityTierFilter !== "all" && "quality",
              capabilityFilter !== "all" && "capability",
              healthFilter !== "all" && "health",
            ].filter(Boolean).join(", ")}</span>
          ) : null}
        </button>

        {filtersExpanded ? (
          <div className="fg-inline-form" aria-label="Provider target filters">
            <label>
              Provider
              <select
                aria-label="Provider filter"
                value={providerFilter}
                onChange={(e) => onProviderFilterChange(e.target.value)}
              >
                <option value="all">All providers</option>
                {providerOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as TargetStatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="runtime-ready">Runtime ready</option>
                <option value="ready">Ready</option>
                <option value="needs-health-check">Needs health check</option>
                <option value="partial">Partial</option>
                <option value="degraded">Degraded</option>
                <option value="blocked">Blocked</option>
                <option value="disabled">Disabled</option>
                <option value="bridge-only">Bridge only</option>
                <option value="unsupported">Unsupported</option>
              </select>
            </label>
            <label>
              Cost class
              <select
                aria-label="Cost class filter"
                value={costClassFilter}
                onChange={(e) => onCostClassFilterChange(e.target.value)}
              >
                <option value="all">All cost classes</option>
                {costClassOptions.map((opt) => (
                  <option key={opt} value={opt}>{titleCase(opt)}</option>
                ))}
              </select>
            </label>
            <label>
              Quality tier
              <select
                aria-label="Quality tier filter"
                value={qualityTierFilter}
                onChange={(e) => onQualityTierFilterChange(e.target.value)}
              >
                <option value="all">All quality tiers</option>
                {qualityTierOptions.map((opt) => (
                  <option key={opt} value={opt}>{titleCase(opt)}</option>
                ))}
              </select>
            </label>
            <label>
              Capability
              <select
                aria-label="Capability filter"
                value={capabilityFilter}
                onChange={(e) => onCapabilityFilterChange(e.target.value as CapabilityFilter)}
              >
                <option value="all">All capabilities</option>
                <option value="streaming">Streaming</option>
                <option value="tool_calling">Tool calling</option>
                <option value="vision">Vision</option>
                <option value="queue_eligible">Queue eligible</option>
              </select>
            </label>
            <label>
              Health
              <select
                aria-label="Health filter"
                value={healthFilter}
                onChange={(e) => onHealthFilterChange(e.target.value)}
              >
                <option value="all">All health states</option>
                {healthOptions.map((opt) => (
                  <option key={opt} value={opt}>{titleCase(opt)}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </section>
  );
}
