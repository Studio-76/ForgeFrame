import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchBootstrapReadiness,
  fetchProviderControlPlane,
  fetchRoutingControlPlane,
  fetchRuntimeHealth,
  type ProviderControlPlaneResponse,
  type RoutingControlPlaneResponse,
  type RuntimeHealthResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

export function ReleaseValidationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<{ ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[] } | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderControlPlaneResponse | null>(null);
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
        const [bootstrapPayload, runtimePayload, providersPayload, routingPayload] = await Promise.all([
          fetchBootstrapReadiness(),
          fetchRuntimeHealth(),
          fetchProviderControlPlane(instanceId),
          fetchRoutingControlPlane(instanceId),
        ]);
        if (!mounted) {
          return;
        }
        setBootstrap(bootstrapPayload);
        setRuntimeHealth(runtimePayload);
        setProviders(providersPayload);
        setRouting(routingPayload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setBootstrap(null);
        setRuntimeHealth(null);
        setProviders(null);
        setRouting(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Release validation surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const readyProviders = (providers?.providers ?? []).filter((provider) => provider.ready && provider.runtime_readiness === "ready");
  const blockedChecks = (bootstrap?.checks ?? []).filter((check) => check.ok !== true);
  const openCircuits = (routing?.circuits ?? []).filter((circuit) => circuit.state === "open");
  const releaseReady = Boolean(
    bootstrap?.ready
    && runtimeHealth?.readiness.accepting_traffic
    && readyProviders.length > 0
    && routing
    && !routing.budget.hard_blocked
    && openCircuits.length === 0
  );

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Release / Validation"
        description="Release claims are cross-checked here against shipped bootstrap, runtime-health, provider, and routing evidence instead of relying on one optimistic dashboard tile."
        question="Would the current build survive a hard release audit, or are there still explicit blockers in bootstrap, provider truth, or routing safety?"
        links={[
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Stay on the current release-gate surface." },
          { label: "Bootstrap / Readiness", to: CONTROL_PLANE_ROUTES.onboarding, description: "Inspect bootstrap and go-live blockers." },
          { label: "Ingress / TLS", to: CONTROL_PLANE_ROUTES.ingressTls, description: "Inspect public origin and certificate blockers." },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: releaseReady ? "Current gates green" : "Current gates blocked", tone: releaseReady ? "success" : "warning" },
        ]}
        note="This page is only a stitched view over existing control-plane signals. Missing backend validation automation stays visible here as a release blocker, not as hidden optimism."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="release and validation gates"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading release gates.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {state === "success" && bootstrap && runtimeHealth && providers && routing ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Gate summary</h3>
                <p className="fg-muted">The core shipped gate signals are shown here without flattening their differences.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Bootstrap ready: {String(bootstrap.ready)}</li>
              <li>Runtime accepting traffic: {String(runtimeHealth.readiness.accepting_traffic)}</li>
              <li>Ready providers: {readyProviders.length}</li>
              <li>Budget hard blocked: {String(routing.budget.hard_blocked)}</li>
              <li>Open circuits: {openCircuits.length}</li>
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Current blockers</h3>
                <p className="fg-muted">If the build is not releasable, the blocking signal should already be visible here.</p>
              </div>
            </div>
            <ul className="fg-list">
              {blockedChecks.length === 0 && runtimeHealth.readiness.accepting_traffic && readyProviders.length > 0 && !routing.budget.hard_blocked && openCircuits.length === 0 ? (
                <li>No current blockers detected in the shipped gate signals.</li>
              ) : null}
              {blockedChecks.slice(0, 6).map((check) => (
                <li key={String(check.id)}>{String(check.id)}: {String(check.details)}</li>
              ))}
              {!runtimeHealth.readiness.accepting_traffic ? <li>Runtime health is not currently accepting traffic.</li> : null}
              {readyProviders.length === 0 ? <li>No provider route is currently runtime-ready for the selected scope.</li> : null}
              {routing.budget.hard_blocked ? <li>Routing budget is hard blocked.</li> : null}
              {openCircuits.map((circuit) => (
                <li key={circuit.target_key}>Circuit open: {circuit.target_key} · {circuit.reason ?? "no reason"}</li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Operator next routes</h3>
                <p className="fg-muted">Release validation should terminate in a concrete route, not a vague note.</p>
              </div>
            </div>
            <div className="fg-stack">
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.onboarding}>Open Bootstrap / Readiness</Link>
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.ingressTls}>Open Ingress / TLS / Certificates</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Open Providers</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}>Open Routing</Link>
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.health}>Open Health</Link>
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Bootstrap next steps</h3>
                <p className="fg-muted">Current bootstrap guidance is repeated here so release validation remains actionable.</p>
              </div>
            </div>
            <ul className="fg-list">
              {(bootstrap.next_steps ?? []).map((step) => <li key={step}>{step}</li>)}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
