import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import {
  fetchRoutingControlPlane,
  simulateRouting,
  updateRoutingBudget,
  updateRoutingCircuit,
  updateRoutingPolicy,
  type ProviderTargetRecord,
  type RoutingBudgetRecord,
  type RoutingCircuitRecord,
  type RoutingControlPlaneResponse,
  type RoutingDecisionRecord,
  type RoutingPolicyRecord,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

type PolicyDraft = {
  execution_lane: RoutingPolicyRecord["execution_lane"];
  prefer_local: boolean;
  prefer_low_latency: boolean;
  allow_premium: boolean;
  allow_fallback: boolean;
  allow_escalation: boolean;
  require_queue_eligible: boolean;
  preferred_target_keys: string;
  fallback_target_keys: string;
  escalation_target_keys: string;
};

function listValue(value: string[]): string {
  return value.length > 0 ? value.join(", ") : "none";
}

function parseTargetKeyList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseBudgetScopesJson(value: string): RoutingBudgetRecord["scopes"] {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }
  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed)) {
    throw new Error("Budget scopes must be a JSON array.");
  }
  return parsed as RoutingBudgetRecord["scopes"];
}

function toPolicyDraft(policy: RoutingPolicyRecord): PolicyDraft {
  return {
    execution_lane: policy.execution_lane,
    prefer_local: policy.prefer_local,
    prefer_low_latency: policy.prefer_low_latency,
    allow_premium: policy.allow_premium,
    allow_fallback: policy.allow_fallback,
    allow_escalation: policy.allow_escalation,
    require_queue_eligible: policy.require_queue_eligible,
    preferred_target_keys: policy.preferred_target_keys.join(", "),
    fallback_target_keys: policy.fallback_target_keys.join(", "),
    escalation_target_keys: policy.escalation_target_keys.join(", "),
  };
}

export function RoutingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [snapshot, setSnapshot] = useState<RoutingControlPlaneResponse | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
  const [budgetDraft, setBudgetDraft] = useState<{ hard_blocked: boolean; blocked_cost_classes: string; reason: string; scopes_json: string }>({
    hard_blocked: false,
    blocked_cost_classes: "",
    reason: "",
    scopes_json: "[]",
  });
  const [circuitDrafts, setCircuitDrafts] = useState<Record<string, string>>({});
  const [simulationPrompt, setSimulationPrompt] = useState("Route this quick provider health summary and keep it local if possible.");
  const [simulationRequestedModel, setSimulationRequestedModel] = useState("");
  const [simulationUseTools, setSimulationUseTools] = useState(false);
  const [simulationRequireVision, setSimulationRequireVision] = useState(false);
  const [simulationStream, setSimulationStream] = useState(false);
  const [simulationMaxOutputTokens, setSimulationMaxOutputTokens] = useState("256");
  const [simulationResult, setSimulationResult] = useState<{ status: string; decision?: RoutingDecisionRecord; error?: { type: string; message: string } } | null>(null);

  const canReadRouting = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "routing.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "routing.write");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const payload = await fetchRoutingControlPlane(instanceId);
      setSnapshot(payload);
      setPolicyDrafts(
        Object.fromEntries(payload.policies.map((policy) => [policy.classification, toPolicyDraft(policy)])),
      );
      setBudgetDraft({
        hard_blocked: payload.budget.hard_blocked,
        blocked_cost_classes: payload.budget.blocked_cost_classes.join(", "),
        reason: payload.budget.reason ?? "",
        scopes_json: formatJson(payload.budget.scopes ?? []),
      });
      setCircuitDrafts(
        Object.fromEntries(payload.circuits.map((circuit) => [circuit.target_key, circuit.reason ?? ""])),
      );
      setState("success");
    } catch (loadError) {
      setSnapshot(null);
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Routing control plane could not be loaded.");
    }
  };

  useEffect(() => {
    if (!canReadRouting) {
      setSnapshot(null);
      setState("idle");
      setError("");
      return;
    }
    void load();
  }, [canReadRouting, instanceId]);

  const targets = snapshot?.targets ?? [];
  const policies = snapshot?.policies ?? [];
  const circuits = snapshot?.circuits ?? [];
  const recentDecisions = snapshot?.recent_decisions ?? [];
  const budget = snapshot?.budget;

  const targetLookup = useMemo(
    () =>
      Object.fromEntries(
        targets.map((target) => [target.target_key, target] satisfies [string, ProviderTargetRecord]),
      ),
    [targets],
  );

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const savePolicy = async (classification: RoutingPolicyRecord["classification"]) => {
    if (!canMutate) {
      setError("This session cannot mutate routing policy.");
      return;
    }
    const draft = policyDrafts[classification];
    if (!draft) {
      return;
    }
    setError("");
    try {
      await updateRoutingPolicy(
        classification,
        {
          execution_lane: draft.execution_lane,
          prefer_local: draft.prefer_local,
          prefer_low_latency: draft.prefer_low_latency,
          allow_premium: draft.allow_premium,
          allow_fallback: draft.allow_fallback,
          allow_escalation: draft.allow_escalation,
          require_queue_eligible: draft.require_queue_eligible,
          preferred_target_keys: parseTargetKeyList(draft.preferred_target_keys),
          fallback_target_keys: parseTargetKeyList(draft.fallback_target_keys),
          escalation_target_keys: parseTargetKeyList(draft.escalation_target_keys),
        },
        instanceId,
      );
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Routing policy update failed.");
    }
  };

  const saveBudget = async () => {
    if (!canMutate) {
      setError("This session cannot mutate routing budget state.");
      return;
    }
    setError("");
    try {
      const scopes = parseBudgetScopesJson(budgetDraft.scopes_json);
      await updateRoutingBudget(
        {
          hard_blocked: budgetDraft.hard_blocked,
          blocked_cost_classes: parseTargetKeyList(budgetDraft.blocked_cost_classes),
          reason: budgetDraft.reason.trim() || null,
          scopes,
        },
        instanceId,
      );
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Routing budget update failed.");
    }
  };

  const saveCircuit = async (targetKey: string, stateValue: RoutingCircuitRecord["state"]) => {
    if (!canMutate) {
      setError("This session cannot mutate routing circuits.");
      return;
    }
    setError("");
    try {
      await updateRoutingCircuit(
        targetKey,
        {
          state: stateValue,
          reason: circuitDrafts[targetKey]?.trim() || null,
        },
        instanceId,
      );
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Routing circuit update failed.");
    }
  };

  const runSimulation = async () => {
    setError("");
    setSimulationResult(null);
    try {
      const payload = await simulateRouting(
        {
          requested_model: simulationRequestedModel.trim() || null,
          prompt: simulationPrompt.trim() || null,
          stream: simulationStream,
          require_vision: simulationRequireVision,
          max_output_tokens: Number(simulationMaxOutputTokens) > 0 ? Number(simulationMaxOutputTokens) : null,
          tools: simulationUseTools
            ? [{ type: "function", function: { name: "lookup_health", description: "Inspect current provider health." } }]
            : undefined,
        },
        instanceId,
      );
      setSimulationResult(payload);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Routing simulation failed.");
    }
  };

  const openCircuits = circuits.filter((circuit) => circuit.state === "open").length;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Smart Execution Routing"
        description="Routing policy is instance-bound product truth here: deterministic classification, ordered target stages, budget and circuit posture, and explainable recent decisions."
        question="Why did this request land on this target, what got excluded first, and is the instance currently blocked by budget or circuit policy?"
        links={[
          {
            label: "Provider Targets",
            to: CONTROL_PLANE_ROUTES.providerTargets,
            description: "Inspect the target register the routing policy is allowed to use.",
          },
          {
            label: "Models",
            to: CONTROL_PLANE_ROUTES.models,
            description: "Check routing keys and capability truth behind the targets.",
          },
        ]}
        badges={[
          { label: `${policies.length} policies`, tone: policies.length >= 2 ? "success" : "warning" },
          { label: `${openCircuits} open circuits`, tone: openCircuits === 0 ? "success" : "warning" },
          { label: budget?.hard_blocked ? "Budget hard blocked" : "Budget open", tone: budget?.hard_blocked ? "danger" : "success" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note="This surface only trusts persisted routing policy, target truth, and the recorded decision ledger. There is no heuristic-only fallback story here."
      />
      {!canReadRouting ? (
        <article className="fg-card">
          <h3>Routing review unavailable</h3>
          <p className="fg-muted">This session does not hold routing.read on the active instance scope, so the page will not pretend the routing control plane is open.</p>
        </article>
      ) : null}
      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="routing control plane"
        onInstanceChange={onInstanceChange}
      />

      {error ? <p className="fg-danger">{error}</p> : null}

      {canReadRouting ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Policy Register</h3>
            <p className="fg-muted">Each routing class carries explicit stage order, lane intent, local bias, and premium posture.</p>
          </div>
          <span className="fg-pill" data-tone={state === "success" ? "success" : state === "error" ? "danger" : "neutral"}>
            {state}
          </span>
        </div>
        {state === "loading" ? <p className="fg-muted">Loading routing policy.</p> : null}
        {policies.length > 0 ? (
          <div className="fg-card-grid">
            {policies.map((policy) => {
              const draft = policyDrafts[policy.classification] ?? toPolicyDraft(policy);
              return (
                <article key={policy.classification} className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>{policy.display_name}</h4>
                      <p className="fg-muted">{policy.description}</p>
                    </div>
                    <span className="fg-pill" data-tone={policy.classification === "simple" ? "success" : "warning"}>
                      {policy.classification}
                    </span>
                  </div>
                  <div className="fg-detail-grid">
                    <p>execution lane={policy.execution_lane} · prefer local={String(policy.prefer_local)} · premium={String(policy.allow_premium)}</p>
                    <p>preferred={listValue(policy.preferred_target_keys)}</p>
                    <p>fallback={listValue(policy.fallback_target_keys)}</p>
                    <p>escalation={listValue(policy.escalation_target_keys)}</p>
                  </div>
                  <div className="fg-inline-form fg-mt-sm">
                    <label>
                      Execution lane
                      <select
                        value={draft.execution_lane}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: {
                              ...draft,
                              execution_lane: event.target.value as PolicyDraft["execution_lane"],
                            },
                          }))
                        }
                      >
                        <option value="sync_interactive">sync_interactive</option>
                        <option value="queued_background">queued_background</option>
                      </select>
                    </label>
                    <label>
                      Preferred targets
                      <input
                        value={draft.preferred_target_keys}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, preferred_target_keys: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Fallback targets
                      <input
                        value={draft.fallback_target_keys}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, fallback_target_keys: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Escalation targets
                      <input
                        value={draft.escalation_target_keys}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, escalation_target_keys: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.prefer_local}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, prefer_local: event.target.checked },
                          }))
                        }
                      />
                      Prefer local
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.prefer_low_latency}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, prefer_low_latency: event.target.checked },
                          }))
                        }
                      />
                      Prefer low latency
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.allow_premium}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, allow_premium: event.target.checked },
                          }))
                        }
                      />
                      Premium allowed
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.allow_fallback}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, allow_fallback: event.target.checked },
                          }))
                        }
                      />
                      Fallback allowed
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.allow_escalation}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, allow_escalation: event.target.checked },
                          }))
                        }
                      />
                      Escalation allowed
                    </label>
                    <label className="fg-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.require_queue_eligible}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.classification]: { ...draft, require_queue_eligible: event.target.checked },
                          }))
                        }
                      />
                      Queue eligible only
                    </label>
                    <div className="fg-actions fg-actions-end">
                      <button type="button" onClick={() => void savePolicy(policy.classification)}>
                        Save {policy.display_name}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </article>
      ) : null}

      {canReadRouting ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Budget & Circuits</h3>
            <p className="fg-muted">Budget posture blocks by instance. Circuits stay explicit per target and never hide inside provider heuristics.</p>
          </div>
          <span className="fg-pill" data-tone={budget?.hard_blocked ? "danger" : openCircuits > 0 ? "warning" : "success"}>
            {budget?.hard_blocked ? "blocked" : openCircuits > 0 ? "attention" : "open"}
          </span>
        </div>
        <div className="fg-card-grid">
          <article className="fg-subcard">
            <h4>Budget Gate</h4>
            <div className="fg-inline-form">
              <label className="fg-checkbox">
                <input
                  type="checkbox"
                  checked={budgetDraft.hard_blocked}
                  onChange={(event) => setBudgetDraft((current) => ({ ...current, hard_blocked: event.target.checked }))}
                />
                Hard block routing
              </label>
              <label>
                Blocked cost classes
                <input
                  value={budgetDraft.blocked_cost_classes}
                  onChange={(event) =>
                    setBudgetDraft((current) => ({ ...current, blocked_cost_classes: event.target.value }))
                  }
                />
              </label>
              <label>
                Reason
                <input
                  value={budgetDraft.reason}
                  onChange={(event) => setBudgetDraft((current) => ({ ...current, reason: event.target.value }))}
                />
              </label>
              <label>
                Scoped budget rules (JSON)
                <textarea
                  value={budgetDraft.scopes_json}
                  onChange={(event) =>
                    setBudgetDraft((current) => ({ ...current, scopes_json: event.target.value }))
                  }
                  rows={10}
                />
              </label>
              <div className="fg-actions fg-actions-end">
                <button type="button" onClick={() => void saveBudget()}>
                  Save budget posture
                </button>
              </div>
            </div>
          </article>
          <article className="fg-subcard">
            <h4>Budget Scope Truth</h4>
            <ul className="fg-list">
              <li>Configured scope rules: {budget?.scopes.length ?? 0}</li>
              <li>Detected anomalies: {budget?.anomalies.length ?? 0}</li>
              <li>Last evaluated at: {budget?.last_evaluated_at ?? "n/a"}</li>
            </ul>
            <div className="fg-detail-grid">
              {(budget?.scopes ?? []).map((scope) => (
                <p key={`${scope.scope_type}:${scope.scope_key}:${scope.window}`}>
                  {scope.scope_type}:{scope.scope_key} · {scope.window} · enabled={String(scope.enabled)} · observed cost=
                  {scope.observed_cost ?? 0} · observed tokens={scope.observed_tokens ?? 0} · soft exceeded=
                  {String(scope.soft_limit_exceeded)} · hard exceeded={String(scope.hard_limit_exceeded)}
                </p>
              ))}
              {(budget?.scopes ?? []).length === 0 ? <p className="fg-muted">No scoped budget rules are configured.</p> : null}
            </div>
            <div className="fg-detail-grid">
              {(budget?.anomalies ?? []).map((anomaly, index) => (
                <p key={`${anomaly.scope_type}:${anomaly.scope_key}:${anomaly.window}:${anomaly.anomaly_type}:${index}`}>
                  {anomaly.severity} · {anomaly.anomaly_type} · {anomaly.scope_type}:{anomaly.scope_key} · {anomaly.window}
                </p>
              ))}
              {(budget?.anomalies ?? []).length === 0 ? <p className="fg-muted">No budget anomalies detected.</p> : null}
            </div>
          </article>
          <article className="fg-subcard">
            <h4>Target Circuits</h4>
            <div className="fg-detail-grid">
              {targets.map((target) => {
                const circuit = circuits.find((item) => item.target_key === target.target_key);
                const stateValue = circuit?.state ?? "closed";
                return (
                  <div key={target.target_key} className="fg-subcard">
                    <p>
                      {target.label} · {target.target_key}
                    </p>
                    <p className="fg-muted">
                      current circuit={stateValue} · priority={target.priority} · cost={target.cost_class}
                    </p>
                    <label>
                      Circuit reason
                      <input
                        value={circuitDrafts[target.target_key] ?? ""}
                        onChange={(event) =>
                          setCircuitDrafts((current) => ({ ...current, [target.target_key]: event.target.value }))
                        }
                      />
                    </label>
                    <div className="fg-actions fg-actions-end">
                      <button type="button" onClick={() => void saveCircuit(target.target_key, "open")}>
                        Open circuit
                      </button>
                      <button type="button" onClick={() => void saveCircuit(target.target_key, "closed")}>
                        Close circuit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </article>
      ) : null}

      {canReadRouting ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Dry-Run Simulation</h3>
            <p className="fg-muted">Simulate a real request path with current policy, target ordering, budget posture, and circuit state.</p>
          </div>
          <button type="button" onClick={() => void runSimulation()}>
            Run simulation
          </button>
        </div>
        <div className="fg-inline-form">
          <label>
            Requested model
            <input value={simulationRequestedModel} onChange={(event) => setSimulationRequestedModel(event.target.value)} />
          </label>
          <label>
            Prompt
            <textarea value={simulationPrompt} onChange={(event) => setSimulationPrompt(event.target.value)} rows={4} />
          </label>
          <label>
            Max output tokens
            <input value={simulationMaxOutputTokens} onChange={(event) => setSimulationMaxOutputTokens(event.target.value)} />
          </label>
          <label className="fg-checkbox">
            <input type="checkbox" checked={simulationUseTools} onChange={(event) => setSimulationUseTools(event.target.checked)} />
            Simulate tool calling
          </label>
          <label className="fg-checkbox">
            <input type="checkbox" checked={simulationRequireVision} onChange={(event) => setSimulationRequireVision(event.target.checked)} />
            Require vision
          </label>
          <label className="fg-checkbox">
            <input type="checkbox" checked={simulationStream} onChange={(event) => setSimulationStream(event.target.checked)} />
            Stream
          </label>
        </div>
        {simulationResult ? (
          <article className="fg-subcard fg-mt-sm">
            <div className="fg-panel-heading">
              <div>
                <h4>Simulation Result</h4>
                <p className="fg-muted">
                  status={simulationResult.status} · classification={simulationResult.decision?.classification ?? "n/a"} · stage=
                  {simulationResult.decision?.policy_stage ?? "blocked"}
                </p>
              </div>
              <span className="fg-pill" data-tone={simulationResult.status === "ok" ? "success" : "danger"}>
                {simulationResult.status}
              </span>
            </div>
            {simulationResult.error ? <p className="fg-danger">{simulationResult.error.type}: {simulationResult.error.message}</p> : null}
            {simulationResult.decision ? (
              <>
                <div className="fg-detail-grid">
                  <p>{simulationResult.decision.summary}</p>
                  <p>{simulationResult.decision.classification_summary}</p>
                  <p>selected target={simulationResult.decision.selected_target_key ?? "none"} · lane={simulationResult.decision.execution_lane}</p>
                  <p>rules={listValue(simulationResult.decision.classification_rules)}</p>
                </div>
                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <h5>Structured Explainability</h5>
                    <pre>{JSON.stringify(simulationResult.decision.structured_details, null, 2)}</pre>
                  </article>
                  <article className="fg-subcard">
                    <h5>Raw Explainability</h5>
                    <pre>{JSON.stringify(simulationResult.decision.raw_details, null, 2)}</pre>
                  </article>
                </div>
              </>
            ) : null}
          </article>
        ) : null}
      </article>
      ) : null}

      {canReadRouting ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Recent Routing Decisions</h3>
            <p className="fg-muted">The ledger is the operator truth for why targets were selected or blocked.</p>
          </div>
          <span className="fg-pill" data-tone={recentDecisions.length > 0 ? "success" : "warning"}>
            {recentDecisions.length} decisions
          </span>
        </div>
        {recentDecisions.length === 0 ? <p className="fg-muted">No routing decisions are persisted yet for this instance.</p> : null}
        {recentDecisions.length > 0 ? (
          <div className="fg-card-grid">
            {recentDecisions.map((decision) => (
              <article key={decision.decision_id} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{decision.summary}</h4>
                    <p className="fg-muted">
                      {decision.classification} · stage={decision.policy_stage} · source={decision.source} · {decision.created_at}
                    </p>
                  </div>
                  <span className="fg-pill" data-tone={decision.error_type ? "danger" : "success"}>
                    {decision.error_type ?? "selected"}
                  </span>
                </div>
                <div className="fg-detail-grid">
                  <p>{decision.classification_summary}</p>
                  <p>selected target={decision.selected_target_key ?? "none"} · lane={decision.execution_lane}</p>
                  <p>rules={listValue(decision.classification_rules)}</p>
                  {decision.candidates.map((candidate) => (
                    <p key={candidate.target_key}>
                      {candidate.label} · selected={String(candidate.selected)} · excluded=
                      {candidate.exclusion_reasons.length > 0 ? candidate.exclusion_reasons.join(", ") : "none"}
                    </p>
                  ))}
                </div>
                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <h5>Structured Explainability</h5>
                    <pre>{JSON.stringify(decision.structured_details, null, 2)}</pre>
                  </article>
                  <article className="fg-subcard">
                    <h5>Raw Explainability</h5>
                    <pre>{JSON.stringify(decision.raw_details, null, 2)}</pre>
                  </article>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>
      ) : null}

      {canReadRouting ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Target Reference</h3>
            <p className="fg-muted">Use the exact target keys below when editing policy stage lists.</p>
          </div>
        </div>
        <div className="fg-detail-grid">
          {targets.map((target) => (
            <p key={target.target_key}>
              {target.target_key} → {targetLookup[target.target_key]?.label ?? target.label} · readiness={target.readiness_status}
            </p>
          ))}
        </div>
      </article>
      ) : null}
    </section>
  );
}
