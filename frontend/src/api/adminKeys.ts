/**
 * Shared TanStack Query key factories for admin API data.
 *
 * Kept separate from query hooks so app-shell code can use session keys without
 * importing every domain API module through `adminQueries`.
 * @module
 */

/** Canonical query keys for ForgeFrame admin API data. */
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
    ["auditHistory", query ?? {}] as const,
  auditHistoryDetail: (
    eventId: string,
    instanceId?: string | null,
    tenantId?: string | null,
    companyId?: string | null,
  ) => ["auditHistoryDetail", eventId, instanceId, tenantId, companyId] as const,
};
