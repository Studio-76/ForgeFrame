/**
 * Diagnostics panel — Diagnostics tab content.
 *
 * Shows operability checks, signal-path health, metrics, and raw
 * observability data. All raw/technical data is hidden behind
 * expandable sections by default so the initial view is clean and
 * actionable. Only expand when troubleshooting requires it.
 *
 * @packageDocumentation
 */

import { useState } from "react";

import type { LogsResponse } from "../../api/domain";
import type { TabPanelProps } from "./types";
import { stringifyValue } from "./utils";

/** Props for DiagnosticsPanel. */
export interface DiagnosticsPanelProps extends TabPanelProps {
  /** Logs API response. */
  logs: LogsResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
}

/**
 * Diagnostics panel — Diagnostics tab.
 *
 * @param props - Component props.
 * @returns The diagnostics panel.
 */
export function DiagnosticsPanel({ logs, loading, error }: DiagnosticsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return <p className="fg-muted">Loading diagnostics data.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No diagnostics data available.</p>;
  }

  const operability = logs.operability;
  const SECTION_KEYS = {
    checks: "checks",
    metrics: "metrics",
    logging: "logging",
    tracing: "tracing",
  };

  return (
    <section aria-label="Diagnostics">
      {/* Signal health summary */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Signal health</h3>
            <p className="fg-muted">
              Observability signal-path checks for logging and tracing.
            </p>
          </div>
          <span
            className="fg-pill"
            data-tone={operability.ready ? "success" : "warning"}
          >
            {operability.ready ? "Ready" : "Review"}
          </span>
        </div>
      </article>

      {/* Operability checks */}
      <article className="fg-card fg-mt-md">
        <div className="fg-panel-heading">
          <div>
            <h3>Operability checks</h3>
            <p className="fg-muted">
              {operability.checks.length} check{operability.checks.length === 1 ? "" : "s"} available.
            </p>
          </div>
          <button
            type="button"
            className="fg-nav-link"
            onClick={() => toggleSection(SECTION_KEYS.checks)}
          >
            {expandedSections[SECTION_KEYS.checks] ? "Hide checks" : "Show checks"}
          </button>
        </div>

        {expandedSections[SECTION_KEYS.checks] ? (
          <ul className="fg-list">
            {operability.checks.length === 0 ? (
              <li className="fg-muted">No checks recorded.</li>
            ) : (
              operability.checks.map((check, index) => (
                <li key={`${stringifyValue(check.id)}-${index}`}>
                  {stringifyValue(check.id)}
                  {" \u2014 "}
                  ok={String(Boolean(check.ok))}
                  {" \u2014 "}
                  {stringifyValue(check.details)}
                </li>
              ))
            )}
          </ul>
        ) : (
          <p className="fg-muted">
            {operability.checks.filter((c) => Boolean(c.ok)).length} of {operability.checks.length} checks passing.
          </p>
        )}
      </article>

      {/* Metrics (collapsible) */}
      <article className="fg-card fg-mt-md">
        <div className="fg-panel-heading">
          <div>
            <h3>Telemetry metrics</h3>
            <p className="fg-muted">
              Runtime metrics, logging, and tracing data.
            </p>
          </div>
          <button
            type="button"
            className="fg-nav-link"
            onClick={() => toggleSection(SECTION_KEYS.metrics)}
          >
            {expandedSections[SECTION_KEYS.metrics] ? "Hide metrics" : "Show metrics"}
          </button>
        </div>

        {expandedSections[SECTION_KEYS.metrics] ? (
          <div className="ff-logs-detail-layout">
            <div className="fg-subcard">
              <h4>Metrics</h4>
              <pre className="fg-code">{JSON.stringify(operability.metrics, null, 2)}</pre>
            </div>
            <div className="fg-subcard">
              <h4>Logging</h4>
              <pre className="fg-code">{JSON.stringify(operability.logging, null, 2)}</pre>
            </div>
            <div className="fg-subcard">
              <h4>Tracing</h4>
              <pre className="fg-code">{JSON.stringify(operability.tracing, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <p className="fg-muted">
            Telemetry data hidden. Click &ldquo;Show metrics&rdquo; to inspect.
          </p>
        )}
      </article>

      {/* Alerts */}
      {logs.alerts.length > 0 ? (
        <article className="fg-card fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h3>Active alerts</h3>
              <p className="fg-muted">
                {logs.alerts.length} alert{logs.alerts.length === 1 ? "" : "s"} current.
              </p>
            </div>
          </div>
          <ul className="fg-list">
            {logs.alerts.map((alert, index) => (
              <li key={`alert-${index}`}>
                <span className="fg-pill" data-tone="warning">
                  {stringifyValue(alert.severity)}
                </span>
                {" "}
                {stringifyValue(alert.type)}
                {" \u2014 "}
                {stringifyValue(alert.message)}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <article className="fg-card fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h3>Alerts</h3>
              <p className="fg-muted">No active alerts.</p>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
