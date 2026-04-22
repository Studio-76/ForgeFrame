import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AdminApiError,
  fetchAccounts,
  fetchAuditHistory,
  fetchAuditHistoryDetail,
  fetchLogs,
  generateAuditExport,
  type AdminSessionUser,
  type AuditExportFormat,
  type AuditExportResult,
  type AuditHistoryDetailResponse,
  type AuditHistoryResponse,
  type AuditHistoryStatus,
  type AuditHistoryWindow,
  type GatewayAccount,
  type LogsResponse,
} from "../api/admin";
import { buildAuditHistoryPath } from "../app/auditHistory";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams, withQueryParams, withTenantScope } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";
import { TenantScopeCard } from "../components/TenantScopeCard";

const AUDIT_WINDOW_PARAM = "auditWindow";
const AUDIT_ACTION_PARAM = "auditAction";
const AUDIT_ACTOR_PARAM = "auditActor";
const AUDIT_TARGET_TYPE_PARAM = "auditTargetType";
const AUDIT_TARGET_ID_PARAM = "auditTargetId";
const AUDIT_STATUS_PARAM = "auditStatus";
const AUDIT_EVENT_PARAM = "auditEvent";

type ErrorState = {
  message: string;
  code: string | null;
  status: number | null;
};

type AuditExportState = "idle" | "submitting" | "success" | "error" | "permission_limited";
type BadgeTone = "success" | "warning" | "danger" | "neutral";
type AuditExportAccessState = {
  badgeLabel: string;
  badgeTone: BadgeTone;
  detail: string;
  disabledReason: string | null;
  canExport: boolean;
};

const VIEWER_AUDIT_PERMISSION_MESSAGE = "Audit history and detail require a standard operator or admin session. Viewer sessions stay on the logs overview only.";

function getErrorState(error: unknown, fallback: string): ErrorState {
  if (error instanceof AdminApiError) {
    return {
      message: error.message || fallback,
      code: error.code ?? null,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallback,
      code: null,
      status: null,
    };
  }

  return {
    message: fallback,
    code: null,
    status: null,
  };
}

function normalizeAuditWindow(value: string | null): AuditHistoryWindow {
  return value === "24h" || value === "7d" || value === "30d" || value === "all" ? value : "7d";
}

function normalizeAuditStatus(value: string | null): AuditHistoryStatus | "" {
  return value === "ok" || value === "warning" || value === "failed" ? value : "";
}

function formatTimestamp(value: string | null | undefined, fallback = "No recent evidence"): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

function setSearchParam(searchParams: URLSearchParams, key: string, value: string | null) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    searchParams.delete(key);
    return;
  }
  searchParams.set(key, normalized);
}

function buildAuditExportSubject(values: Array<string | null | undefined>): string | null {
  const fragments = values
    .map((value) => (value ?? "").trim())
    .filter(Boolean);

  return fragments.length > 0 ? fragments.join(" ") : null;
}

function normalizeAuditExportLimit(value: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function triggerAuditExportDownload(result: AuditExportResult): void {
  if (
    typeof document === "undefined"
    || typeof URL === "undefined"
    || typeof URL.createObjectURL !== "function"
    || typeof URL.revokeObjectURL !== "function"
  ) {
    return;
  }

  const objectUrl = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = result.filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function getAuditExportAccess(session: AdminSessionUser | null, sessionReady: boolean): AuditExportAccessState {
  if (!sessionReady) {
    return {
      badgeLabel: "Checking export access",
      badgeTone: "neutral",
      detail: "ForgeGate is confirming whether this session can generate evidence packages or only inspect the retained audit history.",
      disabledReason: "Export stays disabled until the current session role and read-only posture are confirmed.",
      canExport: false,
    };
  }

  if (session?.role === "viewer") {
    return {
      badgeLabel: "Viewer read-only",
      badgeTone: "warning",
      detail: "Viewer sessions can keep the logs overview visible, but ForgeGate blocks audit history, detail, and export until the session is operator or admin.",
      disabledReason: "Viewer sessions cannot open audit history or generate exports. Open a standard operator or admin session.",
      canExport: false,
    };
  }

  if (session?.read_only) {
    return {
      badgeLabel: "Read-only session",
      badgeTone: "warning",
      detail: "Read-only sessions can inspect the same evidence scope, but export stays disabled to match impersonation and other backend read-only guards.",
      disabledReason: "This session is read-only. Open a standard operator or admin session to generate the current audit export.",
      canExport: false,
    };
  }

  return {
    badgeLabel: "Export enabled",
    badgeTone: "success",
    detail: "Standard operator and admin sessions can generate JSON or CSV packages from the current retained audit scope without leaving `/logs`.",
    disabledReason: null,
    canExport: true,
  };
}

export function LogsPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = getTenantIdFromSearchParams(searchParams);
  const companyId = (searchParams.get("companyId") ?? "").trim() || null;
  const auditWindow = normalizeAuditWindow(searchParams.get(AUDIT_WINDOW_PARAM));
  const auditAction = (searchParams.get(AUDIT_ACTION_PARAM) ?? "").trim();
  const auditActor = (searchParams.get(AUDIT_ACTOR_PARAM) ?? "").trim();
  const auditTargetType = (searchParams.get(AUDIT_TARGET_TYPE_PARAM) ?? "").trim();
  const auditTargetId = (searchParams.get(AUDIT_TARGET_ID_PARAM) ?? "").trim();
  const auditStatus = normalizeAuditStatus(searchParams.get(AUDIT_STATUS_PARAM));
  const selectedAuditEventId = (searchParams.get(AUDIT_EVENT_PARAM) ?? "").trim();

  const [overview, setOverview] = useState<LogsResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);
  const [overviewError, setOverviewError] = useState<ErrorState | null>(null);
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState<boolean>(false);
  const [accountsError, setAccountsError] = useState<string>("");
  const [auditHistory, setAuditHistory] = useState<AuditHistoryResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditAppending, setAuditAppending] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<ErrorState | null>(null);
  const [auditDetail, setAuditDetail] = useState<AuditHistoryDetailResponse | null>(null);
  const [auditDetailLoading, setAuditDetailLoading] = useState<boolean>(false);
  const [auditDetailError, setAuditDetailError] = useState<ErrorState | null>(null);
  const [exportFormat, setExportFormat] = useState<AuditExportFormat>("json");
  const [exportSubjectDraft, setExportSubjectDraft] = useState<string>("");
  const [exportLimitInput, setExportLimitInput] = useState<string>("250");
  const [auditExportState, setAuditExportState] = useState<AuditExportState>("idle");
  const [auditExportResult, setAuditExportResult] = useState<AuditExportResult | null>(null);
  const [auditExportError, setAuditExportError] = useState<ErrorState | null>(null);

  const selectedAccount = accounts.find((account) => account.account_id === tenantId) ?? null;
  const tenantScopeLabel = tenantId ? selectedAccount?.label ?? tenantId : "Shared logs";
  const tenantFilterRequired = overviewError?.code === "tenant_filter_required";
  const auditExportAccess = getAuditExportAccess(session, sessionReady);
  const derivedAuditExportSubject = buildAuditExportSubject([auditActor, auditTargetType, auditTargetId]);
  const maxAuditExportLimit = auditHistory?.retention.eventLimit ?? overview?.audit_retention.eventLimit ?? 250;
  const requestedAuditExportLimit = normalizeAuditExportLimit(exportLimitInput, Math.min(250, maxAuditExportLimit), maxAuditExportLimit);
  const auditExportSubject = exportSubjectDraft.trim() || null;
  const exportNeedsTenantScope = tenantId === null && companyId === null;
  const exportHistoryOnlyFilters = [
    auditActor ? `actor=${auditActor}` : null,
    auditTargetType ? `target type=${auditTargetType}` : null,
    auditTargetId ? `target id=${auditTargetId}` : null,
  ].filter((value): value is string => Boolean(value));
  const auditExportLink = withQueryParams(CONTROL_PLANE_ROUTES.auditExport, {
    tenantId,
    companyId,
    [AUDIT_WINDOW_PARAM]: auditWindow,
    [AUDIT_ACTION_PARAM]: auditAction || null,
    [AUDIT_STATUS_PARAM]: auditStatus || null,
  });
  const filterScopeSummary = [
    companyId ? `Company: ${companyId}` : null,
    `Window: ${auditWindow}`,
    auditAction ? `Action: ${auditAction}` : null,
    auditActor ? `Actor: ${auditActor}` : null,
    auditTargetType ? `Target type: ${auditTargetType}` : null,
    auditTargetId ? `Target id: ${auditTargetId}` : null,
    auditStatus ? `Status: ${auditStatus}` : null,
  ].filter(Boolean).join(" · ");
  const exportScopeSummary = [
    `Format: ${exportFormat.toUpperCase()}`,
    `Window: ${auditWindow}`,
    auditAction ? `Action: ${auditAction}` : null,
    auditStatus ? `Status: ${auditStatus}` : null,
    auditExportSubject ? `Subject: ${auditExportSubject}` : null,
    `Limit: ${requestedAuditExportLimit}`,
  ].filter(Boolean).join(" · ");

  const updateAuditParams = (updates: {
    window?: AuditHistoryWindow;
    action?: string | null;
    actor?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    status?: AuditHistoryStatus | "" | null;
    eventId?: string | null;
  }) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    setSearchParam(nextSearchParams, AUDIT_WINDOW_PARAM, updates.window ?? auditWindow);
    setSearchParam(nextSearchParams, AUDIT_ACTION_PARAM, updates.action ?? auditAction);
    setSearchParam(nextSearchParams, AUDIT_ACTOR_PARAM, updates.actor ?? auditActor);
    setSearchParam(nextSearchParams, AUDIT_TARGET_TYPE_PARAM, updates.targetType ?? auditTargetType);
    setSearchParam(nextSearchParams, AUDIT_TARGET_ID_PARAM, updates.targetId ?? auditTargetId);
    setSearchParam(nextSearchParams, AUDIT_STATUS_PARAM, updates.status ?? auditStatus);
    setSearchParam(nextSearchParams, AUDIT_EVENT_PARAM, updates.eventId ?? null);
    setSearchParams(nextSearchParams);
  };

  const onTenantChange = (nextTenantId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    setSearchParam(nextSearchParams, "tenantId", nextTenantId);
    nextSearchParams.delete(AUDIT_EVENT_PARAM);
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;
    const loadOverview = async () => {
      setOverviewLoading(true);
      try {
        const payload = await fetchLogs(tenantId, companyId);
        if (!mounted) {
          return;
        }
        setOverview(payload);
        setOverviewError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setOverview(null);
        setOverviewError(getErrorState(error, "Logs overview loading failed."));
      } finally {
        if (mounted) {
          setOverviewLoading(false);
        }
      }
    };

    void loadOverview();
    return () => {
      mounted = false;
    };
  }, [tenantId, companyId]);

  useEffect(() => {
    let mounted = true;
    const loadAccounts = async () => {
      try {
        const payload = await fetchAccounts();
        if (!mounted) {
          return;
        }
        setAccounts(payload.accounts);
        setAccountsError("");
      } catch (error) {
        if (!mounted) {
          return;
        }
        setAccountsError(error instanceof Error ? error.message : "Runtime account inventory failed to load.");
      } finally {
        if (mounted) {
          setAccountsLoaded(true);
        }
      }
    };

    void loadAccounts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (sessionReady && session?.role === "viewer") {
      setAuditHistory(null);
      setAuditError({
        message: VIEWER_AUDIT_PERMISSION_MESSAGE,
        code: "operator_role_required",
        status: 403,
      });
      setAuditLoading(false);
      return () => {
        mounted = false;
      };
    }

    const loadAuditHistory = async () => {
      setAuditLoading(true);
      try {
        const payload = await fetchAuditHistory({
          ...(tenantId ? { tenantId } : {}),
          ...(companyId ? { companyId } : {}),
          window: auditWindow,
          action: auditAction || null,
          actor: auditActor || null,
          targetType: auditTargetType || null,
          targetId: auditTargetId || null,
          status: auditStatus || null,
          limit: 25,
        });
        if (!mounted) {
          return;
        }
        setAuditHistory(payload);
        setAuditError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setAuditHistory(null);
        setAuditError(getErrorState(error, "Audit history loading failed."));
      } finally {
        if (mounted) {
          setAuditLoading(false);
        }
      }
    };

    void loadAuditHistory();
    return () => {
      mounted = false;
    };
  }, [session, sessionReady, tenantId, companyId, auditAction, auditActor, auditStatus, auditTargetId, auditTargetType, auditWindow]);

  useEffect(() => {
    let mounted = true;

    if (!selectedAuditEventId) {
      setAuditDetail(null);
      setAuditDetailError(null);
      setAuditDetailLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (sessionReady && session?.role === "viewer") {
      setAuditDetail(null);
      setAuditDetailError({
        message: VIEWER_AUDIT_PERMISSION_MESSAGE,
        code: "operator_role_required",
        status: 403,
      });
      setAuditDetailLoading(false);
      return () => {
        mounted = false;
      };
    }

    const loadAuditDetail = async () => {
      setAuditDetailLoading(true);
      try {
        const payload = await fetchAuditHistoryDetail(selectedAuditEventId, tenantId, companyId);
        if (!mounted) {
          return;
        }
        setAuditDetail(payload);
        setAuditDetailError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setAuditDetail(null);
        setAuditDetailError(getErrorState(error, "Audit detail loading failed."));
      } finally {
        if (mounted) {
          setAuditDetailLoading(false);
        }
      }
    };

    void loadAuditDetail();
    return () => {
      mounted = false;
    };
  }, [session, sessionReady, selectedAuditEventId, tenantId, companyId]);

  useEffect(() => {
    setAuditExportState("idle");
    setAuditExportResult(null);
    setAuditExportError(null);
  }, [auditAction, auditStatus, auditWindow, exportFormat, exportLimitInput, exportSubjectDraft, tenantId, companyId]);

  const loadMoreAuditHistory = async () => {
    if (!auditHistory?.page.nextCursor) {
      return;
    }

    setAuditAppending(true);
    try {
      const nextPage = await fetchAuditHistory({
        ...(tenantId ? { tenantId } : {}),
        ...(companyId ? { companyId } : {}),
        window: auditWindow,
        action: auditAction || null,
        actor: auditActor || null,
        targetType: auditTargetType || null,
        targetId: auditTargetId || null,
        status: auditStatus || null,
        cursor: auditHistory.page.nextCursor,
        limit: auditHistory.page.limit,
      });

      setAuditHistory((current) => {
        if (!current) {
          return nextPage;
        }
        return {
          ...nextPage,
          items: [...current.items, ...nextPage.items],
        };
      });
      setAuditError(null);
    } catch (error) {
      setAuditError(getErrorState(error, "More audit history could not be loaded."));
    } finally {
      setAuditAppending(false);
    }
  };

  const generateCurrentAuditExport = async () => {
    if (!auditExportAccess.canExport || exportNeedsTenantScope || auditExportState === "submitting") {
      return;
    }

    setAuditExportState("submitting");
    setAuditExportError(null);
    try {
      const result = await generateAuditExport({
        format: exportFormat,
        window: auditWindow,
        action: auditAction || null,
        status: auditStatus || null,
        subject: auditExportSubject,
        limit: requestedAuditExportLimit,
      }, tenantId, companyId);
      setAuditExportResult(result);
      setAuditExportState("success");
      triggerAuditExportDownload(result);
    } catch (error) {
      setAuditExportResult(null);
      const nextError = getErrorState(error, "Audit export failed.");
      setAuditExportError(nextError);
      setAuditExportState(nextError.status === 403 ? "permission_limited" : "error");
    }
  };

  const noAuditEventsInScope = Boolean(auditHistory && auditHistory.summary.totalInScope === 0);
  const noAuditResults = Boolean(auditHistory && auditHistory.summary.totalInScope > 0 && auditHistory.summary.totalMatchingFilters === 0);
  const auditPermissionLimited = auditError?.status === 403;
  const auditDetailPermissionLimited = auditDetailError?.status === 403;
  const auditExportBadge = auditExportState === "submitting"
    ? { label: "Export pending", tone: "warning" as BadgeTone }
    : auditExportState === "success"
      ? { label: "Export ready", tone: "success" as BadgeTone }
    : auditExportState === "permission_limited"
        ? { label: "Permission-limited export", tone: "warning" as BadgeTone }
        : auditExportState === "error"
          ? { label: "Export failed", tone: "danger" as BadgeTone }
          : !auditExportAccess.canExport
            ? { label: auditExportAccess.badgeLabel, tone: auditExportAccess.badgeTone }
            : exportNeedsTenantScope
              ? { label: "Tenant scope required", tone: "warning" as BadgeTone }
              : { label: auditExportAccess.badgeLabel, tone: auditExportAccess.badgeTone };
  const auditExportEventPath = auditExportResult
    ? buildAuditHistoryPath({
      tenantId,
      window: "all",
      action: "audit_export_generated",
      targetType: "audit_export",
      targetId: auditExportResult.exportId,
      status: "ok",
    })
    : null;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Errors, Activity, and Audit History"
        description="Operational troubleshooting and governance evidence stay on one route for now, but the page separates the operator intents explicitly."
        question="Are you diagnosing runtime behavior, reviewing governance evidence, or packaging an export?"
        links={[
          {
            label: "Errors & Activity",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Operability checks, active alerts, runtime errors, and a small governance preview.",
          },
          {
            label: "Audit History",
            to: CONTROL_PLANE_ROUTES.auditHistory,
            description: "Filterable evidence history with normalized detail instead of a raw mixed logs list.",
          },
          {
            label: "Audit Export",
            to: CONTROL_PLANE_ROUTES.auditExport,
            description: "Generate a synchronous JSON or CSV evidence package from the shipped export contract.",
          },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Return to the provider surface when the incident points at a specific harness or provider.",
          },
          {
            label: "Usage & Costs",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Compare cost, traffic, and client impact before escalating.",
          },
        ]}
        badges={[{ label: tenantId ? `Tenant scope: ${tenantScopeLabel}` : "Shared logs", tone: tenantId ? "success" : "neutral" }]}
        note="Audit History and Audit Export stay on `/logs`, but ForgeGate now separates evidence review from evidence packaging with distinct anchors and explicit backend-backed export states."
      />

      <TenantScopeCard
        tenantId={tenantId}
        accounts={accounts}
        accountsLoaded={accountsLoaded}
        accountsError={accountsError}
        tenantFilterRequired={tenantFilterRequired}
        surfaceLabel="logs and audit"
        onTenantChange={onTenantChange}
      />

      {overviewError && !tenantFilterRequired ? <p className="fg-danger">{overviewError.message}</p> : null}

      <div id="errors-activity" className="fg-grid">
        {overviewLoading ? (
          <article className="fg-card">
            <h3>Loading errors and activity</h3>
            <p className="fg-muted">ForgeGate is refreshing operability checks, alerts, runtime error summaries, and the audit preview.</p>
          </article>
        ) : null}

        {tenantFilterRequired ? (
          <article className="fg-card">
            <h3>Errors & Activity need tenant scope</h3>
            <p className="fg-muted">{overviewError?.message}</p>
            <p className="fg-note fg-mt-sm">
              Audit History can still be reviewed below, but ForgeGate will not invent a shared runtime error snapshot across multiple tenants.
            </p>
          </article>
        ) : null}

        {overview ? (
          <>
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Operability</h3>
                  <p className="fg-muted">Runtime signal path, health signal path, tracing scope, and observability storage posture.</p>
                </div>
                <span className="fg-pill" data-tone={overview.operability.ready ? "success" : "warning"}>
                  {overview.operability.ready ? "Operationally ready" : "Needs review"}
                </span>
              </div>
              <ul className="fg-list">
                {Array.isArray(overview.operability.checks) ? overview.operability.checks.map((item, index) => (
                  <li key={`${String((item as Record<string, unknown>).id ?? index)}`}>
                    {String((item as Record<string, unknown>).id)} · ok={String((item as Record<string, unknown>).ok)} · {String((item as Record<string, unknown>).details)}
                  </li>
                )) : null}
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Alerts</h3>
                  <p className="fg-muted">Current runtime attention signals for the selected tenant scope.</p>
                </div>
                <span className="fg-pill" data-tone={overview.alerts.length > 0 ? "warning" : "success"}>
                  {overview.alerts.length > 0 ? `${overview.alerts.length} active` : "No active alerts"}
                </span>
              </div>
              <ul className="fg-list">
                {overview.alerts.length === 0 ? <li>No active alerts.</li> : null}
                {overview.alerts.map((alert, index) => (
                  <li key={`${String(alert.type)}-${index}`}>{String(alert.severity)} · {String(alert.type)} · {String(alert.message)}</li>
                ))}
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Error Summary</h3>
                  <p className="fg-muted">Keep runtime error shape here instead of mixing it into governance evidence review.</p>
                </div>
              </div>
              <pre>{JSON.stringify(overview.error_summary, null, 2)}</pre>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Audit Preview</h3>
                  <p className="fg-muted">Overview only. Use Audit History below for filters, detail, and retention-aware review.</p>
                </div>
                <span className="fg-pill" data-tone={overview.audit_preview.length > 0 ? "neutral" : "warning"}>
                  {overview.audit_preview.length > 0 ? "Preview only" : "No preview yet"}
                </span>
              </div>
              <ul className="fg-list">
                {overview.audit_preview.length === 0 ? <li>No recent audit evidence recorded.</li> : null}
                {overview.audit_preview.map((event) => (
                  <li key={event.eventId}>
                    {formatTimestamp(event.createdAt, "No timestamp")} · {event.actionLabel} · {event.statusLabel}
                  </li>
                ))}
              </ul>
              <p className="fg-muted fg-mt-sm">
                Latest audit event: {formatTimestamp(overview.audit_retention.latestEventAt)}
              </p>
              <Link className="fg-nav-link" to={buildAuditHistoryPath({ tenantId, companyId })}>
                Open Audit History
              </Link>
            </article>
          </>
        ) : null}
      </div>

      <article id="audit-history" className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Audit History</h3>
            <p className="fg-muted">Filter by time window, action, actor, target, and status, then open one event into a human-readable evidence view.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">
            Export stays on this route
          </span>
        </div>

        <div className="fg-inline-form">
          <label>
            Window
            <select value={auditWindow} onChange={(event) => updateAuditParams({ window: event.target.value as AuditHistoryWindow })}>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="all">All retained</option>
            </select>
          </label>

          <label>
            Action
            <select value={auditAction} onChange={(event) => updateAuditParams({ action: event.target.value, eventId: null })}>
              <option value="">All actions</option>
              {auditHistory?.filters.available.actions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Actor
            <input
              value={auditActor}
              onChange={(event) => updateAuditParams({ actor: event.target.value, eventId: null })}
              placeholder="Search actor"
            />
          </label>

          <label>
            Target type
            <select value={auditTargetType} onChange={(event) => updateAuditParams({ targetType: event.target.value, eventId: null })}>
              <option value="">All target types</option>
              {auditHistory?.filters.available.targetTypes.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Target id
            <input
              value={auditTargetId}
              onChange={(event) => updateAuditParams({ targetId: event.target.value, eventId: null })}
              placeholder="Search target id"
            />
          </label>

          <label>
            Status
            <select value={auditStatus} onChange={(event) => updateAuditParams({ status: event.target.value as AuditHistoryStatus | "", eventId: null })}>
              <option value="">All statuses</option>
              {auditHistory?.filters.available.statuses.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="fg-muted fg-mt-sm">{filterScopeSummary}</p>
        <div className="fg-row fg-mt-sm">
          <Link className="fg-nav-link" to={auditExportLink}>
            Open Audit Export
          </Link>
          <span className="fg-muted">Window, action, and status stay shared across history review and export generation.</span>
        </div>

        {auditHistory?.retention.retentionLimited ? (
          <p className="fg-note fg-mt-sm">
            Audit retention is limited to the newest {auditHistory.retention.eventLimit} events. Older evidence before {formatTimestamp(auditHistory.retention.oldestAvailableAt)} is outside the retained set.
          </p>
        ) : null}

        <article id="audit-export" className="fg-subcard fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h4>Audit export</h4>
              <p className="fg-muted">Generate a synchronous JSON or CSV package from the shipped backend contract without leaving `/logs`.</p>
            </div>
            <span className="fg-pill" data-tone={auditExportBadge.tone}>
              {auditExportBadge.label}
            </span>
          </div>

          <p className="fg-muted">{auditExportAccess.detail}</p>
          <p className="fg-note fg-mt-sm">
            Export reuses the current tenant scope plus the current audit-history `Window`, `Action`, and `Status` filters. `Subject` is the shipped free-text export filter across actor, target, summary, and raw metadata.
          </p>

          {exportHistoryOnlyFilters.length > 0 ? (
            <p className="fg-note fg-mt-sm">
              Current history-only filters ({exportHistoryOnlyFilters.join(" · ")}) are not first-class export fields yet. ForgeGate keeps them for review only; type `Subject` explicitly if the exported package must stay narrowed to the same evidence slice.
            </p>
          ) : null}

          <div className="fg-inline-form fg-mt-sm">
            <label>
              Format
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as AuditExportFormat)}
                disabled={!auditExportAccess.canExport || exportNeedsTenantScope || auditExportState === "submitting"}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>

            <label>
              Subject
              <input
                value={exportSubjectDraft}
                onInput={(event) => setExportSubjectDraft(event.currentTarget.value)}
                placeholder={derivedAuditExportSubject ?? "Optional text search across actor, target, summary, and metadata"}
                disabled={!auditExportAccess.canExport || exportNeedsTenantScope || auditExportState === "submitting"}
              />
            </label>

            <label>
              Row limit
              <input
                type="number"
                min={1}
                max={maxAuditExportLimit}
                value={exportLimitInput}
                onInput={(event) => setExportLimitInput(event.currentTarget.value)}
                disabled={!auditExportAccess.canExport || exportNeedsTenantScope || auditExportState === "submitting"}
              />
            </label>

            <button
              type="button"
              onClick={() => void generateCurrentAuditExport()}
              disabled={!auditExportAccess.canExport || exportNeedsTenantScope || auditExportState === "submitting"}
            >
              {auditExportState === "submitting" ? `Generating ${exportFormat.toUpperCase()} export...` : `Generate ${exportFormat.toUpperCase()} export`}
            </button>
          </div>

          <p className="fg-muted fg-mt-sm">Current export scope: {exportScopeSummary}</p>

          {exportNeedsTenantScope ? (
            <article className="fg-subcard fg-mt-sm">
              <h5>Tenant scope required before export</h5>
              <p className="fg-muted">The shipped export endpoint rejects mixed-tenant exports. Select one tenant above before generating an evidence package.</p>
            </article>
          ) : null}

          {!auditExportAccess.canExport || (auditExportState === "permission_limited" && auditExportError) ? (
            <article className="fg-subcard fg-mt-sm">
              <h5>{auditExportState === "permission_limited" ? "Permission-limited export" : "Export unavailable for this session"}</h5>
              <p className="fg-muted">{auditExportError?.message ?? auditExportAccess.disabledReason}</p>
            </article>
          ) : null}

          {auditExportState === "submitting" ? (
            <article className="fg-subcard fg-mt-sm">
              <h5>Generating audit export</h5>
              <p className="fg-muted">ForgeGate is preparing the package and keeps the current audit scope visible while the synchronous export runs.</p>
            </article>
          ) : null}

          {auditExportState === "error" && auditExportError ? (
            <article className="fg-subcard fg-mt-sm">
              <h5>Audit export failed</h5>
              <p className="fg-danger">{auditExportError.message}</p>
            </article>
          ) : null}

          {auditExportResult ? (
            <article className="fg-subcard fg-mt-sm">
              <h5>Latest exported package</h5>
              <p className="fg-muted">The export itself is audited. Keep this statement with the current route scope instead of reconstructing it from memory.</p>
              <ul className="fg-list">
                <li><strong>Package</strong>: {auditExportResult.filename}</li>
                <li><strong>Rows exported</strong>: {auditExportResult.rowCount}</li>
                <li><strong>Generated</strong>: {formatTimestamp(auditExportResult.generatedAt, "just now")}</li>
                <li><strong>Export id</strong>: {auditExportResult.exportId}</li>
                <li><strong>Scope</strong>: {exportScopeSummary}</li>
              </ul>
              <div className="fg-row fg-mt-sm">
                <button type="button" onClick={() => triggerAuditExportDownload(auditExportResult)}>
                  Download latest export again
                </button>
                {auditExportEventPath ? (
                  <Link className="fg-nav-link" to={auditExportEventPath}>
                    Open export audit event
                  </Link>
                ) : null}
              </div>
            </article>
          ) : null}
        </article>

        <div className="fg-audit-layout fg-mt-md">
          <div className="fg-stack">
            {auditLoading && !auditHistory ? (
              <article className="fg-subcard">
                <h4>Loading audit history</h4>
                <p className="fg-muted">Persistent filters stay visible while ForgeGate refreshes the current evidence scope.</p>
              </article>
            ) : null}

            {auditPermissionLimited ? (
              <article className="fg-subcard">
                <h4>Audit history is permission-limited</h4>
                <p className="fg-muted">{auditError?.message}</p>
              </article>
            ) : null}

            {auditError && !auditPermissionLimited ? (
              <article className="fg-subcard">
                <h4>Audit history unavailable</h4>
                <p className="fg-danger">{auditError.message}</p>
              </article>
            ) : null}

            {auditHistory && noAuditEventsInScope ? (
              <article className="fg-subcard">
                <h4>No audit evidence yet</h4>
                <p className="fg-muted">
                  {auditWindow === "all"
                    ? "No audit evidence has been retained for the current scope yet."
                    : "No audit evidence was recorded in the selected window for the current scope."}
                </p>
              </article>
            ) : null}

            {auditHistory && noAuditResults ? (
              <article className="fg-subcard">
                <h4>No results for the current filters.</h4>
                <p className="fg-muted">Keep the current scope visible, then widen the filters if you need older or broader evidence.</p>
              </article>
            ) : null}

            {auditHistory && auditHistory.items.length > 0 ? (
              <div className="fg-table-wrap">
                <table className="fg-table">
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Action</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Target</th>
                      <th scope="col">Summary</th>
                      <th scope="col">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditHistory.items.map((event) => (
                      <tr key={event.eventId} className={selectedAuditEventId === event.eventId ? "is-selected" : undefined}>
                        <td>{formatTimestamp(event.createdAt, "No timestamp")}</td>
                        <td>
                          <strong>{event.actionLabel}</strong>
                          <div className="fg-muted">{event.actionKey}</div>
                        </td>
                        <td>{event.statusLabel}</td>
                        <td>
                          <strong>{event.actor.label}</strong>
                          {event.actor.secondary ? <div className="fg-muted">{event.actor.secondary}</div> : null}
                        </td>
                        <td>
                          <strong>{event.target.label}</strong>
                          <div className="fg-muted">{event.target.typeLabel}</div>
                        </td>
                        <td>{event.summary}</td>
                        <td>
                          <button type="button" className="fg-table-trigger" onClick={() => updateAuditParams({ eventId: event.eventId })}>
                            {selectedAuditEventId === event.eventId ? "Selected" : "Open detail"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {auditHistory?.page.hasMore ? (
              <div className="fg-row">
                <button type="button" disabled={auditAppending} onClick={() => void loadMoreAuditHistory()}>
                  {auditAppending ? "Loading more..." : "Load more audit history"}
                </button>
              </div>
            ) : null}
          </div>

          <aside className="fg-card fg-audit-detail-panel">
            {!selectedAuditEventId && !auditDetail ? (
              <>
                <h4>Audit detail</h4>
                <p className="fg-muted">Select an evidence row to inspect actor, target, outcome, structured change context, and raw metadata.</p>
              </>
            ) : null}

            {auditDetailLoading ? (
              <>
                <h4>Loading audit detail</h4>
                <p className="fg-muted">ForgeGate is retrieving the selected audit event without clearing the current table scope.</p>
              </>
            ) : null}

            {auditDetailPermissionLimited ? (
              <>
                <h4>Audit detail is permission-limited</h4>
                <p className="fg-muted">{auditDetailError?.message}</p>
              </>
            ) : null}

            {auditDetailError && !auditDetailPermissionLimited ? (
              <>
                <h4>Audit detail unavailable</h4>
                <p className="fg-danger">{auditDetailError.message}</p>
              </>
            ) : null}

            {auditDetail ? (
              <div className="fg-stack">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{auditDetail.event.actionLabel}</h4>
                    <p className="fg-muted">{auditDetail.summary}</p>
                  </div>
                  <span className="fg-pill" data-tone={auditDetail.event.status === "failed" ? "danger" : auditDetail.event.status === "warning" ? "warning" : "success"}>
                    {auditDetail.event.statusLabel}
                  </span>
                </div>

                <div className="fg-detail-grid">
                  <div><strong>Occurred</strong>: {formatTimestamp(auditDetail.event.createdAt, "No timestamp")}</div>
                  <div><strong>Actor</strong>: {auditDetail.actor.label}{auditDetail.actor.secondary ? ` · ${auditDetail.actor.secondary}` : ""}</div>
                  <div><strong>Target</strong>: {auditDetail.target.label}{auditDetail.target.typeLabel ? ` · ${auditDetail.target.typeLabel}` : ""}</div>
                  <div><strong>Outcome</strong>: {auditDetail.outcome}</div>
                </div>

                <div className="fg-subcard">
                  <h4>Change context</h4>
                  {auditDetail.changeContextUnavailable ? (
                    <p className="fg-muted">Structured change context was not recorded for this event family. Use the summary and raw metadata below without assuming missing precision.</p>
                  ) : (
                    <ul className="fg-list">
                      {auditDetail.changeContext.map((item) => (
                        <li key={`${auditDetail.event.eventId}-${item.label}`}>
                          <strong>{item.label}</strong>: {item.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {auditDetail.redactions.length > 0 ? (
                  <div className="fg-subcard">
                    <h4>Redactions</h4>
                    <p className="fg-muted">Sensitive metadata stays hidden in-line. ForgeGate marks the fields that were intentionally redacted.</p>
                    <ul className="fg-list">
                      {auditDetail.redactions.map((item) => (
                        <li key={`${item.path}-${item.reason}`}>
                          {item.path} · {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="fg-subcard">
                  <h4>Raw metadata</h4>
                  <pre>{JSON.stringify(auditDetail.rawMetadata, null, 2)}</pre>
                </div>

                {auditDetail.relatedLinks.length > 0 ? (
                  <div className="fg-row">
                    {auditDetail.relatedLinks.map((link) => (
                      <Link key={`${link.href}-${link.label}`} className="fg-nav-link" to={withTenantScope(link.href, tenantId)}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </article>
    </section>
  );
}
