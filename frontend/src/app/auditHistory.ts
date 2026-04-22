import {
  fetchAuditHistory,
  type AdminSessionUser,
  type AuditHistoryQuery,
  type AuditHistoryStatus,
  type AuditHistoryWindow,
} from "../api/admin";

type AuditHistoryPathOptions = {
  tenantId?: string | null;
  companyId?: string | null;
  window?: AuditHistoryWindow;
  action?: string | null;
  actor?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  status?: AuditHistoryStatus | "" | null;
  eventId?: string | null;
};

type AuditHistoryPathCandidate = {
  query: AuditHistoryQuery;
};

type AuditHistoryPathMatch = {
  item: {
    createdAt: string;
    eventId: string;
  };
  query: AuditHistoryQuery;
};

function setQueryParam(searchParams: URLSearchParams, key: string, value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return;
  }
  searchParams.set(key, normalized);
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildAuditHistoryPath(options: AuditHistoryPathOptions = {}): string {
  const searchParams = new URLSearchParams();
  setQueryParam(searchParams, "tenantId", options.tenantId);
  setQueryParam(searchParams, "companyId", options.companyId);
  setQueryParam(searchParams, "auditWindow", options.window);
  setQueryParam(searchParams, "auditAction", options.action);
  setQueryParam(searchParams, "auditActor", options.actor);
  setQueryParam(searchParams, "auditTargetType", options.targetType);
  setQueryParam(searchParams, "auditTargetId", options.targetId);
  setQueryParam(searchParams, "auditStatus", options.status ?? null);
  setQueryParam(searchParams, "auditEvent", options.eventId);
  const query = searchParams.toString();
  return `/logs${query ? `?${query}` : ""}#audit-history`;
}

export function canResolveNewestAuditHistoryPath(
  session: AdminSessionUser | null,
  sessionReady: boolean,
): boolean {
  return sessionReady && session !== null && session.role !== "viewer";
}

async function fetchLatestAuditMatch(candidate: AuditHistoryPathCandidate): Promise<AuditHistoryPathMatch | null> {
  const query = {
    ...candidate.query,
    window: candidate.query.window ?? "all",
    limit: 1,
  } satisfies AuditHistoryQuery;

  try {
    const payload = await fetchAuditHistory(query);
    const item = payload.items[0];
    if (!item) {
      return null;
    }
    return {
      item: {
        createdAt: item.createdAt,
        eventId: item.eventId,
      },
      query,
    };
  } catch {
    return null;
  }
}

export async function resolveNewestAuditHistoryPath(
  candidates: AuditHistoryPathCandidate[],
  fallback: AuditHistoryPathOptions,
): Promise<string> {
  const matches = (await Promise.all(candidates.map((candidate) => fetchLatestAuditMatch(candidate))))
    .filter((match): match is AuditHistoryPathMatch => match !== null)
    .sort((left, right) => timestampValue(right.item.createdAt) - timestampValue(left.item.createdAt));

  if (matches.length === 0) {
    return buildAuditHistoryPath(fallback);
  }

  const newest = matches[0];
  return buildAuditHistoryPath({
    tenantId: newest.query.tenantId,
    companyId: newest.query.companyId,
    window: newest.query.window ?? "all",
    action: newest.query.action ?? null,
    actor: newest.query.actor ?? null,
    targetType: newest.query.targetType ?? null,
    targetId: newest.query.targetId ?? null,
    status: newest.query.status ?? null,
    eventId: newest.item.eventId,
  });
}

export async function resolveNewestAuditHistoryPathForSession(
  session: AdminSessionUser | null,
  sessionReady: boolean,
  candidates: AuditHistoryPathCandidate[],
  fallback: AuditHistoryPathOptions,
): Promise<string> {
  if (!canResolveNewestAuditHistoryPath(session, sessionReady)) {
    return buildAuditHistoryPath(fallback);
  }

  return resolveNewestAuditHistoryPath(candidates, fallback);
}
