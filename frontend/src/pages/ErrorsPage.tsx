/**
 * Errors & Incident Review page.
 *
 * Triage surface for incident axes sorted by severity, blocked routing
 * failures, alerts, and signal-path evidence. Raw payloads are hidden
 * behind expandable sections. An operational summary hero at the top
 * gives operators immediate visibility into active risk.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchLogs, type LogsResponse } from "../api/domain/logs";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { DetailPanel } from "../components/ui/DetailPanel";
import { ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type IncidentReview = NonNullable<LogsResponse["incident_review"]>;
type IncidentAxisRow = IncidentReview["axes"][number];
type BlockedRoutingFailureRow = IncidentReview["blocked_routing_failures"][number];
type DetailSelection =
  | { kind: "axis"; id: string }
  | { kind: "routing"; id: string };

const AXIS_ORDER: IncidentAxisRow["axis"][] = [
  "runtime",
  "provider",
  "oauth",
  "routing",
  "queue_dispatch",
  "security",
  "tls",
  "work_interaction",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatMetric(value: unknown): string {
  return numberValue(value).toLocaleString();
}

function formatTimestamp(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "No recent evidence";
}

function severityTone(severity: IncidentAxisRow["severity"]): StatusTone {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "unsupported") {
    return "info";
  }
  if (severity === "clear") {
    return "success";
  }
  return "neutral";
}

function severityStatusKey(severity: IncidentAxisRow["severity"]): string {
  if (severity === "critical") {
    return "blocked";
  }
  if (severity === "warning") {
    return "degraded";
  }
  if (severity === "unsupported") {
    return "unsupported";
  }
  if (severity === "clear") {
    return "ready";
  }
  return "partial";
}

function severityRank(severity: IncidentAxisRow["severity"]): number {
  if (severity === "critical") {
    return 0;
  }
  if (severity === "warning") {
    return 1;
  }
  if (severity === "info") {
    return 2;
  }
  if (severity === "clear") {
    return 3;
  }
  return 4;
}

function fallbackIncidentReview(logs: LogsResponse): IncidentReview {
  const routingMetrics = asRecord(logs.operability.metrics?.routing_metrics);
  const recentFailures = Array.isArray(routingMetrics?.recent_failures)
    ? routingMetrics.recent_failures as Array<Record<string, unknown>>
    : [];
  const runtimeErrorCount = numberValue(logs.error_summary.errors_24h);

  const axes: IncidentAxisRow[] = AXIS_ORDER.map((axis) => {
    if (axis === "runtime") {
      return {
        incident_id: "runtime:fallback",
        axis,
        axis_label: "Runtime",
        title: "Runtime execution failures",
        severity: runtimeErrorCount > 0 ? "warning" : "clear",
        count: runtimeErrorCount,
        first_seen_at: null,
        last_seen_at: null,
        current_effect: runtimeErrorCount > 0 ? "Runtime errors are present, but this backend has not yet provided structured incident grouping." : "No runtime error evidence is visible.",
        next_step: runtimeErrorCount > 0 ? "Open Logs or Execution Review." : "Monitor only.",
        summary: runtimeErrorCount > 0 ? "Fallback incident grouping is active because the backend incident review payload is missing." : "No runtime incident is visible.",
        links: [
          { label: "Open Logs", href: "/logs" },
          { label: "Open Execution Review", href: "/execution" },
        ],
        raw_evidence: {
          error_summary: logs.error_summary,
        },
      };
    }

    if (axis === "routing") {
      return {
        incident_id: "routing:fallback",
        axis,
        axis_label: "Routing",
        title: "Routing and policy failures",
        severity: recentFailures.length > 0 ? "warning" : "clear",
        count: recentFailures.length,
        first_seen_at: recentFailures.at(-1)?.created_at as string | null ?? null,
        last_seen_at: recentFailures[0]?.created_at as string | null ?? null,
        current_effect: recentFailures.length > 0 ? "Blocked routing decisions are visible, but only fallback incident grouping is available." : "No blocked routing failure is visible.",
        next_step: recentFailures.length > 0 ? "Open Routing." : "Monitor only.",
        summary: recentFailures.length > 0 ? "Fallback incident grouping is active because the backend incident review payload is missing." : "No routing incident is visible.",
        links: [
          { label: "Open Routing", href: "/routing" },
        ],
        raw_evidence: {
          recent_failures: recentFailures,
        },
      };
    }

    return {
      incident_id: `${axis}:unsupported`,
      axis,
      axis_label: axis === "queue_dispatch" ? "Queue / Dispatch" : axis.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()),
      title: `${axis.replace(/_/g, " ")} incident review`,
      severity: "unsupported",
      count: 0,
      first_seen_at: null,
      last_seen_at: null,
      current_effect: "The backend has not provided structured incident grouping for this axis on the errors surface.",
      next_step: "Open Logs for raw evidence or the linked product route for follow-up.",
      summary: "Structured incident review is unavailable on this axis without backend support.",
      links: [{ label: "Open Logs", href: "/logs" }],
      raw_evidence: { supported: false },
    };
  });

  return {
    axes,
    blocked_routing_failures: recentFailures.map((failure) => ({
      decision_id: String(failure.decision_id ?? ""),
      error_type: String(failure.error_type ?? "routing_failure"),
      summary: String(failure.summary ?? ""),
      policy_stage: failure.policy_stage ? String(failure.policy_stage) : null,
      created_at: String(failure.created_at ?? ""),
      reason_category: "policy",
      current_effect: "Routing selected no admissible target and blocked the request.",
      next_step: "Open Routing to inspect budget, policy, or capability posture.",
      links: [{ label: "Open Routing", href: "/routing" }],
      raw_evidence: failure,
    })),
  };
}

function routeLinkItems(
  links: Array<{ label: string; href: string }>,
  instanceId: string | null,
) {
  return links.map((link) => ({
    ...link,
    to: withInstanceScope(link.href, instanceId),
  }));
}

export function ErrorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [overview, setOverview] = useState<LogsResponse | null>(null);
  const [selection, setSelection] = useState<DetailSelection | null>(null);

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
      setFetchError(null);
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
        setFetchError(loadError instanceof Error ? loadError.message : "Error surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const incidentReview = useMemo<IncidentReview | null>(() => {
    if (!overview) {
      return null;
    }
    return overview.incident_review ?? fallbackIncidentReview(overview);
  }, [overview]);

  const incidentAxes = useMemo(
    () => (incidentReview?.axes ?? []).slice().sort((left, right) => (
      severityRank(left.severity) - severityRank(right.severity)
      || right.count - left.count
      || left.axis.localeCompare(right.axis)
    )),
    [incidentReview],
  );
  const blockedRoutingFailures = useMemo(
    () => (incidentReview?.blocked_routing_failures ?? []).slice().sort((left, right) => (
      right.created_at.localeCompare(left.created_at)
    )),
    [incidentReview],
  );
  const criticalCount = incidentAxes.filter((item) => item.severity === "critical").length;
  const warningCount = incidentAxes.filter((item) => item.severity === "warning").length;
  const failedChecks = (overview?.operability.checks ?? []).filter((check) => !Boolean(check.ok)).length;
  const activeAlerts = overview?.alerts ?? [];

  useEffect(() => {
    if (!incidentReview) {
      setSelection(null);
      return;
    }
    if (selection?.kind === "axis" && incidentAxes.some((item) => item.incident_id === selection.id)) {
      return;
    }
    if (selection?.kind === "routing" && blockedRoutingFailures.some((item) => item.decision_id === selection.id)) {
      return;
    }
    const defaultAxis = incidentAxes.find((item) => item.severity === "critical")
      ?? incidentAxes.find((item) => item.severity === "warning")
      ?? incidentAxes[0];
    if (defaultAxis) {
      setSelection({ kind: "axis", id: defaultAxis.incident_id });
      return;
    }
    const defaultRouting = blockedRoutingFailures[0];
    if (defaultRouting) {
      setSelection({ kind: "routing", id: defaultRouting.decision_id });
      return;
    }
    setSelection(null);
  }, [blockedRoutingFailures, incidentAxes, incidentReview, selection]);

  const selectedAxis = selection?.kind === "axis"
    ? incidentAxes.find((item) => item.incident_id === selection.id) ?? null
    : null;
  const selectedRoutingFailure = selection?.kind === "routing"
    ? blockedRoutingFailures.find((item) => item.decision_id === selection.id) ?? null
    : null;

  const detailTitle = selectedAxis?.title ?? selectedRoutingFailure?.error_type ?? "Incident detail";
  const detailStatus = selectedAxis?.severity ?? (selectedRoutingFailure ? "blocked" : "warning");
  const detailTone = selectedAxis ? severityTone(selectedAxis.severity) : (selectedRoutingFailure ? "danger" : "warning");
  const detailStatusKey = selectedAxis ? severityStatusKey(selectedAxis.severity) : (selectedRoutingFailure ? "blocked" : "degraded");
  const detailSummary = selectedAxis?.summary ?? selectedRoutingFailure?.summary ?? "Select an incident group or blocked routing failure to inspect its interpretation and raw evidence.";
  const detailEffect = selectedAxis?.current_effect ?? selectedRoutingFailure?.current_effect ?? "No incident selected.";
  const detailNextStep = selectedAxis?.next_step ?? selectedRoutingFailure?.next_step ?? "No action yet.";
  const detailLinks = selectedAxis
    ? routeLinkItems(selectedAxis.links, instanceId)
    : selectedRoutingFailure
      ? routeLinkItems(selectedRoutingFailure.links, instanceId)
      : [];
  const detailRawEvidence = selectedAxis?.raw_evidence ?? selectedRoutingFailure?.raw_evidence ?? {};

  const summaryItems: SummaryStripItem[] = [
    {
      key: "critical",
      label: "Critical incidents",
      value: formatMetric(criticalCount),
      meta: criticalCount > 0 ? "Every critical incident includes a next step on this surface." : "No critical incident group is active.",
      tone: criticalCount > 0 ? "danger" : "success",
      status: criticalCount > 0 ? "blocked" : "ready",
    },
    {
      key: "warning",
      label: "Warning incidents",
      value: formatMetric(warningCount),
      meta: warningCount > 0 ? "Warning groups are prioritized ahead of clear or unsupported axes." : "No warning incident group is active.",
      tone: warningCount > 0 ? "warning" : "success",
      status: warningCount > 0 ? "degraded" : "ready",
    },
    {
      key: "routing",
      label: "Blocked routing failures",
      value: formatMetric(blockedRoutingFailures.length),
      meta: blockedRoutingFailures.length > 0 ? "Policy, budget, or capability failures need routing follow-up." : "No blocked routing failure is visible.",
      tone: blockedRoutingFailures.length > 0 ? "danger" : "success",
      status: blockedRoutingFailures.length > 0 ? "blocked" : "ready",
    },
    {
      key: "alerts",
      label: "Alert pressure",
      value: formatMetric(activeAlerts.length),
      meta: activeAlerts.length > 0 ? "Alerts stay evidence only. Triage stays on this route." : "No active alert is visible.",
      tone: activeAlerts.length > 0 ? "warning" : "success",
      status: activeAlerts.length > 0 ? "degraded" : "ready",
    },
    {
      key: "operability",
      label: "Failed signal checks",
      value: formatMetric(failedChecks),
      meta: failedChecks > 0 ? "Observability signal-path gaps reduce confidence in incident completeness." : "Signal-path checks are currently green.",
      tone: failedChecks > 0 ? "warning" : "success",
      status: failedChecks > 0 ? "degraded" : "ready",
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Errors & Incident Review"
        description="Errors is the incident-triage surface for ForgeFrame: grouped failure axes, blocked routing failures, current effect, next action, and evidence handoff into Logs, Health, Routing, Provider Targets, and Execution."
        question="Which incident shape matters first, what is it impacting right now, and where is the next real operator action?"
        links={[
          {
            label: "Logs",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Open raw evidence and audit context after triage decides which signal matters.",
          },
          {
            label: "Health",
            to: CONTROL_PLANE_ROUTES.health,
            description: "Open runtime readiness and dependency truth when the incident points at degraded providers or ingress.",
          },
          {
            label: "Routing",
            to: CONTROL_PLANE_ROUTES.routing,
            description: "Inspect policy, budget, and blocked candidates when routing is the active failure plane.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: criticalCount > 0 ? `${criticalCount} critical incidents` : "No critical incidents", tone: criticalCount > 0 ? "danger" : "success" },
          { label: blockedRoutingFailures.length > 0 ? `${blockedRoutingFailures.length} blocked routes` : "No blocked routes", tone: blockedRoutingFailures.length > 0 ? "warning" : "success" },
        ]}
        note="Logs stays the raw evidence surface. Errors stays the prioritized triage and incident-review surface."
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

      <ActionBar
        title="Incident handoffs"
        description="Use this route to prioritize incident axes first, then branch into the specialist route that can actually change runtime, routing, or target posture."
        actions={(
          <div className="fg-actions">
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>Logs</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId)}>Health</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}>Routing</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId)}>Execution Review</Link>
          </div>
        )}
      >
        <p className="fg-muted">
          Critical incidents are sorted ahead of warning, clear, and unsupported axes. Every critical incident carries a concrete next step instead of dumping raw logs first.
        </p>
      </ActionBar>

      {state === "loading" ? (
        <LoadingState
          title="Loading incident review"
          description="ForgeFrame is restoring alert pressure, grouped incident axes, blocked routing failures, and the signal-path evidence behind them."
        />
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Error surface loading failed"
          description={fetchError ?? "Incident review could not be loaded."}
        />
      ) : null}

      {overview && incidentReview ? (
        <>
          <SummaryStrip items={summaryItems} />

          <div className="ff-operator-layout">
            <div className="ff-operator-main">
              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Incident triage by axis</h3>
                    <p className="fg-muted">Each axis carries severity, incident count, first/last seen, current effect, next step, and direct route handoff. Unsupported axes stay explicit instead of pretending to be green.</p>
                  </div>
                </div>

                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label="Incident triage by axis">
                    <thead>
                      <tr>
                        <th>Axis</th>
                        <th>Severity</th>
                        <th>Count</th>
                        <th>First seen</th>
                        <th>Last seen</th>
                        <th>Current effect</th>
                        <th>Next step</th>
                        <th>Links</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentAxes.map((incident) => (
                        <tr key={incident.incident_id}>
                          <td>
                            <div className="fg-stack">
                              <strong>{incident.axis_label}</strong>
                              <span className="fg-muted">{incident.title}</span>
                            </div>
                          </td>
                          <td>
                            <StatusBadge tone={severityTone(incident.severity)} status={severityStatusKey(incident.severity)}>
                              {incident.severity}
                            </StatusBadge>
                          </td>
                          <td>{formatMetric(incident.count)}</td>
                          <td>{formatTimestamp(incident.first_seen_at)}</td>
                          <td>{formatTimestamp(incident.last_seen_at)}</td>
                          <td>{incident.current_effect}</td>
                          <td>{incident.next_step}</td>
                          <td>
                            <div className="fg-actions">
                              {routeLinkItems(incident.links, instanceId).map((link) => (
                                <Link key={`${incident.incident_id}-${link.label}`} className="fg-nav-link" to={link.to}>
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button type="button" onClick={() => setSelection({ kind: "axis", id: incident.incident_id })}>
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Blocked routing failures</h3>
                    <p className="fg-muted">Routing failures stay separated because policy, budget, circuit, and capability blockers need different follow-up routes.</p>
                  </div>
                </div>

                {blockedRoutingFailures.length === 0 ? (
                  <p className="fg-muted">No blocked routing failure is visible in the current incident window.</p>
                ) : (
                  <div className="fg-table-wrap">
                    <table className="fg-table" aria-label="Blocked routing failures">
                      <thead>
                        <tr>
                          <th>Error type</th>
                          <th>Reason</th>
                          <th>Policy stage</th>
                          <th>Seen</th>
                          <th>Current effect</th>
                          <th>Next step</th>
                          <th>Links</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blockedRoutingFailures.map((failure) => (
                          <tr key={failure.decision_id}>
                            <td>
                              <div className="fg-stack">
                                <strong>{failure.error_type}</strong>
                                <span className="fg-muted">{failure.summary}</span>
                              </div>
                            </td>
                            <td>{failure.reason_category}</td>
                            <td>{failure.policy_stage ?? "n/a"}</td>
                            <td>{formatTimestamp(failure.created_at)}</td>
                            <td>{failure.current_effect}</td>
                            <td>{failure.next_step}</td>
                            <td>
                              <div className="fg-actions">
                                {routeLinkItems(failure.links, instanceId).map((link) => (
                                  <Link key={`${failure.decision_id}-${link.label}`} className="fg-nav-link" to={link.to}>
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            </td>
                            <td>
                              <button type="button" onClick={() => setSelection({ kind: "routing", id: failure.decision_id })}>
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Alerts and signal-path evidence</h3>
                    <p className="fg-muted">Alerts stay evidence only. Operability checks tell you whether the incident view is being fed by healthy signal paths.</p>
                  </div>
                </div>

                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <h4>Alerts</h4>
                    <ul className="fg-list">
                      {activeAlerts.length === 0 ? <li>No active alert is visible.</li> : null}
                      {activeAlerts.map((alert, index) => (
                        <li key={`${stringifyValue(alert.type)}-${index}`}>
                          {stringifyValue(alert.severity)} &middot; {stringifyValue(alert.type)} &middot; {stringifyValue(alert.message)}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="fg-subcard">
                    <h4>Operability checks</h4>
                    <ul className="fg-list">
                      {(overview.operability.checks ?? []).map((check, index) => (
                        <li key={`${stringifyValue(check.id)}-${index}`}>
                          {stringifyValue(check.id)} &middot; ok={stringifyValue(check.ok)} &middot; {stringifyValue(check.details)}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="fg-actions">
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
                    Open Raw Logs Evidence
                  </Link>
                </div>
              </article>
            </div>

            <DetailPanel
              title={detailTitle}
              description="Short interpretation stays above raw evidence so this route remains triage-first instead of turning into an undifferentiated log dump."
              status={detailStatus}
              statusTone={detailTone}
              statusKey={detailStatusKey}
              sticky
              actions={(
                <div className="fg-actions">
                  {detailLinks.map((link) => (
                    <Link key={`${detailTitle}-${link.label}`} className="fg-nav-link" to={link.to}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Interpretation</h4>
                  <p>{detailSummary}</p>
                  <p className="fg-muted">{detailEffect}</p>
                </section>

                <section className="fg-subcard">
                  <h4>Next step</h4>
                  <p>{detailNextStep}</p>
                </section>

                <section className="fg-subcard">
                  <h4>Raw evidence</h4>
                  <pre>{JSON.stringify(detailRawEvidence, null, 2)}</pre>
                </section>
              </div>
            </DetailPanel>
          </div>
        </>
      ) : null}
    </section>
  );
}
