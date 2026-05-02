/**
 * Logs page — Errors, Activity, and Audit History.
 *
 * Redesigned as a tabbed review surface with four clear modes:
 * - **Errors** — incident axes sorted by severity, blocked routing failures, error breakdown
 * - **Activity** — recent governance events and active alerts
 * - **Audit** — paginated audit history with filter presets, row selection, and contextual detail
 * - **Diagnostics** — signal-path health, metrics, logging, and tracing (raw data hidden by default)
 *
 * Tab state is driven by URL hash for deep linking and testability:
 *   /logs#errors      (default)
 *   /logs#activity
 *   /logs#audit
 *   /logs#diagnostics
 *
 * A persistent operational summary hero at the top shows active errors,
 * open incidents, recent warnings, audit event count, last critical event,
 * and the next recommended action — so an operator can tell within seconds
 * whether anything needs attention.
 *
 * Audit export is a separate, explicit workflow accessible from the Audit tab.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { withInstanceScope } from "../../app/tenantScope";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";
import { ErrorState, LoadingState } from "../../components/ui/StateBlocks";
import { AuditExportForm } from "./AuditExportForm";
import { AuditHistoryPanel } from "./AuditHistoryPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ErrorReviewPanel } from "./ErrorReviewPanel";
import { ActivityPanel } from "./ActivityPanel";
import { FilterPresets } from "./FilterPresets";
import { LogsSummaryHero } from "./LogsSummaryHero";
import type {
  AuditHistoryResponse,
  FilterPreset,
  LogTab,
} from "./types";
import { presetToParams } from "./utils";
import { useLogs } from "./useLogs";

/** Map of tab labels and hash keys. */
const TABS: Array<{ key: LogTab; label: string; hash: string }> = [
  { key: "errors", label: "Errors", hash: "#errors" },
  { key: "activity", label: "Activity", hash: "#activity" },
  { key: "audit", label: "Audit", hash: "#audit" },
  { key: "diagnostics", label: "Diagnostics", hash: "#diagnostics" },
];

/** Map from tab key to hash. */
const TAB_TO_HASH: Record<LogTab, string> = {
  errors: "#errors",
  activity: "#activity",
  audit: "#audit",
  diagnostics: "#diagnostics",
};

/** Map from hash to tab key. */
const HASH_TO_TAB: Record<string, LogTab> = {
  "#errors": "errors",
  "#activity": "activity",
  "#audit": "audit",
  "#audit-export": "audit",
  "#diagnostics": "diagnostics",
};

/** Default tab when no hash matches. */
const DEFAULT_TAB: LogTab = "errors";

/**
 * Parse the active tab from the URL hash.
 * @param hash - Location hash from router.
 * @returns Active tab key.
 */
function tabFromHash(hash: string): LogTab {
  return HASH_TO_TAB[hash] ?? DEFAULT_TAB;
}

/**
 * Main Logs page component.
 *
 * @returns The Logs page.
 */
export function LogsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const {
    logsLoadState,
    logsError,
    logs,
    historyLoadState,
    historyError,
    history,
    detailLoadState,
    detailError: _detailError,
    detail,
    summaryCounts,
    auditWindow,
    auditAction,
    auditActor,
    auditStatus,
    companyId,
  } = useLogs(searchParams);

  const { instances, loadState: instancesLoadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const canReadAudit = sessionReady && sessionHasAnyInstancePermission(session, "audit.read");
  const canGenerateExport = canReadAudit && session?.read_only !== true;

  // Derive active tab from URL hash
  const activeTab = useMemo(() => tabFromHash(location.hash), [location.hash]);

  const [activePreset, setActivePreset] = useState<FilterPreset | null>(null);

  // Sync export hash to audit tab
  const showExport = location.hash === "#audit-export";

  /** Handle tab change — update URL hash. */
  const onTabChange = useCallback((tab: LogTab) => {
    navigate({ ...location, hash: TAB_TO_HASH[tab] }, { replace: true });
  }, [navigate, location]);

  /** Handle filter preset selection. */
  const onPresetChange = useCallback((preset: FilterPreset | null) => {
    setActivePreset(preset);
    const nextSearchParams = new URLSearchParams(searchParams);
    ["auditStatus", "auditAction", "auditWindow"].forEach((key) => nextSearchParams.delete(key));
    if (preset) {
      const params = presetToParams(preset);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null) {
          nextSearchParams.set(key, value);
        }
      });
    }
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: "#audit",
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  /** Handle event selection for detail. */
  const onSelectEvent = useCallback((eventId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("auditEvent", eventId);
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: "#audit",
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  /** Close detail panel. */
  const onCloseDetail = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("auditEvent");
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: "#audit",
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  const onLoadMore = useCallback(() => {
    // Future: cursor-based pagination
  }, []);

  const onInstanceChange = useCallback((nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: location.hash,
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  const hasMorePages = history?.page.hasMore ?? false;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Errors, Activity, and Audit History"
        description="Operational signal, error review, governance events, and observability checks for the active instance scope."
        question="Is there an active issue, and what needs attention right now?"
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: logs?.operability.ready ? "Logging ready" : "Logging not ready", tone: logs?.operability.ready ? "success" : "warning" },
          ...(canReadAudit ? [] : [{ label: "Viewer read-only", tone: "warning" as const }]),
        ]}
        note="Errors, activity, audit, and diagnostics are separated into clear tabs. Raw payloads are hidden by default."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={instancesLoadState}
        error={instancesError}
        surfaceLabel="logs and audit evidence"
        onInstanceChange={onInstanceChange}
      />

      {/* Action links */}
      <div className="fg-actions fg-mb-md">
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>
          Incident Review
        </Link>
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId)}>
          Health
        </Link>
      </div>

      {/* Operational summary hero — always visible */}
      <LogsSummaryHero
        counts={summaryCounts}
        loading={logsLoadState === "loading"}
      />

      {/* Tab navigation */}
      <nav className="ff-logs-tabs" role="tablist" aria-label="Logs review sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            className="ff-logs-tab"
            aria-selected={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active tab content */}
      <div role="tabpanel" className="fg-mt-md">
        {logsLoadState === "loading" && activeTab !== "audit" ? (
          <LoadingState title="Loading logs data." description="ForgeFrame is restoring operational signals." />
        ) : null}

        {logsError && activeTab !== "audit" ? (
          <ErrorState title="Logs loading failed" description={logsError} />
        ) : null}

        {activeTab === "errors" ? (
          <ErrorReviewPanel
            logs={logs}
            loading={logsLoadState === "loading"}
            error={logsError}
            instanceId={instanceId}
            companyId={companyId}
            canReadAudit={canReadAudit}
          />
        ) : null}

        {activeTab === "activity" ? (
          <ActivityPanel
            logs={logs}
            loading={logsLoadState === "loading"}
            error={logsError}
            detail={detail}
            detailLoading={detailLoadState === "loading"}
            onSelectEvent={onSelectEvent}
            instanceId={instanceId}
            companyId={companyId}
            canReadAudit={canReadAudit}
          />
        ) : null}

        {activeTab === "audit" ? (
          <>
            {showExport ? (
              <AuditExportForm
                instanceId={instanceId}
                companyId={companyId}
                instanceName={selectedInstance?.display_name ?? null}
                canGenerateExport={canGenerateExport}
                history={history}
                defaultWindow={auditWindow}
                defaultAction={auditAction}
                defaultActor={auditActor}
                defaultStatus={auditStatus}
              />
            ) : (
              <AuditHistoryPanel
                history={history}
                loading={historyLoadState === "loading"}
                error={historyError}
                detail={detail}
                detailLoading={detailLoadState === "loading"}
                activePreset={activePreset}
                onPresetChange={onPresetChange}
                onSelectEvent={onSelectEvent}
                onCloseDetail={onCloseDetail}
                hasMore={hasMorePages}
                onLoadMore={onLoadMore}
                instanceId={instanceId}
                companyId={companyId}
                canReadAudit={canReadAudit}
              />
            )}
          </>
        ) : null}

        {activeTab === "diagnostics" ? (
          <DiagnosticsPanel
            logs={logs}
            loading={logsLoadState === "loading"}
            error={logsError}
            instanceId={instanceId}
            companyId={companyId}
            canReadAudit={canReadAudit}
          />
        ) : null}
      </div>

      {/* Anchor for audit-export deep link on audit tab */}
      {activeTab === "audit" && !showExport ? (
        <div className="fg-actions fg-mt-md">
          <Link
            className="fg-nav-link"
            to={{ ...location, hash: "#audit-export" }}
          >
            Open Audit Export
          </Link>
        </div>
      ) : null}
    </section>
  );
}
