import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchLogs, type LogsResponse } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
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
        const payload = await fetchLogs(instanceId);
        if (!mounted) {
          return;
        }
        setLogs(payload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setLogs(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Logs surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Logs & Audit Evidence"
        description="Operational signal, audit preview, retention posture, and observability checks for the active instance scope."
        question="What evidence is available for this scope, and is the logging path healthy?"
        links={[
          {
            label: "Errors",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId),
            description: "Open incident review when the logs point to current runtime failures.",
          },
          {
            label: "Health",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId),
            description: "Check runtime readiness and provider posture for degraded signal paths.",
          },
          {
            label: "Audit History",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.auditHistory, instanceId),
            description: "Review full governance event history from the same scope.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: logs?.operability.ready ? "Logging ready" : "Logging not ready", tone: logs?.operability.ready ? "success" : "warning" },
        ]}
        note="This page uses the admin logs endpoint directly and keeps audit export linked from the same evidence workflow."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="logs and audit evidence"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading logs evidence.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {logs ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Audit Preview</h3>
                <p className="fg-muted">Latest governance events available for the selected scope.</p>
              </div>
            </div>
            <ul className="fg-list">
              {logs.audit_preview.length === 0 ? <li>No audit events available.</li> : null}
              {logs.audit_preview.slice(0, 8).map((event) => (
                <li key={event.eventId}>
                  {event.createdAt} - {event.actionLabel} - {event.statusLabel} - {event.summary}
                </li>
              ))}
            </ul>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.auditHistory, instanceId)}>
              Open Audit History
            </Link>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Retention</h3>
                <p className="fg-muted">Audit availability and retention guardrails.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Event limit: {String(logs.audit_retention.eventLimit)}</li>
              <li>Retention limited: {String(logs.audit_retention.retentionLimited)}</li>
              <li>Oldest available: {stringifyValue(logs.audit_retention.oldestAvailableAt)}</li>
              <li>Latest event: {stringifyValue(logs.audit_retention.latestEventAt)}</li>
            </ul>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.auditExport, instanceId)}>
              Open Audit Export
            </Link>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Operability Checks</h3>
                <p className="fg-muted">Logging and tracing signal-path checks.</p>
              </div>
              <span className="fg-pill" data-tone={logs.operability.ready ? "success" : "warning"}>
                {logs.operability.ready ? "ready" : "review"}
              </span>
            </div>
            <ul className="fg-list">
              {logs.operability.checks.map((check, index) => (
                <li key={`${stringifyValue(check.id)}-${index}`}>
                  {stringifyValue(check.id)} - ok={stringifyValue(check.ok)} - {stringifyValue(check.details)}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Alerts & Metrics</h3>
                <p className="fg-muted">Current alert and observability summary from the logs endpoint.</p>
              </div>
            </div>
            <ul className="fg-list">
              {logs.alerts.length === 0 ? <li>No active alerts.</li> : null}
              {logs.alerts.map((alert, index) => (
                <li key={`${stringifyValue(alert.type)}-${index}`}>
                  {stringifyValue(alert.severity)} - {stringifyValue(alert.type)} - {stringifyValue(alert.message)}
                </li>
              ))}
            </ul>
            <pre>{JSON.stringify({ metrics: logs.operability.metrics, logging: logs.operability.logging, tracing: logs.operability.tracing }, null, 2)}</pre>
          </article>
        </div>
      ) : null}
    </section>
  );
}
