/**
 * Activity panel — grouped activity timeline.
 *
 * Replaces a raw event table with investigation filters, grouped repeated
 * events, relative timestamps, and a single contextual detail panel.
 *
 * @packageDocumentation
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type {
  AuditHistoryDetailResponse,
  LogsResponse,
} from "../../api/domain";
import { withInstanceScope } from "../../app/tenantScope";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { AuditHistoryRow, TabPanelProps } from "./types";
import {
  auditStatusTone,
  formatExactTime,
  formatRelativeTime,
  groupEventRows,
  isRoutineSessionEvent,
  stringifyValue,
} from "./utils";

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

type ActivityFilter = "all" | "attention" | "admin" | "runtime" | "failed" | "24h" | "7d";

const FILTERS: Array<{ key: ActivityFilter; label: string }> = [
  { key: "all", label: "All visible" },
  { key: "attention", label: "Needs attention" },
  { key: "admin", label: "Admin activity" },
  { key: "runtime", label: "Runtime activity" },
  { key: "failed", label: "Failed events" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
];

/**
 * Check whether an event is within a relative day window.
 * @param row - Audit row.
 * @param days - Day window.
 * @returns True when the row timestamp is inside the window.
 */
function isWithinDays(row: AuditHistoryRow, days: number): boolean {
  const timestamp = Date.parse(row.createdAt);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

/**
 * Apply the selected activity investigation filter.
 * @param rows - Audit preview rows.
 * @param filter - Selected filter.
 * @returns Filtered rows.
 */
function filterActivityRows(rows: AuditHistoryRow[], filter: ActivityFilter): AuditHistoryRow[] {
  if (filter === "attention") {
    return rows.filter((row) => row.status !== "ok");
  }
  if (filter === "admin") {
    return rows.filter((row) => row.actor.type.includes("admin") || row.actionKey.includes("admin"));
  }
  if (filter === "runtime") {
    return rows.filter((row) => row.actionKey.includes("runtime") || row.target.type.includes("runtime"));
  }
  if (filter === "failed") {
    return rows.filter((row) => row.status === "failed");
  }
  if (filter === "24h") {
    return rows.filter((row) => isWithinDays(row, 1));
  }
  if (filter === "7d") {
    return rows.filter((row) => isWithinDays(row, 7));
  }
  return rows;
}

/**
 * Find the most common action label.
 * @param rows - Audit rows.
 * @returns Most common action label.
 */
function mostCommonAction(rows: AuditHistoryRow[]): string {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.actionLabel, (counts.get(row.actionLabel) ?? 0) + 1));
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "n/a";
}

/**
 * Activity panel — Activity tab.
 * @param props - Component props.
 * @returns Activity panel.
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
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const previewEvents = useMemo(() => logs?.audit_preview ?? [], [logs]);
  const visibleRows = useMemo(
    () => filterActivityRows(previewEvents, filter),
    [filter, previewEvents],
  );
  const attentionRows = visibleRows.filter((row) => row.status !== "ok");
  const routineRows = visibleRows.filter(isRoutineSessionEvent);
  const investigationRows = visibleRows.filter((row) => !isRoutineSessionEvent(row));
  const eventGroups = groupEventRows(investigationRows);
  const routineGroups = groupEventRows(routineRows);
  const alerts = logs?.alerts ?? [];

  if (loading) {
    return <p className="fg-muted">Loading activity data.</p>;
  }

  if (error) {
    return <p className="fg-danger">{error}</p>;
  }

  if (!logs) {
    return <p className="fg-muted">No activity data available.</p>;
  }

  return (
    <section aria-label="Activity" className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Activity summary</h3>
            <p className="fg-muted">
              Routine successful sessions are grouped below so investigation
              starts with events that changed state or need review.
            </p>
          </div>
          <StatusBadge tone={attentionRows.length > 0 ? "warning" : "success"}>
            {attentionRows.length > 0 ? "attention" : "routine"}
          </StatusBadge>
        </div>
        <div className="ff-logs-status-strip">
          <article className="ff-logs-hero-card" data-tone="neutral">
            <span className="ff-logs-hero-label">Total recent events</span>
            <span className="ff-logs-hero-value">{String(visibleRows.length)}</span>
            <span className="ff-logs-hero-meta">Visible after the current filter.</span>
          </article>
          <article className="ff-logs-hero-card" data-tone="neutral">
            <span className="ff-logs-hero-label">Most common event type</span>
            <span className="ff-logs-hero-value ff-logs-hero-value-small">{mostCommonAction(visibleRows)}</span>
            <span className="ff-logs-hero-meta">Grouped by action label.</span>
          </article>
          <article className="ff-logs-hero-card" data-tone="neutral">
            <span className="ff-logs-hero-label">Last event</span>
            <span className="ff-logs-hero-value ff-logs-hero-value-small" title={formatExactTime(visibleRows[0]?.createdAt)}>
              {formatRelativeTime(visibleRows[0]?.createdAt)}
            </span>
            <span className="ff-logs-hero-meta">Exact time is available on hover.</span>
          </article>
          <article className="ff-logs-hero-card" data-tone={attentionRows.length > 0 ? "warning" : "success"}>
            <span className="ff-logs-hero-label">Requires attention</span>
            <span className="ff-logs-hero-value">{String(attentionRows.length)}</span>
            <span className="ff-logs-hero-meta">Warnings and failures in view.</span>
          </article>
        </div>
      </article>

      <div className="ff-filter-presets" role="group" aria-label="Activity filters">
        <span className="ff-filter-presets-label">Investigation filters:</span>
        <div className="ff-filter-presets-list">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ff-filter-preset"
              data-active={filter === item.key ? "true" : undefined}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Active alerts</h3>
              <p className="fg-muted">Alerts are current activity signals that may explain incident pressure.</p>
            </div>
          </div>
          <ul className="fg-list">
            {alerts.map((alert, index) => (
              <li key={`alert-${index}`}>
                <span className="fg-pill" data-tone="warning">{stringifyValue(alert.severity)}</span>
                {" "}{stringifyValue(alert.type)} — {stringifyValue(alert.message)}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Grouped activity timeline</h3>
            <p className="fg-muted">Select an event group to open the contextual details panel.</p>
          </div>
        </div>

        {eventGroups.length === 0 ? (
          <article className="fg-subcard">
            <h4>No visible activity needs review</h4>
            <p className="fg-muted">All visible activity is routine, successful, or excluded by the current filter.</p>
          </article>
        ) : (
          <div className="ff-event-timeline" role="list">
            {eventGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                className="ff-event-group"
                disabled={!group.representative.detailAvailable || !canReadAudit}
                onClick={() => onSelectEvent(group.representative.eventId)}
              >
                <span className="ff-logs-status-dot" data-tone={auditStatusTone(group.representative.status)} aria-hidden="true" />
                <span>
                  <strong>{group.representative.actionLabel}</strong>
                  <small>{group.representative.summary}</small>
                </span>
                <span>{group.representative.actor.label}</span>
                <span title={formatExactTime(group.latestAt)}>{formatRelativeTime(group.latestAt)}</span>
                <StatusBadge tone={auditStatusTone(group.representative.status)}>
                  {group.rows.length > 1 ? `${group.rows.length} grouped` : group.representative.statusLabel}
                </StatusBadge>
              </button>
            ))}
          </div>
        )}

        {routineGroups.length > 0 ? (
          <details className="ff-logs-healthy-systems">
            <summary>Routine successful activity ({routineRows.length})</summary>
            <ul className="fg-list">
              {routineGroups.map((group) => (
                <li key={group.key}>
                  {group.representative.actionLabel} by {group.representative.actor.label} — {group.rows.length} event{group.rows.length === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </article>

      {detailLoading ? <p className="fg-muted">Loading event detail.</p> : null}

      {detail ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>{detail.event.actionLabel}</h3>
              <p className="fg-muted">{detail.summary}</p>
            </div>
            <StatusBadge tone={auditStatusTone(detail.event.status)}>
              {detail.event.statusLabel}
            </StatusBadge>
          </div>

          <div className="ff-logs-detail-layout">
            <div className="fg-subcard">
              <h4>Outcome</h4>
              <p>{detail.outcome}</p>
              <dl className="fg-list">
                <div><dt>Actor</dt><dd>{detail.actor.label}</dd></div>
                <div><dt>Target</dt><dd>{detail.target.label}</dd></div>
                <div><dt>Time</dt><dd title={formatExactTime(detail.event.createdAt)}>{formatRelativeTime(detail.event.createdAt)}</dd></div>
              </dl>
            </div>
            <div className="fg-subcard">
              <h4>Context</h4>
              {detail.changeContext.length === 0 ? (
                <p className="fg-muted">No change context was recorded.</p>
              ) : (
                <ul className="fg-list">
                  {detail.changeContext.map((ctx) => (
                    <li key={ctx.label}>{ctx.label}: {ctx.value}</li>
                  ))}
                </ul>
              )}
              {detail.relatedLinks.length > 0 ? (
                <div className="fg-actions fg-mt-sm">
                  {detail.relatedLinks.map((link) => (
                    <Link key={link.label} className="fg-nav-link" to={withInstanceScope(link.href, instanceId)}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
