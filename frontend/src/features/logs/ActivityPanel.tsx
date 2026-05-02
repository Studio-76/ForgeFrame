/**
 * Activity panel — Activity tab content.
 *
 * Shows audit preview events in a compact table with clear summaries
 * (what happened, severity, actor, time). Row selection opens a contextual
 * detail panel. Raw payloads are hidden by default — only visible when
 * explicitly expanded.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import type {
  AuditHistoryDetailResponse,
  LogsResponse,
} from "../../api/domain";
import { withInstanceScope } from "../../app/tenantScope";
import type { TabPanelProps } from "./types";
import { stringifyValue } from "./utils";

/** Props for ActivityPanel. */
export interface ActivityPanelProps extends TabPanelProps {
  /** Logs API response (contains audit_preview + alerts). */
  logs: LogsResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
  /** Audit event detail (when selected). */
  detail: AuditHistoryDetailResponse | null;
  /** Detail loading state. */
  detailLoading: boolean;
  /** Called when user selects an event. */
  onSelectEvent: (eventId: string) => void;
}

/**
 * Activity panel — Activity tab.
 *
 * @param props - Component props.
 * @returns The activity panel.
 */
export function ActivityPanel({
  logs,
  loading,
  error,
  detail,
  detailLoading,
  onSelectEvent,
  instanceId,
  canReadAudit,
}: ActivityPanelProps) {
  const [expandedRaw, setExpandedRaw] = useState(false);

  if (loading) {
    return <p className="fg-muted">Loading activity data.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No activity data available.</p>;
  }

  const previewEvents = logs.audit_preview ?? [];
  const alerts = logs.alerts ?? [];

  return (
    <section aria-label="Activity">
      {/* Alerts section */}
      {alerts.length > 0 ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Active alerts</h3>
              <p className="fg-muted">Current alert pressure from the logs endpoint.</p>
            </div>
          </div>
          <ul className="fg-list">
            {alerts.map((alert, index) => (
              <li key={`alert-${index}`}>
                <span className="fg-pill" data-tone="warning">{String(alert.severity ?? "info")}</span>
                {" "}
                {String(alert.type ?? "")}
                {" \u2014 "}
                {String(alert.message ?? "")}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {/* Recent events */}
      <article className="fg-card fg-mt-md">
        <div className="fg-panel-heading">
          <div>
            <h3>Recent events</h3>
            <p className="fg-muted">
              Latest governance events from the current scope. Select a row to inspect details.
            </p>
          </div>
        </div>

        {previewEvents.length === 0 ? (
          <p className="fg-muted">No audit events available.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Recent events">
              <thead>
                <tr>
                  <th>What happened</th>
                  <th>Severity</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {previewEvents.map((event) => (
                  <tr key={event.eventId}>
                    <td>
                      <strong>{event.actionLabel}</strong>
                      <div className="fg-muted">{event.summary}</div>
                    </td>
                    <td>
                      <span
                        className="fg-pill"
                        data-tone={event.status === "ok" ? "success" : event.status === "warning" ? "warning" : "danger"}
                      >
                        {event.statusLabel}
                      </span>
                    </td>
                    <td>{event.actor.label}</td>
                    <td>
                      {event.target.label}
                      <div className="fg-muted">{event.target.typeLabel}</div>
                    </td>
                    <td>{event.createdAt}</td>
                    <td>
                      <button
                        type="button"
                        className="fg-nav-link"
                        disabled={!event.detailAvailable || !canReadAudit}
                        onClick={() => onSelectEvent(event.eventId)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Detail panel (when an event is selected) */}
      {detailLoading ? (
        <p className="fg-muted fg-mt-md">Loading event detail.</p>
      ) : null}

      {detail ? (
        <article className="fg-card fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h3>{detail.event.actionLabel}</h3>
              <p className="fg-muted">{detail.summary}</p>
            </div>
            <span
              className="fg-pill"
              data-tone={detail.event.status === "ok" ? "success" : detail.event.status === "warning" ? "warning" : "danger"}
            >
              {detail.event.statusLabel}
            </span>
          </div>

          <div className="ff-logs-detail-layout">
            <div>
              <h4>Impact</h4>
              <p>{detail.outcome}</p>
              <dl className="fg-list">
                <div>
                  <dt>Actor</dt>
                  <dd>{detail.actor.label}{detail.actor.secondary ? ` \u00B7 ${detail.actor.secondary}` : ""}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{detail.target.label}{detail.target.secondary ? ` \u00B7 ${detail.target.secondary}` : ""}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{detail.event.createdAt}</dd>
                </div>
              </dl>

              {detail.changeContext.length > 0 ? (
                <>
                  <h4>Change context</h4>
                  <ul className="fg-list">
                    {detail.changeContext.map((ctx) => (
                      <li key={ctx.label}>{ctx.label}: {ctx.value}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {detail.relatedLinks.length > 0 ? (
                <>
                  <h4>Related</h4>
                  <div className="fg-actions">
                    {detail.relatedLinks.map((link) => (
                      <Link
                        key={link.label}
                        className="fg-nav-link"
                        to={withInstanceScope(link.href, instanceId)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div>
              <button
                type="button"
                className="fg-nav-link"
                onClick={() => setExpandedRaw((prev) => !prev)}
              >
                {expandedRaw ? "Hide raw payload" : "Show raw payload"}
              </button>
              {expandedRaw ? (
                <pre className="fg-code fg-mt-sm">{JSON.stringify(detail.rawMetadata, null, 2)}</pre>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
