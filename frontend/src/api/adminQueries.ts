import { useQuery } from "@tanstack/react-query";

import {
  fetchAuditHistory,
  fetchAuditHistoryDetail,
  fetchDashboard,
  fetchInstances,
  fetchLogs,
} from "./domain";

/* ───── Query key factories ───── */

export const adminKeys = {
  session: ["adminSession"] as const,
  instances: ["instances"] as const,
  dashboard: (instanceId?: string | null) => ["dashboard", instanceId] as const,
  logs: (
    instanceId?: string | null,
    tenantId?: string | null,
    companyId?: string | null,
  ) => ["logs", instanceId, tenantId, companyId] as const,
  auditHistory: (query?: Record<string, unknown>) =>
    ["auditHistory", query] as const,
  auditHistoryDetail: (
    eventId: string,
    instanceId?: string | null,
    tenantId?: string | null,
    companyId?: string | null,
  ) => ["auditHistoryDetail", eventId, instanceId, tenantId, companyId] as const,
};

/* ───── Instances ───── */

/**
 * Fetch the full instance inventory.
 */
export function useInstancesQuery() {
  return useQuery({
    queryKey: adminKeys.instances,
    queryFn: fetchInstances,
    select: (data) => data.instances,
    staleTime: 60 * 1000,
  });
}

/* ───── Dashboard ───── */

/**
 * Fetch the command‑center dashboard for the given scope.
 */
export function useDashboardQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.dashboard(instanceId),
    queryFn: () => fetchDashboard(instanceId),
    staleTime: 15 * 1000,
  });
}

/* ───── Logs / Diagnostics ───── */

export function useLogsQuery(
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.logs(instanceId, tenantId, companyId),
    queryFn: () => fetchLogs(instanceId, tenantId, companyId),
  });
}

/* ───── Audit history ───── */

export function useAuditHistoryQuery(query?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.auditHistory(query),
    queryFn: () => fetchAuditHistory(query as Parameters<typeof fetchAuditHistory>[0]),
  });
}

export function useAuditHistoryDetailQuery(
  eventId: string,
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.auditHistoryDetail(eventId, instanceId, tenantId, companyId),
    queryFn: () => fetchAuditHistoryDetail(eventId, instanceId, tenantId, companyId),
    enabled: Boolean(eventId),
  });
}
