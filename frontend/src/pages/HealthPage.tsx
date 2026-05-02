import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchDashboard, type DashboardResponse } from "../api/domain/dashboard";
import { fetchLogs, type LogsResponse } from "../api/domain/logs";
import { fetchProviderControlPlane, type ProviderControlPlaneResponse } from "../api/domain/providers";
import { fetchRuntimeHealth, type RuntimeHealthResponse } from "../api/domain/health";
import { fetchUsageSummary, type UsageSummaryResponse } from "../api/domain/usage";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
type HealthStatus = "healthy" | "warning" | "failed";
type CheckRecord = {
  id: string;
  ok: boolean;
  severity?: string;
  details?: string | null;
};
type HealthRoute = {
  label: string;
  to: string;
};
type HealthGroup = {
  title: string;
  status: HealthStatus;
  summary: string;
  lastChecked: string;
  evidence: string[];
  error: string;
  nextRoute: HealthRoute;
};
type SignalPathRow = {
  label: string;
  status: HealthStatus;
  evidence: string;
  route: HealthRoute;
};

function providerNeedsOauthHandoff(provider: ProviderControlPlaneResponse["providers"][number]): boolean {
  return provider.oauth_connect_required || provider.next_action_kind === "connect_oauth";
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function formatTimestamp(value: string | null | undefined, fallback = "n/a"): string {
  return value && value.trim() ? value : fallback;
}

function toneForStatus(status: HealthStatus): "success" | "warning" | "danger" {
  if (status === "healthy") {
    return "success";
  }
  if (status === "warning") {
    return "warning";
  }
  return "danger";
}

function labelForStatus(status: HealthStatus): string {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "warning") {
    return "Needs review";
  }
  return "Blocked";
}

function dashboardStatusToHealth(status: string | null | undefined): HealthStatus {
  switch ((status ?? "").trim().toLowerCase()) {
    case "ready":
      return "healthy";
    case "degraded":
      return "warning";
    default:
      return "failed";
  }
}

function summarizeChecks(checks: CheckRecord[]): HealthStatus {
  if (checks.some((check) => !check.ok && (check.severity ?? "").toLowerCase() === "critical")) {
    return "failed";
  }
  if (checks.some((check) => !check.ok)) {
    return "warning";
  }
  return "healthy";
}

function summarizeBootstrapChecks(checks: CheckRecord[]): HealthStatus {
  return checks.some((check) => !check.ok) ? "failed" : "healthy";
}

function summarizeSignals(rows: SignalPathRow[]): HealthStatus {
  if (rows.some((row) => row.status === "failed")) {
    return "failed";
  }
  if (rows.some((row) => row.status === "warning")) {
    return "warning";
  }
  return "healthy";
}

function buildGroup(params: {
  title: string;
  checks: CheckRecord[];
  mode: "runtime" | "bootstrap";
  checkedAt: string | null | undefined;
  fallbackSummary: string;
  successSummary: string;
  nextRoute: HealthRoute;
}): HealthGroup {
  const status = params.mode === "bootstrap" ? summarizeBootstrapChecks(params.checks) : summarizeChecks(params.checks);
  const failingChecks = params.checks.filter((check) => !check.ok);
  const evidence = params.checks.length > 0
    ? params.checks.map((check) => `${check.id}: ${check.ok ? "ok" : "failed"}${check.details ? ` · ${check.details}` : ""}`)
    : [params.fallbackSummary];
  const error = failingChecks.length > 0
    ? failingChecks.map((check) => `${check.id}${check.details ? ` · ${check.details}` : ""}`).join(" | ")
    : "No open blockers recorded.";
  return {
    title: params.title,
    status,
    summary: status === "healthy" ? params.successSummary : params.fallbackSummary,
    lastChecked: formatTimestamp(params.checkedAt),
    evidence,
    error,
    nextRoute: params.nextRoute,
  };
}

function HealthGroupCard({ group }: { group: HealthGroup }) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{group.title}</h3>
          <p className="fg-muted">{group.summary}</p>
        </div>
        <span className="fg-pill" data-tone={toneForStatus(group.status)}>
          {labelForStatus(group.status)}
        </span>
      </div>
      <div className="fg-detail-grid">
        <p>Last check: {group.lastChecked}</p>
        <p>Error: {group.error}</p>
      </div>
      <ul className="fg-list">
        {group.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link className="fg-nav-link" to={group.nextRoute.to}>
        {group.nextRoute.label}
      </Link>
    </article>
  );
}

export function HealthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderControlPlaneResponse | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setState("loading");
      setError(null);
      try {
        const [runtimePayload, providersPayload, logsPayload, usagePayload, dashboardPayload] = await Promise.all([
          fetchRuntimeHealth(),
          fetchProviderControlPlane(instanceId),
          fetchLogs(instanceId),
          fetchUsageSummary("24h", instanceId),
          fetchDashboard(instanceId),
        ]);
        if (!mounted) {
          return;
        }
        setRuntimeHealth(runtimePayload);
        setProviders(providersPayload);
        setLogs(logsPayload);
        setUsage(usagePayload);
        setDashboard(dashboardPayload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setRuntimeHealth(null);
        setProviders(null);
        setLogs(null);
        setUsage(null);
        setDashboard(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Health surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const providerHealthRoute = withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId);
  const oauthTargetsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId);
  const dispatchRoute = withInstanceScope(CONTROL_PLANE_ROUTES.dispatch, instanceId);
  const ingressRoute = withInstanceScope(CONTROL_PLANE_ROUTES.ingressTls, instanceId);
  const logsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId);
  const usageRoute = withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId);
  const costsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId);
  const onboardingRoute = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  const recoveryRoute = withInstanceScope(CONTROL_PLANE_ROUTES.recovery, instanceId);
  const auditHistoryRoute = withInstanceScope(CONTROL_PLANE_ROUTES.auditHistory, instanceId);

  const providersNeedingReview = useMemo(() => (providers?.providers ?? []).filter((provider) => {
    if (!provider.ready || providerNeedsOauthHandoff(provider)) {
      return true;
    }
    return provider.models.some((model) => model.health_status !== "healthy" || model.availability_status === "degraded");
  }), [providers]);

  const runtimeChecks = (runtimeHealth?.readiness.checks ?? []).map((check) => ({
    id: check.id,
    ok: check.ok,
    severity: check.severity,
  }));
  const bootstrapChecks = (providers?.bootstrap_readiness?.checks ?? []).map((check) => ({
    id: check.id,
    ok: check.ok,
    details: check.details,
  }));
  const runtimeChecksById = new Map(runtimeChecks.map((check) => [check.id, check]));
  const bootstrapChecksById = new Map(bootstrapChecks.map((check) => [check.id, check]));
  const dashboardQueueSection = dashboard?.sections.find((section) => section.key === "routing_queue") ?? null;

  const dbMigrationGroup = buildGroup({
    title: "DB / Migration",
    checks: [
      "postgres_url",
      "harness_storage_backend",
      "control_plane_storage_backend",
      "observability_storage_backend",
      "governance_storage_backend",
      "migration_runner",
    ].map((id) => bootstrapChecksById.get(id)).filter(isDefined),
    mode: "bootstrap",
    checkedAt: providers?.bootstrap_readiness?.checked_at ?? null,
    fallbackSummary: "Database wiring or migration proof is incomplete.",
    successSummary: "Storage backends and migration tooling look deployment-ready.",
    nextRoute: { label: "Open Recovery / Backup / Restore", to: recoveryRoute },
  });

  const apiGroup = buildGroup({
    title: "API",
    checks: [
      runtimeChecksById.get("service_dependencies"),
      runtimeChecksById.get("public_origin_contract"),
      bootstrapChecksById.get("app_port"),
      bootstrapChecksById.get("same_origin_runtime_api"),
    ].filter(isDefined),
    mode: "runtime",
    checkedAt: runtimeHealth?.readiness.checked_at ?? null,
    fallbackSummary: `API reachability is not fully proven for api_base ${runtimeHealth?.api_base ?? "unknown"}.`,
    successSummary: `Runtime API base ${runtimeHealth?.api_base ?? "/"} is reachable and aligned with the control-plane origin contract.`,
    nextRoute: { label: "Open Errors & Incident Review", to: withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId) },
  });

  const frontendGroup = buildGroup({
    title: "Frontend",
    checks: [
      runtimeChecksById.get("ui_delivery"),
      bootstrapChecksById.get("frontend_dist"),
      bootstrapChecksById.get("root_ui_on_slash"),
    ].filter(isDefined),
    mode: "runtime",
    checkedAt: runtimeHealth?.readiness.checked_at ?? providers?.bootstrap_readiness?.checked_at ?? null,
    fallbackSummary: "The shipped operator UI is not fully delivered from the expected same-origin path.",
    successSummary: "Frontend delivery is aligned with the root SPA contract.",
    nextRoute: { label: "Open setup progress", to: onboardingRoute },
  });

  const providersGroup = {
    title: "Providers",
    status: providersNeedingReview.length === 0 ? "healthy" as const : providersNeedingReview.some((provider) => providerNeedsOauthHandoff(provider) || !provider.ready) ? "failed" as const : "warning" as const,
    summary: providersNeedingReview.length === 0
      ? "Provider runtime health is currently green."
      : `${providersNeedingReview.length} provider integration${providersNeedingReview.length === 1 ? "" : "s"} need review before runtime posture is trustworthy.`,
    lastChecked: formatTimestamp(providers?.health_config ? providersNeedingReview[0]?.last_health_check_at ?? providers?.bootstrap_readiness?.checked_at ?? runtimeHealth?.readiness.checked_at : runtimeHealth?.readiness.checked_at),
    evidence: providersNeedingReview.length === 0
      ? ["No degraded provider or model health signals were recorded."]
      : providersNeedingReview.map((provider) => `${provider.label}: ${provider.readiness_reason ?? provider.next_action}`),
    error: providersNeedingReview.length === 0
      ? "No provider blockers recorded."
      : providersNeedingReview.map((provider) => provider.label).join(", "),
    nextRoute: {
      label: providersNeedingReview.some((provider) => providerNeedsOauthHandoff(provider)) ? "Open OAuth Targets" : "Open Provider Health & Runs",
      to: providersNeedingReview.some((provider) => providerNeedsOauthHandoff(provider)) ? oauthTargetsRoute : providerHealthRoute,
    },
  };

  const queueWorkerGroup: HealthGroup = dashboardQueueSection ? {
    title: "Queue / Worker",
    status: dashboardStatusToHealth(dashboardQueueSection.status),
    summary: dashboardQueueSection.reason,
    lastChecked: formatTimestamp(dashboard?.generated_at),
    evidence: dashboardQueueSection.details,
    error: dashboardQueueSection.reason,
    nextRoute: { label: dashboardQueueSection.action_label, to: withInstanceScope(dashboardQueueSection.to, instanceId) },
  } : {
    title: "Queue / Worker",
    status: "warning",
    summary: "Queue and worker posture is unavailable from the dashboard summary.",
    lastChecked: "n/a",
    evidence: ["Dashboard did not emit a routing_queue section."],
    error: "Queue and worker evidence is missing.",
    nextRoute: { label: "Open Dispatch", to: dispatchRoute },
  };

  const tlsChecks = [
    runtimeChecksById.get("public_origin_contract"),
    runtimeChecksById.get("tls_certificate_management"),
    bootstrapChecksById.get("public_fqdn_configured"),
    bootstrapChecksById.get("public_dns_resolution"),
    bootstrapChecksById.get("public_https_listener"),
    bootstrapChecksById.get("certificate_material"),
    bootstrapChecksById.get("tls_mode_classification"),
    bootstrapChecksById.get("public_fqdn_tls_evidence"),
  ].filter(isDefined);
  const tlsGroup = buildGroup({
    title: "TLS / FQDN",
    checks: tlsChecks,
    mode: "runtime",
    checkedAt: runtimeHealth?.readiness.checked_at ?? providers?.bootstrap_readiness?.checked_at ?? null,
    fallbackSummary: "Public origin, certificate, or DNS proof is missing, so readiness cannot be green for a public-facing deployment.",
    successSummary: "Public origin, TLS, and DNS evidence line up with the expected deployment posture.",
    nextRoute: { label: "Open Ingress / TLS", to: ingressRoute },
  });

  const signalRows: SignalPathRow[] = [
    {
      label: "Logs",
      status: logs?.operability.ready ? "healthy" : "failed",
      evidence: logs?.operability.checks.map((check) => `${String(check.id)}=${String(check.ok)}`).join(" · ") || "No operability checks returned.",
      route: { label: "Open Logs", to: logsRoute },
    },
    {
      label: "Usage",
      status: (usage?.metrics.recorded_request_count ?? 0) > 0 || (usage?.metrics.recorded_health_event_count ?? 0) > 0 ? "healthy" : "warning",
      evidence: `requests=${String(usage?.metrics.recorded_request_count ?? 0)} · health_events=${String(usage?.metrics.recorded_health_event_count ?? 0)}`,
      route: { label: "Open Usage", to: usageRoute },
    },
    {
      label: "Costs",
      status: Object.keys(usage?.pricing_snapshot ?? {}).length > 0 ? "healthy" : "warning",
      evidence: `pricing_keys=${String(Object.keys(usage?.pricing_snapshot ?? {}).length)} · runtime_cost=${String(usage?.traffic_split.runtime.actual_cost ?? 0)}`,
      route: { label: "Open Costs", to: costsRoute },
    },
    {
      label: "Audit",
      status: logs && (logs.audit_preview.length > 0 || Boolean(logs.audit_retention.latestEventAt)) ? "healthy" : "warning",
      evidence: `preview=${String(logs?.audit_preview.length ?? 0)} · latest=${formatTimestamp(logs?.audit_retention.latestEventAt)}`,
      route: { label: "Open Audit History", to: auditHistoryRoute },
    },
  ];

  const observabilityGroup: HealthGroup = {
    title: "Observability",
    status: summarizeSignals(signalRows),
    summary: "Logs, usage, costs, and audit need to be fed by real signal paths, not by assumed telemetry.",
    lastChecked: formatTimestamp(logs?.audit_retention.latestEventAt ?? runtimeHealth?.readiness.checked_at),
    evidence: signalRows.map((row) => `${row.label}: ${row.evidence}`),
    error: signalRows.filter((row) => row.status !== "healthy").map((row) => row.label).join(", ") || "All signal paths are reporting evidence.",
    nextRoute: { label: "Open Logs", to: logsRoute },
  };

  const checkGroups: HealthGroup[] = [
    dbMigrationGroup,
    apiGroup,
    frontendGroup,
    providersGroup,
    queueWorkerGroup,
    tlsGroup,
    observabilityGroup,
  ];

  const technicalHealthStatus = summarizeSignals([
    { label: "api", status: runtimeHealth?.readiness.accepting_traffic ? "healthy" : "failed", evidence: "", route: { label: "", to: logsRoute } },
    { label: "providers", status: providersGroup.status, evidence: "", route: { label: "", to: providerHealthRoute } },
    { label: "queue_worker", status: queueWorkerGroup.status, evidence: "", route: { label: "", to: dispatchRoute } },
    { label: "observability", status: observabilityGroup.status, evidence: "", route: { label: "", to: logsRoute } },
  ]);
  const readinessStatus = summarizeSignals([
    { label: "db", status: dbMigrationGroup.status, evidence: "", route: { label: "", to: recoveryRoute } },
    { label: "api", status: apiGroup.status, evidence: "", route: { label: "", to: logsRoute } },
    { label: "frontend", status: frontendGroup.status, evidence: "", route: { label: "", to: onboardingRoute } },
    { label: "tls", status: tlsGroup.status, evidence: "", route: { label: "", to: ingressRoute } },
    { label: "traffic", status: runtimeHealth?.readiness.accepting_traffic ? "healthy" : "failed", evidence: "", route: { label: "", to: logsRoute } },
    { label: "bootstrap", status: providers?.bootstrap_readiness?.ready ? "healthy" : "failed", evidence: "", route: { label: "", to: onboardingRoute } },
  ]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Health & Readiness"
        description="Separate technical health from go-live readiness, and tie every failing check to the next operational route."
        question="Is this instance merely up, or is it actually ready for traffic, public exposure, and signal-path accountability?"
        links={[
          {
            label: "Provider Health & Runs",
            to: providerHealthRoute,
            description: "Open the provider-specific probe and run surface when an integration needs review.",
          },
          {
            label: "Dispatch",
            to: dispatchRoute,
            description: "Cross-check worker and queue pressure when runtime posture is degraded by stale dispatch fabric.",
          },
          {
            label: "Ingress / TLS",
            to: ingressRoute,
            description: "Fix public-origin, TLS, and certificate blockers that keep readiness red.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: labelForStatus(technicalHealthStatus), tone: toneForStatus(technicalHealthStatus) },
          { label: `Readiness: ${labelForStatus(readinessStatus)}`, tone: toneForStatus(readinessStatus) },
        ]}
        note="Health answers whether the stack is functioning now. Readiness answers whether the current posture is deployable, supportable, and publicly acceptable."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="health and readiness"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading health, readiness, and signal-path evidence.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {runtimeHealth && providers && logs && usage && dashboard ? (
        <>
          <div className="fg-grid fg-grid-compact">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Technical Health</h3>
                  <p className="fg-muted">Can the runtime answer traffic and keep core operational evidence alive right now?</p>
                </div>
                <span className="fg-pill" data-tone={toneForStatus(technicalHealthStatus)}>
                  {labelForStatus(technicalHealthStatus)}
                </span>
              </div>
              <div className="fg-detail-grid">
                <p>Runtime traffic: {runtimeHealth.readiness.accepting_traffic ? "accepting traffic" : "blocked"}</p>
                <p>Provider review count: {String(providersNeedingReview.length)}</p>
                <p>Queue / worker posture: {queueWorkerGroup.summary}</p>
                <p>Signal path: {observabilityGroup.error}</p>
              </div>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Readiness</h3>
                  <p className="fg-muted">Can this instance be considered deployment-ready instead of merely alive?</p>
                </div>
                <span className="fg-pill" data-tone={toneForStatus(readinessStatus)}>
                  {labelForStatus(readinessStatus)}
                </span>
              </div>
              <div className="fg-detail-grid">
                <p>Bootstrap readiness: {providers.bootstrap_readiness?.ready ? "ready" : "not ready"}</p>
                <p>Runtime readiness state: {runtimeHealth.readiness.state}</p>
                <p>TLS / FQDN: {tlsGroup.error}</p>
                <p>Frontend delivery: {frontendGroup.error}</p>
              </div>
              {!providers.bootstrap_readiness?.ready ? (
                <p className="fg-danger">
                  Readiness stays non-green until bootstrap checks pass. Missing TLS/FQDN evidence is treated as a real blocker, not as a cosmetic warning.
                </p>
              ) : null}
            </article>
          </div>

          <div className="fg-grid">
            {checkGroups.map((group) => <HealthGroupCard key={group.title} group={group} />)}
          </div>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Provider Needing Review</h3>
                <p className="fg-muted">Providers are listed here only when their runtime or auth posture needs intervention.</p>
              </div>
            </div>
            <ul className="fg-list">
              {providersNeedingReview.length === 0 ? <li>No provider needs review right now.</li> : null}
              {providersNeedingReview.map((provider) => {
                const route = providerNeedsOauthHandoff(provider) ? oauthTargetsRoute : providerHealthRoute;
                return (
                  <li key={provider.provider}>
                    <strong>{provider.label}</strong> · {provider.readiness_reason ?? provider.next_action} ·
                    {" "}
                    <Link className="fg-nav-link" to={route}>
                      {providerNeedsOauthHandoff(provider) ? "Open OAuth Targets" : "Open Provider Health & Runs"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Signal Path</h3>
                <p className="fg-muted">Prove that logs, usage, costs, and audit are actually being fed by the running product.</p>
              </div>
            </div>
            <div className="fg-grid fg-grid-compact">
              {signalRows.map((row) => (
                <article key={row.label} className="fg-outline-row">
                  <div className="fg-panel-heading fg-data-row-heading">
                    <strong>{row.label}</strong>
                    <span className="fg-pill" data-tone={toneForStatus(row.status)}>{labelForStatus(row.status)}</span>
                  </div>
                  <p className="fg-muted">{row.evidence}</p>
                  <Link className="fg-nav-link" to={row.route.to}>{row.route.label}</Link>
                </article>
              ))}
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Current Risks</h3>
                <p className="fg-muted">Live attention items come from the dashboard risk model instead of ad-hoc frontend guesses.</p>
              </div>
            </div>
            <ul className="fg-list">
              {dashboard.attention.length === 0 ? <li>No current risks were emitted for this scope.</li> : null}
              {dashboard.attention.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong> · {item.cause} ·
                  {" "}
                  <Link className="fg-nav-link" to={withInstanceScope(item.to, instanceId)}>
                    {item.action_label}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
