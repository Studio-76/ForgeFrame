/**
 * Logs page — Incidents, Logs, Activity, Audit History, and Diagnostics.
 *
 * Redesigned as a tabbed review surface with five clear modes:
 * - **Incidents** — active issue list, remediation callout, selected evidence
 * - **Logs** — historical error breakdown and raw evidence handoff
 * - **Activity** — recent governance events and active alerts
 * - **Audit** — paginated audit history with filter presets, row selection, and contextual detail
 * - **Diagnostics** — signal-path health, metrics, logging, and tracing (raw data hidden by default)
 *
 * Tab state is driven by URL hash for deep linking and testability:
 *   /logs#incidents   (default)
 *   /logs#logs
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
import { PageHeader } from "../../components/ui/PageHeader";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateBlocks";
import { AuditExportForm } from "./AuditExportForm";
import { AuditHistoryPanel } from "./AuditHistoryPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ErrorReviewPanel } from "./ErrorReviewPanel";
import { LogsEvidencePanel } from "./LogsEvidencePanel";
import { ActivityPanel } from "./ActivityPanel";
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
  { key: "incidents", label: "Incidents", hash: "#incidents" },
  { key: "logs", label: "Logs", hash: "#logs" },
  { key: "activity", label: "Activity", hash: "#activity" },
  { key: "audit", label: "Audit history", hash: "#audit-history" },
  { key: "diagnostics", label: "Diagnostics", hash: "#diagnostics" },
];

/** Map from tab key to hash. */
const TAB_TO_HASH: Record<LogTab, string> = {
  incidents: "#incidents",
  logs: "#logs",
  activity: "#activity",
  audit: "#audit-history",
  diagnostics: "#diagnostics",
};

/** Map from hash to tab key. */
const HASH_TO_TAB: Record<string, LogTab> = {
  "#incidents": "incidents",
  "#errors": "incidents",
  "#logs": "logs",
  "#activity": "activity",
  "#audit-history": "audit",
  "#audit": "audit",
  "#audit-export": "audit",
  "#diagnostics": "diagnostics",
};

/** Default tab when no hash matches. */
const DEFAULT_TAB: LogTab = "incidents";

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
      hash: "#audit-history",
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  /** Handle event selection for detail. */
  const onSelectEvent = useCallback((eventId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("auditEvent", eventId);
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: "#audit-history",
    }, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  /** Close detail panel. */
  const onCloseDetail = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("auditEvent");
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: "#audit-history",
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
      <PageHeader
        eyebrow="Operations"
        title="Incidents and Observability"
        description="Incident response, logs, activity, audit history, and diagnostics separated into clear operator modes."
      />

      {/* ── Scope indicator ── */}
      {selectedInstance ? (
        <div className="flex items-center gap-2 px-1 py-1.5 mb-2 text-meta text-muted">
          <span className="font-medium">Scope:</span>
          <span className="text-primary">{selectedInstance.display_name ?? selectedInstance.instance_id}</span>
          <Button variant="navigation" density="compact" onPress={() => onInstanceChange(null)}>
            Change
          </Button>
        </div>
      ) : null}
      <div hidden={!!selectedInstance}>
        <InstanceScopeCard
          instanceId={instanceId}
          selectedInstance={selectedInstance}
          instances={instances}
          loadState={instancesLoadState}
          error={instancesError}
          surfaceLabel="logs and audit evidence"
          onInstanceChange={onInstanceChange}
        />
      </div>

      {/* Action links */}
      <div className="fg-actions fg-mb-md">
        {!selectedInstance ? null : (
          <>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>
              Review incidents
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId)}>
              Review runtime health
            </Link>
          </>
        )}
      </div>

      {/* Operational summary hero — always visible */}
      <LogsSummaryHero
        counts={summaryCounts}
        loading={logsLoadState === "loading"}
        instanceId={instanceId}
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

        {activeTab === "incidents" ? (
          <ErrorReviewPanel
            logs={logs}
            loading={logsLoadState === "loading"}
            error={logsError}
            instanceId={instanceId}
            companyId={companyId}
            canReadAudit={canReadAudit}
          />
        ) : null}

        {activeTab === "logs" ? (
          <LogsEvidencePanel
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
            Export audit data
          </Link>
        </div>
      ) : null}
    </section>
  );
}
