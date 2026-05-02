import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { RoutingControlPlaneResponse } from "../../api/domain/routing";
import type { SimulationFormState, SimulationResultState, SimulationScenario } from "./types";
import {
  applySimulationScenario,
  formatJson,
  laneMatchLabel,
  requestedScenarioLabel,
  selectedCandidate,
  rejectedCandidates,
  selectionBasis,
  simulationSummary,
  asStringList,
} from "./utils";

/**
 * Props for the simulation panel.
 */
export type RoutingSimulationPanelProps = {
  snapshot: RoutingControlPlaneResponse | null;
  simulationForm: SimulationFormState;
  simulationPending: boolean;
  simulationResult: SimulationResultState | null;
  simulationHistory: Partial<Record<SimulationScenario, SimulationResultState>>;
  providerOptions: string[];
  instanceId: string | null;
  canMutate: boolean;
  actionError: string;
  onSetSimulationForm: (form: SimulationFormState) => void;
  onRunSimulation: (formOverride?: SimulationFormState) => void;
  onRunScenarioSimulation: (scenario: SimulationScenario) => void;
};

/**
 * Dry-run simulation panel with scenario controls and result details.
 * Shows a rich summary preview so operators know the last result without expanding.
 */
export function RoutingSimulationPanel({
  snapshot,
  simulationForm,
  simulationPending,
  simulationResult,
  simulationHistory,
  providerOptions,
  instanceId,
  canMutate,
  actionError,
  onSetSimulationForm,
  onRunSimulation,
  onRunScenarioSimulation,
}: RoutingSimulationPanelProps) {
  const targets = snapshot?.targets ?? [];
  const activeSimulation = simulationResult?.decision;
  const activeSelectedCandidate = selectedCandidate(activeSimulation);
  const activeRejectedCandidates = rejectedCandidates(activeSimulation);
  const activeSelectionBasis = selectionBasis(activeSimulation);
  const matchingScopes = Array.isArray(activeSelectionBasis.budget_matching_scopes)
    ? activeSelectionBasis.budget_matching_scopes as Array<Record<string, unknown>>
    : [];
  const openCircuitExplainability = Array.isArray(activeSelectionBasis.open_circuits)
    ? activeSelectionBasis.open_circuits as Array<Record<string, unknown>>
    : [];
  const blockedCostClasses = asStringList(activeSelectionBasis.blocked_cost_classes);
  const simpleHistory = simulationHistory.simple;
  const nonSimpleHistory = simulationHistory.non_simple;

  return (
    <div className="ff-collapse-section-body">
      <div className="fg-inline-form">
        <label>
          Request class
          <select
            aria-label="Simulation request class"
            value={simulationForm.scenario}
            onChange={(event) =>
              onSetSimulationForm(applySimulationScenario(simulationForm, event.target.value as SimulationScenario, instanceId))
            }
          >
            <option value="simple">Simple</option>
            <option value="non_simple">Non-simple</option>
          </select>
        </label>
        <label>
          Requested provider
          <select
            aria-label="Simulation provider"
            value={simulationForm.requestedProvider}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, requestedProvider: event.target.value })}
          >
            <option value="all">All providers</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </label>
        <label>
          Requested model
          <input
            aria-label="Simulation model"
            value={simulationForm.requestedModel}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, requestedModel: event.target.value })}
          />
        </label>
        <label>
          Request path policy
          <select
            aria-label="Request path policy"
            value={simulationForm.requestPathPolicy}
            onChange={(event) =>
              onSetSimulationForm({ ...simulationForm, requestPathPolicy: event.target.value as SimulationFormState["requestPathPolicy"] })
            }
          >
            <option value="smart_routing">smart_routing</option>
            <option value="queue_background">queue_background</option>
            <option value="local_only">local_only</option>
            <option value="pinned_target">pinned_target</option>
          </select>
        </label>
        {simulationForm.requestPathPolicy === "pinned_target" ? (
          <label>
            Pinned target key
            <select
              aria-label="Pinned target key"
              value={simulationForm.pinnedTargetKey}
              onChange={(event) => onSetSimulationForm({ ...simulationForm, pinnedTargetKey: event.target.value })}
            >
              <option value="">Choose target</option>
              {targets.map((target) => (
                <option key={target.target_key} value={target.target_key}>{target.target_key}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Budget scope type
          <select
            aria-label="Budget scope type"
            value={simulationForm.budgetScopeType}
            onChange={(event) => {
              const nextScopeType = event.target.value as SimulationFormState["budgetScopeType"];
              onSetSimulationForm({
                ...simulationForm,
                budgetScopeType: nextScopeType,
                budgetScopeKey: nextScopeType === "instance"
                  ? (instanceId ?? "")
                  : simulationForm.budgetScopeType === "instance"
                    ? ""
                    : simulationForm.budgetScopeKey,
              });
            }}
          >
            <option value="instance">instance</option>
            <option value="agent">agent</option>
            <option value="task">task</option>
          </select>
        </label>
        <label>
          Budget scope key
          <input
            aria-label="Budget scope key"
            value={simulationForm.budgetScopeType === "instance" ? (instanceId ?? "") : simulationForm.budgetScopeKey}
            disabled={simulationForm.budgetScopeType === "instance"}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, budgetScopeKey: event.target.value })}
          />
        </label>
        <label>
          Expected execution lane
          <select
            aria-label="Expected execution lane"
            value={simulationForm.expectedLane}
            onChange={(event) =>
              onSetSimulationForm({ ...simulationForm, expectedLane: event.target.value as SimulationFormState["expectedLane"] })
            }
          >
            <option value="either">either</option>
            <option value="sync_interactive">sync_interactive</option>
            <option value="queued_background">queued_background</option>
          </select>
        </label>
        <label>
          Prompt
          <textarea
            aria-label="Simulation prompt"
            value={simulationForm.prompt}
            rows={4}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, prompt: event.target.value })}
          />
        </label>
        <label>
          Max output tokens
          <input
            aria-label="Simulation max output tokens"
            value={simulationForm.maxOutputTokens}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, maxOutputTokens: event.target.value })}
          />
        </label>
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={simulationForm.requireStreaming}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, requireStreaming: event.target.checked })}
          />
          Streaming required
        </label>
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={simulationForm.requireToolCalling}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, requireToolCalling: event.target.checked })}
          />
          Tool calling required
        </label>
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={simulationForm.requireVision}
            onChange={(event) => onSetSimulationForm({ ...simulationForm, requireVision: event.target.checked })}
          />
          Vision required
        </label>
      </div>

      <div className="fg-actions">
        <button type="button" onClick={() => void onRunScenarioSimulation("simple")} disabled={simulationPending}>
          {simulationPending ? "Running simulation" : "Run simple simulation"}
        </button>
        <button type="button" onClick={() => void onRunScenarioSimulation("non_simple")} disabled={simulationPending}>
          {simulationPending ? "Running simulation" : "Run non-simple simulation"}
        </button>
        <button type="button" onClick={() => void onRunSimulation()} disabled={simulationPending}>
          {simulationPending ? "Running simulation" : "Run configured simulation"}
        </button>
      </div>

      {simulationResult ? (
        <div className="fg-card-grid fg-mt-sm">
          <article className="fg-subcard">
            <h4>Short decision</h4>
            {simulationResult.error ? (
              <p className="fg-danger">{simulationResult.error.type}: {simulationResult.error.message}</p>
            ) : null}
            <ul className="fg-list">
              <li>Requested scenario: {requestedScenarioLabel(simulationResult.form)}</li>
              <li>Classification result: {simulationResult.decision ? titleCase(simulationResult.decision.classification) : "No decision persisted"}</li>
              <li>Selected target: {simulationResult.decision?.selected_target_key ?? "none"}</li>
              <li>Policy stage: {simulationResult.decision?.policy_stage ?? "blocked"}</li>
              <li>Execution lane: {simulationResult.decision?.execution_lane ?? "n/a"}</li>
              <li>{laneMatchLabel(simulationResult.form, simulationResult.decision)}</li>
            </ul>
            {simulationResult.decision ? <p className="fg-muted">{simulationResult.decision.summary}</p> : null}
          </article>

          <article className="fg-subcard">
            <h4>Decision factors</h4>
            {simulationResult.decision ? (
              <ul className="fg-list">
                <li>{simulationResult.decision.classification_summary}</li>
                <li>Classification rules: {listValue(simulationResult.decision.classification_rules)}</li>
                <li>Request path policy: {String(activeSelectionBasis.request_path_policy ?? "smart_routing")}</li>
                <li>Provider scope: {simulationResult.form.requestedProvider === "all" ? "all providers" : simulationResult.form.requestedProvider}</li>
                <li>Selected candidate reasons: {activeSelectedCandidate?.selection_reasons.length ? activeSelectedCandidate.selection_reasons.join(", ") : "none recorded"}</li>
                <li>Rejected candidates: {activeRejectedCandidates.length}</li>
                <li>Blocked cost classes in effect: {blockedCostClasses.length > 0 ? blockedCostClasses.join(", ") : "none"}</li>
                <li>Matching budget scopes: {matchingScopes.length > 0 ? matchingScopes.map((scope) => `${String(scope.scope_type)}:${String(scope.scope_key)}`).join(", ") : "none"}</li>
                <li>Open circuits in effect: {openCircuitExplainability.length > 0 ? openCircuitExplainability.map((circuit) => String(circuit.target_key)).join(", ") : "none"}</li>
              </ul>
            ) : (
              <p className="fg-muted">No decision factors are available because the simulation did not persist a routing decision.</p>
            )}
          </article>

          <article className="fg-subcard">
            <h4>Rejected candidates</h4>
            {activeRejectedCandidates.length > 0 ? (
              <ul className="fg-list">
                {activeRejectedCandidates.map((candidate) => (
                  <li key={candidate.target_key}>
                    {candidate.label} · {candidate.target_key} · {candidate.exclusion_reasons.join(", ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fg-muted">No rejected candidates were recorded for this simulation.</p>
            )}
          </article>

          <article className="fg-subcard">
            <h4>Simple vs non-simple comparison</h4>
            <ul className="fg-list">
              <li>Simple: {simulationSummary(simpleHistory)}</li>
              <li>Non-simple: {simulationSummary(nonSimpleHistory)}</li>
              <li>
                {simpleHistory?.decision && nonSimpleHistory?.decision
                  ? simpleHistory.decision.selected_target_key !== nonSimpleHistory.decision.selected_target_key
                    ? "Simple and non-simple simulations currently resolve to different targets, which matches the expected routing split."
                    : "Simple and non-simple simulations currently land on the same target. Inspect target pools, request-path controls, or budget/circuit gates before trusting this posture."
                  : "Run both quick simulations to compare the current simple and non-simple routing posture."}
              </li>
            </ul>
          </article>
        </div>
      ) : null}

      {simulationResult ? (
        <AdvancedDiagnostics
          title="Raw simulation details"
          description="Structured explainability stays in the short decision and factor views. Raw payloads remain collapsed here for technical debugging."
          status={simulationResult.status}
          statusTone={simulationResult.status === "blocked" ? "danger" : "neutral"}
        >
          <pre>{formatJson(simulationResult)}</pre>
        </AdvancedDiagnostics>
      ) : null}
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function listValue(value: string[]): string {
  return value.length > 0 ? value.join(", ") : "none";
}
