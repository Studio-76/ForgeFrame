/**
 * CostMixView — renders the routing cost-mix section with
 * premium vs low-cost summary, pricing snapshot, and cost-mix table.
 *
 * @packageDocumentation
 */

import type { CostMixRow } from "../types";
import { formatCurrency, formatMetric, formatPercent } from "../helpers";

export type CostMixViewProps = {
  /** Whether routing data is readable. */
  canReadRouting: boolean;
  /** Whether routing data is loaded. */
  hasRouting: boolean;
  /** Cost mix rows. */
  costMixRows: CostMixRow[];
  /** Total selected decision count. */
  selectedDecisionCount: number;
  /** Premium escalation count. */
  premiumEscalationCount: number;
  /** Open circuit count during this review period. */
  openCircuitCount: number;
  /** Pricing snapshot key-value pairs. */
  pricingSnapshot: Record<string, number>;
};

/**
 * Renders the routing cost-mix section with premium/low-cost
 * usage summary, pricing snapshot, and the cost-mix data table.
 */
export function CostMixView({
  canReadRouting,
  hasRouting,
  costMixRows,
  selectedDecisionCount,
  premiumEscalationCount,
  openCircuitCount,
  pricingSnapshot,
}: CostMixViewProps) {
  if (!canReadRouting) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Routing mix hidden</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          Routing.read is required to explain premium-versus-low-cost selection from the recent
          decision ledger.
        </p>
      </div>
    );
  }

  if (!hasRouting) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Routing mix unavailable</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          Routing data is required to display the cost mix.
        </p>
      </div>
    );
  }

  if (costMixRows.length === 0) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Routing cost mix</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          No recent selected routing decisions are available yet.
        </p>
      </div>
    );
  }

  const premiumMix = costMixRows.find((row) => row.costClass === "premium");
  const lowCostSelections = costMixRows
    .filter((row) => row.costClass === "baseline" || row.costClass === "low")
    .reduce((total, row) => total + row.selectedCount, 0);

  return (
    <>
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Premium vs low-cost usage</h4>
          <ul className="fg-list">
            <li>Selected decisions reviewed: {formatMetric(selectedDecisionCount)}</li>
            <li>
              Premium share: {premiumMix ? formatPercent(premiumMix.share) : "0.0%"}
            </li>
            <li>
              Low-cost share:{" "}
              {selectedDecisionCount === 0
                ? "0.0%"
                : formatPercent(lowCostSelections / selectedDecisionCount)}
            </li>
            <li>Premium fallback/escalation selections: {formatMetric(premiumEscalationCount)}</li>
            <li>Open provider circuits during this review: {formatMetric(openCircuitCount)}</li>
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>Pricing snapshot</h4>
          <ul className="fg-list">
            {Object.entries(pricingSnapshot).length > 0
              ? Object.entries(pricingSnapshot).map(([key, value]) => (
                  <li key={key}>
                    {key}: {formatMetric(value, 2)}
                  </li>
                ))
              : null}
            {Object.entries(pricingSnapshot).length === 0 ? (
              <li>Pricing snapshot unavailable without usage analytics.</li>
            ) : null}
          </ul>
        </article>
      </div>

      <div className="fg-table-wrap">
        <table className="fg-table" aria-label="Routing cost mix">
          <thead>
            <tr>
              <th>Cost class</th>
              <th>Selected</th>
              <th>Share</th>
              <th>Providers</th>
              <th>Policy stages</th>
            </tr>
          </thead>
          <tbody>
            {costMixRows.map((row) => (
              <tr key={row.costClass}>
                <td>{row.costClass}</td>
                <td>{formatMetric(row.selectedCount)}</td>
                <td>{formatPercent(row.share)}</td>
                <td>{row.providers.join(", ")}</td>
                <td>{row.stages.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
