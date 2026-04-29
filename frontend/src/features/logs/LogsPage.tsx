import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

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
import { ActionBar } from "../../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../../components/ui/DetailPanel";
import { EntityTable } from "../../components/ui/EntityTable";
import { ErrorState, LoadingState, PermissionState } from "../../components/ui/StateBlocks";
import { SummaryStrip } from "../../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";

const HISTORY_LIMIT = 25;
const EXPORT_DEFAULT_LIMIT = 250;
const HISTORY_WINDOWS: AuditHistoryWindow[] = ["24h", "7d", "30d", "all"];
const EXPORT_FORMATS: AuditExportFormat[] = ["json", "csv"];
const STATUS_OPTIONS: AuditHistoryStatus[] = ["ok", "warning", "failed"];
const AUDIT_HISTORY_HASH = "#audit-history";
const AUDIT_EXPORT_HASH = "#audit-export";

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
    actor,
    status,
    eventId,
    targetType,
    targetId,
  }: {
    instanceId: string | null;
    companyId: string | null;
    window: AuditHistoryWindow;
    action?: string | null;
    actor?: string | null;
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
    auditActor: actor,
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const auditHistoryRef = useRef<HTMLElement | null>(null);
  const auditExportRef = useRef<HTMLElement | null>(null);
  const canReadAudit = sessionReady && sessionHasAnyInstancePermission(session, "audit.read");
  const canGenerateExport = canReadAudit && session?.read_only !== true;

  const updateRouteSearch = (nextSearchParams: URLSearchParams) => {
    const search = nextSearchParams.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    });
  };

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    updateRouteSearch(nextSearchParams);
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
    updateRouteSearch(nextSearchParams);
  };

  useEffect(() => {
    const target = location.hash === AUDIT_HISTORY_HASH
      ? auditHistoryRef.current
      : location.hash === AUDIT_EXPORT_HASH
        ? auditExportRef.current
        : null;
    if (!target) {
      return;
    }
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start" });
    }
    target.focus();
  }, [location.hash]);

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
    actor: auditActor,
    status: auditStatus,
    targetType: auditTargetType,
    targetId: auditTargetId,
  });
  const historyPath = buildAuditHashPath("audit-history", {
    instanceId,
    companyId,
    window: auditWindow,
    action: auditAction,
    actor: auditActor,
    status: auditStatus,
    targetType: auditTargetType,
    targetId: auditTargetId,
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

  const downloadLatestExport = () => {
    if (!exportResult?.blob || typeof window === "undefined" || typeof URL.createObjectURL !== "function") {
      setExportState("error");
      setExportError("Latest export download is unsupported in this browser context.");
      return;
    }

    const objectUrl = URL.createObjectURL(exportResult.blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = exportResult.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
        actor: auditActor,
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
      <ActionBar
        title="Evidence handoffs"
        description="Export stays on this route with a separate audit export workflow."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId)}>Health</Link>
          <Link className="fg-nav-link" to={historyPath}>Audit History</Link>
          <Link className="fg-nav-link" to={exportPath}>Audit export</Link>
        </div>
      </ActionBar>

      {logsState === "loading" ? (
        <LoadingState
          title="Loading logs evidence."
          description="ForgeFrame is restoring runtime signals, audit preview, and operability posture."
        />
      ) : null}
      {logsError ? (
        <ErrorState
          title="Logs surface loading failed"
          description={logsError}
        />
      ) : null}

      {logs ? (
        <>
          <SummaryStrip
            items={[
              {
                key: "audit-preview",
                label: "Audit preview",
                value: logs.audit_preview.length,
                meta: "Latest governance events available for the selected scope.",
              },
              {
                key: "retention-limit",
                label: "Retention limit",
                value: String(logs.audit_retention.eventLimit),
                meta: logs.audit_retention.retentionLimited ? "Retention limited" : "Full retention window available",
                status: logs.audit_retention.retentionLimited ? "partial" : "ready",
              },
              {
                key: "operability",
                label: "Operability",
                value: logs.operability.ready ? "ready" : "review",
                meta: "Logging and tracing signal-path checks.",
                status: logs.operability.ready ? "ready" : "degraded",
              },
              {
                key: "alerts",
                label: "Alerts",
                value: logs.alerts.length,
                meta: logs.alerts.length > 0 ? "Current alert pressure detected." : "No active alerts.",
                status: logs.alerts.length > 0 ? "degraded" : "ready",
              },
            ]}
          />

          <div className="fg-grid">
            <EntityTable
              title="Audit Preview"
              description="Latest governance events available for the selected scope."
              actions={<Link className="fg-nav-link" to={historyPath}>Open Audit History</Link>}
              tableLabel="Audit preview"
              columns={[
                { key: "createdAt", header: "Created", render: (item) => item.createdAt },
                { key: "actionLabel", header: "Action", render: (item) => item.actionLabel },
                { key: "statusLabel", header: "Status", render: (item) => item.statusLabel },
                { key: "summary", header: "Summary", render: (item) => item.summary },
              ]}
              rows={logs.audit_preview.slice(0, 8)}
              rowKey={(item) => item.eventId}
              emptyTitle="No audit events available."
              emptyDescription="The logs endpoint is not returning previewable governance events for this scope."
            />

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
        </>
      ) : null}

      <article
        id="audit-export"
        ref={auditExportRef}
        tabIndex={-1}
        className={`fg-card${location.hash === AUDIT_EXPORT_HASH ? " is-anchor-target" : ""}`}
      >
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
              <button className="fg-nav-link" type="button" onClick={downloadLatestExport}>
                Download latest export again
              </button>
            </div>
          </article>
        ) : null}
      </article>

      <article
        id="audit-history"
        ref={auditHistoryRef}
        tabIndex={-1}
        className={`fg-card${location.hash === AUDIT_HISTORY_HASH ? " is-anchor-target" : ""}`}
      >
        <div className="fg-panel-heading">
          <div>
            <h3>Audit history</h3>
            <p className="fg-muted">Use this as a focused evidence search surface. Filters stay URL-backed, detail stays separate, and raw payloads remain collapsible.</p>
          </div>
          <Link className="fg-nav-link" to={exportPath}>Open Audit Export</Link>
        </div>

        {!canReadAudit ? (
          <PermissionState
            title="Audit history is permission-limited"
            description="Audit history and detail require a standard operator or admin session. Viewer sessions stay on the logs overview only."
          />
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
                Outcome
                <select value={auditStatus ?? ""} onChange={(event) => updateAuditParam("auditStatus", event.target.value || null)}>
                  <option value="">Any outcome</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{optionLabel(status, history?.filters.available.statuses ?? [])}</option>)}
                </select>
              </label>
              <label>
                Actor
                <input value={auditActor ?? ""} placeholder="Search actor" onChange={(event) => updateAuditParam("auditActor", event.target.value || null)} />
              </label>
              <label>
                Target
                <input
                  value={auditTargetId ?? ""}
                  placeholder="Search target or correlation"
                  onChange={(event) => updateAuditParam("auditTargetId", event.target.value || null)}
                />
              </label>
            </div>

            {historyState === "loading" ? <p className="fg-muted">Loading audit history.</p> : null}
            {historyError ? <p className="fg-danger">{historyError}</p> : null}

            {history ? (
              <>
                <p className="fg-muted fg-mt-sm">
                  Showing {history.items.length} event{history.items.length === 1 ? "" : "s"} from {history.summary.totalMatchingFilters} matching result
                  {history.summary.totalMatchingFilters === 1 ? "" : "s"} in {history.summary.totalInScope} in-scope event
                  {history.summary.totalInScope === 1 ? "" : "s"}.
                </p>
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
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Target</th>
                          <th>Outcome</th>
                          <th>Correlation</th>
                          <th>Timestamp</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.items.map((item) => (
                          <tr key={item.eventId}>
                            <td>
                              {item.actor.label}
                              {item.actor.secondary ? <div className="fg-muted">{item.actor.secondary}</div> : null}
                            </td>
                            <td>
                              {item.actionLabel}
                              <div className="fg-muted">{item.actionKey}</div>
                            </td>
                            <td>
                              {item.target.label}
                              <div className="fg-muted">{item.target.typeLabel}{item.target.secondary ? ` · ${item.target.secondary}` : ""}</div>
                            </td>
                            <td><span className="fg-pill" data-tone={item.status === "ok" ? "success" : item.status === "warning" ? "warning" : "danger"}>{item.statusLabel}</span></td>
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

      {detailState === "loading" ? (
        <LoadingState
          title="Loading audit detail."
          description="ForgeFrame is restoring the selected audit event context."
        />
      ) : null}
      {detailError ? (
        <ErrorState
          title="Audit detail loading failed"
          description={detailError}
        />
      ) : null}
      {detail ? (
        <>
          <DetailPanel
            title={detail.event.actionLabel}
            description={detail.summary}
            status={detail.outcome}
            statusKey={detail.event.status === "ok" ? "ready" : detail.event.status === "warning" ? "degraded" : "blocked"}
            sticky
          >
            <h4>Short interpretation</h4>
            <p>{detail.summary}</p>
            <dl>
              <div>
                <dt>Actor</dt>
                <dd>{detail.actor.label}{detail.actor.secondary ? ` · ${detail.actor.secondary}` : ""}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{detail.target.label}{detail.target.secondary ? ` · ${detail.target.secondary}` : ""}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{detail.outcome}</dd>
              </div>
              <div>
                <dt>Correlation</dt>
                <dd>{detail.correlation ? `${detail.correlation.label}: ${detail.correlation.value}` : "n/a"}</dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>{detail.event.createdAt}</dd>
              </div>
            </dl>
            <h4>Change context</h4>
            <ul className="fg-list">
              {detail.changeContext.length === 0 ? <li>{detail.changeContextUnavailable ? "Change context unavailable." : "No change context recorded."}</li> : null}
              {detail.changeContext.map((item) => <li key={item.label}>{item.label}: {item.value}</li>)}
            </ul>
            <h4>Related links</h4>
            <ul className="fg-list">
              {detail.relatedLinks.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <Link to={withInstanceScope(link.href, instanceId)}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </DetailPanel>
          <AdvancedDiagnostics
            title="Raw metadata"
            description="Underlying audit event payload for troubleshooting and export verification."
            status={detail.event.status === "ok" ? "ready" : detail.event.status === "warning" ? "degraded" : "blocked"}
            statusKey={detail.event.status === "ok" ? "ready" : detail.event.status === "warning" ? "degraded" : "blocked"}
          >
            <pre>{JSON.stringify(detail.rawMetadata, null, 2)}</pre>
          </AdvancedDiagnostics>
        </>
      ) : null}
    </section>
  );
}
