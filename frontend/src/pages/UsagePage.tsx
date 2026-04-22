import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchClientDrilldown,
  fetchClientOperationalView,
  fetchProviderDrilldown,
  fetchUsageSummary,
  type AdminSessionUser,
  type UsageSummaryResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams, withTenantScope } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
type UsageWindow = "1h" | "24h" | "7d" | "all";
type BadgeTone = "success" | "warning" | "neutral";

type UsageAccessState = {
  badgeLabel: string;
  badgeTone: BadgeTone;
  summaryDetail: string;
  noticeTitle: string | null;
  noticeDetail: string | null;
};

const WINDOW_OPTIONS: UsageWindow[] = ["1h", "24h", "7d", "all"];

const WINDOW_LABELS: Record<UsageWindow, string> = {
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

function getUsageAccess(session: AdminSessionUser | null, sessionReady: boolean): UsageAccessState {
  const isViewer = session?.role === "viewer";
  const isReadOnly = Boolean(session?.read_only);

  if (!sessionReady) {
    return {
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      summaryDetail: "ForgeGate is confirming the current session role before it labels this shared operations drilldown.",
      noticeTitle: "Checking usage permissions",
      noticeDetail: "The route stays read-only, but ForgeGate still confirms whether this session is viewer-limited or a standard operator/admin session.",
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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function toStringValue(value: unknown, fallback = "-"): string {
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

function formatMetric(value: unknown, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumberValue(value));
}

function formatPercent(value: unknown): string {
  return `${formatMetric(toNumberValue(value) * 100, 1)}%`;
}

function formatTimestamp(value: unknown, fallback = "No recent evidence"): string {
  return typeof value === "string" && value ? value : fallback;
}

function getLatestEvidenceTimestamp(summary: UsageSummaryResponse | null): number | null {
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

function isUsageEmpty(summary: UsageSummaryResponse | null, clientOps: Array<Record<string, string | number | boolean>>): boolean {
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

function getAttentionClients(clientOps: Array<Record<string, string | number | boolean>>) {
  return clientOps.filter((item) => toBooleanValue(item.needs_attention)).slice(0, 5);
}

function getRecommendedRoute(summary: UsageSummaryResponse, clientOps: Array<Record<string, string | number | boolean>>) {
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

function describeFreshness(window: UsageWindow, latestEvidenceAt: number | null): { label: string; tone: BadgeTone; detail: string } {
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

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partialMessages, setPartialMessages] = useState<string[]>([]);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [window, setWindow] = useState<UsageWindow>("24h");
  const [clientOps, setClientOps] = useState<Array<Record<string, string | number | boolean>>>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [providerDrilldown, setProviderDrilldown] = useState<Record<string, unknown> | null>(null);
  const [providerDrilldownState, setProviderDrilldownState] = useState<LoadState>("idle");
  const [providerDrilldownError, setProviderDrilldownError] = useState<string | null>(null);
  const [clientDrilldown, setClientDrilldown] = useState<Record<string, unknown> | null>(null);
  const [clientDrilldownState, setClientDrilldownState] = useState<LoadState>("idle");
  const [clientDrilldownError, setClientDrilldownError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const tenantId = getTenantIdFromSearchParams(searchParams);

  const access = getUsageAccess(session, sessionReady);
  const latestEvidenceAt = getLatestEvidenceTimestamp(summary);
  const freshness = describeFreshness(window, latestEvidenceAt);
  const emptyUsage = isUsageEmpty(summary, clientOps);
  const attentionClients = getAttentionClients(clientOps);
  const recommendation = summary ? getRecommendedRoute(summary, clientOps) : null;
  const providerModels = asRecordArray(providerDrilldown?.models);
  const providerClients = asRecordArray(providerDrilldown?.clients);
  const providerHealth = asRecordArray(providerDrilldown?.latest_health);
  const clientProviders = asRecordArray(clientDrilldown?.providers);
  const clientErrors = asRecordArray(clientDrilldown?.recent_errors);
  const clientUsage = asRecordArray(clientDrilldown?.recent_usage);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      setError(null);
      setPartialMessages([]);
      setSummary(null);
      setClientOps([]);
      setProviderDrilldown(null);
      setProviderDrilldownState("idle");
      setProviderDrilldownError(null);
      setClientDrilldown(null);
      setClientDrilldownState("idle");
      setClientDrilldownError(null);

      const summaryRequest = tenantId ? fetchUsageSummary(window, tenantId) : fetchUsageSummary(window);
      const clientOpsRequest = tenantId ? fetchClientOperationalView(window, tenantId) : fetchClientOperationalView(window);
      const [summaryResult, clientOpsResult] = await Promise.allSettled([summaryRequest, clientOpsRequest]);

      if (!mounted) {
        return;
      }

      const nextPartialMessages: string[] = [];
      let nextSummary: UsageSummaryResponse | null = null;
      let nextClients: Array<Record<string, string | number | boolean>> = [];
      let nextError: string | null = null;

      if (summaryResult.status === "fulfilled") {
        nextSummary = summaryResult.value;
      } else {
        const message = summaryResult.reason instanceof Error ? summaryResult.reason.message : "Usage summary loading failed.";
        nextPartialMessages.push(`Summary monitoring is unavailable: ${message}`);
        nextError = message;
      }

      if (clientOpsResult.status === "fulfilled") {
        nextClients = clientOpsResult.value.clients;
      } else {
        const message = clientOpsResult.reason instanceof Error ? clientOpsResult.reason.message : "Client operational view loading failed.";
        nextPartialMessages.push(`Client hotspot ranking is unavailable: ${message}`);
        if (!nextError) {
          nextError = message;
        }
      }

      setSummary(nextSummary);
      setClientOps(nextClients);
      setPartialMessages(nextPartialMessages);

      if (nextSummary) {
        const providerOptions = nextSummary.aggregations.by_provider.map((item) => toStringValue(item.provider, ""));
        setSelectedProvider((current) => (current && providerOptions.includes(current) ? current : (providerOptions[0] ?? "")));
      } else {
        setSelectedProvider("");
      }

      if (nextClients.length > 0) {
        const clientOptions = nextClients.map((item) => toStringValue(item.client_id, ""));
        setSelectedClient((current) => (current && clientOptions.includes(current) ? current : (clientOptions[0] ?? "")));
      } else {
        setSelectedClient("");
      }

      if (nextSummary || nextClients.length > 0) {
        setState("success");
        setError(nextSummary ? null : nextError);
        return;
      }

      setState("error");
      setError(nextError ?? "Usage drilldown loading failed.");
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [tenantId, window]);

  useEffect(() => {
    let mounted = true;

    if (!summary || !selectedProvider) {
      setProviderDrilldown(null);
      setProviderDrilldownState("idle");
      setProviderDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setProviderDrilldownState("loading");
    setProviderDrilldownError(null);

    void (tenantId ? fetchProviderDrilldown(selectedProvider, window, tenantId) : fetchProviderDrilldown(selectedProvider, window))
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(payload.drilldown);
        setProviderDrilldownState("success");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(null);
        setProviderDrilldownState("error");
        setProviderDrilldownError(err instanceof Error ? err.message : "Provider drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [selectedProvider, summary, tenantId, window]);

  useEffect(() => {
    let mounted = true;

    if (!selectedClient) {
      setClientDrilldown(null);
      setClientDrilldownState("idle");
      setClientDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setClientDrilldownState("loading");
    setClientDrilldownError(null);

    void (tenantId ? fetchClientDrilldown(selectedClient, window, tenantId) : fetchClientDrilldown(selectedClient, window))
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(payload.drilldown);
        setClientDrilldownState("success");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(null);
        setClientDrilldownState("error");
        setClientDrilldownError(err instanceof Error ? err.message : "Client drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [selectedClient, tenantId, window]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Usage & Cost Operations Drilldown"
        description="Historical traffic, cost pressure, and provider/client hotspot evidence separated from the live provider and incident routes."
        question="What needs operational attention?"
        links={[
          {
            label: "Usage Overview",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Start with the summary monitoring surface and evidence freshness.",
          },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Use the live provider route when the signal looks provider-wide or readiness-related.",
          },
          {
            label: "Errors & Activity",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Switch to incident shape, recent failures, and audit-adjacent activity when usage evidence points to a runtime problem.",
          },
          {
            label: "Client Investigation",
            to: `${CONTROL_PLANE_ROUTES.usage}#client-investigation`,
            description: "Stay on this route when the next question is client blast radius or cost concentration.",
          },
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          { label: freshness.label, tone: freshness.tone },
          ...(tenantId ? [{ label: `Tenant scope: ${tenantId}`, tone: "success" as const }] : []),
        ]}
        note={`${access.summaryDetail} Runtime truth stays adjacent on Provider Health & Runs, while this page remains the historical monitoring drilldown.`}
      />

      {access.noticeTitle && access.noticeDetail ? (
        <article className="fg-card">
          <h3>{access.noticeTitle}</h3>
          <p className="fg-muted">{access.noticeDetail}</p>
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Monitoring window</h3>
            <p className="fg-muted">Window changes should preserve focus and make it clear whether the evidence is fresh, partial, or empty.</p>
          </div>
          <span className="fg-pill" data-tone={state === "loading" ? "neutral" : "success"}>
            {state === "loading" ? "Refreshing data" : WINDOW_LABELS[window]}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Usage window
            <select aria-label="Usage window" value={window} onChange={(event) => setWindow(event.target.value as UsageWindow)}>
              {WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {WINDOW_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      {error ? <p className="fg-danger">{error}</p> : null}

      {partialMessages.length > 0 ? (
        <article className="fg-card">
          <h3>Partial data</h3>
          <ul className="fg-list">
            {partialMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {state === "loading" ? (
        <article className="fg-card">
          <h3>Loading usage drilldown</h3>
          <p className="fg-muted">ForgeGate is refreshing summary monitoring, client hotspot ranking, and the currently selected drilldowns.</p>
        </article>
      ) : null}

      {summary ? (
        <>
          <div className="fg-grid">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Current alert pressure</h3>
                  <p className="fg-muted">Last-hour alert indicators stay separate from the historical window below so the route does not overstate what the selector controls.</p>
                </div>
                <span className="fg-pill" data-tone={summary.alerts.length > 0 ? "warning" : "success"}>
                  {summary.alerts.length > 0 ? `${summary.alerts.length} active signal${summary.alerts.length === 1 ? "" : "s"}` : "No current alert pressure"}
                </span>
              </div>
              <ul className="fg-list">
                {summary.alerts.length === 0 ? <li>No active last-hour alert indicators.</li> : null}
                {summary.alerts.map((item, index) => (
                  <li key={`${toStringValue(item.type)}-${index}`}>
                    {toStringValue(item.severity)} · {toStringValue(item.type)} · {toStringValue(item.message)} · value={toStringValue(item.value)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Recommended next route</h3>
                  <p className="fg-muted">{recommendation?.description}</p>
                </div>
                {recommendation ? (
                  <Link className="fg-nav-link" to={withTenantScope(recommendation.to, tenantId)}>
                    {recommendation.linkLabel}
                  </Link>
                ) : null}
              </div>
              <p>
                <strong>{recommendation?.title}</strong>
              </p>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Recent evidence freshness</h3>
                  <p className="fg-muted">Keep recent evidence truth separate from the wider historical window.</p>
                </div>
                <span className="fg-pill" data-tone={freshness.tone}>
                  {freshness.label}
                </span>
              </div>
              <ul className="fg-list">
                <li>Historical window: {WINDOW_LABELS[window]}</li>
                <li>Latest evidence: {latestEvidenceAt ? new Date(latestEvidenceAt).toISOString() : "No recent evidence"}</li>
                <li>Freshness source: latest health checks plus the fixed 24h timeline.</li>
                <li>{freshness.detail}</li>
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Client hotspots</h3>
                  <p className="fg-muted">Use this ranking to decide whether the blast radius is client-specific before opening deeper investigation.</p>
                </div>
                <span className="fg-pill" data-tone={attentionClients.length > 0 ? "warning" : "success"}>
                  {attentionClients.length > 0 ? "Needs attention" : "No client flagged"}
                </span>
              </div>
              <ul className="fg-list">
                {attentionClients.length === 0 ? <li>No client exceeded the current needs-attention threshold.</li> : null}
                {attentionClients.map((item) => (
                  <li key={toStringValue(item.client_id)}>
                    {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · errors={formatMetric(item.errors)} · error rate=
                    {formatPercent(item.error_rate)}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          {emptyUsage ? (
            <article className="fg-card">
              <h3>No recent runtime or health traffic was recorded in this window</h3>
              <p className="fg-muted">
                This is the expected empty state for a pre-launch or low-traffic installation. Keep the route honest by treating it as monitoring with no evidence rather than implying missing configuration controls.
              </p>
            </article>
          ) : null}

          <article id="usage-overview" className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Monitoring overview</h3>
                <p className="fg-muted">Summary monitoring stays here. Use the provider and client sections below only after the blast radius is clear.</p>
              </div>
              <span className="fg-pill" data-tone="neutral">
                Historical evidence
              </span>
            </div>

            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Active models</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.active_model_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Recorded requests</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_request_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Recorded errors</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_error_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Health events</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_health_event_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Runtime actual cost</span>
                <strong className="fg-kpi-value">{formatMetric(summary.traffic_split.runtime.actual_cost, 2)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Health actual cost</span>
                <strong className="fg-kpi-value">{formatMetric(summary.traffic_split.health_check.actual_cost, 2)}</strong>
              </article>
            </div>

            <div className="fg-card-grid fg-mt-md">
              <article className="fg-subcard">
                <h4>Traffic split</h4>
                <ul className="fg-list">
                  <li>
                    Runtime · requests={formatMetric(summary.traffic_split.runtime.requests)} · tokens=
                    {formatMetric(summary.traffic_split.runtime.tokens)} · actual={formatMetric(summary.traffic_split.runtime.actual_cost, 2)}
                  </li>
                  <li>
                    Health checks · requests={formatMetric(summary.traffic_split.health_check.requests)} · tokens=
                    {formatMetric(summary.traffic_split.health_check.tokens)} · actual={formatMetric(summary.traffic_split.health_check.actual_cost, 2)}
                  </li>
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Top providers</h4>
                <ul className="fg-list">
                  {summary.aggregations.by_provider.length === 0 ? <li>No provider traffic recorded.</li> : null}
                  {summary.aggregations.by_provider.slice(0, 5).map((item) => (
                    <li key={toStringValue(item.provider)}>
                      {toStringValue(item.provider)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                      {formatMetric(item.actual_cost, 2)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Error shape</h4>
                <ul className="fg-list">
                  {summary.aggregations.errors_by_provider.slice(0, 3).map((item) => (
                    <li key={`provider-${toStringValue(item.provider)}`}>
                      Provider {toStringValue(item.provider)}: {formatMetric(item.errors)} errors
                    </li>
                  ))}
                  {summary.aggregations.errors_by_client.slice(0, 3).map((item) => (
                    <li key={`client-${toStringValue(item.client_id)}`}>
                      Client {toStringValue(item.client_id)}: {formatMetric(item.errors)} errors
                    </li>
                  ))}
                  {summary.aggregations.errors_by_type.slice(0, 3).map((item) => (
                    <li key={`type-${toStringValue(item.error_key)}`}>
                      {toStringValue(item.error_key)}: {formatMetric(item.errors)} errors
                    </li>
                  ))}
                  {summary.aggregations.errors_by_provider.length === 0 &&
                  summary.aggregations.errors_by_client.length === 0 &&
                  summary.aggregations.errors_by_type.length === 0 ? <li>No recorded error hotspots.</li> : null}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Timeline</h4>
                <ul className="fg-list">
                  {summary.timeline_24h.slice(-8).map((item) => (
                    <li key={toStringValue(item.bucket_start)}>
                      {toStringValue(item.bucket_start)} · req={formatMetric(item.requests)} · err={formatMetric(item.errors)} · rate=
                      {formatPercent(item.error_rate)} · actual={formatMetric(item.actual_cost, 2)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Latest health evidence</h4>
                <ul className="fg-list">
                  {summary.latest_health.length === 0 ? <li>No recent health evidence recorded.</li> : null}
                  {summary.latest_health.slice(0, 5).map((item) => (
                    <li key={`${toStringValue(item.provider)}:${toStringValue(item.model)}:${toStringValue(item.checked_at)}`}>
                      {toStringValue(item.provider)} / {toStringValue(item.model)} · status={toStringValue(item.status)} · check=
                      {toStringValue(item.check_type)} · at={formatTimestamp(item.checked_at)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Cost posture</h4>
                <ul className="fg-list">
                  <li>Actual: {toStringValue(summary.cost_axes.actual)}</li>
                  <li>Hypothetical: {toStringValue(summary.cost_axes.hypothetical)}</li>
                  <li>Avoided: {toStringValue(summary.cost_axes.avoided)}</li>
                  {Object.entries(summary.pricing_snapshot).map(([key, value]) => (
                    <li key={key}>
                      {key}: {formatMetric(value, 2)}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </article>

          <article id="provider-investigation" className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Provider investigation</h3>
                <p className="fg-muted">Use this after the summary points to a provider hotspot. Live readiness and control actions stay on Provider Health & Runs.</p>
              </div>
              <Link className="fg-nav-link" to={withTenantScope(CONTROL_PLANE_ROUTES.providerHealthRuns, tenantId)}>
                Open Provider Health & Runs
              </Link>
            </div>

            {summary.aggregations.by_provider.length === 0 ? (
              <p className="fg-muted">No provider activity recorded in this window.</p>
            ) : (
              <>
                <div className="fg-inline-form">
                  <label>
                    Provider drilldown
                    <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
                      {summary.aggregations.by_provider.map((item) => {
                        const provider = toStringValue(item.provider, "");
                        return (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {providerDrilldownError ? <p className="fg-danger">{providerDrilldownError}</p> : null}
                {providerDrilldownState === "loading" ? <p className="fg-muted">Loading provider drilldown.</p> : null}

                {providerDrilldown ? (
                  <div className="fg-card-grid fg-mt-md">
                    <article className="fg-subcard">
                      <h4>Selected provider summary</h4>
                      <ul className="fg-list">
                        <li>Provider: {toStringValue(providerDrilldown.provider, selectedProvider)}</li>
                        <li>Requests: {formatMetric(providerDrilldown.requests)}</li>
                        <li>Errors: {formatMetric(providerDrilldown.errors)}</li>
                        <li>Models with evidence: {formatMetric(providerModels.length)}</li>
                        <li>Clients with evidence: {formatMetric(providerClients.length)}</li>
                      </ul>
                    </article>

                    <article className="fg-subcard">
                      <h4>Model concentration</h4>
                      <ul className="fg-list">
                        {providerModels.length === 0 ? <li>No model evidence recorded for this provider.</li> : null}
                        {providerModels.slice(0, 5).map((item) => (
                          <li key={toStringValue(item.model)}>
                            {toStringValue(item.model)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                            {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="fg-subcard">
                      <h4>Client concentration</h4>
                      <ul className="fg-list">
                        {providerClients.length === 0 ? <li>No client evidence recorded for this provider.</li> : null}
                        {providerClients.slice(0, 5).map((item) => (
                          <li key={toStringValue(item.client_id)}>
                            {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                            {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="fg-subcard">
                      <h4>Recent provider health evidence</h4>
                      <ul className="fg-list">
                        {providerHealth.length === 0 ? <li>No recent health checks recorded for this provider.</li> : null}
                        {providerHealth.slice(0, 5).map((item) => (
                          <li key={`${toStringValue(item.provider)}:${toStringValue(item.model)}:${toStringValue(item.checked_at)}`}>
                            {toStringValue(item.model)} · status={toStringValue(item.status)} · check={toStringValue(item.check_type)} · at=
                            {formatTimestamp(item.checked_at)}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </div>
                ) : null}
              </>
            )}
          </article>
        </>
      ) : null}

      <article id="client-investigation" className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Client investigation</h3>
            <p className="fg-muted">Use this when the question is client blast radius, error concentration, or cost concentration rather than provider readiness.</p>
          </div>
          <Link className="fg-nav-link" to={withTenantScope(CONTROL_PLANE_ROUTES.logs, tenantId)}>
            Open Errors & Activity
          </Link>
        </div>

        {clientOps.length === 0 ? (
          <p className="fg-muted">No client activity recorded in this window.</p>
        ) : (
          <>
            <div className="fg-inline-form">
              <label>
                Client drilldown
                <select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>
                  {clientOps.map((item) => {
                    const clientId = toStringValue(item.client_id, "");
                    return (
                      <option key={clientId} value={clientId}>
                        {clientId}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="fg-card-grid fg-mt-md">
              <article className="fg-subcard">
                <h4>Hotspot ranking</h4>
                <ul className="fg-list">
                  {clientOps.slice(0, 5).map((item) => (
                    <li key={toStringValue(item.client_id)}>
                      {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · errors={formatMetric(item.errors)} · rate=
                      {formatPercent(item.error_rate)} · needs attention={toStringValue(item.needs_attention)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Selected client summary</h4>
                {clientDrilldownError ? <p className="fg-danger">{clientDrilldownError}</p> : null}
                {clientDrilldownState === "loading" ? <p className="fg-muted">Loading client drilldown.</p> : null}
                {clientDrilldown ? (
                  <ul className="fg-list">
                    <li>Client: {toStringValue(clientDrilldown.client_id, selectedClient)}</li>
                    <li>Requests: {formatMetric(clientDrilldown.requests)}</li>
                    <li>Errors: {formatMetric(clientDrilldown.errors)}</li>
                    <li>Providers touched: {formatMetric(clientProviders.length)}</li>
                  </ul>
                ) : null}
              </article>

              <article className="fg-subcard">
                <h4>Provider spread</h4>
                <ul className="fg-list">
                  {clientProviders.length === 0 ? <li>No provider evidence recorded for this client.</li> : null}
                  {clientProviders.slice(0, 5).map((item) => (
                    <li key={toStringValue(item.provider)}>
                      {toStringValue(item.provider)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                      {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Recent client errors</h4>
                <ul className="fg-list">
                  {clientErrors.length === 0 ? <li>No recent errors recorded for this client.</li> : null}
                  {clientErrors.slice(0, 5).map((item, index) => (
                    <li key={`${toStringValue(item.provider)}-${index}`}>
                      {formatTimestamp(item.created_at ?? item.checked_at)} · provider={toStringValue(item.provider)} · model=
                      {toStringValue(item.model)} · type={toStringValue(item.error_type ?? item.status)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Recent client usage</h4>
                <ul className="fg-list">
                  {clientUsage.length === 0 ? <li>No recent usage events recorded for this client.</li> : null}
                  {clientUsage.slice(0, 5).map((item, index) => (
                    <li key={`${toStringValue(item.provider)}-${index}`}>
                      {formatTimestamp(item.created_at)} · provider={toStringValue(item.provider)} · model={toStringValue(item.model)} ·
                      tokens={formatMetric(item.total_tokens)} · actual={formatMetric(item.actual_cost, 2)}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
