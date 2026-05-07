import { useQuery } from "@tanstack/react-query";

import { adminKeys } from "./adminKeys";
import {
  fetchAuditHistory,
  fetchAuditHistoryDetail,
  fetchDashboard,
  fetchInstances,
  fetchLogs,
} from "./domain";

/* ───── Query key factories ───── */

export { adminKeys } from "./adminKeys";

/* ───── Instances ───── */

/**
 * Fetch the full instance inventory.
 *
 * Instance metadata changes infrequently — keep it fresh for 2 minutes.
 * @returns Query result containing the instance list.
 */
export function useInstancesQuery() {
  return useQuery({
    queryKey: adminKeys.instances,
    queryFn: fetchInstances,
    select: (data) => data.instances,
    staleTime: 2 * 60 * 1000,
  });
}

/* ───── Dashboard ───── */

/**
 * Fetch the command‑center dashboard for the given scope.
 *
 * Dashboard shows live status — shorter stale time so the operator
 * always sees current data without manual refresh.
 * @param instanceId - Optional instance scope.
 * @returns Query result containing dashboard data.
 */
export function useDashboardQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.dashboard(instanceId),
    queryFn: () => fetchDashboard(instanceId),
    staleTime: 15 * 1000,
  });
}

/* ───── Logs / Diagnostics ───── */

/**
 * Fetch logs for the given scope.
 *
 * Logs are read-heavy and rarely change — 5 minute stale time reduces
 * unnecessary refetches when the operator browses other pages.
 * @param instanceId - Optional instance scope.
 * @param tenantId - Optional tenant scope.
 * @param companyId - Optional company scope.
 * @returns Query result containing logs and diagnostics data.
 */
export function useLogsQuery(
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.logs(instanceId, tenantId, companyId),
    queryFn: () => fetchLogs(instanceId, tenantId, companyId),
    staleTime: 5 * 60 * 1000,
  });
}

/* ───── Audit history ───── */

/**
 * Fetch paginated audit history.
 *
 * Static historical data — long stale time makes sense. The user can
 * always manually refetch.
 * @param query - Audit history filters.
 * @param enabled - Whether audit history should be fetched.
 * @returns Query result containing audit history data.
 */
export function useAuditHistoryQuery(
  query?: Record<string, unknown>,
  enabled = true,
) {
  return useQuery({
    queryKey: adminKeys.auditHistory(query),
    queryFn: () => fetchAuditHistory(query as Parameters<typeof fetchAuditHistory>[0]),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch a single audit event detail.
 *
 * Only fetches when an eventId is provided (enabled condition).
 * Detail views are infrequently re-visited so a moderate stale time suffices.
 * @param eventId - Audit event identifier.
 * @param instanceId - Optional instance scope.
 * @param tenantId - Optional tenant scope.
 * @param companyId - Optional company scope.
 * @param enabled - Whether audit detail should be fetched.
 * @returns Query result containing audit detail data.
 */
export function useAuditHistoryDetailQuery(
  eventId: string,
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: adminKeys.auditHistoryDetail(eventId, instanceId, tenantId, companyId),
    queryFn: () => fetchAuditHistoryDetail(eventId, instanceId, tenantId, companyId),
    enabled: enabled && Boolean(eventId),
    staleTime: 5 * 60 * 1000,
  });
}
