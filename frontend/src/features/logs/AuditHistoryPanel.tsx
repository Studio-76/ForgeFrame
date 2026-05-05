/**
 * Audit history panel — compliance and traceability view.
 *
 * Uses the ForgeFrame DataTable for a sortable, searchable, paginated
 * event list. Row clicks open the detail panel. Filter presets and
 * the compliance summary card remain above the table.
 *
 * @packageDocumentation
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type {
  AuditHistoryDetailResponse,
  AuditHistoryResponse,
} from "../../api/domain";
import type { AuditHistoryRow } from "./types";
import { withInstanceScope } from "../../app/tenantScope";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  DataTable,
  type DataTableColumn,
} from "../../components/ui/DataTable";
import { Section } from "../../components/ui/Section";
import { FilterPresets } from "./FilterPresets";
import type {
  FilterPreset,
  TabPanelProps,
} from "./types";
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
  /** Detail error message. */
  detailError?: string | null;
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
 * Map AuditHistoryRow status to tone string for table display.
 */
function rowStatusTone(status: AuditHistoryRow["status"]): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "ok": return "success";
    case "warning": return "warning";
    case "failed": return "danger";
    default: return "neutral";
  }
}

/**
 * Audit history panel — Audit tab with DataTable.
 *
 * @param props - Component props.
 * @returns Audit history panel.
 */
export function AuditHistoryPanel({
  history,
  loading,
  error,
  detail,
  detailLoading,
  detailError,
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
          Viewer sessions cannot open audit history. Open a standard operator
          or admin session.
        </p>
      </article>
    );
  }

  const items = history?.items ?? [];
  const relevantRows = items.filter((row) => row.status !== "ok" || isAuditRelevant(row));
  const regularRows = items.filter((row) => !isAuditRelevant(row));
  const newestEventAt =
    history?.summary.latestEventAt ?? items[0]?.createdAt ?? null;

  // ── Audit DataTable columns ──
  const columns: DataTableColumn<AuditHistoryRow>[] = useMemo(
    () => [
      {
        id: "action",
        header: "Action",
        accessorFn: (row: AuditHistoryRow) => (
          <div>
            <div className="font-medium text-primary">{row.actionLabel}</div>
            <div className="text-muted text-xs mt-0.5">{row.summary}</div>
          </div>
        ),
        sortingKey: (row: AuditHistoryRow) => row.actionLabel,
        alwaysVisible: true,
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (row: AuditHistoryRow) => (
          <span className="text-primary text-sm">{row.actor.label}</span>
        ),
        sortingKey: (row: AuditHistoryRow) => row.actor.label,
      },
      {
        id: "target",
        header: "Target",
        accessorFn: (row: AuditHistoryRow) => (
          <span className="text-muted text-sm">{row.target.typeLabel}</span>
        ),
        sortingKey: (row: AuditHistoryRow) => row.target.typeLabel,
        isTechnical: true,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row: AuditHistoryRow) => (
          <StatusBadge tone={rowStatusTone(row.status)} status={row.status}>
            {row.statusLabel}
          </StatusBadge>
        ),
        sortingKey: (row: AuditHistoryRow) => row.status,
      },
      {
        id: "timestamp",
        header: "Time",
        accessorFn: (row: AuditHistoryRow) => (
          <span className="text-muted text-xs" title={formatExactTime(row.createdAt)}>
            {formatRelativeTime(row.createdAt)}
          </span>
        ),
        sortingKey: (row: AuditHistoryRow) => row.createdAt,
      },
    ],
    [],
  );

  // ── Row click handler ──
  const handleRowClick = (row: AuditHistoryRow) => {
    if (row.detailAvailable) {
      onSelectEvent(row.eventId);
    }
  };

  return (
    <section aria-label="Audit history" className="fg-stack">
      {/* Compliance summary card */}
      {history?.retention ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Audit coverage</h3>
              <p className="fg-muted">
                Compliance and traceability evidence for the current scope.
              </p>
            </div>
            <StatusBadge
              tone={
                history.retention.retentionLimited ? "warning" : "success"
              }
            >
              {history.retention.retentionLimited
                ? "retention limited"
                : "covered"}
            </StatusBadge>
          </div>
          <dl className="ff-logs-incident-fields">
            <div>
              <dt>Retention limit</dt>
              <dd>{String(history.retention.eventLimit)}</dd>
            </div>
            <div>
              <dt>Stored events</dt>
              <dd>{String(history.summary.totalInScope)}</dd>
            </div>
            <div>
              <dt>Oldest event</dt>
              <dd title={formatExactTime(history.retention.oldestAvailableAt)}>
                {formatRelativeTime(history.retention.oldestAvailableAt)}
              </dd>
            </div>
            <div>
              <dt>Newest event</dt>
              <dd title={formatExactTime(newestEventAt)}>
                {formatRelativeTime(newestEventAt)}
              </dd>
            </div>
            <div>
              <dt>Export availability</dt>
              <dd>Available from Audit export</dd>
            </div>
          </dl>
        </article>
      ) : null}

      {/* Filter presets */}
      <FilterPresets active={activePreset} onSelect={onPresetChange} />

      {/* Event detail panel (when an event is selected) */}
      {detailLoading ? (
        <p className="fg-muted">Loading event detail.</p>
      ) : null}

      {detailError && !detailLoading ? (
        <p className="fg-danger">{detailError}</p>
      ) : null}

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
              <button
                type="button"
                className="fg-nav-link"
                onClick={onCloseDetail}
              >
                Close detail
              </button>
            </div>
          </div>

          <div className="ff-logs-detail-layout">
            <div className="fg-subcard">
              <h4>Traceability</h4>
              <p>{detail.outcome}</p>
              <dl className="fg-list">
                <div>
                  <dt>Actor</dt>
                  <dd>{detail.actor.label}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{detail.target.label}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd title={formatExactTime(detail.event.createdAt)}>
                    {formatRelativeTime(detail.event.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="fg-subcard">
              <h4>Change context</h4>
              {detail.changeContext.length === 0 ? (
                <p className="fg-muted">No change context recorded.</p>
              ) : (
                <ul className="fg-list">
                  {detail.changeContext.map((ctx) => (
                    <li key={ctx.label}>
                      {ctx.label}: {ctx.value}
                    </li>
                  ))}
                </ul>
              )}
              {detail.relatedLinks.length > 0 ? (
                <div className="fg-actions fg-mt-sm">
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
              ) : null}
            </div>
          </div>

          <details
            className="ff-logs-healthy-systems"
            open={expandedRaw}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                setExpandedRaw((current) => !current);
              }}
            >
              Technical details
            </summary>
            <dl className="fg-list">
              <div>
                <dt>Correlation</dt>
                <dd>
                  {detail.correlation
                    ? `${detail.correlation.label}: ${detail.correlation.value}`
                    : "n/a"}
                </dd>
              </div>
              <div>
                <dt>Event ID</dt>
                <dd>{detail.event.eventId}</dd>
              </div>
            </dl>
            <pre className="fg-code fg-mt-sm">
              {JSON.stringify(detail.rawMetadata, null, 2)}
            </pre>
          </details>
        </article>
      ) : null}

      {/* Loading & error states */}
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

      {/* Audit events table */}
      {items.length > 0 ? (
        <DataTable<AuditHistoryRow>
          data={items}
          columns={columns}
          rowKey={(row) => row.eventId}
          // Selection
          selectedRowId={detail?.event.eventId ?? null}
          onRowClick={handleRowClick}
          // States
          loading={false}
          emptyTitle="No audit events"
          emptyDescription="No audit events match the current filters."
          // Pagination
          enablePagination={true}
          pageSize={25}
          // Layout
          title="Audit events"
          description={
            relevantRows.length > 0
              ? `${relevantRows.length} event${relevantRows.length === 1 ? "" : "s"} needing attention highlighted.`
              : "All visible events are routine."
          }
          density="compact"
          enableColumnVisibility={true}
          showSearch={true}
          searchPlaceholder="Search audit events..."
          showPresets={false}
        />
      ) : null}

      {/* Routine events collapsed section */}
      {regularRows.length > 0 ? (
        <details className="ff-logs-healthy-systems">
          <summary>
            Routine audit events ({regularRows.length})
          </summary>
          {regularRows.map((row) => (
            <button
              key={row.eventId}
              type="button"
              className="ff-event-group"
              disabled={!row.detailAvailable}
              onClick={() => {
                if (row.detailAvailable) {
                  onSelectEvent(row.eventId);
                }
              }}
            >
              <span
                className="ff-logs-status-dot"
                data-tone={auditStatusTone(row.status)}
                aria-hidden="true"
              />
              <span>
                <strong>{row.actionLabel}</strong>
                <small>{row.summary}</small>
              </span>
              <span>{row.actor.label}</span>
              <span title={formatExactTime(row.createdAt)}>
                {formatRelativeTime(row.createdAt)}
              </span>
            </button>
          ))}
        </details>
      ) : null}

      {/* Load more link */}
      {hasMore ? (
        <div className="fg-actions">
          <button
            type="button"
            className="fg-nav-link"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Loading\u2026" : "Load more"}
          </button>
        </div>
      ) : null}

      {/* Footer count */}
      {history ? (
        <p className="fg-muted">
          Showing {items.length} event
          {items.length === 1 ? "" : "s"}
          {history.summary.totalMatchingFilters > items.length
            ? ` from ${history.summary.totalMatchingFilters} matching`
            : ""}
          {history.summary.totalInScope > 0
            ? ` \u00b7 ${history.summary.totalInScope} in scope`
            : ""}
          .
        </p>
      ) : null}
    </section>
  );
}

/**
 * Determine whether an audit event should be highlighted for compliance.
 */
function isAuditRelevant(row: AuditHistoryRow): boolean {
  const action = row.actionKey.toLowerCase();
  return (
    row.status !== "ok" ||
    action.includes("admin") ||
    action.includes("setting") ||
    action.includes("access") ||
    action.includes("security") ||
    action.includes("denied") ||
    action.includes("failed")
  );
}
