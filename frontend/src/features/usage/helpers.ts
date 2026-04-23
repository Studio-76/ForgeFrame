import type { AdminSessionUser, UsageSummaryResponse } from "../../api/admin";
import { sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";

export type LoadState = "idle" | "loading" | "success" | "error";
export type UsageWindow = "1h" | "24h" | "7d" | "all";
export type BadgeTone = "success" | "warning" | "neutral";

export type UsageAccessState = {
  badgeLabel: string;
  badgeTone: BadgeTone;
  summaryDetail: string;
  noticeTitle: string | null;
  noticeDetail: string | null;
};

export const WINDOW_OPTIONS: UsageWindow[] = ["1h", "24h", "7d", "all"];

export const WINDOW_LABELS: Record<UsageWindow, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  all: "All recorded history",
};

const STALE_WINDOW_MS: Record<Exclude<UsageWindow, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function getUsageAccess(session: AdminSessionUser | null, sessionReady: boolean): UsageAccessState {
  const canReadUsage = sessionHasAnyInstancePermission(session, "audit.read");
  const isViewer = Boolean(session) && !canReadUsage;
  const isReadOnly = Boolean(session?.read_only);

  if (!sessionReady) {
    return {
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      summaryDetail: "ForgeFrame is confirming the current session role before it labels this shared operations drilldown.",
      noticeTitle: "Checking usage permissions",
      noticeDetail: "The route stays read-only, but ForgeFrame still confirms whether this session is viewer-limited or a standard operator/admin session.",
    };
  }

  if (isViewer) {
    return {
      badgeLabel: "Viewer read-only",
      badgeTone: "warning",
      summaryDetail: "Viewer sessions can inspect traffic, cost pressure, and hotspot rankings here, then branch to the shared operations routes for action without implying admin depth.",
      noticeTitle: "Viewer read-only usage drilldown",
      noticeDetail: "This session can monitor alerts, provider/client hotspots, and historical evidence, but the page stays explicitly read-only and does not imply access beyond adjacent operations routes.",
    };
  }

  if (isReadOnly) {
    return {
      badgeLabel: "Read-only session",
      badgeTone: "warning",
      summaryDetail: "This session can inspect the operations drilldown, but it should hand follow-up action off to the adjacent provider or incident routes.",
      noticeTitle: "Read-only operations session",
      noticeDetail: "Historical usage evidence stays visible here, but this session should use shared operator workflows for any follow-up instead of assuming broader control-plane depth.",
    };
  }

  return {
    badgeLabel: "Shared operations view",
    badgeTone: "success",
    summaryDetail: "Use this route to identify alert pressure, cost posture, and provider/client hotspots before opening the live provider or incident surfaces.",
    noticeTitle: null,
    noticeDetail: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

export function toStringValue(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    return value || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

export function formatMetric(value: unknown, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumberValue(value));
}

export function formatPercent(value: unknown): string {
  return `${formatMetric(toNumberValue(value) * 100, 1)}%`;
}

export function formatTimestamp(value: unknown, fallback = "No recent evidence"): string {
  return typeof value === "string" && value ? value : fallback;
}

export function getLatestEvidenceTimestamp(summary: UsageSummaryResponse | null): number | null {
  if (!summary) {
    return null;
  }

  const timestamps: number[] = [];

  summary.latest_health.forEach((item) => {
    const checkedAt = typeof item.checked_at === "string" ? Date.parse(item.checked_at) : Number.NaN;
    if (Number.isFinite(checkedAt)) {
      timestamps.push(checkedAt);
    }
  });

  summary.timeline_24h.forEach((item) => {
    const hasSignal = toNumberValue(item.requests) > 0 || toNumberValue(item.errors) > 0 || toNumberValue(item.actual_cost) > 0;
    const bucketStart = typeof item.bucket_start === "string" ? Date.parse(item.bucket_start) : Number.NaN;

    if (hasSignal && Number.isFinite(bucketStart)) {
      timestamps.push(bucketStart);
    }
  });

  if (timestamps.length === 0) {
    return null;
  }

  return Math.max(...timestamps);
}

export function isUsageEmpty(summary: UsageSummaryResponse | null, clientOps: Array<Record<string, string | number | boolean>>): boolean {
  if (!summary) {
    return false;
  }

  return (
    toNumberValue(summary.metrics.recorded_request_count) === 0 &&
    toNumberValue(summary.metrics.recorded_error_count) === 0 &&
    toNumberValue(summary.metrics.recorded_health_event_count) === 0 &&
    summary.alerts.length === 0 &&
    clientOps.length === 0
  );
}

function isEvidenceStale(window: UsageWindow, latestEvidenceAt: number | null): boolean {
  if (window === "all" || latestEvidenceAt === null) {
    return false;
  }

  return Date.now() - latestEvidenceAt > STALE_WINDOW_MS[window];
}

function hasProviderAttention(summary: UsageSummaryResponse): boolean {
  const healthAlertTypes = new Set(["health_failures", "provider_hotspot"]);

  return (
    summary.alerts.some((item) => healthAlertTypes.has(toStringValue(item.type))) ||
    summary.latest_health.some((item) => {
      const status = toStringValue(item.status).toLowerCase();
      return status && !["ok", "healthy", "success", "passed"].includes(status);
    })
  );
}

export function getAttentionClients(clientOps: Array<Record<string, string | number | boolean>>) {
  return clientOps.filter((item) => toBooleanValue(item.needs_attention)).slice(0, 5);
}

export function getRecommendedRoute(summary: UsageSummaryResponse, clientOps: Array<Record<string, string | number | boolean>>) {
  if (hasProviderAttention(summary)) {
    return {
      title: "Provider-level follow-up",
      description: "Alert indicators or recent health evidence point to provider readiness as the next operational question.",
      to: CONTROL_PLANE_ROUTES.providerHealthRuns,
      linkLabel: "Open Provider Health & Runs",
    };
  }

  if (toNumberValue(summary.metrics.recorded_error_count) > 0 || clientOps.some((item) => toBooleanValue(item.needs_attention))) {
    return {
      title: "Incident and activity follow-up",
      description: "Errors or client hotspots are present. The next route should focus on incident shape and recent activity rather than adding more cost detail.",
      to: CONTROL_PLANE_ROUTES.logs,
      linkLabel: "Open Errors & Activity",
    };
  }

  return {
    title: "No secondary drilldown required",
    description: "Current evidence does not show active alert pressure. Return to the dashboard if you need the broader command-center view.",
    to: CONTROL_PLANE_ROUTES.dashboard,
    linkLabel: "Return to Command Center",
  };
}

export function describeFreshness(window: UsageWindow, latestEvidenceAt: number | null): { label: string; tone: BadgeTone; detail: string } {
  if (window === "7d" || window === "all") {
    return {
      label: latestEvidenceAt === null ? "Recent evidence unavailable" : "Recent evidence only",
      tone: "neutral",
      detail: "Freshness is based on recent health checks and the fixed 24h timeline only, not the entire selected history.",
    };
  }

  if (latestEvidenceAt === null) {
    return {
      label: "No recent evidence",
      tone: "warning",
      detail: "No recent health checks or 24h timeline evidence were recorded for this window.",
    };
  }

  if (isEvidenceStale(window, latestEvidenceAt)) {
    return {
      label: "Recent evidence stale",
      tone: "warning",
      detail: "Recent health checks and 24h timeline evidence are older than this window.",
    };
  }

  return {
    label: "Recent evidence current",
    tone: "success",
    detail: "Recent health checks and 24h timeline evidence fall within this window.",
  };
}
