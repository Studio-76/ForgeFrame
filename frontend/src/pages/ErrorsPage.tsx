import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchLogs, type LogsResponse } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function ErrorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<LogsResponse | null>(null);

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
        const payload = await fetchLogs(instanceId);
        if (!mounted) {
          return;
        }
        setOverview(payload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setOverview(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Error surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const routingMetrics = asRecord(overview?.operability.metrics?.routing_metrics);
  const recentFailures = Array.isArray(routingMetrics?.recent_failures)
    ? routingMetrics.recent_failures as Array<Record<string, unknown>>
    : [];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Errors & Incident Review"
        description="Runtime failures, blocked routing outcomes, and alert pressure live here without collapsing into audit-history review."
        question="What is failing right now, and is it a runtime error, a degraded dependency, or a routing guard?"
        links={[
          {
            label: "Health",
            to: CONTROL_PLANE_ROUTES.health,
            description: "Open runtime readiness and provider health posture when the failure points to degraded dependencies.",
          },
          {
            label: "Costs",
            to: CONTROL_PLANE_ROUTES.costs,
            description: "Inspect budget or blocked cost posture when the incident stems from routing controls.",
          },
          {
            label: "Audit History",
            to: CONTROL_PLANE_ROUTES.auditHistory,
            description: "Open governance evidence when the next question is who changed or approved something.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: overview?.alerts.length ? `${overview.alerts.length} active alerts` : "No active alerts", tone: overview?.alerts.length ? "warning" : "success" },
        ]}
        note="This route does not pretend that incident review and audit export are the same job. Audit stays linked, but failure review remains separate."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="errors and incident review"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading error posture.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {overview ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Alerts</h3>
                <p className="fg-muted">Current operator attention signals for the active scope.</p>
              </div>
            </div>
            <ul className="fg-list">
              {overview.alerts.length === 0 ? <li>No active alerts.</li> : null}
              {overview.alerts.map((alert, index) => (
                <li key={`${String(alert.type)}-${index}`}>{String(alert.severity)} · {String(alert.type)} · {String(alert.message)}</li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Error Summary</h3>
                <p className="fg-muted">Runtime error counts stay separate from audit evidence.</p>
              </div>
            </div>
            <pre>{JSON.stringify(overview.error_summary, null, 2)}</pre>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Operability Checks</h3>
                <p className="fg-muted">Signal-path and tracing truth behind the current incident view.</p>
              </div>
            </div>
            <ul className="fg-list">
              {overview.operability.checks.map((check, index) => (
                <li key={`${String(check.id ?? index)}`}>{String(check.id)} · ok={String(check.ok)} · {String(check.details)}</li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Blocked Routing Failures</h3>
                <p className="fg-muted">Budget and circuit failures are surfaced here as incidents, not hidden inside the routing editor.</p>
              </div>
            </div>
            <ul className="fg-list">
              {recentFailures.length === 0 ? <li>No recent blocked routing decisions recorded.</li> : null}
              {recentFailures.map((failure) => (
                <li key={String(failure.decision_id)}>
                  {String(failure.error_type)} · {String(failure.summary)} · {String(failure.created_at)}
                </li>
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
