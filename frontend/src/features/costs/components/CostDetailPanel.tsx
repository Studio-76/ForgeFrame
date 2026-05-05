/**
 * CostDetailPanel — renders the side-panel cost safety context
 * (blockers, billing truth, write path) as inline sections.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { GateStatus } from "../types";
import { formatMetric, formatCurrency } from "../helpers";

export type CostDetailPanelProps = {
  /** Traffic-gate status. */
  budgetState: GateStatus;
  /** Whether hard block is active. */
  hardBlocked: boolean;
  /** Routing visibility label (null when routing is visible). */
  routingVisibilityLabel: string | null;
  /** Routing visibility explanation. */
  routingVisibilityDetail: string;
  /** Blocked cost class names. */
  blockedCostClassNames: string;
  /** Number of soft-warning scopes. */
  warningScopeCount: number;
  /** Number of open target circuits. */
  openCircuitCount: number;
  /** Number of budget anomalies. */
  anomalyCount: number;
  /** Whether the session can mutate routing. */
  canMutateRouting: boolean;
  /** Whether the session can read routing. */
  canReadRouting: boolean;
  /** History-remaining budget label. */
  remainingBudgetLabel: string | null;
  /** Remaining budget value. */
  remainingBudgetValue: number | null;
  /** Routing editor route. */
  routingEditorRoute: string;
  /** Provider targets route. */
  routingTargetsRoute: string;
};

/**
 * Renders the cost safety context panel as a set of inline cards.
 *
 * Previously rendered as a sticky sidebar DetailPanel; now rendered
 * as an inline section within the page content flow.
 */
export function CostDetailPanel({
  budgetState,
  hardBlocked,
  routingVisibilityLabel,
  routingVisibilityDetail,
  blockedCostClassNames,
  warningScopeCount,
  openCircuitCount,
  anomalyCount,
  canMutateRouting,
  canReadRouting,
  remainingBudgetLabel,
  remainingBudgetValue,
  routingEditorRoute,
  routingTargetsRoute,
}: CostDetailPanelProps) {
  return (
    <div className="fg-card-grid">
      <article className="fg-subcard">
        <h4>Blocking vs warning</h4>
        <p>{budgetState.detail}</p>
        <p className="fg-muted">
          Hard block stops all routing. Warning posture keeps traffic open but may suppress premium
          or high-cost classes and may leave some target circuits open.
        </p>
      </article>

      <article className="fg-subcard">
        <h4>Visible blockers</h4>
        <ul className="fg-list">
          <li>
            Hard block active: {routingVisibilityLabel ?? String(hardBlocked)}
          </li>
          <li>
            Blocked cost classes:{" "}
            {routingVisibilityLabel ?? (blockedCostClassNames || "none")}
          </li>
          <li>
            Soft warning scopes: {routingVisibilityLabel ?? formatMetric(warningScopeCount)}
          </li>
          <li>
            Open target circuits: {routingVisibilityLabel ?? formatMetric(openCircuitCount)}
          </li>
          <li>
            Budget anomalies: {routingVisibilityLabel ?? formatMetric(anomalyCount)}
          </li>
        </ul>
        {routingVisibilityLabel ? <p className="fg-muted">{routingVisibilityDetail}</p> : null}
        {remainingBudgetLabel && remainingBudgetValue !== null ? (
          <p className="fg-muted">
            Hard budget remaining: {formatCurrency(remainingBudgetValue)} ({remainingBudgetLabel})
          </p>
        ) : null}
      </article>

      <article className="fg-subcard">
        <h4>Billing truth guardrail</h4>
        <p>Provider-reported billing is currently unsupported.</p>
        <p className="fg-muted">
          Estimated and modeled values stay operational only. Use actual cost for metered billing
          truth and treat the other axes as forecast, exposure, or avoided-spend evidence.
        </p>
      </article>

      <article className="fg-subcard">
        <h4>Write path</h4>
        <p>
          {canMutateRouting
            ? "Budget and circuit controls are writable on this page."
            : canReadRouting
              ? "This session is read-only for routing.write."
              : "Routing write-path is hidden with the routing control plane."}
        </p>
        <p className="fg-muted">
          {canMutateRouting
            ? "Use the editor and target controls here for direct persistence, then switch to Routing only when you need simulation or policy-stage edits."
            : canReadRouting
              ? "Open the same scope with a routing.write session if budget or circuit posture must be changed."
              : "Open the same scope with routing.read plus routing.write if budget or circuit posture must be reviewed and changed."}
        </p>
        <div className="fg-actions">
          <Link className="fg-nav-link" to={routingEditorRoute}>
            Routing
          </Link>
          <Link className="fg-nav-link" to={routingTargetsRoute}>
            Targets
          </Link>
        </div>
      </article>
    </div>
  );
}
