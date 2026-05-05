import type { RoutingCircuitRecord, RoutingControlPlaneResponse } from "../../api/domain/routing";
import type { BudgetDraftState } from "./types";
import { toneForStatus, titleCase, routingBlockers } from "./utils";

/**
 * Props for the budget and circuit guardrails section.
 */
export type RoutingBudgetCircuitsProps = {
  snapshot: RoutingControlPlaneResponse | null;
  budgetDraft: BudgetDraftState;
  circuitDrafts: Record<string, string>;
  canMutate: boolean;
  actionError: string;
  onSetBudgetDraft: (draft: BudgetDraftState) => void;
  onSaveBudget: () => void;
  onSetCircuitDrafts: (drafts: Record<string, string>) => void;
  onSaveCircuit: (targetKey: string, state: RoutingCircuitRecord["state"]) => void;
};

/**
 * Budget gate editor and circuit breaker management section.
 */
export function RoutingBudgetCircuits({
  snapshot,
  budgetDraft,
  circuitDrafts,
  canMutate,
  actionError,
  onSetBudgetDraft,
  onSaveBudget,
  onSetCircuitDrafts,
  onSaveCircuit,
}: RoutingBudgetCircuitsProps) {
  if (!snapshot) {
    return null;
  }

  const budget = snapshot.budget;
  const targets = snapshot.targets;
  const circuits = snapshot.circuits;
  const blockers = routingBlockers(snapshot);

  return (
    <div className="fg-card-grid">
      <article className="fg-subcard">
        <h4>What blocks routing right now</h4>
        {blockers.length === 0 ? (
          <p className="fg-muted">No active budget, circuit, or target-readiness blocker is visible for this instance.</p>
        ) : (
          <ul className="fg-list">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="fg-subcard">
        <h4>Budget gate editor</h4>
        <p className="fg-muted">
          Hard block stops all routing. Blocked cost classes only remove matching candidates. Only writable scope fields
          belong in this editor; observed usage, anomaly flags, and evaluation timestamps are server-calculated and remain
          read-only below.
        </p>
        <div className="fg-inline-form">
          <label className="fg-checkbox">
            <input
              type="checkbox"
              checked={budgetDraft.hard_blocked}
              onChange={(event) => onSetBudgetDraft({ ...budgetDraft, hard_blocked: event.target.checked })}
            />
            Hard block routing
          </label>
          <label>
            Blocked cost classes
            <input
              aria-label="Blocked cost classes"
              value={budgetDraft.blocked_cost_classes}
              onChange={(event) => onSetBudgetDraft({ ...budgetDraft, blocked_cost_classes: event.target.value })}
            />
          </label>
          <label>
            Reason
            <input
              aria-label="Budget reason"
              value={budgetDraft.reason}
              onChange={(event) => onSetBudgetDraft({ ...budgetDraft, reason: event.target.value })}
            />
          </label>
          <label>
            Scoped budget rules (writable JSON)
            <textarea
              aria-label="Scoped budget rules writable JSON"
              value={budgetDraft.scopes_json}
              rows={10}
              onChange={(event) => onSetBudgetDraft({ ...budgetDraft, scopes_json: event.target.value })}
            />
          </label>
        </div>
        <div className="fg-actions fg-actions-end">
          <button type="button" onClick={() => void onSaveBudget()}>
            Save budget posture
          </button>
        </div>
      </article>

      <article className="fg-subcard">
        <h4>Budget scope truth</h4>
        <ul className="fg-list">
          <li>Configured scope rules: {budget?.scopes.length ?? 0}</li>
          <li>Matching anomalies: {budget?.anomalies.length ?? 0}</li>
          <li>Last evaluated at: {budget?.last_evaluated_at ?? "n/a"}</li>
        </ul>
        <div className="fg-detail-grid">
          {(budget?.scopes ?? []).map((scope) => (
            <p key={`${scope.scope_type}:${scope.scope_key}:${scope.window}`}>
              {scope.scope_type}:{scope.scope_key} · {scope.window} · enabled={String(scope.enabled)} · soft={scope.soft_cost_limit ?? "n/a"} · hard={scope.hard_cost_limit ?? "n/a"} · observed cost={scope.observed_cost ?? 0} · observed tokens={scope.observed_tokens ?? 0} · soft exceeded={String(scope.soft_limit_exceeded)} · hard exceeded={String(scope.hard_limit_exceeded)}
            </p>
          ))}
          {(budget?.scopes ?? []).length === 0 ? <p className="fg-muted">No scoped budget rules are configured.</p> : null}
        </div>
        <div className="fg-detail-grid">
          {(budget?.anomalies ?? []).map((anomaly, index) => (
            <p key={`${anomaly.scope_type}:${anomaly.scope_key}:${anomaly.window}:${anomaly.anomaly_type}:${index}`}>
              {anomaly.severity} · {anomaly.anomaly_type} · {anomaly.scope_type}:{anomaly.scope_key} · threshold cost={anomaly.threshold_cost ?? "n/a"} · threshold tokens={anomaly.threshold_tokens ?? "n/a"}
            </p>
          ))}
          {(budget?.anomalies ?? []).length === 0 ? <p className="fg-muted">No budget anomalies are recorded.</p> : null}
        </div>
      </article>

      <article className="fg-subcard">
        <h4>Target circuit breakers</h4>
        <p className="fg-muted">Open circuits immediately exclude targets before stage ordering chooses between preferred, fallback, or escalation.</p>
        <div className="fg-detail-grid">
          {targets.map((target) => {
            const circuit = circuits.find((item) => item.target_key === target.target_key);
            const circuitState = circuit?.state ?? "closed";
            return (
              <div key={target.target_key} className="fg-subcard">
                <p>{target.label} · {target.target_key}</p>
                <p className="fg-muted">Circuit={circuitState} · cost={target.cost_class} · readiness={target.readiness_status}</p>
                <label>
                  Circuit reason
                  <input
                    aria-label={`Circuit reason ${target.target_key}`}
                    value={circuitDrafts[target.target_key] ?? ""}
                    onChange={(event) =>
                      onSetCircuitDrafts({ ...circuitDrafts, [target.target_key]: event.target.value })
                    }
                  />
                </label>
                <div className="fg-actions fg-actions-end">
                  <button type="button" onClick={() => void onSaveCircuit(target.target_key, "open")}>
                    Open circuit
                  </button>
                  <button type="button" onClick={() => void onSaveCircuit(target.target_key, "closed")}>
                    Close circuit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
