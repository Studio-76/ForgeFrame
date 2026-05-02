/**
 * Diagnostics panel — actionable observability checks.
 *
 * Surfaces failing checks first, explains signal-health review states, and
 * keeps raw telemetry payloads in advanced sections.
 *
 * @packageDocumentation
 */

import type { LogsResponse } from "../../api/domain";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { StatusBadge } from "../../components/ui/StatusBadge";
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

type OperabilityCheck = LogsResponse["operability"]["checks"][number];

/**
 * Read a string field from an operability check.
 * @param check - Operability check.
 * @param key - Field key.
 * @returns String value.
 */
function checkField(check: OperabilityCheck, key: string): string {
  return stringifyValue(check[key]);
}

/**
 * Determine whether a check passed.
 * @param check - Operability check.
 * @returns True when the check reports ok.
 */
function checkPassed(check: OperabilityCheck): boolean {
  return Boolean(check.ok);
}

/**
 * Detect whether telemetry payloads are missing.
 * @param value - Telemetry object.
 * @returns True when the object has no keys.
 */
function telemetryMissing(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

/**
 * Diagnostics panel — Diagnostics tab.
 * @param props - Component props.
 * @returns Diagnostics panel.
 */
export function DiagnosticsPanel({ logs, loading, error }: DiagnosticsPanelProps) {
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
  const failingChecks = operability.checks.filter((check) => !checkPassed(check));
  const passingChecks = operability.checks.filter(checkPassed);
  const missingTelemetry = [
    telemetryMissing(operability.metrics) ? "metrics" : null,
    telemetryMissing(operability.logging) ? "logging" : null,
    telemetryMissing(operability.tracing) ? "tracing" : null,
  ].filter((item): item is string => Boolean(item));
  const signalNeedsReview = !operability.ready || failingChecks.length > 0 || missingTelemetry.length > 0;
  const recommendedAction = failingChecks.length > 0
    ? "Review failing checks first. They explain why signal health needs attention."
    : missingTelemetry.length > 0
      ? `Inspect telemetry metrics because ${missingTelemetry.join(", ")} data is missing.`
      : "No diagnostic repair is required. Keep metrics collapsed unless investigating an incident.";

  return (
    <section aria-label="Diagnostics" className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Diagnostics summary</h3>
            <p className="fg-muted">
              Signal health is marked Review when checks fail, telemetry is
              missing, or the backend reports the observability path is not ready.
            </p>
          </div>
          <StatusBadge tone={signalNeedsReview ? "warning" : "success"}>
            {signalNeedsReview ? "Review signal health issue" : "Ready"}
          </StatusBadge>
        </div>
        <dl className="ff-logs-incident-fields">
          <div><dt>Signal health state</dt><dd>{signalNeedsReview ? "Review" : "Ready"}</dd></div>
          <div><dt>Passing checks</dt><dd>{String(passingChecks.length)}</dd></div>
          <div><dt>Failing checks</dt><dd>{String(failingChecks.length)}</dd></div>
          <div><dt>Missing telemetry</dt><dd>{missingTelemetry.length > 0 ? missingTelemetry.join(", ") : "None"}</dd></div>
          <div><dt>Last check time</dt><dd>Current response</dd></div>
        </dl>
        <div className="ff-logs-remediation-callout">
          <div>
            <strong>Recommended action</strong>
            <p>{recommendedAction}</p>
          </div>
          <a className="ff-primary-action" href="#diagnostic-checks">
            {failingChecks.length > 0 ? "Review failing checks" : "Inspect telemetry metrics"}
          </a>
        </div>
      </article>

      <article className="fg-card" id="diagnostic-checks">
        <div className="fg-panel-heading">
          <div>
            <h3>Failed or suspicious checks</h3>
            <p className="fg-muted">
              Failed checks are shown by default; passing checks are collapsed.
            </p>
          </div>
        </div>

        {failingChecks.length === 0 ? (
          <article className="fg-subcard">
            <h4>No failing checks</h4>
            <p className="fg-muted">Operability checks are passing in the current response.</p>
          </article>
        ) : (
          <div className="ff-issue-list" role="list">
            {failingChecks.map((check, index) => (
              <article key={`${checkField(check, "id")}-${index}`} className="ff-issue-card" role="listitem">
                <div className="ff-issue-card-main">
                  <div className="ff-logs-status-line">
                    <span className="ff-logs-status-dot" data-tone="warning" aria-hidden="true" />
                    <strong>{checkField(check, "id")}</strong>
                    <StatusBadge tone="warning">review</StatusBadge>
                  </div>
                  <p>{checkField(check, "details")}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        <details className="ff-logs-healthy-systems">
          <summary>Passing checks ({passingChecks.length})</summary>
          <ul className="fg-list">
            {passingChecks.length === 0 ? <li>No passing checks recorded.</li> : null}
            {passingChecks.map((check, index) => (
              <li key={`${checkField(check, "id")}-${index}`}>
                {checkField(check, "id")} — {checkField(check, "details")}
              </li>
            ))}
          </ul>
        </details>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Alerts</h3>
            <p className="fg-muted">
              {logs.alerts.length > 0
                ? `${logs.alerts.length} active alert${logs.alerts.length === 1 ? "" : "s"} may affect signal interpretation.`
                : "No active alerts. Alert state is healthy."}
            </p>
          </div>
          <StatusBadge tone={logs.alerts.length > 0 ? "warning" : "success"}>
            {logs.alerts.length > 0 ? "active" : "healthy"}
          </StatusBadge>
        </div>
        {logs.alerts.length > 0 ? (
          <ul className="fg-list">
            {logs.alerts.map((alert, index) => (
              <li key={`alert-${index}`}>
                {stringifyValue(alert.severity)} · {stringifyValue(alert.type)} · {stringifyValue(alert.message)}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <AdvancedDiagnostics
        title="Advanced telemetry payloads"
        description={missingTelemetry.length > 0
          ? `Telemetry payloads are missing for ${missingTelemetry.join(", ")}.`
          : "Telemetry payloads are present and collapsed until an investigation needs them."}
        status="advanced"
        statusTone={missingTelemetry.length > 0 ? "warning" : "neutral"}
      >
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
      </AdvancedDiagnostics>
    </section>
  );
}
