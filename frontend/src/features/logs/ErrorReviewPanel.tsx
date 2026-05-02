/**
 * Incident review panel — Incidents tab content.
 *
 * Shows active operational issues first, collapses healthy systems, gives each
 * issue one primary remediation action, and keeps raw evidence in advanced
 * diagnostics instead of row-level noise.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { LogsResponse } from "../../api/domain";
import { withInstanceScope } from "../../app/tenantScope";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { StatusBadge, type StatusTone } from "../../components/ui/StatusBadge";
import type { TabPanelProps } from "./types";
import {
  countActiveErrors,
  formatExactTime,
  formatRelativeTime,
  getPrimaryRemediationLink,
  remediationLabel,
  stringifyValue,
} from "./utils";

type IncidentReview = NonNullable<LogsResponse["incident_review"]>;
type IncidentAxis = IncidentReview["axes"][number];
type BlockedRoutingFailure = IncidentReview["blocked_routing_failures"][number];

/** Props for ErrorReviewPanel. */
export interface ErrorReviewPanelProps extends TabPanelProps {
  /** Logs API response. */
  logs: LogsResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
}

/** Incident detail selection. */
type IncidentSelection =
  | { kind: "axis"; id: string }
  | { kind: "routing"; id: string };

/**
 * Resolve severity tone for status badges.
 * @param severity - Incident severity.
 * @returns ForgeFrame tone.
 */
function severityTone(severity: IncidentAxis["severity"]): StatusTone {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "clear") {
    return "success";
  }
  if (severity === "unsupported") {
    return "info";
  }
  return "neutral";
}

/**
 * Resolve severity sort rank.
 * @param severity - Incident severity.
 * @returns Sort rank where lower means more urgent.
 */
function severityRank(severity: IncidentAxis["severity"]): number {
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

/**
 * Determine whether an axis belongs in the active issue list.
 * @param axis - Incident axis.
 * @returns True when the axis needs operator review.
 */
function isActiveAxis(axis: IncidentAxis): boolean {
  if (axis.severity === "critical") {
    return true;
  }
  if (axis.severity === "warning") {
    return axis.count > 0;
  }
  return axis.count > 0 && axis.severity !== "clear";
}

/**
 * Sort incident axes by active severity, count, and stable label.
 * @param axes - Incident axes.
 * @returns Sorted axes.
 */
function sortIncidentAxes(axes: IncidentAxis[]): IncidentAxis[] {
  return [...axes].sort((left, right) => (
    severityRank(left.severity) - severityRank(right.severity)
    || right.count - left.count
    || left.axis_label.localeCompare(right.axis_label)
  ));
}

/**
 * Build a primary action link for a routing failure.
 * @param failure - Routing failure.
 * @returns Primary remediation link or null.
 */
function getRoutingAction(failure: BlockedRoutingFailure) {
  return getPrimaryRemediationLink(failure.links);
}

/**
 * Incident review panel — Incidents tab.
 * @param props - Component props.
 * @returns Incident review panel.
 */
export function ErrorReviewPanel({ logs, loading, error, instanceId }: ErrorReviewPanelProps) {
  const [selection, setSelection] = useState<IncidentSelection | null>(null);

  const activeAxes = useMemo(() => {
    const axes = logs?.incident_review?.axes ?? [];
    return sortIncidentAxes(axes.filter(isActiveAxis));
  }, [logs]);

  const healthyAxes = useMemo(() => {
    const axes = logs?.incident_review?.axes ?? [];
    return sortIncidentAxes(axes.filter((axis) => !isActiveAxis(axis)));
  }, [logs]);

  const routingFailures = useMemo(() => {
    const failures = logs?.incident_review?.blocked_routing_failures ?? [];
    return [...failures].sort((left, right) => (
      String(right.created_at).localeCompare(String(left.created_at))
    ));
  }, [logs]);

  useEffect(() => {
    const firstAxis = activeAxes[0];
    if (selection?.kind === "axis" && activeAxes.some((axis) => axis.incident_id === selection.id)) {
      return;
    }
    if (selection?.kind === "routing" && routingFailures.some((failure) => failure.decision_id === selection.id)) {
      return;
    }
    if (firstAxis) {
      setSelection({ kind: "axis", id: firstAxis.incident_id });
      return;
    }
    const firstRouting = routingFailures[0];
    setSelection(firstRouting ? { kind: "routing", id: firstRouting.decision_id } : null);
  }, [activeAxes, routingFailures, selection]);

  if (loading) {
    return <p className="fg-muted">Loading incident data.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No incident data available.</p>;
  }

  const selectedAxis = selection?.kind === "axis"
    ? activeAxes.find((axis) => axis.incident_id === selection.id) ?? null
    : null;
  const selectedRoutingFailure = selection?.kind === "routing"
    ? routingFailures.find((failure) => failure.decision_id === selection.id) ?? null
    : null;
  const selectedTitle = selectedAxis?.title ?? selectedRoutingFailure?.error_type ?? "Incident detail";
  const selectedSummary = selectedAxis?.summary ?? selectedRoutingFailure?.summary ?? "Select an active issue to inspect diagnostics.";
  const selectedEffect = selectedAxis?.current_effect ?? selectedRoutingFailure?.current_effect ?? "No active issue selected.";
  const selectedNextStep = selectedAxis?.next_step ?? selectedRoutingFailure?.next_step ?? "No action required.";
  const selectedRaw = selectedAxis?.raw_evidence ?? selectedRoutingFailure?.raw_evidence ?? {};
  const activeErrorCount = countActiveErrors(logs);
  const topIssue = activeAxes[0];

  return (
    <section aria-label="Incidents" className="fg-stack">
      <article className="fg-card ff-logs-remediation-panel">
        <div className="fg-panel-heading">
          <div>
            <h3>
              {activeErrorCount > 0
                ? `${activeErrorCount} active error${activeErrorCount === 1 ? "" : "s"} require operator action.`
                : "No active errors require operator action."}
            </h3>
            <p className="fg-muted">
              Critical issues with nonzero counts appear before warnings. Healthy
              systems are collapsed below the active list.
            </p>
          </div>
          {topIssue ? (
            <StatusBadge tone={severityTone(topIssue.severity)} status={topIssue.severity}>
              {topIssue.axis_label}
            </StatusBadge>
          ) : null}
        </div>

        {topIssue ? (
          <div className="ff-logs-remediation-callout">
            <div>
              <strong>Start here: {topIssue.axis_label}</strong>
              <p>{topIssue.next_step}</p>
            </div>
            {getPrimaryRemediationLink(topIssue.links) ? (
              <Link
                className="ff-primary-action"
                to={withInstanceScope(getPrimaryRemediationLink(topIssue.links)?.href ?? "", instanceId)}
              >
                {getPrimaryRemediationLink(topIssue.links)?.label}
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="fg-muted">All incident axes are currently clear or informational.</p>
        )}
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Prioritized issue list</h3>
            <p className="fg-muted">
              One primary action per issue. Use View diagnostics only when raw
              evidence is needed for investigation.
            </p>
          </div>
        </div>

        {activeAxes.length === 0 ? (
          <p className="fg-muted">No active incident axes need attention.</p>
        ) : (
          <div className="ff-issue-list" role="list">
            {activeAxes.map((axis) => {
              const primaryLink = getPrimaryRemediationLink(axis.links);
              const selected = selection?.kind === "axis" && selection.id === axis.incident_id;
              return (
                <article
                  key={axis.incident_id}
                  className="ff-issue-card"
                  data-selected={selected ? "true" : undefined}
                  role="listitem"
                >
                  <div className="ff-issue-card-main">
                    <div className="ff-logs-status-line">
                      <span className="ff-logs-status-dot" data-tone={severityTone(axis.severity)} aria-hidden="true" />
                      <strong>{axis.axis_label}</strong>
                      <StatusBadge tone={severityTone(axis.severity)} status={axis.severity}>
                        {axis.severity}
                      </StatusBadge>
                    </div>
                    <p>{axis.current_effect}</p>
                    <dl className="ff-issue-meta">
                      <div><dt>Count</dt><dd>{String(axis.count)}</dd></div>
                      <div><dt>Last seen</dt><dd title={formatExactTime(axis.last_seen_at)}>{formatRelativeTime(axis.last_seen_at)}</dd></div>
                      <div><dt>Recommended action</dt><dd>{axis.next_step}</dd></div>
                    </dl>
                  </div>
                  <div className="ff-issue-actions">
                    {primaryLink ? (
                      <Link className="ff-primary-action" to={withInstanceScope(primaryLink.href, instanceId)}>
                        {primaryLink.label}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="fg-nav-link"
                      onClick={() => setSelection({ kind: "axis", id: axis.incident_id })}
                    >
                      View diagnostics
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {healthyAxes.length > 0 ? (
          <details className="ff-logs-healthy-systems">
            <summary>No current issues ({healthyAxes.length})</summary>
            <ul className="fg-list">
              {healthyAxes.map((axis) => (
                <li key={axis.incident_id}>
                  <strong>{axis.axis_label}</strong> — {axis.summary}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </article>

      {routingFailures.length > 0 ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Blocked routing failures</h3>
              <p className="fg-muted">
                Routing blockers stay compact because policy, budget, circuit,
                and capability failures need specific follow-up.
              </p>
            </div>
          </div>
          <div className="ff-issue-list" role="list">
            {routingFailures.map((failure) => {
              const primaryLink = getRoutingAction(failure);
              return (
                <article key={failure.decision_id} className="ff-issue-card" role="listitem">
                  <div className="ff-issue-card-main">
                    <div className="ff-logs-status-line">
                      <span className="ff-logs-status-dot" data-tone="danger" aria-hidden="true" />
                      <strong>{failure.error_type}</strong>
                      <StatusBadge tone="danger" status="blocked">blocked</StatusBadge>
                    </div>
                    <p>{failure.current_effect}</p>
                    <dl className="ff-issue-meta">
                      <div><dt>Reason</dt><dd>{failure.reason_category}</dd></div>
                      <div><dt>Policy stage</dt><dd>{failure.policy_stage ?? "n/a"}</dd></div>
                      <div><dt>Seen</dt><dd title={formatExactTime(failure.created_at)}>{formatRelativeTime(failure.created_at)}</dd></div>
                    </dl>
                  </div>
                  <div className="ff-issue-actions">
                    {primaryLink ? (
                      <Link className="ff-primary-action" to={withInstanceScope(primaryLink.href, instanceId)}>
                        {primaryLink.label}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="fg-nav-link"
                      onClick={() => setSelection({ kind: "routing", id: failure.decision_id })}
                    >
                      View diagnostics
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Selected issue breakdown</h3>
            <p className="fg-muted">
              Error breakdown follows the selected incident instead of living as
              a detached card.
            </p>
          </div>
        </div>
        <div className="ff-logs-detail-layout">
          <div className="fg-subcard">
            <h4>{selectedTitle}</h4>
            <p>{selectedSummary}</p>
            <p className="fg-muted">{selectedEffect}</p>
          </div>
          <div className="fg-subcard">
            <h4>Recommended action</h4>
            <p>{selectedNextStep}</p>
          </div>
        </div>
      </article>

      <AdvancedDiagnostics
        title="Advanced diagnostics for selected issue"
        description="Raw evidence and low-level payloads remain available without competing with the remediation path."
        status="advanced"
        statusTone="neutral"
      >
        <pre className="fg-code">{JSON.stringify({
          selected_issue: selectedTitle,
          raw_evidence: selectedRaw,
          error_summary: logs.error_summary,
          alerts: logs.alerts.map((alert) => ({
            severity: stringifyValue(alert.severity),
            type: stringifyValue(alert.type),
            message: stringifyValue(alert.message),
          })),
        }, null, 2)}</pre>
      </AdvancedDiagnostics>
    </section>
  );
}
