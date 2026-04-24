import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchAuditHistory,
  fetchAuditHistoryDetail,
  fetchLogs,
  generateAuditExport,
  type AuditExportFormat,
  type AuditExportResult,
  type AuditHistoryDetailResponse,
  type AuditHistoryResponse,
  type AuditHistoryStatus,
  type AuditHistoryWindow,
  type LogsResponse,
} from "../../api/admin";
import { sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope, withQueryParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const HISTORY_LIMIT = 25;
const EXPORT_DEFAULT_LIMIT = 250;
const HISTORY_WINDOWS: AuditHistoryWindow[] = ["24h", "7d", "30d", "all"];
const EXPORT_FORMATS: AuditExportFormat[] = ["json", "csv"];
const STATUS_OPTIONS: AuditHistoryStatus[] = ["ok", "warning", "failed"];

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizedParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key)?.trim();
  return value ? value : null;
}

function getAuditWindow(searchParams: URLSearchParams): AuditHistoryWindow {
  const value = searchParams.get("auditWindow");
  return value === "24h" || value === "30d" || value === "all" ? value : "7d";
}

function getAuditStatus(searchParams: URLSearchParams): AuditHistoryStatus | null {
  const value = searchParams.get("auditStatus");
  return value === "ok" || value === "warning" || value === "failed" ? value : null;
}

function scopedHistoryQuery({
  instanceId,
  companyId,
  window,
  action,
  actor,
  targetType,
  targetId,
  status,
  limit,
}: {
  instanceId: string | null;
  companyId: string | null;
  window: AuditHistoryWindow;
  action: string | null;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
  status: AuditHistoryStatus | null;
  limit: number;
}) {
  return {
    instanceId,
    ...(companyId ? { companyId } : {}),
    window,
    action,
    actor,
    targetType,
    targetId,
    status,
    limit,
  };
}

function buildAuditHashPath(
  hash: "audit-history" | "audit-export",
  {
    instanceId,
    companyId,
    window,
    action,
    status,
    eventId,
    targetType,
    targetId,
  }: {
    instanceId: string | null;
    companyId: string | null;
    window: AuditHistoryWindow;
    action?: string | null;
    status?: AuditHistoryStatus | null;
    eventId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
  },
) {
  return withQueryParams(`/logs#${hash}`, {
    instanceId,
    companyId,
    auditWindow: window,
    auditAction: action,
    auditStatus: status,
    auditEvent: eventId,
    auditTargetType: targetType,
    auditTargetId: targetId,
  });
}

function optionLabel(value: string, options: Array<{ value: string; label: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function scopeLabel(instanceName: string | null, window: AuditHistoryWindow, action: string | null, status: AuditHistoryStatus | null, limit: number) {
  return [
    "Format: JSON",
    instanceName ? `Instance: ${instanceName}` : "Instance: default scope",
    `Window: ${window}`,
    action ? `Action: ${action}` : null,
    status ? `Status: ${status}` : null,
    `Limit: ${limit}`,
  ].filter(Boolean).join(" · ");
}

export function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const companyId = normalizedParam(searchParams, "companyId");
  const auditWindow = getAuditWindow(searchParams);
  const auditAction = normalizedParam(searchParams, "auditAction");
  const auditActor = normalizedParam(searchParams, "auditActor");
  const auditTargetType = normalizedParam(searchParams, "auditTargetType");
  const auditTargetId = normalizedParam(searchParams, "auditTargetId");
  const auditStatus = getAuditStatus(searchParams);
  const auditEventId = normalizedParam(searchParams, "auditEvent");
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [logsState, setLogsState] = useState<LoadState>("idle");
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [historyState, setHistoryState] = useState<LoadState>("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditHistoryResponse | null>(null);
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditHistoryDetailResponse | null>(null);
  const [exportFormat, setExportFormat] = useState<AuditExportFormat>("json");
  const [exportSubject, setExportSubject] = useState("");
  const [exportLimit, setExportLimit] = useState(String(EXPORT_DEFAULT_LIMIT));
  const [exportState, setExportState] = useState<LoadState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<AuditExportResult | null>(null);
  const canReadAudit = sessionReady && sessionHasAnyInstancePermission(session, "audit.read");
  const canGenerateExport = canReadAudit && session?.read_only !== true;

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const updateAuditParam = (key: string, value: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (value) {
      nextSearchParams.set(key, value);
    } else {
      nextSearchParams.delete(key);
    }
    if (key !== "auditEvent") {
      nextSearchParams.delete("auditEvent");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLogsState("loading");
      setLogsError(null);
      try {
        const payload = await fetchLogs(instanceId, undefined, companyId);
        if (!mounted) {
          return;
        }
        setLogs(payload);
        setLogsState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setLogs(null);
        setLogsState("error");
        setLogsError(loadError instanceof Error ? loadError.message : "Logs surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [companyId, instanceId]);

  useEffect(() => {
    let mounted = true;

    if (!canReadAudit) {
      setHistory(null);
      setHistoryError(null);
      setHistoryState("idle");
      return () => {
        mounted = false;
      };
    }

    const load = async () => {
      setHistoryState("loading");
      setHistoryError(null);
      try {
        const payload = await fetchAuditHistory(scopedHistoryQuery({
          instanceId,
          companyId,
          window: auditWindow,
          action: auditAction,
          actor: auditActor,
          targetType: auditTargetType,
          targetId: auditTargetId,
          status: auditStatus,
          limit: HISTORY_LIMIT,
        }));
        if (!mounted) {
          return;
        }
        setHistory(payload);
        setHistoryState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setHistory(null);
        setHistoryState("error");
        setHistoryError(loadError instanceof Error ? loadError.message : "Audit history loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [auditAction, auditActor, auditStatus, auditTargetId, auditTargetType, auditWindow, canReadAudit, companyId, instanceId]);

  useEffect(() => {
    let mounted = true;

    if (!canReadAudit || !auditEventId) {
      setDetail(null);
      setDetailState("idle");
      setDetailError(null);
      return () => {
        mounted = false;
      };
    }

    setDetailState("loading");
    setDetailError(null);
    void fetchAuditHistoryDetail(auditEventId, instanceId, undefined, companyId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setDetail(payload);
        setDetailState("success");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setDetailError(loadError instanceof Error ? loadError.message : "Audit detail loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [auditEventId, canReadAudit, companyId, instanceId]);

  const exportLimitNumber = useMemo(() => {
    const parsed = Number(exportLimit);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : EXPORT_DEFAULT_LIMIT;
  }, [exportLimit]);

  const exportPlaceholder = [auditActor, auditTargetType, auditTargetId].filter(Boolean).join(" ");
  const exportPath = buildAuditHashPath("audit-export", {
    instanceId,
    companyId,
    window: auditWindow,
    action: auditAction,
    status: auditStatus,
  });
  const historyPath = buildAuditHashPath("audit-history", {
    instanceId,
    companyId,
    window: auditWindow,
    action: auditAction,
    status: auditStatus,
  });

  const handleExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canGenerateExport) {
      return;
    }
    setExportState("loading");
    setExportError(null);
    try {
      const payload = await generateAuditExport({
        format: exportFormat,
        window: auditWindow,
        action: auditAction,
        status: auditStatus,
        subject: exportSubject.trim() ? exportSubject.trim() : null,
        limit: exportLimitNumber,
      }, instanceId, undefined, companyId);
      setExportResult(payload);
      setExportState("success");
    } catch (loadError) {
      setExportState("error");
      setExportError(loadError instanceof Error ? loadError.message : "Audit export failed.");
    }
  };

  const openDetail = (eventId: string) => {
    updateAuditParam("auditEvent", eventId);
  };

  const exportEventPath = exportResult
    ? buildAuditHashPath("audit-history", {
        instanceId,
        companyId,
        window: "all",
        action: "audit_export_generated",
        targetType: "audit_export",
        targetId: exportResult.exportId,
      })
    : "";

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Errors, Activity, and Audit History"
        description="Operational signal, audit preview, retention posture, and observability checks for the active instance scope."
        question="What evidence is available for this scope, and is the logging path healthy?"
        links={[
          {
            label: "Errors",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId),
            description: "Open incident review when the logs point to current runtime failures.",
          },
          {
            label: "Health",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId),
            description: "Check runtime readiness and provider posture for degraded signal paths.",
          },
          {
            label: "Audit History",
            to: historyPath,
            description: "Review full governance event history from the same scope.",
          },
          {
            label: "Audit export",
            to: exportPath,
            description: "Export stays on this route with a separate audit export workflow.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: logs?.operability.ready ? "Logging ready" : "Logging not ready", tone: logs?.operability.ready ? "success" : "warning" },
          ...(canReadAudit ? [] : [{ label: "Viewer read-only", tone: "warning" as const }]),
        ]}
        note="This page uses the admin logs endpoint directly and keeps audit export linked from the same evidence workflow."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="logs and audit evidence"
        onInstanceChange={onInstanceChange}
      />

      {logsState === "loading" ? <article className="fg-card"><p className="fg-muted">Loading logs evidence.</p></article> : null}
      {logsError ? <p className="fg-danger">{logsError}</p> : null}

      {logs ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Audit Preview</h3>
                <p className="fg-muted">Latest governance events available for the selected scope.</p>
              </div>
            </div>
            <ul className="fg-list">
              {logs.audit_preview.length === 0 ? <li>No audit events available.</li> : null}
              {logs.audit_preview.slice(0, 8).map((item) => (
                <li key={item.eventId}>
                  {item.createdAt} - {item.actionLabel} - {item.statusLabel} - {item.summary}
                </li>
              ))}
            </ul>
            <Link className="fg-nav-link" to={historyPath}>
              Open Audit History
            </Link>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Retention</h3>
                <p className="fg-muted">Audit availability and retention guardrails.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Event limit: {String(logs.audit_retention.eventLimit)}</li>
              <li>Retention limited: {String(logs.audit_retention.retentionLimited)}</li>
              <li>Oldest available: {stringifyValue(logs.audit_retention.oldestAvailableAt)}</li>
              <li>Latest event: {stringifyValue(logs.audit_retention.latestEventAt)}</li>
            </ul>
            <Link className="fg-nav-link" to={exportPath}>
              Open Audit Export
            </Link>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Operability Checks</h3>
                <p className="fg-muted">Logging and tracing signal-path checks.</p>
              </div>
              <span className="fg-pill" data-tone={logs.operability.ready ? "success" : "warning"}>
                {logs.operability.ready ? "ready" : "review"}
              </span>
            </div>
            <ul className="fg-list">
              {logs.operability.checks.map((check, index) => (
                <li key={`${stringifyValue(check.id)}-${index}`}>
                  {stringifyValue(check.id)} - ok={stringifyValue(check.ok)} - {stringifyValue(check.details)}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Alerts & Metrics</h3>
                <p className="fg-muted">Current alert and observability summary from the logs endpoint.</p>
              </div>
            </div>
            <ul className="fg-list">
              {logs.alerts.length === 0 ? <li>No active alerts.</li> : null}
              {logs.alerts.map((alert, index) => (
                <li key={`${stringifyValue(alert.type)}-${index}`}>
                  {stringifyValue(alert.severity)} - {stringifyValue(alert.type)} - {stringifyValue(alert.message)}
                </li>
              ))}
            </ul>
            <pre>{JSON.stringify({ metrics: logs.operability.metrics, logging: logs.operability.logging, tracing: logs.operability.tracing }, null, 2)}</pre>
          </article>
        </div>
      ) : null}

      <article id="audit-export" className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Audit export</h3>
            <p className="fg-muted">Current export scope: {scopeLabel(selectedInstance?.display_name ?? null, auditWindow, auditAction, auditStatus, exportLimitNumber)}</p>
          </div>
          <Link className="fg-nav-link" to={historyPath}>Open Audit History</Link>
        </div>
        {!canReadAudit ? (
          <p className="fg-muted">Viewer sessions cannot open audit history or generate exports. Open a standard operator or admin session.</p>
        ) : null}
        <form className="fg-inline-form" onSubmit={(event) => void handleExport(event)}>
          <label>
            Format
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as AuditExportFormat)}>
              {EXPORT_FORMATS.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
            </select>
          </label>
          <label>
            Subject
            <input
              value={exportSubject}
              onChange={(event) => setExportSubject(event.target.value)}
              onInput={(event) => setExportSubject(event.currentTarget.value)}
              placeholder={exportPlaceholder || "ops runtime_key key_alpha"}
            />
          </label>
          <label>
            Limit
            <input
              type="number"
              min="1"
              value={exportLimit}
              onChange={(event) => setExportLimit(event.target.value)}
              onInput={(event) => setExportLimit(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={!canGenerateExport || exportState === "loading"}>
            {exportState === "loading" ? "Generating export" : `Generate ${exportFormat.toUpperCase()} export`}
          </button>
        </form>
        {exportState === "error" ? (
          <p className="fg-danger">Audit export failed: {exportError}</p>
        ) : null}
        {exportResult ? (
          <article className="fg-subcard fg-mt-md">
            <h4>Latest exported package</h4>
            <ul className="fg-list">
              <li>{exportResult.filename}</li>
              <li>Rows exported: {exportResult.rowCount}</li>
              <li>Generated at: {stringifyValue(exportResult.generatedAt)}</li>
              {exportSubject.trim() ? <li>{exportSubject.trim()}</li> : null}
            </ul>
            <div className="fg-actions fg-mt-sm">
              <Link className="fg-nav-link" to={exportEventPath}>Open export audit event</Link>
              <a className="fg-nav-link" href="#" onClick={(event) => event.preventDefault()}>Download latest export again</a>
            </div>
          </article>
        ) : null}
      </article>

      <article id="audit-history" className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Audit history</h3>
            <p className="fg-muted">Audit history and detail require a standard operator or admin session. Viewer sessions stay on the logs overview only.</p>
          </div>
          <Link className="fg-nav-link" to={exportPath}>Open Audit Export</Link>
        </div>

        {!canReadAudit ? (
          <article className="fg-subcard">
            <h4>Audit history is permission-limited</h4>
            <p className="fg-muted">Audit history and detail require a standard operator or admin session. Viewer sessions stay on the logs overview only.</p>
          </article>
        ) : (
          <>
            <div className="fg-inline-form">
              <label>
                Window
                <select value={auditWindow} onChange={(event) => updateAuditParam("auditWindow", event.target.value)}>
                  {HISTORY_WINDOWS.map((window) => <option key={window} value={window}>{window}</option>)}
                </select>
              </label>
              <label>
                Action
                <select value={auditAction ?? ""} onChange={(event) => updateAuditParam("auditAction", event.target.value || null)}>
                  <option value="">Any action</option>
                  {(history?.filters.available.actions ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                Target type
                <select value={auditTargetType ?? ""} onChange={(event) => updateAuditParam("auditTargetType", event.target.value || null)}>
                  <option value="">Any target</option>
                  {(history?.filters.available.targetTypes ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={auditStatus ?? ""} onChange={(event) => updateAuditParam("auditStatus", event.target.value || null)}>
                  <option value="">Any status</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{optionLabel(status, history?.filters.available.statuses ?? [])}</option>)}
                </select>
              </label>
              <label>
                Actor
                <input value={auditActor ?? ""} placeholder="Search actor" onChange={(event) => updateAuditParam("auditActor", event.target.value || null)} />
              </label>
            </div>

            {historyState === "loading" ? <p className="fg-muted">Loading audit history.</p> : null}
            {historyError ? <p className="fg-danger">{historyError}</p> : null}

            {history ? (
              <>
                {history.items.length === 0 && history.summary.totalInScope === 0 ? (
                  <article className="fg-subcard fg-mt-md">
                    <h4>No audit evidence yet</h4>
                    <p className="fg-muted">No audit evidence was recorded in the selected window.</p>
                  </article>
                ) : null}
                {history.items.length === 0 && history.summary.totalInScope > 0 ? (
                  <article className="fg-subcard fg-mt-md">
                    <h4>No results for the current filters.</h4>
                    <p className="fg-muted">The current scope contains audit evidence, but the selected filters exclude it.</p>
                  </article>
                ) : null}
                {history.items.length > 0 ? (
                  <div className="fg-table-wrap fg-mt-md">
                    <table className="fg-table">
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>Action</th>
                          <th>Status</th>
                          <th>Actor</th>
                          <th>Target</th>
                          <th>Summary</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.items.map((item) => (
                          <tr key={item.eventId}>
                            <td>{item.createdAt}</td>
                            <td>{item.actionLabel}</td>
                            <td><span className="fg-pill" data-tone={item.status === "ok" ? "success" : item.status === "warning" ? "warning" : "danger"}>{item.statusLabel}</span></td>
                            <td>{item.actor.label}</td>
                            <td>{item.target.label}</td>
                            <td>{item.summary}</td>
                            <td>
                              <button className="fg-table-trigger" type="button" onClick={() => openDetail(item.eventId)} disabled={!item.detailAvailable}>
                                Open detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </article>

      {detailState === "loading" ? <article className="fg-card"><p className="fg-muted">Loading audit detail.</p></article> : null}
      {detailError ? <p className="fg-danger">{detailError}</p> : null}
      {detail ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>{detail.event.actionLabel}</h3>
              <p className="fg-muted">{detail.summary}</p>
            </div>
            <span className="fg-pill" data-tone={detail.event.status === "ok" ? "success" : detail.event.status === "warning" ? "warning" : "danger"}>{detail.outcome}</span>
          </div>
          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Change context</h4>
              <ul className="fg-list">
                {detail.changeContext.length === 0 ? <li>{detail.changeContextUnavailable ? "Change context unavailable." : "No change context recorded."}</li> : null}
                {detail.changeContext.map((item) => <li key={item.label}>{item.label}: {item.value}</li>)}
              </ul>
            </article>
            <article className="fg-subcard">
              <h4>Related links</h4>
              <ul className="fg-list">
                {detail.relatedLinks.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link to={withInstanceScope(link.href, instanceId)}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <h4>Raw metadata</h4>
          <pre>{JSON.stringify(detail.rawMetadata, null, 2)}</pre>
        </article>
      ) : null}
    </section>
  );
}
