import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchRoutingControlPlane,
  fetchUsageSummary,
  type RoutingControlPlaneResponse,
  type UsageSummaryResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMetric(value: unknown, digits = 0): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function selectedCostClassCounts(snapshot: RoutingControlPlaneResponse | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const decision of snapshot?.recent_decisions ?? []) {
    const selected = decision.candidates.find((candidate) => candidate.selected);
    if (!selected) {
      continue;
    }
    counts[selected.cost_class] = (counts[selected.cost_class] ?? 0) + 1;
  }
  return counts;
}

export function CostsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [routing, setRouting] = useState<RoutingControlPlaneResponse | null>(null);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setState("loading");
      setError(null);
      try {
        const [usagePayload, routingPayload] = await Promise.all([
          fetchUsageSummary("24h", instanceId),
          fetchRoutingControlPlane(instanceId),
        ]);
        if (!mounted) {
          return;
        }
        setUsage(usagePayload);
        setRouting(routingPayload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setUsage(null);
        setRouting(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Cost surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const providerCosts = usage?.aggregations.by_provider ?? [];
  const clientCosts = usage?.aggregations.by_client ?? [];
  const openCircuits = (routing?.circuits ?? []).filter((circuit) => circuit.state === "open");
  const costMix = selectedCostClassCounts(routing);
  const blockedDecisions = (routing?.recent_decisions ?? []).filter((decision) => Boolean(decision.error_type)).length;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Costs & Budget Controls"
        description="Cost truth stays separate from generic usage: budget posture, blocked cost classes, circuit pressure, and recent routing cost mix live on one operator surface."
        question="Is current spend still inside the allowed routing posture?"
        links={[
          {
            label: "Usage",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Return to historical provider and client traffic drilldowns.",
          },
          {
            label: "Routing",
            to: CONTROL_PLANE_ROUTES.routing,
            description: "Inspect or change budget, circuits, and policy staging directly.",
          },
          {
            label: "Errors",
            to: CONTROL_PLANE_ROUTES.errors,
            description: "Switch to incident review when blocked cost posture becomes a runtime failure.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: routing?.budget.hard_blocked ? "Budget blocked" : "Budget open", tone: routing?.budget.hard_blocked ? "danger" : "success" },
        ]}
        note="This page only trusts persisted usage analytics and the routing control-plane ledger. It does not infer cost posture from frontend state."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="cost and budget posture"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading cost posture.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {usage && routing ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Budget Posture</h3>
                <p className="fg-muted">The routing budget state is the hard control, not an after-the-fact report.</p>
              </div>
              <span className="fg-pill" data-tone={routing.budget.hard_blocked ? "danger" : "success"}>
                {routing.budget.hard_blocked ? "Hard blocked" : "Traffic allowed"}
              </span>
            </div>
            <ul className="fg-list">
              <li>Blocked cost classes: {routing.budget.blocked_cost_classes.length > 0 ? routing.budget.blocked_cost_classes.join(", ") : "none"}</li>
              <li>Budget reason: {routing.budget.reason ?? "none"}</li>
              <li>Budget updated at: {routing.budget.updated_at ?? "n/a"}</li>
              <li>Scoped budget rules: {formatMetric(routing.budget.scopes.length)}</li>
              <li>Budget anomalies: {formatMetric(routing.budget.anomalies.length)}</li>
              <li>Budget last evaluated: {routing.budget.last_evaluated_at ?? "n/a"}</li>
              <li>Open circuits: {formatMetric(openCircuits.length)}</li>
              <li>Blocked routing decisions in ledger: {formatMetric(blockedDecisions)}</li>
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Recorded Costs (24h)</h3>
                <p className="fg-muted">Actual, hypothetical, and avoided cost remain explicit instead of collapsing into one blend.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Runtime actual cost: {formatMetric(usage.traffic_split.runtime.actual_cost, 2)}</li>
              <li>Runtime hypothetical cost: {formatMetric(usage.traffic_split.runtime.hypothetical_cost, 2)}</li>
              <li>Avoided cost: {formatMetric(usage.traffic_split.runtime.avoided_cost, 2)}</li>
              <li>Health-check actual cost: {formatMetric(usage.traffic_split.health_check.actual_cost, 2)}</li>
              <li>Recorded runtime requests: {formatMetric(usage.metrics.recorded_request_count)}</li>
              <li>Recorded runtime errors: {formatMetric(usage.metrics.recorded_error_count)}</li>
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Recent Routing Cost Mix</h3>
                <p className="fg-muted">This is the persisted target mix from the decision ledger, not a UI estimate.</p>
              </div>
            </div>
            <ul className="fg-list">
              {Object.entries(costMix).length === 0 ? <li>No recent selected targets recorded.</li> : null}
              {Object.entries(costMix).map(([costClass, count]) => (
                <li key={costClass}>{costClass}: {formatMetric(count)}</li>
              ))}
              <li>Fallback-stage decisions: {formatMetric((routing.recent_decisions ?? []).filter((decision) => decision.policy_stage === "fallback").length)}</li>
              <li>Escalation-stage decisions: {formatMetric((routing.recent_decisions ?? []).filter((decision) => decision.policy_stage === "escalation").length)}</li>
              <li>Queued-background selections: {formatMetric((routing.recent_decisions ?? []).filter((decision) => decision.execution_lane === "queued_background").length)}</li>
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Provider Cost Hotspots</h3>
                <p className="fg-muted">Highest recorded provider spend for the active window.</p>
              </div>
            </div>
            <ul className="fg-list">
              {providerCosts.length === 0 ? <li>No provider costs recorded.</li> : null}
              {providerCosts.slice(0, 5).map((item, index) => (
                <li key={`${String(item.provider)}-${index}`}>
                  {String(item.provider)} · actual={formatMetric(item.actual_cost, 2)} · hypothetical={formatMetric(item.hypothetical_cost, 2)} · avoided={formatMetric(item.avoided_cost, 2)}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Client Cost Hotspots</h3>
                <p className="fg-muted">Client concentration remains visible before you escalate spend or budget blocks.</p>
              </div>
            </div>
            <ul className="fg-list">
              {clientCosts.length === 0 ? <li>No client costs recorded.</li> : null}
              {clientCosts.slice(0, 5).map((item, index) => (
                <li key={`${String(item.client_id)}-${index}`}>
                  {String(item.client_id)} · requests={formatMetric(item.requests)} · actual={formatMetric(item.actual_cost, 2)}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Pricing Snapshot</h3>
                <p className="fg-muted">Configured pricing stays visible next to recorded cost evidence.</p>
              </div>
            </div>
            <ul className="fg-list">
              {Object.entries(usage.pricing_snapshot).map(([key, value]) => (
                <li key={key}>{key}: {formatMetric(value, 2)}</li>
              ))}
            </ul>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}>
              Open Routing Controls
            </Link>
          </article>
        </div>
      ) : null}
    </section>
  );
}
