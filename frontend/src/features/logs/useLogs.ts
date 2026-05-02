/**
 * Custom hooks for the Logs feature module.
 *
 * Wraps TanStack Query hooks from adminQueries to provide
 * combined state for the Logs surface.
 *
 * @packageDocumentation
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  useAuditHistoryDetailQuery,
  useAuditHistoryQuery,
  useLogsQuery,
} from "../../api/adminQueries";
import type {
  LogsResponse,
  AuditHistoryResponse,
  AuditHistoryDetailResponse,
  AuditHistoryQuery,
  AuditHistoryStatus,
  AuditHistoryWindow,
} from "../../api/domain";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import type {
  LoadState,
  LogsSummaryCounts,
} from "./types";
import { countActiveErrors, getNextAction, getPrimaryRemediationLink } from "./utils";

/** Combined return type for useLogsData. */
export interface UseLogsReturn {
  /** Logs data load state. */
  logsLoadState: LoadState;
  /** Logs data error message. */
  logsError: string | null;
  /** Logs API response. */
  logs: LogsResponse | null;
  /** Audit history load state. */
  historyLoadState: LoadState;
  /** Audit history error message. */
  historyError: string | null;
  /** Audit history response. */
  history: AuditHistoryResponse | null;
  /** Audit detail load state. */
  detailLoadState: LoadState;
  /** Audit detail error message. */
  detailError: string | null;
  /** Audit detail response. */
  detail: AuditHistoryDetailResponse | null;
  /** Derived summary counts. */
  summaryCounts: LogsSummaryCounts;
  /** Instance ID parsed from URL. */
  instanceId: string | null;
  /** Company ID parsed from URL. */
  companyId: string | null;
  /** Parsed URL filter params. */
  auditWindow: AuditHistoryWindow;
  auditAction: string | null;
  auditActor: string | null;
  auditTargetType: string | null;
  auditTargetId: string | null;
  auditStatus: AuditHistoryStatus | null;
  auditEventId: string | null;
}

/**
 * Parse a search param with optional trimming.
 * @param searchParams - URLSearchParams.
 * @param key - Parameter key.
 * @returns Trimmed value or null.
 */
function normalizedParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key)?.trim();
  return value ? value : null;
}

/**
 * Parse audit window from URL params.
 * @param searchParams - URLSearchParams.
 * @returns AuditHistoryWindow value.
 */
function getAuditWindow(searchParams: URLSearchParams): AuditHistoryWindow {
  const value = searchParams.get("auditWindow");
  return value === "24h" || value === "30d" || value === "all" ? value : "7d";
}

/**
 * Parse audit status from URL params.
 * @param searchParams - URLSearchParams.
 * @returns Audit status or null.
 */
function getAuditStatus(searchParams: URLSearchParams): AuditHistoryStatus | null {
  const value = searchParams.get("auditStatus");
  return value === "ok" || value === "warning" || value === "failed" ? value : null;
}

/**
 * Primary hook for the Logs page.
 * Manages all data fetching via TanStack Query and parses URL state.
 * @param searchParams - URLSearchParams from the router.
 * @param canReadAudit - Whether the session can read audit data.
 * @returns Combined data state.
 */
export function useLogs(searchParams: URLSearchParams, canReadAudit = true): UseLogsReturn {
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const companyId = normalizedParam(searchParams, "companyId");
  const auditWindow = getAuditWindow(searchParams);
  const auditAction = normalizedParam(searchParams, "auditAction");
  const auditActor = normalizedParam(searchParams, "auditActor");
  const auditTargetType = normalizedParam(searchParams, "auditTargetType");
  const auditTargetId = normalizedParam(searchParams, "auditTargetId");
  const auditStatus = getAuditStatus(searchParams);
  const auditEventId = normalizedParam(searchParams, "auditEvent");

  const logsQuery = useLogsQuery(instanceId, undefined, companyId);
  const historyQuery = useAuditHistoryQuery({
    instanceId,
    companyId,
    window: auditWindow,
    action: auditAction,
    actor: auditActor,
    targetType: auditTargetType,
    targetId: auditTargetId,
    status: auditStatus,
    limit: 25,
  } satisfies AuditHistoryQuery);
  const detailQuery = useAuditHistoryDetailQuery(
    auditEventId ?? "",
    instanceId,
    undefined,
    companyId,
  );

  const summaryCounts = useMemo<LogsSummaryCounts>(() => {
    const axes = logsQuery.data?.incident_review?.axes ?? [];
    const activeAxes = axes.filter((axis) => axis.severity === "critical"
      || (axis.severity === "warning" && axis.count > 0)
      || (axis.severity === "info" && axis.count > 0));
    const topIssue = [...activeAxes].sort((left, right) => {
      const severityRank = (severity: string) => severity === "critical" ? 0
        : severity === "warning" ? 1
        : severity === "info" ? 2
        : severity === "clear" ? 3
        : 4;
      return severityRank(left.severity) - severityRank(right.severity)
        || right.count - left.count;
    })[0] ?? null;
    const primaryAction = topIssue ? getPrimaryRemediationLink(topIssue.links) : null;
    return {
      activeErrors: countActiveErrors(logsQuery.data ?? null),
      openIncidents: axes.filter((a) => a.severity === "warning").length,
      recentWarnings: logsQuery.data?.alerts.filter((a) => String(a.severity) === "warning").length ?? 0,
      auditEventCount: historyQuery.data?.summary.totalInScope ?? logsQuery.data?.audit_preview.length ?? 0,
      lastCriticalEvent: topIssue?.severity === "critical" ? topIssue.last_seen_at ?? null : null,
      nextAction: getNextAction(logsQuery.data ?? null),
      topSubsystem: topIssue?.axis_label ?? "All systems",
      impact: topIssue?.current_effect ?? "No active incident is visible in the current scope.",
      primaryActionLabel: primaryAction?.label ?? "Monitor incidents",
      primaryActionHref: primaryAction?.href ?? null,
    };
  }, [logsQuery.data, historyQuery.data]);

  const detailError = detailQuery.error
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : "Audit detail loading failed."
    : null;

  return {
    logsLoadState: logsQuery.isLoading ? "loading" : logsQuery.isError ? "error" : logsQuery.data ? "success" : "idle",
    logsError: logsQuery.error instanceof Error ? logsQuery.error.message : null,
    logs: logsQuery.data ?? null,
    historyLoadState: historyQuery.isLoading ? "loading" : historyQuery.isError ? "error" : historyQuery.data ? "success" : "idle",
    historyError: historyQuery.error instanceof Error ? historyQuery.error.message : null,
    history: historyQuery.data ?? null,
    detailLoadState: detailQuery.isLoading ? "loading" : detailQuery.isError ? "error" : detailQuery.data ? "success" : "idle",
    detailError,
    detail: detailQuery.data ?? null,
    summaryCounts,
    instanceId,
    companyId,
    auditWindow,
    auditAction,
    auditActor,
    auditTargetType,
    auditTargetId,
    auditStatus,
    auditEventId,
  };
}
