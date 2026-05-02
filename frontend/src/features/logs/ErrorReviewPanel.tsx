/**
 * Error review panel — Errors tab content.
 *
 * Shows error axes sorted by severity (critical first), blocked routing
 * failures, and error-by-type breakdown. Raw evidence is hidden behind
 * expandable sections. Each item carries a clear next action.
 *
 * @packageDocumentation
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { LogsResponse } from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { TabPanelProps } from "./types";
import { stringifyValue } from "./utils";

/** Severity tone mapping. */
const SEVERITY_TONES: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  critical: "danger",
  warning: "warning",
  clear: "success",
  unsupported: "neutral",
};

/** Severity sort rank (lower = higher priority). */
function severityRank(severity: string): number {
  return severity === "critical" ? 0
    : severity === "warning" ? 1
    : severity === "info" ? 2
    : severity === "clear" ? 3
    : 4;
}

/** Props for ErrorReviewPanel. */
export interface ErrorReviewPanelProps extends TabPanelProps {
  /** Logs API response. */
  logs: LogsResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
}

/** Expanded raw state for axis IDs. */
type ExpandedRaw = Record<string, boolean>;

/**
 * Error review panel — Errors tab.
 *
 * @param props - Component props.
 * @returns The error review panel.
 */
export function ErrorReviewPanel({ logs, loading, error, instanceId }: ErrorReviewPanelProps) {
  const [expandedRaw, setExpandedRaw] = useState<ExpandedRaw>({});

  const incidentAxes = useMemo(() => {
    if (!logs?.incident_review) {
      return [];
    }
    return [...logs.incident_review.axes].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity)
        || b.count - a.count,
    );
  }, [logs]);

  const routingFailures = useMemo(() => {
    if (!logs?.incident_review) {
      return [];
    }
    return [...logs.incident_review.blocked_routing_failures].sort(
      (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    );
  }, [logs]);

  const errorBreakdown = useMemo(() => {
    const errSummary = logs?.error_summary;
    if (!errSummary) {
      return null;
    }
    return {
      errors24h: String(errSummary.errors_24h ?? "n/a"),
      byProvider: Array.isArray(errSummary.errors_by_provider)
        ? (errSummary.errors_by_provider as Array<{ provider: string; errors: number }>)
        : [],
      byType: Array.isArray(errSummary.errors_by_type)
        ? (errSummary.errors_by_type as Array<{ error_key: string; errors: number }>)
        : [],
    };
  }, [logs]);

  if (loading) {
    return <p className="fg-muted">Loading error review data.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No error data available.</p>;
  }

  const toggleRaw = (id: string) => {
    setExpandedRaw((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section aria-label="Error review">
      {/* Axes table */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Incident triage by axis</h3>
            <p className="fg-muted">
              Sorted by severity. Critical and warning items include a recommended next step.
            </p>
          </div>
        </div>

        {incidentAxes.length === 0 ? (
          <p className="fg-muted">No incident axes available.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Incident axes">
              <thead>
                <tr>
                  <th>Axis</th>
                  <th>Severity</th>
                  <th>Count</th>
                  <th>Current effect</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {incidentAxes.map((axis) => (
                  <tr key={axis.incident_id}>
                    <td>
                      <strong>{axis.axis_label}</strong>
                      <div className="fg-muted">{axis.title}</div>
                    </td>
                    <td>
                      <span
                        className="fg-pill"
                        data-tone={SEVERITY_TONES[axis.severity] ?? "neutral"}
                      >
                        {axis.severity}
                      </span>
                    </td>
                    <td>{String(axis.count)}</td>
                    <td>{axis.current_effect}</td>
                    <td>
                      <div className="fg-stack">
                        <span>{axis.next_step}</span>
                        <div className="fg-actions">
                          {axis.links.map((link) => (
                            <Link
                              key={link.label}
                              className="fg-nav-link"
                              to={withInstanceScope(link.href, instanceId)}
                            >
                              {link.label}
                            </Link>
                          ))}
                          <button
                            type="button"
                            className="fg-nav-link"
                            onClick={() => toggleRaw(axis.incident_id)}
                          >
                            {expandedRaw[axis.incident_id] ? "Hide raw" : "Raw evidence"}
                          </button>
                        </div>
                        {expandedRaw[axis.incident_id] ? (
                          <pre className="fg-code fg-mt-sm">{JSON.stringify(axis.raw_evidence, null, 2)}</pre>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Blocked routing failures */}
      <article className="fg-card fg-mt-md">
        <div className="fg-panel-heading">
          <div>
            <h3>Blocked routing failures</h3>
            <p className="fg-muted">
              Policy, budget, circuit, and capability blockers.
            </p>
          </div>
        </div>

        {routingFailures.length === 0 ? (
          <p className="fg-muted">No blocked routing failures.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Blocked routing failures">
              <thead>
                <tr>
                  <th>Error</th>
                  <th>Reason</th>
                  <th>Policy stage</th>
                  <th>Seen</th>
                  <th>Current effect</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {routingFailures.map((failure) => (
                  <tr key={failure.decision_id}>
                    <td>
                      <strong>{failure.error_type}</strong>
                      <div className="fg-muted">{failure.summary}</div>
                    </td>
                    <td>{failure.reason_category}</td>
                    <td>{failure.policy_stage ?? "n/a"}</td>
                    <td>{stringifyValue(failure.created_at)}</td>
                    <td>{failure.current_effect}</td>
                    <td>
                      <div className="fg-stack">
                        <span>{failure.next_step}</span>
                        <div className="fg-actions">
                          {failure.links.map((link) => (
                            <Link
                              key={link.label}
                              className="fg-nav-link"
                              to={withInstanceScope(link.href, instanceId)}
                            >
                              {link.label}
                            </Link>
                          ))}
                          <button
                            type="button"
                            className="fg-nav-link"
                            onClick={() => toggleRaw(failure.decision_id)}
                          >
                            {expandedRaw[failure.decision_id] ? "Hide raw" : "Raw evidence"}
                          </button>
                        </div>
                        {expandedRaw[failure.decision_id] ? (
                          <pre className="fg-code fg-mt-sm">{JSON.stringify(failure.raw_evidence, null, 2)}</pre>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Error breakdown */}
      {errorBreakdown ? (
        <article className="fg-card fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h3>Error breakdown</h3>
              <p className="fg-muted">
                Errors in the last 24 hours grouped by provider and type.
              </p>
            </div>
          </div>
          <div className="ff-logs-error-grid">
            <div className="fg-subcard">
              <h4>24h total</h4>
              <span className="ff-logs-error-total">{errorBreakdown.errors24h}</span>
            </div>
            <div className="fg-subcard">
              <h4>By provider</h4>
              {errorBreakdown.byProvider.length === 0 ? (
                <p className="fg-muted">No provider errors.</p>
              ) : (
                <ul className="fg-list">
                  {errorBreakdown.byProvider.map((p) => (
                    <li key={p.provider}>{p.provider}: {String(p.errors)}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="fg-subcard">
              <h4>By type</h4>
              {errorBreakdown.byType.length === 0 ? (
                <p className="fg-muted">No type breakdown.</p>
              ) : (
                <ul className="fg-list">
                  {errorBreakdown.byType.map((t) => (
                    <li key={t.error_key}>{t.error_key}: {String(t.errors)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
