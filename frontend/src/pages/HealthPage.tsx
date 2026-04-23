import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchLogs,
  fetchProviderControlPlane,
  fetchRuntimeHealth,
  type LogsResponse,
  type ProviderControlPlaneResponse,
  type RuntimeHealthResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "n/a";
}

export function HealthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderControlPlaneResponse | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);

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
        const [runtimePayload, providersPayload, logsPayload] = await Promise.all([
          fetchRuntimeHealth(),
          fetchProviderControlPlane(instanceId),
          fetchLogs(instanceId),
        ]);
        if (!mounted) {
          return;
        }
        setRuntimeHealth(runtimePayload);
        setProviders(providersPayload);
        setLogs(logsPayload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setRuntimeHealth(null);
        setProviders(null);
        setLogs(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Health surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const providersNeedingReview = (providers?.providers ?? []).filter((provider) => {
    if (!provider.ready) {
      return true;
    }
    return provider.models.some((model) => model.health_status !== "healthy" || model.availability_status === "degraded");
  });

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Health & Readiness"
        description="Runtime readiness, provider health posture, and signal-path coverage stay separate from incident review and audit history."
        question="Is this instance technically healthy enough to accept traffic, and where is the real degradation?"
        links={[
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Open the live provider inventory and run posture when a specific integration is degraded.",
          },
          {
            label: "Errors",
            to: CONTROL_PLANE_ROUTES.errors,
            description: "Switch to incident review when readiness degradation is already causing failures.",
          },
          {
            label: "Onboarding",
            to: CONTROL_PLANE_ROUTES.onboarding,
            description: "Return to bootstrap and exposure posture when health gaps are structural, not transient.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: runtimeHealth?.readiness.accepting_traffic ? "Accepting traffic" : "Traffic blocked", tone: runtimeHealth?.readiness.accepting_traffic ? "success" : "danger" },
        ]}
        note="This page reads the shipped runtime `/health` payload plus provider control-plane truth. It does not invent readiness from frontend state."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="health and readiness"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading health posture.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {runtimeHealth && providers && logs ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Runtime Readiness</h3>
                <p className="fg-muted">Public runtime truth from `/health` stays visible even when readiness is degraded.</p>
              </div>
              <span className="fg-pill" data-tone={runtimeHealth.readiness.accepting_traffic ? "success" : "danger"}>
                {runtimeHealth.readiness.state}
              </span>
            </div>
            <ul className="fg-list">
              <li>Checked at: {formatTimestamp(runtimeHealth.readiness.checked_at)}</li>
              <li>Warnings: {String(runtimeHealth.readiness.warning_count)}</li>
              <li>Critical checks: {String(runtimeHealth.readiness.critical_count)}</li>
              {runtimeHealth.readiness.checks.map((check) => (
                <li key={check.id}>{check.id} · ok={String(check.ok)} · severity={check.severity}</li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Provider Health Posture</h3>
                <p className="fg-muted">Health config and live provider readiness from the control plane.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Provider health enabled: {String(providers.health_config.provider_health_enabled)}</li>
              <li>Model health enabled: {String(providers.health_config.model_health_enabled)}</li>
              <li>Probe mode: {providers.health_config.probe_mode}</li>
              <li>Interval seconds: {String(providers.health_config.interval_seconds)}</li>
              <li>Providers needing review: {String(providersNeedingReview.length)}</li>
            </ul>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>
              Open Provider Health & Runs
            </Link>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Providers Needing Review</h3>
                <p className="fg-muted">Only degraded providers are listed here.</p>
              </div>
            </div>
            <ul className="fg-list">
              {providersNeedingReview.length === 0 ? <li>No degraded providers detected.</li> : null}
              {providersNeedingReview.map((provider) => (
                <li key={provider.provider}>
                  {provider.label} · ready={String(provider.ready)} · reason={provider.readiness_reason ?? "none"} · runtime={provider.runtime_readiness}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Health Signal Path</h3>
                <p className="fg-muted">Observability checks that prove health and readiness are wired through the product.</p>
              </div>
            </div>
            <ul className="fg-list">
              {logs.operability.checks.map((check) => (
                <li key={String(check.id)}>{String(check.id)} · ok={String(check.ok)} · {String(check.details)}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
