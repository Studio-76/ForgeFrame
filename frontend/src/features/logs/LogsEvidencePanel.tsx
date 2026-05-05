/**
 * Logs evidence panel — historical logs tab content.
 *
 * Keeps raw evidence and error breakdown separate from active incident
 * response so operators can inspect history without losing triage priority.
 *
 * @packageDocumentation
 */

import type { LogsResponse } from "../../api/domain";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { TabPanelProps } from "./types";

/** Props for LogsEvidencePanel. */
export interface LogsEvidencePanelProps extends TabPanelProps {
  /** Logs API response. */
  logs: LogsResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
}

interface ErrorBreakdown {
  /** Total errors in the last 24 hours. */
  errors24h: string;
  /** Provider grouped errors. */
  byProvider: Array<{ provider: string; errors: number }>;
  /** Error-type grouped errors. */
  byType: Array<{ error_key: string; errors: number }>;
}

/**
 * Build a safe error breakdown model from the API payload.
 * @param logs - Logs API response.
 * @returns Error breakdown or null when unavailable.
 */
function getErrorBreakdown(logs: LogsResponse | null): ErrorBreakdown | null {
  const errSummary = logs?.error_summary;
  if (!errSummary) {
    return null;
  }
  return {
    errors24h: String(errSummary.errors_24h ?? "n/a"),
    byProvider: Array.isArray(errSummary.errors_by_provider)
      ? (errSummary.errors_by_provider as Array<Record<string, unknown>>).map((entry) => ({
          provider: String(entry?.provider ?? "unknown"),
          errors: typeof entry?.errors === "number" ? entry.errors : Number(entry?.errors ?? 0),
        }))
      : [],
    byType: Array.isArray(errSummary.errors_by_type)
      ? (errSummary.errors_by_type as Array<Record<string, unknown>>).map((entry) => ({
          error_key: String(entry?.error_key ?? "unknown"),
          errors: typeof entry?.errors === "number" ? entry.errors : Number(entry?.errors ?? 0),
        }))
      : [],
  };
}

/**
 * Logs evidence tab.
 * @param props - Component props.
 * @returns Logs evidence panel.
 */
export function LogsEvidencePanel({ logs, loading, error }: LogsEvidencePanelProps) {
  if (loading) {
    return <p className="fg-muted">Loading log evidence.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No log evidence available.</p>;
  }

  const errorBreakdown = getErrorBreakdown(logs);

  return (
    <section aria-label="Logs evidence" className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Historical log evidence</h3>
            <p className="fg-muted">
              Logs are investigation evidence. Active remediation stays on the
              Incidents tab so history does not compete with current failures.
            </p>
          </div>
        </div>

        {errorBreakdown ? (
          <div className="ff-logs-error-grid">
            <div className="fg-subcard">
              <h4>Errors in the last 24 hours</h4>
              <span className="ff-logs-error-total">{errorBreakdown.errors24h}</span>
            </div>
            <div className="fg-subcard">
              <h4>Provider error groups</h4>
              {errorBreakdown.byProvider.length === 0 ? (
                <p className="fg-muted">No provider error groups recorded.</p>
              ) : (
                <ul className="fg-list">
                  {errorBreakdown.byProvider.map((provider) => (
                    <li key={provider.provider}>
                      {provider.provider}: {String(provider.errors)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="fg-subcard">
              <h4>Error type groups</h4>
              {errorBreakdown.byType.length === 0 ? (
                <p className="fg-muted">No error type groups recorded.</p>
              ) : (
                <ul className="fg-list">
                  {errorBreakdown.byType.map((typeGroup) => (
                    <li key={typeGroup.error_key}>
                      {typeGroup.error_key}: {String(typeGroup.errors)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="fg-muted">No structured error breakdown is available.</p>
        )}
      </article>

      <AdvancedDiagnostics
        title="Advanced logs payload"
        description="Raw error summary, audit preview, and retention data stay collapsed until needed for support investigation."
        status="advanced"
        statusTone="neutral"
      >
        <pre className="fg-code">{JSON.stringify({
          error_summary: logs.error_summary,
          audit_preview: logs.audit_preview,
          audit_retention: logs.audit_retention,
        }, null, 2)}</pre>
      </AdvancedDiagnostics>
    </section>
  );
}
