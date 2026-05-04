import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchBootstrapReadiness } from "../api/domain/bootstrap";
import {
  fetchIngressTlsStatus,
  type IngressTlsStatusResponse,
} from "../api/domain/ingress-tls";
import {
  fetchProviderControlPlane,
  type ProviderControlPlaneResponse,
} from "../api/domain/providers";
import {
  fetchRecoveryOverview,
  type RecoveryOverviewResponse,
} from "../api/domain/recovery";
import {
  fetchRoutingControlPlane,
  type RoutingControlPlaneResponse,
} from "../api/domain/routing";
import {
  fetchRuntimeHealth,
  type RuntimeHealthResponse,
} from "../api/domain/health";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { ScopeConfig } from "../components/page-templates";
import {
  AdvancedDiagnostics,
  Button,
  DataTable,
  ErrorState,
  LoadingState,
} from "../components/ui";
import type { DataTableColumn } from "../components/ui";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import {
  GateChecklist,
  GateDetailSidebar,
  deriveReleaseSummary,
  ReleaseStatusHero,
} from "../features/release";
import type {
  BootstrapPayload,
  GateRecord,
  GatePriority,
  LoadState,
} from "../features/release";

/** @private */
function hasEvidenceTimestamp(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

/** @private */
function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const normalized = values.filter(hasEvidenceTimestamp).sort();
  return normalized.at(-1) ?? null;
}

/** @private */
function asCheckId(value: Record<string, unknown>): string {
  return typeof value.id === "string" ? value.id : "unknown_check";
}

/** @private */
function asCheckDetails(value: Record<string, unknown>): string {
  return typeof value.details === "string" ? value.details : "No details recorded.";
}

/**
 * Enforce that a gate has an evidence timestamp. If the gate is functionally
 * ready but lacks a timestamp, it is treated as "manual evidence required".
 */
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
    priority: "manual-evidence",
    blocker: `${gate.category} is functionally green, but the release gate has no evidence timestamp.`,
    notes: [
      "Evidence timestamp is missing, so this gate cannot contribute to release-ready.",
      gate.blocker,
      ...gate.notes,
    ],
  };
}

/**
 * Resolve the priority tier for a gate record based on its status and severity.
 */
function resolveGatePriority(gate: {
  ready: boolean;
  severity: number;
  statusLabel: string;
}): GatePriority {
  if (!gate.ready && gate.severity >= 3) return "blocking";
  if (!gate.ready && gate.statusLabel === "manual evidence required") return "manual-evidence";
  if (!gate.ready && gate.severity >= 2) return "warning";
  if (gate.ready) return "ready";
  return "not-required";
}

/**
 * Health-check-based action label for linking to a remediation route.
 */
function remediationAction(
  gateReady: boolean,
  baseLabel: string,
  blockerLabel: string,
): string {
  if (!gateReady) return blockerLabel;
  return `Review ${baseLabel}`;
}

/** @private */
type AuditRow = {
  key: string;
  category: string;
  evidenceAt: string;
  evidenceProvider: string;
  evidenceSource: string;
};

/**
 * Release / Validation page — redesigned as an actionable release readiness workflow.
 *
 * Shows a top-level status summary, a prioritized gate checklist,
 * and a remediation-focused detail sidebar. Blocking gates are
 * surfaced first; ready and not-required gates are collapsed by default.
 */
export function ReleaseValidationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const {
    instances,
    loadState,
    error: instancesError,
    selectedInstance,
  } = useInstanceCatalog(instanceId);
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Release validation surface loading failed.",
        );
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

  // ── Build gate records from API payloads ──────────────────────────

  const rawGates: GateRecord[] = [];

  if (bootstrap && runtimeHealth && recovery && providers && routing && ingress) {
    const bootstrapFailures = (bootstrap.checks ?? []).filter(
      (check) => check.ok !== true,
    );

    rawGates.push({
      key: "build_test",
      category: "Build / Test",
      statusLabel: "manual evidence required",
      tone: "warning",
      statusKey: "blocked",
      ready: false,
      severity: 3,
      priority: "manual-evidence",
      evidenceSource: "Release pipeline evidence is not wired into the control plane.",
      evidenceAt: null,
      blocker:
        "Build and test proof still needs explicit operator evidence before this build can be called release-ready.",
      primaryAction: "Provide build/test evidence",
      primaryActionTo: CONTROL_PLANE_ROUTES.auditHistory,
      secondaryActions: [
        { label: "View audit history", to: CONTROL_PLANE_ROUTES.auditHistory },
      ],
      evidenceGuidance:
        "Upload or reference a signed build output, test run report, or CI/CD pipeline attestation confirming the build and test suite passed.",
      acceptsManualEvidence: true,
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
      priority: resolveGatePriority({
        ready: bootstrap.ready,
        severity: bootstrap.ready ? 0 : 3,
        statusLabel: bootstrap.ready ? "ready" : "blocked",
      }),
      evidenceSource: "Bootstrap readiness report",
      evidenceAt: bootstrap.checked_at ?? null,
      blocker: bootstrap.ready
        ? "Bootstrap readiness report is fully green."
        : `${bootstrapFailures.length} bootstrap checks still fail. ${bootstrapFailures[0] ? `${asCheckId(bootstrapFailures[0])}: ${asCheckDetails(bootstrapFailures[0])}` : "Missing details."}`,
      primaryAction: remediationAction(bootstrap.ready, "Bootstrap / Readiness", "Fix bootstrap readiness"),
      primaryActionTo: onboardingLink,
      secondaryActions: [
        { label: "View onboarding", to: onboardingLink },
      ],
      notes: bootstrapFailures.map(
        (check) => `${asCheckId(check)}: ${asCheckDetails(check)}`,
      ),
    });

    const runtimeCriticalChecks = runtimeHealth.readiness.checks.filter(
      (check) => !check.ok && check.severity === "critical",
    );
    rawGates.push({
      key: "runtime_api",
      category: "Runtime API",
      statusLabel: runtimeHealth.readiness.accepting_traffic ? "ready" : "blocked",
      tone: runtimeHealth.readiness.accepting_traffic ? "success" : "danger",
      statusKey: runtimeHealth.readiness.accepting_traffic ? "ready" : "blocked",
      ready: runtimeHealth.readiness.accepting_traffic,
      severity: runtimeHealth.readiness.accepting_traffic ? 0 : 3,
      priority: resolveGatePriority({
        ready: runtimeHealth.readiness.accepting_traffic,
        severity: runtimeHealth.readiness.accepting_traffic ? 0 : 3,
        statusLabel: runtimeHealth.readiness.accepting_traffic ? "ready" : "blocked",
      }),
      evidenceSource: "Runtime /health readiness payload",
      evidenceAt: runtimeHealth.readiness.checked_at ?? null,
      blocker: runtimeHealth.readiness.accepting_traffic
        ? "Runtime health is currently accepting traffic."
        : `${runtimeHealth.readiness.critical_count} critical readiness checks block runtime traffic.`,
      primaryAction: remediationAction(runtimeHealth.readiness.accepting_traffic, "Runtime health", "Review runtime health"),
      primaryActionTo: healthLink,
      secondaryActions: [
        { label: "View health dashboard", to: healthLink },
      ],
      notes: runtimeCriticalChecks.map(
        (check) => `${check.id}: severity=${check.severity}`,
      ),
    });

    const readyProviders = providers.providers.filter(
      (provider) => provider.ready && provider.runtime_readiness === "ready",
    );
    const providerEvidenceAt = latestTimestamp(
      providers.providers.flatMap((provider) => [
        provider.last_health_check_at,
        provider.last_probe_at,
        provider.last_sync_at,
      ]),
    );
    const firstProviderIssue = providers.providers.find(
      (provider) => !provider.ready || provider.runtime_readiness !== "ready",
    );
    const providerGateReady = readyProviders.length > 0 && providerEvidenceAt !== null;

    rawGates.push({
      key: "provider",
      category: "Provider",
      statusLabel: providerGateReady
        ? "ready"
        : readyProviders.length > 0
          ? "manual evidence required"
          : "blocked",
      tone: providerGateReady
        ? "success"
        : readyProviders.length > 0
          ? "warning"
          : "danger",
      statusKey: providerGateReady
        ? "ready"
        : readyProviders.length > 0
          ? "partial"
          : "blocked",
      ready: providerGateReady,
      severity: providerGateReady ? 0 : readyProviders.length > 0 ? 2 : 3,
      priority: resolveGatePriority({
        ready: providerGateReady,
        severity: providerGateReady ? 0 : readyProviders.length > 0 ? 2 : 3,
        statusLabel: providerGateReady
          ? "ready"
          : readyProviders.length > 0
            ? "manual evidence required"
            : "blocked",
      }),
      evidenceSource: "Provider control plane and health evidence",
      evidenceAt: providerEvidenceAt,
      blocker: providerGateReady
        ? `${readyProviders.length} provider routes are runtime-ready.`
        : readyProviders.length > 0
          ? "Provider readiness exists, but no evidence timestamp is recorded for the current release gate."
          : `No runtime-ready provider path is available${firstProviderIssue ? `; first issue: ${firstProviderIssue.provider} -> ${firstProviderIssue.readiness_reason ?? firstProviderIssue.next_action}` : "."}`,
      primaryAction: remediationAction(providerGateReady, "providers", "Review provider readiness"),
      primaryActionTo: providersLink,
      secondaryActions: [{ label: "View providers", to: providersLink }],
      notes: providers.providers.map(
        (provider) =>
          `${provider.provider}: ready=${String(provider.ready)} runtime=${provider.runtime_readiness}`,
      ),
    });

    const oauthProviders = providers.providers.filter(
      (provider) => provider.oauth_required,
    );
    const oauthBlockedProviders = oauthProviders.filter(
      (provider) =>
        provider.oauth_connect_required || (provider.oauth_failure_count ?? 0) > 0,
    );
    const oauthEvidenceAt = latestTimestamp(
      oauthProviders.flatMap((provider) => [
        typeof provider.oauth_last_probe?.checked_at === "string"
          ? provider.oauth_last_probe.checked_at
          : null,
        typeof provider.oauth_last_bridge_sync?.checked_at === "string"
          ? provider.oauth_last_bridge_sync.checked_at
          : null,
        provider.last_probe_at,
      ]),
    );
    const oauthReady =
      oauthProviders.length === 0 || oauthBlockedProviders.length === 0;

    rawGates.push({
      key: "oauth",
      category: "OAuth",
      statusLabel:
        oauthProviders.length === 0
          ? "not required in scope"
          : oauthReady
            ? "ready"
            : "blocked",
      tone:
        oauthProviders.length === 0
          ? "info"
          : oauthReady
            ? "success"
            : "danger",
      statusKey:
        oauthProviders.length === 0
          ? "unsupported"
          : oauthReady
            ? "ready"
            : "blocked",
      ready: oauthProviders.length === 0 || oauthReady,
      severity: oauthProviders.length === 0 ? 0 : oauthReady ? 0 : 2,
      priority: resolveGatePriority({
        ready: oauthProviders.length === 0 || oauthReady,
        severity: oauthProviders.length === 0 ? 0 : oauthReady ? 0 : 2,
        statusLabel:
          oauthProviders.length === 0
            ? "not required in scope"
            : oauthReady
              ? "ready"
              : "blocked",
      }),
      evidenceSource:
        oauthProviders.length === 0
          ? "No OAuth-backed providers are active in the selected scope."
          : "OAuth provider bridge and probe truth",
      evidenceAt:
        oauthProviders.length === 0 ? providerEvidenceAt : oauthEvidenceAt,
      blocker:
        oauthProviders.length === 0
          ? "No OAuth-backed provider gate is required for this scoped release path."
          : oauthReady
            ? "OAuth-backed providers are connected without active probe failures."
            : `${oauthBlockedProviders.length} OAuth-backed providers still need bridge or credential work.`,
      primaryAction: "Review OAuth scope",
      primaryActionTo: CONTROL_PLANE_ROUTES.oauthTargets,
      secondaryActions: [{ label: "View OAuth targets", to: CONTROL_PLANE_ROUTES.oauthTargets }],
      notes: oauthProviders.map(
        (provider) =>
          `${provider.provider}: connect_required=${String(provider.oauth_connect_required)} failures=${provider.oauth_failure_count ?? 0}`,
      ),
    });

    const openCircuits = routing.circuits.filter(
      (circuit) => circuit.state === "open",
    );
    const routingEvidenceAt = latestTimestamp([
      routing.budget.updated_at,
      routing.budget.last_evaluated_at,
      ...routing.circuits.map((circuit) => circuit.updated_at ?? null),
      ...routing.recent_decisions.map((decision) => decision.created_at),
    ]);
    const routingReady =
      !routing.budget.hard_blocked &&
      openCircuits.length === 0 &&
      routing.targets.length > 0;

    rawGates.push({
      key: "routing",
      category: "Routing",
      statusLabel: routingReady ? "ready" : "blocked",
      tone: routingReady ? "success" : "danger",
      statusKey: routingReady
        ? "ready"
        : routing.budget.hard_blocked
          ? "budget_blocked"
          : "circuit_open",
      ready: routingReady,
      severity: routingReady ? 0 : 3,
      priority: resolveGatePriority({
        ready: routingReady,
        severity: routingReady ? 0 : 3,
        statusLabel: routingReady ? "ready" : "blocked",
      }),
      evidenceSource: "Routing policy, budget, circuit, and decision ledger",
      evidenceAt: routingEvidenceAt,
      blocker: routingReady
        ? "Routing policy, budget, and circuit posture are clear for release."
        : routing.budget.hard_blocked
          ? `Routing budget is hard blocked${routing.budget.reason ? `: ${routing.budget.reason}` : "."}`
          : openCircuits.length > 0
            ? `${openCircuits.length} routing circuits are open.`
            : "Routing has no active target coverage in this scope.",
      primaryAction: remediationAction(routingReady, "routing", "Review routing"),
      primaryActionTo: routingLink,
      secondaryActions: [{ label: "View routing", to: routingLink }],
      notes: [
        ...openCircuits.map(
          (circuit) => `${circuit.target_key}: ${circuit.reason ?? "open"}`,
        ),
        ...routing.recent_decisions
          .slice(0, 3)
          .map((decision) => `${decision.created_at}: ${decision.summary}`),
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
      priority: "manual-evidence",
      evidenceSource:
        "No shipped aggregate release gate currently proves queue pressure, dispatch recovery, and worker posture together.",
      evidenceAt: null,
      blocker:
        "Queue and dispatch validation still requires explicit operator review before release.",
      primaryAction: "Review queue and dispatch",
      primaryActionTo: dispatchLink,
      secondaryActions: [
        { label: "View dispatch", to: dispatchLink },
      ],
      evidenceGuidance:
        "Confirm that queue pressure is nominal, dispatch recovery is functional, and worker posture is healthy. Provide a summary or reference to the monitoring dashboard.",
      acceptsManualEvidence: true,
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
      priority: "manual-evidence",
      evidenceSource:
        "No shipped release gate currently records a full security posture signoff with timestamped approval coverage.",
      evidenceAt: null,
      blocker:
        "Security validation still requires explicit review of policies, approvals, and access posture.",
      primaryAction: "Review security posture",
      primaryActionTo: CONTROL_PLANE_ROUTES.security,
      secondaryActions: [
        { label: "View security", to: CONTROL_PLANE_ROUTES.security },
      ],
      evidenceGuidance:
        "Review recent policy audits, access reviews, and approval coverage. Record a signoff confirming the security posture is acceptable for release.",
      acceptsManualEvidence: true,
      notes: [
        "Security remains a hard release gate until explicit evidence is wired into the control plane.",
      ],
    });

    const tlsReady = ingress.mode_classification === "normative_public_https";
    const tlsExceptionMode =
      ingress.tls_mode !== "integrated_acme" ||
      !ingress.fqdn ||
      ingress.certificate.trust_state === "self_signed";

    rawGates.push({
      key: "tls",
      category: "TLS",
      statusLabel: tlsReady
        ? "ready"
        : selectedInstance?.exposure_mode === "local_only"
          ? "only local"
          : tlsExceptionMode
            ? "exception mode"
            : "blocked",
      tone: tlsReady
        ? "success"
        : selectedInstance?.exposure_mode === "local_only"
          ? "info"
          : tlsExceptionMode
            ? "warning"
            : "danger",
      statusKey: tlsReady
        ? "ready"
        : selectedInstance?.exposure_mode === "local_only"
          ? "onboarding-only"
          : tlsExceptionMode
            ? "unsupported"
            : "blocked",
      ready: tlsReady,
      severity: tlsReady
        ? 0
        : selectedInstance?.exposure_mode === "local_only"
          ? 1
          : tlsExceptionMode
            ? 2
            : 3,
      priority: resolveGatePriority({
        ready: tlsReady,
        severity: tlsReady
          ? 0
          : selectedInstance?.exposure_mode === "local_only"
            ? 1
            : tlsExceptionMode
              ? 2
              : 3,
        statusLabel: tlsReady ? "ready" : selectedInstance?.exposure_mode === "local_only"
          ? "not required in scope"
          : tlsExceptionMode
            ? "exception mode"
            : "blocked",
      }),
      evidenceSource: "Ingress / TLS certificate status API",
      evidenceAt: ingress.checked_at,
      blocker: tlsReady
        ? "Public HTTPS and certificate evidence are aligned."
        : ingress.blockers[0]
          ? `Ingress/TLS blocker: ${ingress.blockers[0]}`
          : "Ingress/TLS evidence is not yet production-ready.",
      primaryAction: remediationAction(tlsReady, "Ingress / TLS", "Review TLS configuration"),
      primaryActionTo: CONTROL_PLANE_ROUTES.ingressTls,
      secondaryActions: [
        {
          label: "View Ingress / TLS",
          to: CONTROL_PLANE_ROUTES.ingressTls,
        },
      ],
      notes: [
        `fqdn=${ingress.fqdn ?? "missing"}`,
        `trust_state=${ingress.certificate.trust_state}`,
        `renewal_allowed=${String(ingress.renewal_allowed)}`,
      ],
    });

    const recoveryReady =
      recovery.summary.runtime_status === "ok" &&
      recovery.upgrade_posture.runtime_status === "ok";
    rawGates.push({
      key: "backup_recovery",
      category: "Backup / Recovery",
      statusLabel: recoveryReady ? "ready" : "blocked",
      tone: recoveryReady ? "success" : "danger",
      statusKey: recoveryReady ? "ready" : "blocked",
      ready: recoveryReady,
      severity: recoveryReady ? 0 : 3,
      priority: resolveGatePriority({
        ready: recoveryReady,
        severity: recoveryReady ? 0 : 3,
        statusLabel: recoveryReady ? "ready" : "blocked",
      }),
      evidenceSource: "Recovery overview and upgrade posture",
      evidenceAt: recovery.summary.checked_at,
      blocker: recoveryReady
        ? "Recovery runtime and upgrade posture are green."
        : `Recovery runtime=${recovery.summary.runtime_status}; upgrade=${recovery.upgrade_posture.runtime_status}; blockers=${recovery.upgrade_posture.blockers.join(", ") || "missing evidence"}`,
      primaryAction: remediationAction(recoveryReady, "Backup / Recovery", "Review backup readiness"),
      primaryActionTo: CONTROL_PLANE_ROUTES.recovery,
      secondaryActions: [
        {
          label: "View recovery",
          to: CONTROL_PLANE_ROUTES.recovery,
        },
      ],
      notes: recovery.upgrade_posture.blockers,
    });
  }

  const gates = useMemo(() => rawGates.map(enforceEvidenceTimestamp), [
    // rawGates is rebuilt on every render when data changes, so this is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    bootstrap,
    runtimeHealth,
    recovery,
    providers,
    routing,
    ingress,
  ]);

  const summary = useMemo(() => deriveReleaseSummary(gates), [gates]);

  useEffect(() => {
    if (gates.length === 0) {
      setSelectedGateKey("");
      return;
    }
    if (!gates.some((gate) => gate.key === selectedGateKey)) {
      setSelectedGateKey(gates[0]?.key ?? "");
    }
  }, [selectedGateKey, gates]);

  const selectedGate = gates.find((gate) => gate.key === selectedGateKey) ?? gates[0] ?? null;

  // ── Template props ───────────────────────────────────────

  const scopeLabel = selectedInstance?.display_name
    ?? selectedInstance?.instance_id
    ?? "Default instance path";

  /** Scope config: show current scope with a clear action. */
  const scope: ScopeConfig | undefined = instanceId
    ? { label: scopeLabel, onChange: () => onInstanceChange(null) }
    : undefined;

  /** Attention items: promote errors to blockers. */
  const attentionItems: AttentionPayload[] = [];
  if (state === "error") {
    attentionItems.push({
      key: "fetch-error",
      level: "primary_blocker",
      title: "Release gateboard failed to load",
      description: error ?? "Release evidence could not be restored.",
    });
  }

  /** Summary strip: gate counts. */
  const summaryItems: SummaryStripItem[] | undefined =
    state === "success" && gates.length > 0
      ? [
          {
            key: "total",
            label: "Total gates",
            value: summary.totalGates,
          },
          {
            key: "blocked",
            label: "Blocked",
            value: summary.blockingCount,
            tone: summary.blockingCount > 0 ? "danger" : "success",
          },
          {
            key: "manual-evidence",
            label: "Need evidence",
            value: summary.manualEvidenceCount,
            tone: summary.manualEvidenceCount > 0 ? "warning" : "success",
          },
        ]
      : undefined;

  /** Actions: refresh button. */
  const actions: Action[] = [
    {
      label: "Refresh gates",
      kind: "primary",
      intent: "run",
      onClick: () => setRefreshNonce((n) => n + 1),
    },
  ];

  /** Audit evidence table data. */
  const auditData: AuditRow[] = gates.map((gate) => ({
    key: gate.key,
    category: gate.category,
    evidenceAt: gate.evidenceAt ?? "—",
    evidenceProvider: gate.evidenceProvider ?? "—",
    evidenceSource: gate.evidenceSource,
  }));

  const auditColumns: DataTableColumn<AuditRow>[] = [
    {
      id: "category",
      header: "Gate",
      accessorFn: (row) => row.category,
      sortingKey: (row) => row.category,
      alwaysVisible: true,
    },
    {
      id: "evidenceAt",
      header: "Evidence at",
      accessorFn: (row) => row.evidenceAt,
      sortingKey: (row) => row.evidenceAt,
    },
    {
      id: "evidenceProvider",
      header: "Provided by",
      accessorFn: (row) => row.evidenceProvider,
    },
    {
      id: "evidenceSource",
      header: "Source",
      accessorFn: (row) => row.evidenceSource,
    },
  ];

  return (
    <RegistryManagementPage
      eyebrow="Release"
      title="Release Validation"
      description="Release claims stay blocked until bootstrap, runtime, provider, OAuth, routing, queue, security, TLS, and recovery gates all have real evidence."
      scope={scope}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={actions}
      selectedItemContent={
        selectedGate ? <GateDetailSidebar gate={selectedGate} /> : null
      }
      hasSelection={selectedGate != null && state === "success"}
      diagnostics={
        <pre>
          {JSON.stringify(
            { bootstrap, runtimeHealth, providers, routing, ingress, recovery },
            null,
            2,
          )}
        </pre>
      }
      diagnosticsTitle="Release diagnostics"
    >
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
          action={
            <Button variant="secondary" onPress={() => setRefreshNonce((n) => n + 1)}>
              Retry
            </Button>
          }
        />
      ) : null}

      {state === "success" && gates.length > 0 ? (
        <>
          <ReleaseStatusHero summary={summary} />

          <div className="ff-release-layout">
            <div className="ff-release-main">
              <GateChecklist
                gates={gates}
                selectedGateKey={selectedGateKey}
                onSelectGate={setSelectedGateKey}
              />
            </div>
          </div>

          {/* Audit evidence table */}
          <details
            className="ff-collapse-section ff-release-audit"
            style={{ marginTop: "1rem" }}
          >
            <summary>
              <span className="ff-collapse-summary-text">
                <h3>Audit history</h3>
                <p>Evidence timestamps and audit metadata for all release gates.</p>
              </span>
            </summary>
            <div className="ff-collapse-section-body">
              <DataTable
                data={auditData}
                columns={auditColumns}
                rowKey={(row) => row.key}
                enablePagination={false}
                showSearch={false}
                showPresets={false}
                enableColumnVisibility={false}
                density="compact"
              />
            </div>
          </details>
        </>
      ) : null}
    </RegistryManagementPage>
  );
}
