/**
 * Audit history API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendQueryParams,
  appendAuditScope,
  getAdminToken,
  fetchJson,
  AdminApiError,
} from "./_internal";

// ---------------------------------------------------------------------------
// Audit types
// ---------------------------------------------------------------------------

/** Audit history time window. */
export type AuditHistoryWindow = "24h" | "7d" | "30d" | "all";
/** Audit event status. */
export type AuditHistoryStatus = "ok" | "warning" | "failed";

/** Summary of an audit event actor. */
export type AuditHistoryActorSummary = {
  type: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

/** Summary of an audit event target. */
export type AuditHistoryTargetSummary = {
  type: string;
  typeLabel: string;
  id?: string | null;
  label: string;
  secondary?: string | null;
};

/** Correlation summary for an audit event. */
export type AuditHistoryCorrelationSummary = {
  label: string;
  value: string;
};

/** Single audit history row. */
export type AuditHistoryRow = {
  eventId: string;
  createdAt: string;
  tenantId?: string | null;
  companyId?: string | null;
  actionKey: string;
  actionLabel: string;
  status: AuditHistoryStatus;
  statusLabel: string;
  actor: AuditHistoryActorSummary;
  target: AuditHistoryTargetSummary;
  summary: string;
  correlation?: AuditHistoryCorrelationSummary | null;
  detailAvailable: boolean;
};

/** Audit history filter option. */
export type AuditHistoryFilterOption = {
  value: string;
  label: string;
};

/** Audit history list response. */
export type AuditHistoryResponse = {
  status: "ok";
  instance?: InstanceRecord;
  items: AuditHistoryRow[];
  page: {
    limit: number;
    nextCursor?: string | null;
    hasMore: boolean;
  };
  retention: {
    eventLimit: number;
    oldestAvailableAt?: string | null;
    retentionLimited: boolean;
  };
  filters: {
    applied: {
      window: AuditHistoryWindow;
      action?: string | null;
      actor?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      status?: AuditHistoryStatus | null;
    };
    available: {
      actions: AuditHistoryFilterOption[];
      statuses: AuditHistoryFilterOption[];
      targetTypes: AuditHistoryFilterOption[];
    };
  };
  summary: {
    totalInScope: number;
    totalMatchingFilters: number;
    latestEventAt?: string | null;
  };
};

/** Audit history detail response. */
export type AuditHistoryDetailResponse = {
  status: "ok";
  instance?: InstanceRecord;
  event: {
    eventId: string;
    createdAt: string;
    tenantId?: string | null;
    companyId?: string | null;
    actionKey: string;
    actionLabel: string;
    status: AuditHistoryStatus;
    statusLabel: string;
  };
  actor: AuditHistoryActorSummary;
  target: AuditHistoryTargetSummary;
  summary: string;
  outcome: string;
  correlation?: AuditHistoryCorrelationSummary | null;
  changeContext: Array<{ label: string; value: string }>;
  changeContextUnavailable: boolean;
  rawMetadata: Record<string, unknown>;
  redactions: Array<{ path: string; reason: string }>;
  relatedLinks: Array<{ label: string; href: string; kind: string }>;
};

/** Audit history query parameters. */
export type AuditHistoryQuery = {
  instanceId?: string | null;
  tenantId?: string | null;
  companyId?: string | null;
  window?: AuditHistoryWindow;
  action?: string | null;
  actor?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  status?: AuditHistoryStatus | null;
  cursor?: string | null;
  limit?: number | null;
};

/** Audit export format. */
export type AuditExportFormat = "csv" | "json";
/** Audit export time window. */
export type AuditExportWindow = "24h" | "7d" | "30d" | "all";
/** Audit export status. */
export type AuditExportStatus = "ok" | "warning" | "failed";

/** Audit export request parameters. */
export type AuditExportRequest = {
  format: AuditExportFormat;
  window: AuditExportWindow;
  action?: string | null;
  actor?: string | null;
  status?: AuditExportStatus | null;
  subject?: string | null;
  includeRawDetails?: boolean;
  limit?: number;
};

/** Audit export result. */
export type AuditExportResult = {
  exportId: string;
  filename: string;
  status: string;
  rowCount: number;
  generatedAt?: string | null;
  sizeBytes: number;
  blob: Blob;
};

/** Helper type for the audit export response headers. */
type AuditExportHeaders = {
  "X-ForgeFrame-Audit-Export-Id"?: string | null;
  "X-ForgeFrame-Audit-Export-Row-Count"?: string | null;
  "X-ForgeFrame-Audit-Export-Generated-At"?: string | null;
  "X-ForgeGate-Audit-Export-Id"?: string | null;
  "X-ForgeGate-Audit-Export-Row-Count"?: string | null;
  "X-ForgeGate-Audit-Export-Generated-At"?: string | null;
};

/**
 * Read a response header with fallback to legacy key.
 * @param headers - The response Headers object.
 * @param primaryKey - Primary header name.
 * @param legacyKey - Legacy fallback header name.
 * @returns The header value or null.
 */
function getResponseHeader(
  headers: Headers,
  primaryKey: string,
  legacyKey: string,
): string | null {
  return headers.get(primaryKey) ?? headers.get(legacyKey);
}

/**
 * Parse filename from a Content-Disposition header.
 * @param headerValue - The Content-Disposition header value.
 * @returns The filename or null.
 */
function parseContentDispositionFilename(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/filename\*?=(?:UTF-8'')?["']?([^"'\n;]+)["']?/i);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

// ---------------------------------------------------------------------------
// Audit API functions
// ---------------------------------------------------------------------------

/**
 * Fetch audit history with query filters.
 * @param query - Audit query parameters.
 * @returns Audit history response.
 */
export function fetchAuditHistory(query: AuditHistoryQuery = {}) {
  return fetchJson<AuditHistoryResponse>(appendQueryParams("/admin/logs/audit-events", {
    instanceId: query.instanceId,
    tenantId: query.tenantId,
    companyId: query.companyId,
    window: query.window ?? "7d",
    action: query.action,
    actor: query.actor,
    targetType: query.targetType,
    targetId: query.targetId,
    status: query.status,
    cursor: query.cursor,
    limit: query.limit,
  }));
}

/**
 * Fetch audit event detail by event ID.
 * @param eventId - The audit event ID.
 * @param instanceId - Optional instance ID.
 * @param tenantId - Optional tenant ID.
 * @param companyId - Optional company ID.
 * @returns Audit event detail response.
 */
export function fetchAuditHistoryDetail(eventId: string, instanceId?: string | null, tenantId?: string | null, companyId?: string | null) {
  return fetchJson<AuditHistoryDetailResponse>(appendQueryParams(`/admin/logs/audit-events/${encodeURIComponent(eventId)}`, {
    instanceId,
    tenantId,
    companyId,
  }));
}

/**
 * Generate an audit export (downloads a blob).
 * @param payload - Export request parameters.
 * @param instanceId - Optional instance ID.
 * @param tenantId - Optional tenant ID.
 * @param companyId - Optional company ID.
 * @returns Export result with blob.
 * @throws {AdminApiError} On export failure.
 */
export async function generateAuditExport(
  payload: AuditExportRequest,
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
): Promise<AuditExportResult> {
  const path = appendAuditScope("/admin/logs/audit-export", tenantId, companyId, instanceId);
  const token = getAdminToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      action: payload.action?.trim() ? payload.action.trim() : null,
      actor: payload.actor?.trim() ? payload.actor.trim() : null,
      status: payload.status ?? null,
      subject: payload.subject?.trim() ? payload.subject.trim() : null,
      include_raw_details: payload.includeRawDetails ?? true,
      limit: payload.limit ?? 250,
    }),
  });

  if (!response.ok) {
    let message = `Failed to generate audit export (${response.status}).`;
    let code: string | undefined;
    try {
      const errorPayload = (await response.json()) as {
        error?: { type?: string; message?: string };
        detail?: string | { message?: string };
      };
      if (errorPayload.error?.message) {
        message = errorPayload.error.message;
        code = errorPayload.error.type;
      } else if (typeof errorPayload.detail === "string") {
        message = errorPayload.detail;
      } else if (errorPayload.detail?.message) {
        message = errorPayload.detail.message;
      }
    } catch {
      // noop
    }
    throw new AdminApiError(message, response.status, code);
  }

  const blob = await response.blob();
  return {
    exportId: getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Id", "X-ForgeGate-Audit-Export-Id") ?? "",
    filename: parseContentDispositionFilename(response.headers.get("Content-Disposition"))
      ?? `forgeframe-audit-export.${payload.format}`,
    status: "ready",
    rowCount: Number(getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Row-Count", "X-ForgeGate-Audit-Export-Row-Count") ?? "0"),
    generatedAt: getResponseHeader(response.headers, "X-ForgeFrame-Audit-Export-Generated-At", "X-ForgeGate-Audit-Export-Generated-At"),
    sizeBytes: blob.size,
    blob,
  };
}
