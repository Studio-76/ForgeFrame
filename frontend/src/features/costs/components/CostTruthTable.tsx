/**
 * CostTruthTable — renders the cost truth ledger as a card grid
 * plus provider/client cost hotspots.
 *
 * @packageDocumentation
 */

import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { CostTruthRecord } from "../types";
import { formatCurrency, toNumber, formatMetric, truthTone } from "../helpers";

/**
 * A cost hotspot entry for providers or clients.
 */
export type CostHotspotItem = {
  /** Provider or client identifier. */
  id: string;
  /** Actual cost. */
  actualCost: number;
  /** Hypothetical/estimated cost. */
  estimatedCost: number;
  /** Avoided cost. */
  avoidedCost: number;
  /** Request count (client hotspots only). */
  requests?: number;
};

export type CostTruthTableProps = {
  /** Whether usage analytics are readable. */
  canReadUsage: boolean;
  /** Whether usage data is available. */
  hasUsage: boolean;
  /** Ordered cost truth records. */
  truths: CostTruthRecord[];
  /** Provider cost hotspots (top 5). */
  providerCosts: CostHotspotItem[];
  /** Client cost hotspots (top 5). */
  clientCosts: CostHotspotItem[];
  /** Called to retry loading. */
  onRetry?: () => void;
};

/**
 * Renders the cost truth ledger section with card-based truth records
 * and provider/client hotspot summaries.
 */
export function CostTruthTable({
  canReadUsage,
  hasUsage,
  truths,
  providerCosts,
  clientCosts,
  onRetry,
}: CostTruthTableProps) {
  if (!canReadUsage) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Usage cost truth hidden</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          This session cannot read persisted usage analytics, so actual, estimated, modeled, and
          avoided cost remain unavailable here.
        </p>
      </div>
    );
  }

  if (!hasUsage) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Usage cost truth unavailable</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          Usage analytics did not load for the active scope.
        </p>
        {onRetry ? (
          <button type="button" className="ff-btn-secondary ff-btn-sm mt-3" onClick={onRetry}>
            Retry usage load
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {/* Cost truth cards */}
      <div className="fg-card-grid">
        {truths.map((truth) => (
          <article key={truth.key} className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>{truth.label}</h4>
                <p className="fg-muted">{truth.description}</p>
              </div>
              <StatusBadge
                tone={truthTone(truth)}
                status={truth.status === "tracked" ? "ready" : truth.status === "unsupported" ? "unsupported" : "degraded"}
              >
                {truth.status}
              </StatusBadge>
            </div>
            <ul className="fg-list">
              <li>Billing truth: {truth.billing_truth ? "Yes" : "No"}</li>
              <li>Runtime cost: {formatCurrency(truth.runtime_cost)}</li>
              <li>Health-check cost: {formatCurrency(truth.health_check_cost)}</li>
              <li>Total cost: {formatCurrency(truth.total_cost)}</li>
            </ul>
          </article>
        ))}
      </div>

      {/* Provider / client hotspots */}
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Provider cost hotspots</h4>
          <ul className="fg-list">
            {providerCosts.length === 0 ? (
              <li>No provider cost evidence was recorded in the last 24 hours.</li>
            ) : null}
            {providerCosts.slice(0, 5).map((item, index) => (
              <li key={`${item.id}-${index}`}>
                {item.id} · actual={formatCurrency(item.actualCost)} · estimated=
                {formatCurrency(item.estimatedCost)} · avoided={formatCurrency(item.avoidedCost)}
              </li>
            ))}
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>Client cost hotspots</h4>
          <ul className="fg-list">
            {clientCosts.length === 0 ? (
              <li>No client cost evidence was recorded in the last 24 hours.</li>
            ) : null}
            {clientCosts.slice(0, 5).map((item, index) => (
              <li key={`${item.id}-${index}`}>
                {item.id} · requests={formatMetric(item.requests ?? 0)} · actual=
                {formatCurrency(item.actualCost)} · estimated={formatCurrency(item.estimatedCost)}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </>
  );
}
