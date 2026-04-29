import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchBootstrapReadiness,
  fetchIngressTlsStatus,
  fetchProviderControlPlane,
  fetchRecoveryOverview,
  fetchRoutingControlPlane,
  fetchRuntimeHealth,
  type IngressTlsStatusResponse,
  type ProviderControlPlaneResponse,
  type RecoveryOverviewResponse,
  type RoutingControlPlaneResponse,
  type RuntimeHealthResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type BootstrapPayload = {
  ready: boolean;
  checks: Array<Record<string, unknown>>;
  next_steps: string[];
  checked_at?: string;
};
type GateRecord = {
  key: string;
  category: string;
  statusLabel: string;
  tone: StatusTone;
  statusKey: string;
  ready: boolean;
  severity: number;
  evidenceSource: string;
  evidenceAt: string | null;
  blocker: string;
  linkTo: string;
  linkLabel: string;
  notes: string[];
};

function hasEvidenceTimestamp(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

function formatTimestamp(value: string | null | undefined): string {
  return hasEvidenceTimestamp(value) ? value : "manual evidence required";
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const normalized = values
    .filter(hasEvidenceTimestamp)
    .sort();
  return normalized.at(-1) ?? null;
}

function asCheckId(value: Record<string, unknown>): string {
  return typeof value.id === "string" ? value.id : "unknown_check";
}

function asCheckDetails(value: Record<string, unknown>): string {
  return typeof value.details === "string" ? value.details : "No details recorded.";
}

function blockerToneAndState(severity: number): { tone: StatusTone; statusKey: string } {
  if (severity >= 3) {
    return { tone: "danger", statusKey: "blocked" };
  }
  if (severity === 2) {
    return { tone: "warning", statusKey: "partial" };
  }
  return { tone: "info", statusKey: "unsupported" };
}

function enforceEvidenceTimestamp(gate: GateRecord): GateRecord {
  if (!gate.ready || hasEvidenceTimestamp(gate.evidenceAt)) {
    return gate;
  }

  return {
    ...gate,
    statusLabel: "manual evidence required",
    tone: "warning",
    statusKey: "partial",
    ready: false,
    severity: Math.max(gate.severity, 3),
    blocker: `${gate.category} is functionally green, but the release gate has no evidence timestamp.`,
    notes: [
      "Evidence timestamp is missing, so this gate cannot contribute to release-ready.",
      gate.blocker,
      ...gate.notes,
    ],
  };
}

export function ReleaseValidationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [recovery, setRecovery] = useState<RecoveryOverviewResponse | null>(null);
  const [providers, setProviders] = useState<ProviderControlPlaneResponse | null>(null);
  const [routing, setRouting] = useState<RoutingControlPlaneResponse | null>(null);
  const [ingress, setIngress] = useState<IngressTlsStatusResponse | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedGateKey, setSelectedGateKey] = useState<string>("");

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
        const [
          bootstrapPayload,
          runtimePayload,
          recoveryPayload,
          providersPayload,
          routingPayload,
          ingressPayload,
        ] = await Promise.all([
          fetchBootstrapReadiness(),
          fetchRuntimeHealth(),
          fetchRecoveryOverview(),
          fetchProviderControlPlane(instanceId),
          fetchRoutingControlPlane(instanceId),
          fetchIngressTlsStatus(),
        ]);
        if (!mounted) {
          return;
        }
        setBootstrap(bootstrapPayload);
        setRuntimeHealth(runtimePayload);
        setRecovery(recoveryPayload);
        setProviders(providersPayload);
        setRouting(routingPayload);
        setIngress(ingressPayload);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setBootstrap(null);
        setRuntimeHealth(null);
        setRecovery(null);
        setProviders(null);
        setRouting(null);
        setIngress(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Release validation surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId, refreshNonce]);

  const providersLink = withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId);
  const routingLink = withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId);
  const dispatchLink = withInstanceScope(CONTROL_PLANE_ROUTES.dispatch, instanceId);
  const queuesLink = withInstanceScope(CONTROL_PLANE_ROUTES.queues, instanceId);
  const healthLink = withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);
  const onboardingLink = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);

  const rawGates: GateRecord[] = [];

  if (bootstrap && runtimeHealth && recovery && providers && routing && ingress) {
    const bootstrapFailures = (bootstrap.checks ?? []).filter((check) => check.ok !== true);
    rawGates.push({
      key: "build_test",
      category: "Build / Test",
      statusLabel: "manual evidence required",
      tone: "warning",
      statusKey: "blocked",
      ready: false,
      severity: 3,
      evidenceSource: "Release pipeline evidence is not wired into the control plane.",
      evidenceAt: null,
      blocker: "Build and test proof still needs explicit operator evidence before this build can be called release-ready.",
      linkTo: CONTROL_PLANE_ROUTES.auditHistory,
      linkLabel: "Open Audit History",
      notes: [
        "No shipped release-pipeline endpoint currently records green build/test proof into this gateboard.",
        "Until that evidence exists, the release claim stays blocked instead of fake-green.",
      ],
    });

    rawGates.push({
      key: "bootstrap",
      category: "Bootstrap",
      statusLabel: bootstrap.ready ? "ready" : "blocked",
      tone: bootstrap.ready ? "success" : "danger",
      statusKey: bootstrap.ready ? "ready" : "blocked",
      ready: bootstrap.ready,
      severity: bootstrap.ready ? 0 : 3,
      evidenceSource: "Bootstrap readiness report",
      evidenceAt: bootstrap.checked_at ?? null,
      blocker: bootstrap.ready
        ? "Bootstrap readiness report is fully green."
        : `${bootstrapFailures.length} bootstrap checks still fail. ${bootstrapFailures[0] ? `${asCheckId(bootstrapFailures[0])}: ${asCheckDetails(bootstrapFailures[0])}` : "Missing details."}`,
      linkTo: onboardingLink,
      linkLabel: "Open Bootstrap / Readiness",
      notes: bootstrapFailures.map((check) => `${asCheckId(check)}: ${asCheckDetails(check)}`),
    });

    const runtimeCriticalChecks = runtimeHealth.readiness.checks.filter((check) => !check.ok && check.severity === "critical");
    rawGates.push({
      key: "runtime_api",
      category: "Runtime API",
      statusLabel: runtimeHealth.readiness.accepting_traffic ? "ready" : "blocked",
      tone: runtimeHealth.readiness.accepting_traffic ? "success" : "danger",
      statusKey: runtimeHealth.readiness.accepting_traffic ? "ready" : "blocked",
      ready: runtimeHealth.readiness.accepting_traffic,
      severity: runtimeHealth.readiness.accepting_traffic ? 0 : 3,
      evidenceSource: "Runtime /health readiness payload",
      evidenceAt: runtimeHealth.readiness.checked_at ?? null,
      blocker: runtimeHealth.readiness.accepting_traffic
        ? "Runtime health is currently accepting traffic."
        : `${runtimeHealth.readiness.critical_count} critical readiness checks block runtime traffic.`,
      linkTo: healthLink,
      linkLabel: "Open Health",
      notes: runtimeCriticalChecks.map((check) => `${check.id}: severity=${check.severity}`),
    });

    const readyProviders = providers.providers.filter((provider) => provider.ready && provider.runtime_readiness === "ready");
    const providerEvidenceAt = latestTimestamp(
      providers.providers.flatMap((provider) => [
        provider.last_health_check_at,
        provider.last_probe_at,
        provider.last_sync_at,
      ]),
    );
    const firstProviderIssue = providers.providers.find((provider) => !provider.ready || provider.runtime_readiness !== "ready");
    const providerGateReady = readyProviders.length > 0 && providerEvidenceAt !== null;
    rawGates.push({
      key: "provider",
      category: "Provider",
      statusLabel: providerGateReady ? "ready" : readyProviders.length > 0 ? "manual evidence required" : "blocked",
      tone: providerGateReady ? "success" : readyProviders.length > 0 ? "warning" : "danger",
      statusKey: providerGateReady ? "ready" : readyProviders.length > 0 ? "partial" : "blocked",
      ready: providerGateReady,
      severity: providerGateReady ? 0 : readyProviders.length > 0 ? 2 : 3,
      evidenceSource: "Provider control plane and health evidence",
      evidenceAt: providerEvidenceAt,
      blocker: providerGateReady
        ? `${readyProviders.length} provider routes are runtime-ready.`
        : readyProviders.length > 0
          ? "Provider readiness exists, but no evidence timestamp is recorded for the current release gate."
        : `No runtime-ready provider path is available${firstProviderIssue ? `; first issue: ${firstProviderIssue.provider} -> ${firstProviderIssue.readiness_reason ?? firstProviderIssue.next_action}` : "."}`,
      linkTo: providersLink,
      linkLabel: "Open Providers",
      notes: providers.providers.map((provider) => `${provider.provider}: ready=${String(provider.ready)} runtime=${provider.runtime_readiness}`),
    });

    const oauthProviders = providers.providers.filter((provider) => provider.oauth_required);
    const oauthBlockedProviders = oauthProviders.filter((provider) => provider.oauth_connect_required || (provider.oauth_failure_count ?? 0) > 0);
    const oauthEvidenceAt = latestTimestamp(
      oauthProviders.flatMap((provider) => [
        typeof provider.oauth_last_probe?.checked_at === "string" ? provider.oauth_last_probe.checked_at : null,
        typeof provider.oauth_last_bridge_sync?.checked_at === "string" ? provider.oauth_last_bridge_sync.checked_at : null,
        provider.last_probe_at,
      ]),
    );
    const oauthReady = oauthProviders.length === 0 || oauthBlockedProviders.length === 0;
    rawGates.push({
      key: "oauth",
      category: "OAuth",
      statusLabel: oauthProviders.length === 0 ? "not required in scope" : oauthReady ? "ready" : "blocked",
      tone: oauthProviders.length === 0 ? "info" : oauthReady ? "success" : "danger",
      statusKey: oauthProviders.length === 0 ? "unsupported" : oauthReady ? "ready" : "blocked",
      ready: oauthProviders.length === 0 || oauthReady,
      severity: oauthProviders.length === 0 ? 0 : oauthReady ? 0 : 2,
      evidenceSource: oauthProviders.length === 0 ? "No OAuth-backed providers are active in the selected scope." : "OAuth provider bridge and probe truth",
      evidenceAt: oauthProviders.length === 0 ? providerEvidenceAt : oauthEvidenceAt,
      blocker: oauthProviders.length === 0
        ? "No OAuth-backed provider gate is required for this scoped release path."
        : oauthReady
          ? "OAuth-backed providers are connected without active probe failures."
          : `${oauthBlockedProviders.length} OAuth-backed providers still need bridge or credential work.`,
      linkTo: CONTROL_PLANE_ROUTES.oauthTargets,
      linkLabel: "Open OAuth Targets",
      notes: oauthProviders.map((provider) => `${provider.provider}: connect_required=${String(provider.oauth_connect_required)} failures=${provider.oauth_failure_count ?? 0}`),
    });

    const openCircuits = routing.circuits.filter((circuit) => circuit.state === "open");
    const routingEvidenceAt = latestTimestamp([
      routing.budget.updated_at,
      routing.budget.last_evaluated_at,
      ...routing.circuits.map((circuit) => circuit.updated_at ?? null),
      ...routing.recent_decisions.map((decision) => decision.created_at),
    ]);
    const routingReady = !routing.budget.hard_blocked && openCircuits.length === 0 && routing.targets.length > 0;
    rawGates.push({
      key: "routing",
      category: "Routing",
      statusLabel: routingReady ? "ready" : "blocked",
      tone: routingReady ? "success" : "danger",
      statusKey: routingReady ? "ready" : routing.budget.hard_blocked ? "budget_blocked" : "circuit_open",
      ready: routingReady,
      severity: routingReady ? 0 : 3,
      evidenceSource: "Routing policy, budget, circuit, and decision ledger",
      evidenceAt: routingEvidenceAt,
      blocker: routingReady
        ? "Routing policy, budget, and circuit posture are clear for release."
        : routing.budget.hard_blocked
          ? `Routing budget is hard blocked${routing.budget.reason ? `: ${routing.budget.reason}` : "."}`
          : openCircuits.length > 0
            ? `${openCircuits.length} routing circuits are open.`
            : "Routing has no active target coverage in this scope.",
      linkTo: routingLink,
      linkLabel: "Open Routing",
      notes: [
        ...openCircuits.map((circuit) => `${circuit.target_key}: ${circuit.reason ?? "open"}`),
        ...routing.recent_decisions.slice(0, 3).map((decision) => `${decision.created_at}: ${decision.summary}`),
      ],
    });

    rawGates.push({
      key: "queue_dispatch",
      category: "Queue / Dispatch",
      statusLabel: "manual evidence required",
      tone: "warning",
      statusKey: "blocked",
      ready: false,
      severity: 3,
      evidenceSource: "No shipped aggregate release gate currently proves queue pressure, dispatch recovery, and worker posture together.",
      evidenceAt: null,
      blocker: "Queue and dispatch validation still requires explicit operator review before release.",
      linkTo: dispatchLink,
      linkLabel: "Open Dispatch",
      notes: [
        `Queue route: ${queuesLink}`,
        `Dispatch route: ${dispatchLink}`,
      ],
    });

    rawGates.push({
      key: "security",
      category: "Security",
      statusLabel: "manual evidence required",
      tone: "warning",
      statusKey: "blocked",
      ready: false,
      severity: 3,
      evidenceSource: "No shipped release gate currently records a full security posture signoff with timestamped approval coverage.",
      evidenceAt: null,
      blocker: "Security validation still requires explicit review of policies, approvals, and access posture.",
      linkTo: CONTROL_PLANE_ROUTES.security,
      linkLabel: "Open Security",
      notes: [
        "Security remains a hard release gate until explicit evidence is wired into the control plane.",
      ],
    });

    const tlsReady = ingress.mode_classification === "normative_public_https";
    rawGates.push({
      key: "tls",
      category: "TLS",
      statusLabel: tlsReady ? "ready" : selectedInstance?.exposure_mode === "local_only" ? "only local" : ingress.tls_mode !== "integrated_acme" || !ingress.fqdn || ingress.certificate.trust_state === "self_signed" ? "exception mode" : "blocked",
      tone: tlsReady ? "success" : selectedInstance?.exposure_mode === "local_only" ? "info" : ingress.tls_mode !== "integrated_acme" || !ingress.fqdn || ingress.certificate.trust_state === "self_signed" ? "warning" : "danger",
      statusKey: tlsReady ? "ready" : selectedInstance?.exposure_mode === "local_only" ? "onboarding-only" : ingress.tls_mode !== "integrated_acme" || !ingress.fqdn || ingress.certificate.trust_state === "self_signed" ? "unsupported" : "blocked",
      ready: tlsReady,
      severity: tlsReady ? 0 : selectedInstance?.exposure_mode === "local_only" ? 1 : ingress.tls_mode !== "integrated_acme" || !ingress.fqdn || ingress.certificate.trust_state === "self_signed" ? 2 : 3,
      evidenceSource: "Ingress / TLS certificate status API",
      evidenceAt: ingress.checked_at,
      blocker: tlsReady
        ? "Public HTTPS and certificate evidence are aligned."
        : ingress.blockers[0]
          ? `Ingress/TLS blocker: ${ingress.blockers[0]}`
          : "Ingress/TLS evidence is not yet production-ready.",
      linkTo: CONTROL_PLANE_ROUTES.ingressTls,
      linkLabel: "Open Ingress / TLS",
      notes: [
        `fqdn=${ingress.fqdn ?? "missing"}`,
        `trust_state=${ingress.certificate.trust_state}`,
        `renewal_allowed=${String(ingress.renewal_allowed)}`,
      ],
    });

    const recoveryReady = recovery.summary.runtime_status === "ok" && recovery.upgrade_posture.runtime_status === "ok";
    rawGates.push({
      key: "backup_recovery",
      category: "Backup / Recovery",
      statusLabel: recoveryReady ? "ready" : "blocked",
      tone: recoveryReady ? "success" : "danger",
      statusKey: recoveryReady ? "ready" : "blocked",
      ready: recoveryReady,
      severity: recoveryReady ? 0 : 3,
      evidenceSource: "Recovery overview and upgrade posture",
      evidenceAt: recovery.summary.checked_at,
      blocker: recoveryReady
        ? "Recovery runtime and upgrade posture are green."
        : `Recovery runtime=${recovery.summary.runtime_status}; upgrade=${recovery.upgrade_posture.runtime_status}; blockers=${recovery.upgrade_posture.blockers.join(", ") || "missing evidence"}`,
      linkTo: CONTROL_PLANE_ROUTES.recovery,
      linkLabel: "Open Recovery",
      notes: recovery.upgrade_posture.blockers,
    });
  }

  const gates = rawGates.map(enforceEvidenceTimestamp);

  useEffect(() => {
    if (gates.length === 0) {
      setSelectedGateKey("");
      return;
    }
    if (!gates.some((gate) => gate.key === selectedGateKey)) {
      setSelectedGateKey(gates[0].key);
    }
  }, [selectedGateKey, gates.length, gates.map((gate) => gate.key).join(",")]);

  const selectedGate = gates.find((gate) => gate.key === selectedGateKey) ?? gates[0] ?? null;
  const releaseReady = gates.length > 0 && gates.every((gate) => gate.ready);
  const blockedGates = gates.filter((gate) => !gate.ready).sort((left, right) => right.severity - left.severity || left.category.localeCompare(right.category));
  const manualEvidenceGates = blockedGates.filter((gate) => gate.evidenceAt === null);
  const blockerRoutes = blockedGates
    .map((gate) => ({ to: gate.linkTo, label: gate.linkLabel }))
    .filter((route, index, allRoutes) => allRoutes.findIndex((item) => item.to === route.to) === index);

  const summaryItems: SummaryStripItem[] = [
    {
      key: "release",
      label: "Release status",
      value: releaseReady ? "release-ready" : "blocked",
      meta: releaseReady
        ? "Every hard gate is currently backed by real evidence."
        : "At least one hard gate is blocked or still requires manual evidence.",
      tone: releaseReady ? "success" : "danger",
      status: releaseReady ? "ready" : "blocked",
    },
    {
      key: "blocked",
      label: "Blocked gates",
      value: blockedGates.length,
      meta: blockedGates.length > 0 ? blockedGates.map((gate) => gate.category).join(", ") : "No blocked gates remain.",
      tone: blockedGates.length > 0 ? "danger" : "success",
      status: blockedGates.length > 0 ? "blocked" : "ready",
    },
    {
      key: "manual",
      label: "Manual evidence gates",
      value: manualEvidenceGates.length,
      meta: manualEvidenceGates.length > 0 ? manualEvidenceGates.map((gate) => gate.category).join(", ") : "No gates are waiting on manual evidence.",
      tone: manualEvidenceGates.length > 0 ? "warning" : "success",
      status: manualEvidenceGates.length > 0 ? "partial" : "ready",
    },
    {
      key: "coverage",
      label: "Gate categories",
      value: gates.length,
      meta: gates.length > 0 ? gates.map((gate) => gate.category).join(", ") : "No gate categories loaded.",
      tone: gates.length >= 10 ? "success" : "warning",
      status: gates.length >= 10 ? "ready" : "partial",
    },
  ];

  const gateColumns: EntityTableColumn<GateRecord>[] = [
    {
      key: "category",
      header: "Gate",
      render: (gate) => (
        <button
          type="button"
          className="fg-data-row"
          onClick={() => setSelectedGateKey(gate.key)}
        >
          <div>
            <strong>{gate.category}</strong>
            <div className="fg-muted">{gate.evidenceSource}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (gate) => (
        <StatusBadge tone={gate.tone} status={gate.statusKey}>
          {gate.statusLabel}
        </StatusBadge>
      ),
    },
    {
      key: "evidence",
      header: "Evidence at",
      render: (gate) => formatTimestamp(gate.evidenceAt),
    },
    {
      key: "blocker",
      header: "Blocker",
      render: (gate) => gate.blocker,
    },
    {
      key: "route",
      header: "Target route",
      render: (gate) => <Link className="fg-nav-link" to={gate.linkTo}>{gate.linkLabel}</Link>,
    },
  ];

  const blockerColumns: EntityTableColumn<GateRecord>[] = [
    {
      key: "category",
      header: "Blocked gate",
      render: (gate) => (
        <div>
          <strong>{gate.category}</strong>
          <div className="fg-muted">{gate.blocker}</div>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (gate) => {
        const severity = blockerToneAndState(gate.severity);
        return (
          <StatusBadge tone={severity.tone} status={severity.statusKey}>
            {severity.statusKey.replace(/_/g, " ")}
          </StatusBadge>
        );
      },
    },
    {
      key: "route",
      header: "Fix route",
      render: (gate) => <Link className="fg-nav-link" to={gate.linkTo}>{gate.linkLabel}</Link>,
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Release / Validation"
        description="Release claims stay blocked until bootstrap, runtime, provider, OAuth, routing, queue, security, TLS, and recovery gates all have real evidence."
        badges={[
          { label: releaseReady ? "release-ready" : "release blocked", tone: releaseReady ? "success" : "danger" },
          { label: `${blockedGates.length} blocked gate(s)`, tone: blockedGates.length > 0 ? "warning" : "success" },
        ]}
        note="This page never invents a release claim. Missing automation becomes `manual evidence required`, and release-ready appears only when every hard gate is actually covered."
      />

      <ActionBar
        title="Release gateboard"
        description="Hard gates, evidence timestamps, current blockers, and next correction routes are generated directly from the shipped control-plane signals."
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={() => setRefreshNonce((current) => current + 1)}>
              Refresh
            </button>
            {blockerRoutes.map((route) => (
              <Link key={route.to} className="fg-nav-link" to={route.to}>{route.label}</Link>
            ))}
          </div>
        )}
      />

      <SummaryStrip items={summaryItems} />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="release and validation gates"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" && gates.length === 0 ? (
        <LoadingState
          title="Loading release gates"
          description="Restoring bootstrap, runtime, provider, routing, TLS, and recovery evidence."
        />
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Release gateboard failed to load"
          description={error ?? "Release evidence could not be restored."}
          action={<button type="button" onClick={() => setRefreshNonce((current) => current + 1)}>Retry</button>}
        />
      ) : null}

      {state === "success" && gates.length > 0 ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Release gates"
              description="Every category shows status, evidence source, evidence timestamp, blocker, and the responsible correction route."
              columns={gateColumns}
              rows={gates}
              rowKey={(gate) => gate.key}
              tableLabel="Release gate categories"
              getRowClassName={(gate) => (gate.key === selectedGateKey ? "is-selected" : undefined)}
            />

            <EntityTable
              title="Sorted blockers"
              description="Blockers are severity-sorted so the operator can resolve the hardest release breaks first."
              columns={blockerColumns}
              rows={blockedGates}
              rowKey={(gate) => gate.key}
              tableLabel="Release blockers"
              emptyTitle="No release blockers"
              emptyDescription="Every release gate currently has real evidence and no open blocker."
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedGate?.category ?? "Selected gate"}
              description={selectedGate?.evidenceSource ?? "Pick a gate to inspect its evidence, blocker, and correction route."}
              status={selectedGate?.statusLabel}
              statusTone={selectedGate?.tone}
              statusKey={selectedGate?.statusKey}
              sticky
            >
              {selectedGate ? (
                <div className="fg-stack">
                  <section className="fg-subcard">
                    <h4>Gate truth</h4>
                    <p>Evidence source: {selectedGate.evidenceSource}</p>
                    <p>Evidence at: {formatTimestamp(selectedGate.evidenceAt)}</p>
                    <p>Blocker: {selectedGate.blocker}</p>
                    <p>Fix route: <Link className="fg-nav-link" to={selectedGate.linkTo}>{selectedGate.linkLabel}</Link></p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Release stance</h4>
                    <p>{selectedGate.ready ? "This gate currently contributes real coverage toward release readiness." : "This gate is still blocking the release claim."}</p>
                  </section>

                  <AdvancedDiagnostics
                    title="Gate notes"
                    description="Raw blocker notes and evidence fragments for the selected release gate."
                    status={selectedGate.statusLabel}
                    statusTone={selectedGate.tone}
                    statusKey={selectedGate.statusKey}
                  >
                    {selectedGate.notes.length > 0 ? (
                      <ul className="fg-list">
                        {selectedGate.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    ) : (
                      <p className="fg-muted">No additional notes recorded for this gate.</p>
                    )}
                  </AdvancedDiagnostics>

                  <AdvancedDiagnostics
                    title="Raw stitched evidence"
                    description="The current page intentionally stitches together existing read models rather than inventing a synthetic green signal."
                    status="advanced"
                    statusTone="neutral"
                  >
                    <pre>{JSON.stringify({
                      bootstrap,
                      runtimeHealth,
                      providers,
                      routing,
                      ingress,
                      recovery,
                    }, null, 2)}</pre>
                  </AdvancedDiagnostics>
                </div>
              ) : null}
            </DetailPanel>
          </div>
        </div>
      ) : null}
    </section>
  );
}
