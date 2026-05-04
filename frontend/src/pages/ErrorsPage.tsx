/**
 * Errors & Incident Review page.
 *
 * Triage surface for incident axes sorted by severity, blocked routing
 * failures, alerts, and signal-path evidence. Raw payloads are hidden
 * behind the template-level diagnostics section.
 *
 * Uses the IncidentResponsePage template for consistent layout with
 * header, attention items, summary strip, actions, content area,
 * selected-item detail, and collapsed diagnostics.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { fetchLogs, type LogsResponse } from "../api/domain/logs";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { IncidentResponsePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import { ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge } from "../components/ui/StatusBadge";

import {
  type DetailSelection,
  type IncidentReview,
  type LoadState,
  formatMetric,
  formatTimestamp,
  isActiveIncidentAxis,
  routeLinkItems,
  severityRank,
  severityStatusKey,
  severityTone,
  stringifyValue,
  fallbackIncidentReview,
  IncidentDetailContent,
} from "../features/errors";

/**
 * Errors & Incident Review page — incident-triage surface sorted by
 * severity with grouped failure axes, blocked routing failures,
 * current effect, next action, and evidence handoff.
 */
export function ErrorsPage() {
  const navigate = useNavigate();
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
  const activeIncidentAxes = useMemo(
    () => incidentAxes.filter(isActiveIncidentAxis),
    [incidentAxes],
  );
  const healthyIncidentAxes = useMemo(
    () => incidentAxes.filter((axis) => !isActiveIncidentAxis(axis)),
    [incidentAxes],
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
    if (selection?.kind === "axis" && activeIncidentAxes.some((item) => item.incident_id === selection.id)) {
      return;
    }
    if (selection?.kind === "routing" && blockedRoutingFailures.some((item) => item.decision_id === selection.id)) {
      return;
    }
    const defaultAxis = activeIncidentAxes.find((item) => item.severity === "critical")
      ?? activeIncidentAxes.find((item) => item.severity === "warning")
      ?? activeIncidentAxes[0];
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
  }, [activeIncidentAxes, blockedRoutingFailures, incidentReview, selection]);

  const selectedAxis = selection?.kind === "axis"
    ? activeIncidentAxes.find((item) => item.incident_id === selection.id) ?? null
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

  const summaryItems = [
    {
      key: "critical",
      label: "Critical incidents",
      value: formatMetric(criticalCount),
      meta: criticalCount > 0 ? "Every critical incident includes a next step on this surface." : "No critical incident group is active.",
      tone: criticalCount > 0 ? ("danger" as const) : ("success" as const),
      status: criticalCount > 0 ? "blocked" : "ready",
    },
    {
      key: "warning",
      label: "Warning incidents",
      value: formatMetric(warningCount),
      meta: warningCount > 0 ? "Warning groups are prioritized ahead of clear or unsupported axes." : "No warning incident group is active.",
      tone: warningCount > 0 ? ("warning" as const) : ("success" as const),
      status: warningCount > 0 ? "degraded" : "ready",
    },
    {
      key: "routing",
      label: "Blocked routing failures",
      value: formatMetric(blockedRoutingFailures.length),
      meta: blockedRoutingFailures.length > 0 ? "Policy, budget, or capability failures need routing follow-up." : "No blocked routing failure is visible.",
      tone: blockedRoutingFailures.length > 0 ? ("danger" as const) : ("success" as const),
      status: blockedRoutingFailures.length > 0 ? "blocked" : "ready",
    },
    {
      key: "alerts",
      label: "Alert pressure",
      value: formatMetric(activeAlerts.length),
      meta: activeAlerts.length > 0 ? "Alerts stay evidence only. Triage stays on this route." : "No active alert is visible.",
      tone: activeAlerts.length > 0 ? ("warning" as const) : ("success" as const),
      status: activeAlerts.length > 0 ? "degraded" : "ready",
    },
    {
      key: "operability",
      label: "Failed signal checks",
      value: formatMetric(failedChecks),
      meta: failedChecks > 0 ? "Observability signal-path gaps reduce confidence in incident completeness." : "Signal-path checks are currently green.",
      tone: failedChecks > 0 ? ("warning" as const) : ("success" as const),
      status: failedChecks > 0 ? "degraded" : "ready",
    },
  ];

  const attentionItems: AttentionPayload[] = [];
  if (criticalCount > 0) {
    attentionItems.push({
      key: "critical-incidents",
      level: "primary_blocker",
      title: `${criticalCount} critical incident${criticalCount > 1 ? "s" : ""}`,
      description: "Critical incidents need immediate operator attention. Every critical incident includes a next step on this surface.",
    });
  }
  if (warningCount > 0) {
    attentionItems.push({
      key: "warning-incidents",
      level: "warning",
      title: `${warningCount} warning incident${warningCount > 1 ? "s" : ""}`,
      description: "Warning incidents are prioritized ahead of clear or unsupported axes.",
    });
  }
  if (criticalCount === 0 && warningCount === 0) {
    attentionItems.push({
      key: "all-clear",
      level: "healthy",
      title: "All incidents accounted for",
    });
  }

  const pageActions: Action[] = [
    {
      label: "Review logs evidence",
      kind: "navigation",
      intent: "navigate",
      onClick: () => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)),
    },
    {
      label: "Review runtime health",
      kind: "navigation",
      intent: "navigate",
      onClick: () => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId)),
    },
    {
      label: "Review routing policy",
      kind: "navigation",
      intent: "navigate",
      onClick: () => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)),
    },
    {
      label: "Review provider targets",
      kind: "navigation",
      intent: "navigate",
      onClick: () => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)),
    },
    {
      label: "Inspect execution failures",
      kind: "navigation",
      intent: "navigate",
      onClick: () => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId)),
    },
  ];

  return (
    <IncidentResponsePage
      eyebrow="Runtime"
      title="Errors & Incidents"
      description="Errors is the incident-triage surface for ForgeFrame: grouped failure axes, blocked routing failures, current effect, next action, and evidence handoff into Logs, Health, Routing, Provider Targets, and Execution."
      attentionItems={state === "success" && overview ? attentionItems : undefined}
      summaryItems={state === "success" && overview ? summaryItems : undefined}
      actions={state === "success" && overview ? pageActions : undefined}
      selectedItemContent={state === "success" && selection ? (
        <IncidentDetailContent
          selectedAxis={selectedAxis}
          selectedRoutingFailure={selectedRoutingFailure}
          detailTitle={detailTitle}
          detailStatus={detailStatus}
          detailTone={detailTone}
          detailStatusKey={detailStatusKey}
          detailSummary={detailSummary}
          detailEffect={detailEffect}
          detailNextStep={detailNextStep}
          detailLinks={detailLinks}
        />
      ) : undefined}
      hasSelection={state === "success" && selection !== null}
      diagnostics={state === "success" && selection ? (
        <pre>{JSON.stringify(detailRawEvidence, null, 2)}</pre>
      ) : undefined}
      diagnosticsTitle="Incident diagnostics"
    >
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
          <InstanceScopeCard
            instanceId={instanceId}
            selectedInstance={selectedInstance}
            instances={instances}
            loadState={loadState}
            error={instancesError}
            surfaceLabel="errors and incident review"
            onInstanceChange={onInstanceChange}
          />

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
                      {activeIncidentAxes.map((incident) => (
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
                {healthyIncidentAxes.length > 0 ? (
                  <details className="ff-logs-healthy-systems">
                    <summary>No current issues ({healthyIncidentAxes.length})</summary>
                    <ul className="fg-list">
                      {healthyIncidentAxes.map((incident) => (
                        <li key={incident.incident_id}>{incident.axis_label}: {incident.summary}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
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
          </div>
        </>
      ) : null}
    </IncidentResponsePage>
  );
}
