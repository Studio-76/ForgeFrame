import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { fetchDashboard, type DashboardResponse } from "../api/domain/dashboard";
import { fetchLogs, type LogsResponse } from "../api/domain/logs";
import { fetchProviderControlPlane, type ProviderControlPlaneResponse } from "../api/domain/providers";
import { fetchRuntimeHealth, type RuntimeHealthResponse } from "../api/domain/health";
import { fetchUsageSummary, type UsageSummaryResponse } from "../api/domain/usage";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { Button } from "../components/ui/Button";
import { DetailPanel } from "../components/ui/DetailPanel";
import { IncidentResponsePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import {
  HealthGroupCard,
  buildGroup,
  dashboardStatusToHealth,
  formatTimestamp,
  isDefined,
  labelForStatus,
  providerNeedsOauthHandoff,
  summarizeSignals,
  toneForStatus,
} from "../features/health";
import type { HealthGroup, SignalPathRow } from "../features/health";

export function HealthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  // ── Page-local state ────────────────────────────────────────
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderControlPlaneResponse | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<HealthGroup | null>(null);

  // ── Instance scope change handler ──────────────────────────
  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  // ── Data fetching ──────────────────────────────────────────
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
  }, [instanceId, refreshNonce]);

  // ── Refresh handler ────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshNonce((current) => current + 1);
    setSelectedGroup(null);
  }, []);

  // ── Routes ─────────────────────────────────────────────────
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
  const errorsRoute = withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId);

  // ── Derived data ───────────────────────────────────────────
  const providersNeedingReview = useMemo(() => (providers?.providers ?? []).filter((provider) => {
    if (!provider.ready || providerNeedsOauthHandoff(provider)) {
      return true;
    }
    return provider.models.some((model) => model.health_status !== "healthy" || model.availability_status === "degraded");
  }), [providers]);

  const runtimeChecks = (runtimeHealth?.readiness?.checks ?? []).map((check) => ({
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

  // ── Build health groups ────────────────────────────────────
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
    nextRoute: { label: "Review recovery posture", to: recoveryRoute },
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
    checkedAt: runtimeHealth?.readiness?.checked_at ?? null,
    fallbackSummary: `API reachability is not fully proven for api_base ${runtimeHealth?.api_base ?? "unknown"}.`,
    successSummary: `Runtime API base ${runtimeHealth?.api_base ?? "/"} is reachable and aligned with the control-plane origin contract.`,
    nextRoute: { label: "Review errors and incidents", to: errorsRoute },
  });

  const frontendGroup = buildGroup({
    title: "Frontend",
    checks: [
      runtimeChecksById.get("ui_delivery"),
      bootstrapChecksById.get("frontend_dist"),
      bootstrapChecksById.get("root_ui_on_slash"),
    ].filter(isDefined),
    mode: "runtime",
    checkedAt: runtimeHealth?.readiness?.checked_at ?? providers?.bootstrap_readiness?.checked_at ?? null,
    fallbackSummary: "The shipped operator UI is not fully delivered from the expected same-origin path.",
    successSummary: "Frontend delivery is aligned with the root SPA contract.",
    nextRoute: { label: "Check setup progress", to: onboardingRoute },
  });

  const providersGroup: HealthGroup = {
    title: "Providers",
    status: providersNeedingReview.length === 0 ? "healthy" as const : providersNeedingReview.some((provider) => providerNeedsOauthHandoff(provider) || !provider.ready) ? "failed" as const : "warning" as const,
    summary: providersNeedingReview.length === 0
      ? "Provider runtime health is currently green."
      : `${providersNeedingReview.length} provider integration${providersNeedingReview.length === 1 ? "" : "s"} need review before runtime posture is trustworthy.`,
    lastChecked: formatTimestamp(providers?.health_config ? providersNeedingReview[0]?.last_health_check_at ?? providers?.bootstrap_readiness?.checked_at ?? runtimeHealth?.readiness?.checked_at : runtimeHealth?.readiness?.checked_at),
    evidence: providersNeedingReview.length === 0
      ? ["No degraded provider or model health signals were recorded."]
      : providersNeedingReview.map((provider) => `${provider.label}: ${provider.readiness_reason ?? provider.next_action}`),
    error: providersNeedingReview.length === 0
      ? "No provider blockers recorded."
      : providersNeedingReview.map((provider) => provider.label).join(", "),
    nextRoute: {
      label: providersNeedingReview.some((provider) => providerNeedsOauthHandoff(provider)) ? "Review OAuth targets" : "Review provider health and runs",
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
    nextRoute: { label: "Review dispatch queue", to: dispatchRoute },
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
    checkedAt: runtimeHealth?.readiness?.checked_at ?? providers?.bootstrap_readiness?.checked_at ?? null,
    fallbackSummary: "Public origin, certificate, or DNS proof is missing, so readiness cannot be green for a public-facing deployment.",
    successSummary: "Public origin, TLS, and DNS evidence line up with the expected deployment posture.",
    nextRoute: { label: "Review ingress/TLS", to: ingressRoute },
  });

  const signalRows: SignalPathRow[] = [
    {
      label: "Logs",
      status: logs?.operability?.ready ? "healthy" : "failed",
      evidence: (logs?.operability?.checks ?? []).map((check) => `${String(check.id)}=${String(check.ok)}`).join(" · ") || "No operability checks returned.",
      route: { label: "View logs", to: logsRoute },
    },
    {
      label: "Usage",
      status: (usage?.metrics?.recorded_request_count ?? 0) > 0 || (usage?.metrics?.recorded_health_event_count ?? 0) > 0 ? "healthy" : "warning",
      evidence: `requests=${String(usage?.metrics?.recorded_request_count ?? 0)} · health_events=${String(usage?.metrics?.recorded_health_event_count ?? 0)}`,
      route: { label: "View usage metrics", to: usageRoute },
    },
    {
      label: "Costs",
      status: Object.keys(usage?.pricing_snapshot ?? {}).length > 0 ? "healthy" : "warning",
      evidence: `pricing_keys=${String(Object.keys(usage?.pricing_snapshot ?? {}).length)} · runtime_cost=${String(usage?.traffic_split?.runtime?.actual_cost ?? 0)}`,
      route: { label: "View cost metrics", to: costsRoute },
    },
    {
      label: "Audit",
      status: logs && ((logs.audit_preview ?? []).length > 0 || Boolean(logs.audit_retention?.latestEventAt)) ? "healthy" : "warning",
      evidence: `preview=${String((logs?.audit_preview ?? []).length)} · latest=${formatTimestamp(logs?.audit_retention?.latestEventAt)}`,
      route: { label: "View audit history", to: auditHistoryRoute },
    },
  ];

  const observabilityGroup: HealthGroup = {
    title: "Observability",
    status: summarizeSignals(signalRows),
    summary: "Logs, usage, costs, and audit need to be fed by real signal paths, not by assumed telemetry.",
    lastChecked: formatTimestamp(logs?.audit_retention?.latestEventAt ?? runtimeHealth?.readiness?.checked_at),
    evidence: signalRows.map((row) => `${row.label}: ${row.evidence}`),
    error: signalRows.filter((row) => row.status !== "healthy").map((row) => row.label).join(", ") || "All signal paths are reporting evidence.",
    nextRoute: { label: "View logs", to: logsRoute },
  };

  const checkGroups: HealthGroup[] = useMemo(() => [
    dbMigrationGroup,
    apiGroup,
    frontendGroup,
    providersGroup,
    queueWorkerGroup,
    tlsGroup,
    observabilityGroup,
  ], [dbMigrationGroup, apiGroup, frontendGroup, providersGroup, queueWorkerGroup, tlsGroup, observabilityGroup]);

  const technicalHealthStatus = summarizeSignals([
    { label: "api",       status: runtimeHealth?.readiness?.accepting_traffic ? "healthy" : "failed", evidence: "", route: { label: "", to: logsRoute } },
    { label: "providers", status: providersGroup.status, evidence: "", route: { label: "", to: providerHealthRoute } },
    { label: "queue_worker", status: queueWorkerGroup.status, evidence: "", route: { label: "", to: dispatchRoute } },
    { label: "observability", status: observabilityGroup.status, evidence: "", route: { label: "", to: logsRoute } },
  ]);
  const readinessStatus = summarizeSignals([
    { label: "db", status: dbMigrationGroup.status, evidence: "", route: { label: "", to: recoveryRoute } },
    { label: "api", status: apiGroup.status, evidence: "", route: { label: "", to: logsRoute } },
    { label: "frontend", status: frontendGroup.status, evidence: "", route: { label: "", to: onboardingRoute } },
    { label: "tls", status: tlsGroup.status, evidence: "", route: { label: "", to: ingressRoute } },
    { label: "traffic",       status: runtimeHealth?.readiness?.accepting_traffic ? "healthy" : "failed", evidence: "", route: { label: "", to: logsRoute } },
    { label: "bootstrap", status: providers?.bootstrap_readiness?.ready ? "healthy" : "failed", evidence: "", route: { label: "", to: onboardingRoute } },
  ]);

  const dataLoaded = runtimeHealth && providers && logs && usage && dashboard;

  // ── Attention items ────────────────────────────────────────
  const attentionItems: AttentionPayload[] = useMemo(() => {
    const items: AttentionPayload[] = [];

    if (!dataLoaded) {
      return items;
    }

    const failedGroups = checkGroups.filter((g) => g.status === "failed");
    const warningGroups = checkGroups.filter((g) => g.status === "warning");

    if (failedGroups.length > 0) {
      items.push({
        key: "failed-groups",
        level: "primary_blocker",
        title: `${failedGroups.length} health group${failedGroups.length > 1 ? "s" : ""} in failed state`,
        description: failedGroups.map((g) => `${g.title}: ${g.error}`).join(" | "),
      });
    }

    if (warningGroups.length > 0) {
      items.push({
        key: "warning-groups",
        level: "warning",
        title: `${warningGroups.length} health group${warningGroups.length > 1 ? "s" : ""} need${warningGroups.length === 1 ? "s" : ""} review`,
        description: warningGroups.map((g) => g.title).join(", "),
      });
    }

    if (dashboard && dashboard.attention.length > 0) {
      items.push({
        key: "dashboard-risks",
        level: "needs_action",
        title: `${dashboard.attention.length} current risk${dashboard.attention.length === 1 ? "" : "s"} from dashboard`,
        description: dashboard.attention.map((a) => a.title).join(", "),
      });
    }

    if (failedGroups.length === 0 && warningGroups.length === 0) {
      items.push({
        key: "all-healthy",
        level: "healthy",
        title: "All health groups are green",
        description: "No failed or warning groups detected.",
      });
    }

    return items;
  }, [checkGroups, dashboard, dataLoaded]);

  // ── Summary items ──────────────────────────────────────────
  const summaryItems = useMemo(() => {
    if (!dataLoaded) {
      return undefined;
    }
    const healthyCount = checkGroups.filter((g) => g.status === "healthy").length;
    const warningCount = checkGroups.filter((g) => g.status === "warning").length;
    const failedCount = checkGroups.filter((g) => g.status === "failed").length;

    return [
      {
        key: "healthy" as const,
        label: "Healthy groups" as const,
        value: String(healthyCount) as string,
        tone: "success" as const,
        status: "ready" as const,
      },
      ...(warningCount > 0
        ? [{
            key: "warning" as const,
            label: "Needs review" as const,
            value: String(warningCount) as string,
            tone: "warning" as const,
            status: "partial" as const,
          }]
        : []),
      ...(failedCount > 0
        ? [{
            key: "failed" as const,
            label: "Failed groups" as const,
            value: String(failedCount) as string,
            tone: "danger" as const,
            status: "blocked" as const,
          }]
        : []),
    ];
  }, [checkGroups, dataLoaded]);

  // ── Page actions ───────────────────────────────────────────
  const actions: Action[] = useMemo(() => [
    {
      label: "Refresh health data",
      kind: "secondary",
      intent: "run",
      onClick: handleRefresh,
    },
  ], [handleRefresh]);

  // ── Selected item detail (not sticky — two-pane layout provides sidebar position) ──
  const selectedItemContent = selectedGroup ? (
    <DetailPanel
      title={`${selectedGroup.title} — Details`}
      description={selectedGroup.summary}
      status={labelForStatus(selectedGroup.status)}
      statusTone={toneForStatus(selectedGroup.status)}
      statusKey={selectedGroup.status}
      actions={
        <div className="flex gap-2">
          <Button variant="navigation" onPress={() => navigate(selectedGroup.nextRoute.to)}>
            {selectedGroup.nextRoute.label}
          </Button>
          <Button variant="tertiary" onPress={() => setSelectedGroup(null)}>
            Close
          </Button>
        </div>
      }
    >
      <div className="fg-detail-grid">
        <p>Last checked: {selectedGroup.lastChecked}</p>
        <p>Error: {selectedGroup.error}</p>
      </div>
      <h4 className="fg-heading-sm mt-3">Evidence</h4>
      <ul className="fg-list">
        {selectedGroup.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </DetailPanel>
  ) : null;

  // ── Diagnostics content ────────────────────────────────────
  const diagnosticsContent = (
    <div className="fg-stack">
      <p className="text-muted">Runtime health API base: {runtimeHealth?.api_base ?? "unknown"}</p>
      <p className="text-muted">Readiness state: {runtimeHealth?.readiness?.state ?? "unknown"}</p>
      <p className="text-muted">Accepting traffic: {String(runtimeHealth?.readiness?.accepting_traffic ?? false)}</p>
      <p className="text-muted">Bootstrap ready: {String(providers?.bootstrap_readiness?.ready ?? false)}</p>
      <p className="text-muted">Technical health: {labelForStatus(technicalHealthStatus)}</p>
      <p className="text-muted">Readiness posture: {labelForStatus(readinessStatus)}</p>
      {error ? <p className="fg-danger">{error}</p> : null}
    </div>
  );

  return (
    <IncidentResponsePage
      eyebrow="Runtime"
      title="Health Status"
      description="System health and active incidents for the selected instance"
      scope={selectedInstance ? {
        label: selectedInstance.display_name ?? selectedInstance.instance_id,
        onChange: () => onInstanceChange(null),
      } : undefined}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={actions}
      selectedItemContent={selectedItemContent}
      hasSelection={selectedGroup !== null}
      useTwoPaneLayout
      detailPanelTitle="Health group detail"
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Health diagnostics"
    >
      {/* ── Scope selector (hidden when scoped via template prop) ── */}
      <div hidden={!!selectedInstance}>
        <InstanceScopeCard
          instanceId={instanceId}
          selectedInstance={selectedInstance}
          instances={instances}
          loadState={loadState}
          error={instancesError}
          surfaceLabel="health and readiness"
          onInstanceChange={onInstanceChange}
        />
      </div>

      {/* ── Loading state ── */}
      {state === "loading" ? (
        <div className="ff-state-block" data-state="loading">
          <div className="ff-skeleton-row" />
          <strong>Loading health surface</strong>
          <p>Restoring runtime health, provider readiness, signal paths, and risk evidence.</p>
        </div>
      ) : null}

      {/* ── Error state ── */}
      {error && !dataLoaded ? <p className="fg-danger">{error}</p> : null}

      {/* ── Data-loaded content ── */}
      {dataLoaded ? (
        <>
          {/* ── Health group cards ── */}
          <div className="fg-grid">
            {checkGroups.map((group) => (
              <HealthGroupCard
                key={group.title}
                group={group}
                onSelect={() => setSelectedGroup(group)}
              />
            ))}
          </div>

          {/* ── Providers needing review ── */}
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
                    <Button variant="navigation" onPress={() => navigate(route)}>
                      {providerNeedsOauthHandoff(provider) ? "Review OAuth targets" : "Review provider health"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </article>

          {/* ── Signal path ── */}
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
                  <Button variant="navigation" onPress={() => navigate(row.route.to)}>
                    {row.route.label}
                  </Button>
                </article>
              ))}
            </div>
          </article>


        </>
      ) : null}
    </IncidentResponsePage>
  );
}
