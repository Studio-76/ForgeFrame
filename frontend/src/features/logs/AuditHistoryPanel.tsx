/**
 * Audit history panel — Audit tab content.
 *
 * Paginated audit event table with filter controls, severity-first sorting,
 * row selection for contextual detail (with raw payload hidden by default),
 * and clear event summaries. Filter presets are provided via FilterPresets.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from "react";

import type {
  AuditHistoryDetailResponse,
  AuditHistoryResponse,
} from "../../api/domain";
import { withInstanceScope } from "../../app/tenantScope";
import { FilterPresets } from "./FilterPresets";
import type { FilterPreset, TabPanelProps } from "./types";

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
 * Audit history panel — Audit tab.
 *
 * @param props - Component props.
 * @returns The audit history panel.
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

  return (
    <section aria-label="Audit history">
      {history?.retention ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Retention</h3>
              <p className="fg-muted">
                Event limit: {String(history.retention.eventLimit)}
                {history.retention.retentionLimited ? " \u00B7 Retention limited" : ""}
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <FilterPresets active={activePreset} onSelect={onPresetChange} />

      {loading ? (
        <p className="fg-muted fg-mt-sm">Loading audit history.</p>
      ) : null}

      {error ? (
        <p className="fg-danger fg-mt-sm">{error}</p>
      ) : null}

      {history && items.length === 0 ? (
        <article className="fg-subcard fg-mt-md">
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
        <div className="fg-table-wrap fg-mt-md">
          <table className="fg-table" aria-label="Audit history">
            <thead>
              <tr>
                <th>What happened</th>
                <th>Severity</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Correlation</th>
                <th>Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.eventId}>
                  <td>
                    <strong>{item.actionLabel}</strong>
                    <div className="fg-muted">{item.summary}</div>
                  </td>
                  <td>
                    <span
                      className="fg-pill"
                      data-tone={item.status === "ok" ? "success" : item.status === "warning" ? "warning" : "danger"}
                    >
                      {item.statusLabel}
                    </span>
                  </td>
                  <td>
                    {item.actor.label}
                    {item.actor.secondary ? <div className="fg-muted">{item.actor.secondary}</div> : null}
                  </td>
                  <td>
                    {item.target.label}
                    <div className="fg-muted">{item.target.typeLabel}</div>
                  </td>
                  <td>
                    {item.correlation ? (
                      <>
                        {item.correlation.value}
                        <div className="fg-muted">{item.correlation.label}</div>
                      </>
                    ) : (
                      <span className="fg-muted">n/a</span>
                    )}
                  </td>
                  <td>{item.createdAt}</td>
                  <td>
                    <button
                      type="button"
                      className="fg-nav-link"
                      disabled={!item.detailAvailable}
                      onClick={() => onSelectEvent(item.eventId)}
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Pagination */}
      {hasMore ? (
        <div className="fg-actions fg-mt-sm">
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

      {history ? (
        <p className="fg-muted fg-mt-sm">
          Showing {items.length} event{items.length === 1 ? "" : "s"}
          {history.summary.totalMatchingFilters > items.length
            ? ` from ${history.summary.totalMatchingFilters} matching`
            : ""}
          {history.summary.totalInScope > 0
            ? ` \u00B7 ${history.summary.totalInScope} in scope`
            : ""}.
        </p>
      ) : null}

      {/* Detail panel */}
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
            <div className="fg-actions">
              <button type="button" className="fg-nav-link" onClick={onCloseDetail}>
                Close detail
              </button>
            </div>
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
                  <dt>Correlation</dt>
                  <dd>{detail.correlation ? `${detail.correlation.label}: ${detail.correlation.value}` : "n/a"}</dd>
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
                      <a
                        key={link.label}
                        className="fg-nav-link"
                        href={withInstanceScope(link.href, instanceId)}
                      >
                        {link.label}
                      </a>
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
