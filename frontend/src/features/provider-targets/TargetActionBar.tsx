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
 * Action bar with grouped actions and filters for the provider targets page.
 * Separates page actions, diagnostics, and related-page navigation.
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
  return (
    <section className="ff-action-bar">
      <div className="ff-action-bar-header">
        <div className="ff-action-bar-copy">
          <h2>Target controls</h2>
          <p>Filter targets, refresh live truth, or run diagnostics.</p>
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
            to={withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-dry-run`, instanceId)}
          >
            Routing Dry Run
          </Link>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}
          >
            Provider Health
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
        </div>
      </div>

      <div className="ff-action-bar-body">
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
      </div>
    </section>
  );
}
