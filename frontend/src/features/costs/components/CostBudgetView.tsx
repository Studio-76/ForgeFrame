/**
 * CostBudgetView — renders the budget posture section including
 * budget editor, scoped rules, anomalies, blocked cost classes,
 * and circuit/guard map.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import {
  StatusBadge,
} from "../../../components/ui/StatusBadge";
import type {
  BlockedCostClassRow,
  BudgetDraft,
  BudgetScopeDraft,
  GateStatus,
  ProviderCircuitRow,
  TargetCircuitRow,
} from "../types";
import {
  formatCurrency,
  formatMetric,
  formatTimestamp,
  scopeStatus,
} from "../helpers";
import type { RoutingCircuitRecord } from "../../../api/domain/routing";
import { BUDGET_WINDOW_OPTIONS } from "../types";

export type CostBudgetViewProps = {
  /** Whether routing data is readable. */
  canReadRouting: boolean;
  /** Whether the session can mutate routing budget. */
  canMutateRouting: boolean;
  /** Whether routing data is loaded. */
  hasRouting: boolean;
  /** Computed traffic-gate status. */
  budgetState: GateStatus;
  /** Whether hard block is active. */
  hardBlocked: boolean;
  /** Budget reason text. */
  budgetReason: string | null;
  /** Last evaluated timestamp. */
  lastEvaluatedAt: string | null;
  /** Number of soft-warning scopes. */
  warningScopeCount: number;
  /** Number of hard-exceeded scopes. */
  hardExceededScopeCount: number;
  /** Number of budget anomalies. */
  anomalyCount: number;
  /** Budget anomalies as display data. */
  anomalies: Array<{
    severity: string;
    anomalyType: string;
    scopeType: string;
    scopeKey: string;
    observedCost: number | null;
    thresholdCost: number | null;
    detectedAt: string | null;
  }>;
  /** Blocked cost class rows. */
  blockedCostClasses: BlockedCostClassRow[];
  /** Provider circuit rows. */
  providerCircuits: ProviderCircuitRow[];
  /** Target circuit rows. */
  targetCircuits: TargetCircuitRow[];
  /** Open circuit count. */
  openCircuitCount: number;
  /** Budget draft state. */
  budgetDraft: BudgetDraft;
  /** Whether the budget is currently being saved. */
  budgetSaving: boolean;
  /** Saving state per circuit target key. */
  savingCircuitKey: string | null;
  /** Circuit reason drafts. */
  circuitDrafts: Record<string, string>;
  /** Routing policy editor route. */
  routingEditorRoute: string;
  /** Called to update a scope draft field. */
  onUpdateScopeDraft: (index: number, patch: Partial<BudgetScopeDraft>) => void;
  /** Called to add a new budget scope. */
  onAddBudgetScope: () => void;
  /** Called to remove a budget scope. */
  onRemoveBudgetScope: (index: number) => void;
  /** Called to toggle hard_blocked. */
  onSetHardBlocked: (value: boolean) => void;
  /** Called to set blocked_cost_classes. */
  onSetBlockedCostClasses: (value: string) => void;
  /** Called to set budget reason. */
  onSetBudgetReason: (value: string) => void;
  /** Called to save the budget. */
  onSaveBudget: () => void;
  /** Called to save a circuit state change. */
  onSaveCircuit: (targetKey: string, nextState: RoutingCircuitRecord["state"]) => void;
  /** Called to update a circuit reason draft. */
  onSetCircuitDraft: (targetKey: string, value: string) => void;
  /** Called to retry loading routing data. */
  onRetry?: () => void;
};

/**
 * Renders the full budget posture section with editor, scopes,
 * anomalies, blocked classes, and circuit map.
 */
export function CostBudgetView({
  canReadRouting,
  canMutateRouting,
  hasRouting,
  budgetState,
  hardBlocked,
  budgetReason,
  lastEvaluatedAt,
  warningScopeCount,
  hardExceededScopeCount,
  anomalyCount,
  anomalies,
  blockedCostClasses,
  providerCircuits,
  targetCircuits,
  openCircuitCount,
  budgetDraft,
  budgetSaving,
  savingCircuitKey,
  circuitDrafts,
  routingEditorRoute,
  onUpdateScopeDraft,
  onAddBudgetScope,
  onRemoveBudgetScope,
  onSetHardBlocked,
  onSetBlockedCostClasses,
  onSetBudgetReason,
  onSaveBudget,
  onSaveCircuit,
  onSetCircuitDraft,
  onRetry,
}: CostBudgetViewProps) {
  if (!canReadRouting) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Routing budget posture hidden</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          This session cannot read the routing control plane, so budget, blocked classes, and
          circuits stay unavailable here.
        </p>
      </div>
    );
  }

  if (!hasRouting) {
    return (
      <div className="ff-state-block" data-state="empty">
        <strong className="text-body text-primary font-semibold">Routing budget posture unavailable</strong>
        <p className="text-meta text-muted mt-1.5 max-w-md">
          Routing state did not load for the active scope.
        </p>
        {onRetry ? (
          <button type="button" className="ff-btn-secondary ff-btn-sm mt-3" onClick={onRetry}>
            Retry routing load
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {/* Budget posture core */}
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Current gate state</h4>
          <ul className="fg-list">
            <li>Hard blocked: {String(hardBlocked)}</li>
            <li>Budget reason: {budgetReason ?? "none recorded"}</li>
            <li>Last evaluated: {formatTimestamp(lastEvaluatedAt)}</li>
            <li>Soft warning scopes: {formatMetric(warningScopeCount)}</li>
            <li>Hard-exceeded scopes: {formatMetric(hardExceededScopeCount)}</li>
            <li>Budget anomalies: {formatMetric(anomalyCount)}</li>
            <li>
              Blocked cost classes:{" "}
              {blockedCostClasses.length > 0
                ? blockedCostClasses.map((row) => row.costClass).join(", ")
                : "none"}
            </li>
          </ul>
        </article>

        {/* Budget editor */}
        <article className="fg-subcard">
          <div className="fg-panel-heading">
            <div>
              <h4>Budget editor</h4>
              <p className="fg-muted">
                This editor persists hard block, blocked classes, and scoped budget rules through
                the routing API. Server-calculated observed spend and anomaly fields remain read-only.
              </p>
            </div>
            <StatusBadge tone={canMutateRouting ? "success" : "warning"} status={canMutateRouting ? "ready" : "waiting_approval"}>
              {canMutateRouting ? "editable" : "read-only"}
            </StatusBadge>
          </div>

          <div className="fg-inline-form">
            <label className="fg-checkbox">
              <input
                type="checkbox"
                checked={budgetDraft.hard_blocked}
                onChange={(event) => onSetHardBlocked(event.target.checked)}
                disabled={!canMutateRouting || budgetSaving}
              />
              Hard block all routing
            </label>

            <label>
              Blocked cost classes
              <input
                aria-label="Blocked cost classes"
                value={budgetDraft.blocked_cost_classes}
                onChange={(event) => onSetBlockedCostClasses(event.target.value)}
                disabled={!canMutateRouting || budgetSaving}
              />
            </label>

            <label>
              Budget reason
              <input
                aria-label="Budget reason"
                value={budgetDraft.reason}
                onChange={(event) => onSetBudgetReason(event.target.value)}
                disabled={!canMutateRouting || budgetSaving}
              />
            </label>
          </div>

          <div className="fg-actions">
            <button type="button" onClick={onAddBudgetScope} disabled={!canMutateRouting || budgetSaving}>
              Add scope rule
            </button>
          </div>

          {/* Scope rules */}
          <div className="fg-stack">
            {budgetDraft.scopes.map((scope, index) => {
              const status = scopeStatus(scope);
              return (
                <section
                  key={`${scope.scope_type}:${scope.scope_key}:${scope.window}:${index}`}
                  className="fg-subcard"
                >
                  <div className="fg-panel-heading">
                    <div>
                      <h5>
                        {scope.scope_type}:{scope.scope_key || "new scope"}
                      </h5>
                      <p className="fg-muted">
                        Window {scope.window}. Observed values and limit-exceeded flags are
                        calculated by the backend and stay read-only.
                      </p>
                    </div>
                    <StatusBadge tone={status.tone} status={status.statusKey}>
                      {status.label}
                    </StatusBadge>
                  </div>

                  <div className="fg-inline-form">
                    <label>
                      Scope type
                      <select
                        value={scope.scope_type}
                        onChange={(event) =>
                          onUpdateScopeDraft(index, {
                            scope_type: event.target.value as BudgetScopeDraft["scope_type"],
                          })
                        }
                        disabled={!canMutateRouting || budgetSaving}
                      >
                        <option value="instance">instance</option>
                        <option value="agent">agent</option>
                        <option value="task">task</option>
                      </select>
                    </label>

                    <label>
                      Scope key
                      <input
                        value={scope.scope_key}
                        onChange={(event) => onUpdateScopeDraft(index, { scope_key: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Window
                      <select
                        value={scope.window}
                        onChange={(event) =>
                          onUpdateScopeDraft(index, {
                            window: event.target.value as BudgetScopeDraft["window"],
                          })
                        }
                        disabled={!canMutateRouting || budgetSaving}
                      >
                        {BUDGET_WINDOW_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={scope.enabled}
                        onChange={(event) => onUpdateScopeDraft(index, { enabled: event.target.checked })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                      Enabled
                    </label>

                    <label>
                      Soft cost limit
                      <input
                        inputMode="decimal"
                        value={scope.soft_cost_limit}
                        onChange={(event) => onUpdateScopeDraft(index, { soft_cost_limit: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Hard cost limit
                      <input
                        inputMode="decimal"
                        value={scope.hard_cost_limit}
                        onChange={(event) => onUpdateScopeDraft(index, { hard_cost_limit: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Soft token limit
                      <input
                        inputMode="numeric"
                        value={scope.soft_token_limit}
                        onChange={(event) => onUpdateScopeDraft(index, { soft_token_limit: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Hard token limit
                      <input
                        inputMode="numeric"
                        value={scope.hard_token_limit}
                        onChange={(event) => onUpdateScopeDraft(index, { hard_token_limit: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Soft-blocked cost classes
                      <input
                        value={scope.soft_blocked_cost_classes}
                        onChange={(event) =>
                          onUpdateScopeDraft(index, { soft_blocked_cost_classes: event.target.value })
                        }
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>

                    <label>
                      Note
                      <input
                        value={scope.note}
                        onChange={(event) => onUpdateScopeDraft(index, { note: event.target.value })}
                        disabled={!canMutateRouting || budgetSaving}
                      />
                    </label>
                  </div>

                  <div className="fg-detail-grid">
                    <p>
                      Observed cost:{" "}
                      {scope.observed_cost === null
                        ? "No evidence"
                        : formatCurrency(scope.observed_cost)}
                    </p>
                    <p>
                      Observed tokens:{" "}
                      {scope.observed_tokens === null
                        ? "No evidence"
                        : formatMetric(scope.observed_tokens)}
                    </p>
                    <p>
                      Previous-window cost:{" "}
                      {scope.previous_window_cost === null
                        ? "No evidence"
                        : formatCurrency(scope.previous_window_cost)}
                    </p>
                    <p>
                      Previous-window tokens:{" "}
                      {scope.previous_window_tokens === null
                        ? "No evidence"
                        : formatMetric(scope.previous_window_tokens)}
                    </p>
                    <p>Soft limit exceeded: {String(scope.soft_limit_exceeded)}</p>
                    <p>Hard limit exceeded: {String(scope.hard_limit_exceeded)}</p>
                    <p>Last evaluated: {formatTimestamp(scope.last_evaluated_at)}</p>
                  </div>

                  <div className="fg-actions fg-actions-end">
                    <button
                      type="button"
                      onClick={() => onRemoveBudgetScope(index)}
                      disabled={!canMutateRouting || budgetSaving}
                    >
                      Remove scope
                    </button>
                  </div>
                </section>
              );
            })}

            {budgetDraft.scopes.length === 0 ? (
              <p className="fg-muted">
                No scoped budget rules are configured yet. Add one if you need hard or soft cost
                limits per instance, agent, or task.
              </p>
            ) : null}
          </div>

          <div className="fg-actions fg-actions-end">
            <button
              type="button"
              onClick={onSaveBudget}
              disabled={!canMutateRouting || budgetSaving}
            >
              {budgetSaving ? "Saving budget posture" : "Save budget posture"}
            </button>
          </div>
        </article>

        {/* Budget anomalies */}
        <article className="fg-subcard">
          <h4>Budget anomalies</h4>
          <ul className="fg-list">
            {anomalies.length === 0 ? <li>No budget anomaly is currently recorded.</li> : null}
            {anomalies.map((anomaly, index) => (
              <li
                key={`${anomaly.scopeType}:${anomaly.scopeKey}:${anomaly.anomalyType}:${index}`}
              >
                {anomaly.severity} · {anomaly.anomalyType} · {anomaly.scopeType}:{anomaly.scopeKey} · observed=
                {formatCurrency(anomaly.observedCost)} · threshold=
                {formatCurrency(anomaly.thresholdCost)} · detected=
                {formatTimestamp(anomaly.detectedAt)}
              </li>
            ))}
          </ul>
        </article>
      </div>

      {/* Blocked cost classes table */}
      <section className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Blocked cost classes</h3>
            <p className="fg-muted">
              Cost-class suppression is listed concretely with source, reason, and a direct route
              into routing policy review.
            </p>
          </div>
        </div>

        {blockedCostClasses.length === 0 ? (
          <p className="fg-muted">
            No cost class is currently blocked or suppressed by the active budget posture.
          </p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Blocked cost classes">
              <thead>
                <tr>
                  <th>Cost class</th>
                  <th>Effect</th>
                  <th>Reason</th>
                  <th>Affected targets</th>
                  <th>Last signal</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedCostClasses.map((row) => (
                  <tr key={row.costClass}>
                    <td>
                      <div className="fg-stack">
                        <strong>{row.costClass}</strong>
                        <StatusBadge
                          tone={row.status === "blocked" ? "danger" : "warning"}
                          status={row.status === "blocked" ? "blocked" : "degraded"}
                        >
                          {row.status === "blocked" ? "blocking" : "warning"}
                        </StatusBadge>
                      </div>
                    </td>
                    <td>{row.effect}</td>
                    <td>{row.reasons.join(" ")}</td>
                    <td>{formatMetric(row.affectedTargets)}</td>
                    <td>{formatTimestamp(row.lastSignalAt)}</td>
                    <td>
                      <Link className="fg-nav-link" to={routingEditorRoute}>
                        Routing policy
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Circuit & guard map */}
      <section className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Circuit & guard map</h3>
            <p className="fg-muted">
              Provider rows aggregate persisted target circuits. The target-level controls below are
              the real write path for circuit state on this instance.
            </p>
          </div>
        </div>

        <div className="fg-card-grid">
          <article className="fg-subcard">
            <h4>Instance guard</h4>
            <ul className="fg-list">
              <li>Traffic gate: {budgetState.label}</li>
              <li>Hard block reason: {budgetReason ?? "none recorded"}</li>
              <li>Open target circuits: {formatMetric(openCircuitCount)}</li>
              <li>
                Provider groups with open circuits:{" "}
                {formatMetric(providerCircuits.filter((row) => row.openCircuitCount > 0).length)}
              </li>
              <li>
                Routing cost-class suppressions: {formatMetric(blockedCostClasses.length)}
              </li>
            </ul>
          </article>

          <article className="fg-subcard">
            <h4>Provider circuit posture</h4>
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Provider circuit posture">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Targets</th>
                    <th>Open circuits</th>
                    <th>Cost classes</th>
                    <th>Last trip</th>
                  </tr>
                </thead>
                <tbody>
                  {providerCircuits.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No provider targets are registered for this instance.</td>
                    </tr>
                  ) : (
                    providerCircuits.map((row) => (
                      <tr key={row.provider}>
                        <td>{row.provider}</td>
                        <td>
                          <StatusBadge
                            tone={
                              row.status === "blocked"
                                ? "danger"
                                : row.status === "degraded"
                                  ? "warning"
                                  : "success"
                            }
                            status={
                              row.status === "blocked"
                                ? "blocked"
                                : row.status === "degraded"
                                  ? "degraded"
                                  : "ready"
                            }
                          >
                            {row.status}
                          </StatusBadge>
                        </td>
                        <td>{formatMetric(row.targetCount)}</td>
                        <td>{formatMetric(row.openCircuitCount)}</td>
                        <td>{row.costClasses.join(", ") || "unknown"}</td>
                        <td>{formatTimestamp(row.lastTripAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <article className="fg-subcard">
          <div className="fg-panel-heading">
            <div>
              <h4>Per-target circuit controls</h4>
              <p className="fg-muted">
                Open circuit excludes the target immediately. Close circuit restores it to normal
                routing competition.
              </p>
            </div>
            <StatusBadge tone={canMutateRouting ? "success" : "warning"} status={canMutateRouting ? "ready" : "waiting_approval"}>
              {canMutateRouting ? "editable" : "read-only"}
            </StatusBadge>
          </div>

          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Per-target circuit controls">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Provider</th>
                  <th>Cost class</th>
                  <th>Status</th>
                  <th>Last trip</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {targetCircuits.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No persisted target circuits exist for the active instance.</td>
                  </tr>
                ) : (
                  targetCircuits.map((row) => (
                    <tr key={row.targetKey}>
                      <td>
                        <div className="fg-stack">
                          <strong>{row.label}</strong>
                          <span className="fg-muted">{row.targetKey}</span>
                        </div>
                      </td>
                      <td>{row.provider}</td>
                      <td>{row.costClass}</td>
                      <td>
                        <StatusBadge
                          tone={row.state === "open" ? "danger" : "success"}
                          status={row.state === "open" ? "blocked" : "ready"}
                        >
                          {row.state === "open" ? "open" : "closed"}
                        </StatusBadge>
                      </td>
                      <td>{formatTimestamp(row.updatedAt)}</td>
                      <td>
                        <input
                          aria-label={`Circuit reason ${row.targetKey}`}
                          value={circuitDrafts[row.targetKey] ?? row.reason ?? ""}
                          onChange={(event) => onSetCircuitDraft(row.targetKey, event.target.value)}
                          disabled={!canMutateRouting || savingCircuitKey === row.targetKey}
                        />
                      </td>
                      <td>
                        <div className="fg-actions">
                          <button
                            type="button"
                            onClick={() => onSaveCircuit(row.targetKey, "open")}
                            disabled={!canMutateRouting || savingCircuitKey === row.targetKey}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => onSaveCircuit(row.targetKey, "closed")}
                            disabled={!canMutateRouting || savingCircuitKey === row.targetKey}
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
