/**
 * Audit history panel — compliance and traceability view.
 *
 * Groups repeated audit events, keeps routine successful sessions collapsed,
 * and exposes raw IDs only in technical details so compliance evidence stays
 * readable without becoming another raw event dump.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import type {
  AuditHistoryDetailResponse,
  AuditHistoryResponse,
} from "../../api/domain";
import { withInstanceScope } from "../../app/tenantScope";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { FilterPresets } from "./FilterPresets";
import type { AuditHistoryRow, FilterPreset, TabPanelProps } from "./types";
import {
  auditStatusTone,
  formatExactTime,
  formatRelativeTime,
  groupEventRows,
  isRoutineSessionEvent,
} from "./utils";

/** Props for AuditHistoryPanel. */
export interface AuditHistoryPanelProps extends TabPanelProps {
  /** Audit history response. */
  history: AuditHistoryResponse | null;
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
  /** Audit event detail (when selected). */
  detail: AuditHistoryDetailResponse | null;
  /** Detail loading state. */
  detailLoading: boolean;
  /** Active filter preset. */
  activePreset: FilterPreset | null;
  /** Called when user selects a preset. */
  onPresetChange: (preset: FilterPreset | null) => void;
  /** Called when user selects an event. */
  onSelectEvent: (eventId: string) => void;
  /** Called when user closes the detail panel. */
  onCloseDetail: () => void;
  /** Whether pagination has more pages. */
  hasMore: boolean;
  /** Called when user requests next page. */
  onLoadMore: () => void;
}

/**
 * Determine whether an audit event should be highlighted for compliance.
 * @param row - Audit row.
 * @returns True when the event is security or compliance relevant.
 */
function isAuditRelevant(row: AuditHistoryRow): boolean {
  const action = row.actionKey.toLowerCase();
  return row.status !== "ok"
    || action.includes("admin")
    || action.includes("setting")
    || action.includes("access")
    || action.includes("security")
    || action.includes("denied")
    || action.includes("failed");
}

/**
 * Audit history panel — Audit tab.
 * @param props - Component props.
 * @returns Audit history panel.
 */
export function AuditHistoryPanel({
  history,
  loading,
  error,
  detail,
  detailLoading,
  activePreset,
  onPresetChange,
  onSelectEvent,
  onCloseDetail,
  hasMore,
  onLoadMore,
  instanceId,
  canReadAudit,
}: AuditHistoryPanelProps) {
  const [expandedRaw, setExpandedRaw] = useState(false);

  if (!canReadAudit) {
    return (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Audit history</h3>
            <p className="fg-muted">
              Audit history requires a standard operator or admin session.
            </p>
          </div>
        </div>
        <p className="fg-muted">
          Viewer sessions cannot open audit history. Open a standard operator or admin session.
        </p>
      </article>
    );
  }

  const items = history?.items ?? [];
  const relevantRows = items.filter(isAuditRelevant);
  const routineRows = items.filter((item) => !isAuditRelevant(item) || isRoutineSessionEvent(item));
  const groupedRows = groupEventRows(relevantRows);
  const routineGroups = groupEventRows(routineRows);
  const newestEventAt = history?.summary.latestEventAt ?? items[0]?.createdAt ?? null;

  return (
    <section aria-label="Audit history" className="fg-stack">
      {history?.retention ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Audit coverage</h3>
              <p className="fg-muted">
                Compliance and traceability evidence for the current scope.
              </p>
            </div>
            <StatusBadge tone={history.retention.retentionLimited ? "warning" : "success"}>
              {history.retention.retentionLimited ? "retention limited" : "covered"}
            </StatusBadge>
          </div>
          <dl className="ff-logs-incident-fields">
            <div><dt>Retention limit</dt><dd>{String(history.retention.eventLimit)}</dd></div>
            <div><dt>Stored events</dt><dd>{String(history.summary.totalInScope)}</dd></div>
            <div><dt>Oldest event</dt><dd title={formatExactTime(history.retention.oldestAvailableAt)}>{formatRelativeTime(history.retention.oldestAvailableAt)}</dd></div>
            <div><dt>Newest event</dt><dd title={formatExactTime(newestEventAt)}>{formatRelativeTime(newestEventAt)}</dd></div>
            <div><dt>Export availability</dt><dd>Available from Audit export</dd></div>
          </dl>
        </article>
      ) : null}

      <FilterPresets active={activePreset} onSelect={onPresetChange} />

      {loading ? <p className="fg-muted">Loading audit history.</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {history && items.length === 0 ? (
        <article className="fg-subcard">
          <h4>
            {history.summary.totalInScope === 0
              ? "No audit evidence yet"
              : "No results for the current filters"}
          </h4>
          <p className="fg-muted">
            {history.summary.totalInScope === 0
              ? "No audit evidence was recorded in the selected window."
              : "The current scope contains audit evidence, but the selected filters exclude it."}
          </p>
        </article>
      ) : null}

      {items.length > 0 ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Audit events needing traceability</h3>
              <p className="fg-muted">
                Admin mutations, settings changes, access/session events, and
                failed or denied actions are grouped first.
              </p>
            </div>
          </div>

          {groupedRows.length === 0 ? (
            <article className="fg-subcard">
              <h4>No audit events need attention</h4>
              <p className="fg-muted">All visible audit evidence is routine for the selected filters.</p>
            </article>
          ) : (
            <div className="ff-event-timeline" role="list">
              {groupedRows.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className="ff-event-group"
                  disabled={!group.representative.detailAvailable}
                  onClick={() => onSelectEvent(group.representative.eventId)}
                >
                  <span className="ff-logs-status-dot" data-tone={auditStatusTone(group.representative.status)} aria-hidden="true" />
                  <span>
                    <strong>{group.representative.actionLabel}</strong>
                    <small>{group.representative.summary}</small>
                  </span>
                  <span>{group.representative.actor.label}</span>
                  <span>{group.representative.target.typeLabel}</span>
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
              <summary>Routine audit events ({routineRows.length})</summary>
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
      ) : null}

      {hasMore ? (
        <div className="fg-actions">
          <button
            type="button"
            className="fg-nav-link"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {history ? (
        <p className="fg-muted">
          Showing {items.length} event{items.length === 1 ? "" : "s"}
          {history.summary.totalMatchingFilters > items.length
            ? ` from ${history.summary.totalMatchingFilters} matching`
            : ""}
          {history.summary.totalInScope > 0
            ? ` · ${history.summary.totalInScope} in scope`
            : ""}.
        </p>
      ) : null}

      {detailLoading ? <p className="fg-muted">Loading event detail.</p> : null}

      {detail ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>{detail.event.actionLabel}</h3>
              <p className="fg-muted">{detail.summary}</p>
            </div>
            <div className="fg-actions">
              <StatusBadge tone={auditStatusTone(detail.event.status)}>
                {detail.event.statusLabel}
              </StatusBadge>
              <button type="button" className="fg-nav-link" onClick={onCloseDetail}>
                Close detail
              </button>
            </div>
          </div>

          <div className="ff-logs-detail-layout">
            <div className="fg-subcard">
              <h4>Traceability</h4>
              <p>{detail.outcome}</p>
              <dl className="fg-list">
                <div><dt>Actor</dt><dd>{detail.actor.label}</dd></div>
                <div><dt>Target</dt><dd>{detail.target.label}</dd></div>
                <div><dt>Time</dt><dd title={formatExactTime(detail.event.createdAt)}>{formatRelativeTime(detail.event.createdAt)}</dd></div>
              </dl>
            </div>
            <div className="fg-subcard">
              <h4>Change context</h4>
              {detail.changeContext.length === 0 ? (
                <p className="fg-muted">No change context recorded.</p>
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

          <details className="ff-logs-healthy-systems" open={expandedRaw}>
            <summary onClick={(event) => {
              event.preventDefault();
              setExpandedRaw((current) => !current);
            }}>
              Technical details
            </summary>
            <dl className="fg-list">
              <div><dt>Correlation</dt><dd>{detail.correlation ? `${detail.correlation.label}: ${detail.correlation.value}` : "n/a"}</dd></div>
              <div><dt>Event ID</dt><dd>{detail.event.eventId}</dd></div>
            </dl>
            <pre className="fg-code fg-mt-sm">{JSON.stringify(detail.rawMetadata, null, 2)}</pre>
          </details>
        </article>
      ) : null}
    </section>
  );
}
