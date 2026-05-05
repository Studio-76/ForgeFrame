import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchIngressTlsStatus,
  renewIngressTls,
  type IngressTlsRenewalResult,
  type IngressTlsStatusResponse,
} from "../api/domain/ingress-tls";
import { fetchBootstrapReadiness } from "../api/domain/bootstrap";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";
import {
  TlsStatusHero,
  TlsRemediationChecklist,
  TlsPublicReadinessChecklist,
  TlsActionBar,
  TlsDetailPanel,
  deriveTlsSummary,
  derivePosture,
  buildRemediationChecklist,
  buildPublicReadinessChecklist,
  asBootstrapCheck,
  RELEVANT_CHECK_IDS,
} from "../features/ingress-tls";
import type { LoadState, BootstrapCheck } from "../features/ingress-tls";

/**
 * Ingress / TLS / Certificates page — a guided TLS control surface.
 *
 * The page surfaces TLS posture at a glance, shows the next recommended action,
 * converts blockers into a prioritized remediation checklist (or public-readiness
 * requirements for local-only instances), hides raw diagnostics behind expandable
 * sections, and uses task-specific action labels instead of generic navigation.
 *
 * Local-only instances get a "Public HTTPS readiness" checklist framed as
 * preparatory requirements rather than active blockers, with clear setup
 * actions available.
 */
export function IngressTlsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<BootstrapCheck[]>([]);
  const [status, setStatus] = useState<IngressTlsStatusResponse | null>(null);
  const [renewalResult, setRenewalResult] = useState<IngressTlsRenewalResult | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

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
      // Show loading state immediately
      if (mounted) {
        setState("loading");
        setError(null);
      }
      try {
        const [payload, ingressStatus] = await Promise.all([
          fetchBootstrapReadiness(),
          fetchIngressTlsStatus(),
        ]);
        if (!mounted) {
          return;
        }
        const relevantChecks = (payload.checks ?? [])
          .map(asBootstrapCheck)
          .filter((check): check is BootstrapCheck => check !== null)
          .filter((check) => RELEVANT_CHECK_IDS.has(check.id));
        setChecks(relevantChecks);
        setStatus(ingressStatus);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setChecks([]);
        setStatus(null);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Ingress / TLS surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [refreshNonce]);

  const triggerRenewal = async () => {
    setRenewing(true);
    setError(null);
    try {
      const result = await renewIngressTls();
      setRenewalResult(result.renewal);
      setStatus(result.ingress);
      setRefreshNonce((current) => current + 1);
    } catch (renewalError) {
      setRenewalResult({
        status: "failed",
        details: renewalError instanceof Error ? renewalError.message : "Certificate renewal failed.",
      });
    } finally {
      setRenewing(false);
    }
  };

  const summary = deriveTlsSummary(selectedInstance, status);
  const posture = derivePosture(selectedInstance, status);
  const isLocalOnly = posture === "local_only";
  const hasLiveCert = status?.certificate?.present === true;
  const remediationItems = buildRemediationChecklist(status, instanceId, checks);
  const readinessItems = buildPublicReadinessChecklist(status, instanceId);

  // ── Scope config ─────────────────────────────────────────
  const scopeLabel = selectedInstance
    ? selectedInstance.display_name
    : instanceId
      ? instanceId
      : undefined;

  const scope = scopeLabel
    ? {
        label: scopeLabel,
        onChange: () => {
          onInstanceChange(null);
        },
      }
    : undefined;

  // ── Summary items (only when loaded) ──────────────────────
  const certDays = status?.certificate?.days_remaining;
  const summaryItems = state !== "success" ? [] : [
    { key: "posture", label: "Posture", value: summary.label, tone: summary.tone },
    { key: "readiness", label: "Public HTTPS", value: summary.publicReadiness.label, tone: summary.publicReadiness.tone },
    {
      key: "cert",
      label: "Certificate",
      value: hasLiveCert ? "Present" : "Missing",
      tone: hasLiveCert ? ("success" as const) : ("danger" as const),
    },
    ...(certDays != null && certDays >= 0
      ? [
          {
            key: "expiry",
            label: "Expiry (days)",
            value: certDays,
            tone: certDays > 30 ? ("success" as const) : ("warning" as const),
          },
        ]
      : []),
  ];

  // ── Attention items (only when loaded) ────────────────────
  const attentionItems: AttentionPayload[] = state !== "success" ? [] : [
    ...(status?.renewal_allowed
      ? [{ key: "renewal", level: "healthy" as const, title: "Renewal available", tone: "success" as const }]
      : status
        ? [
            {
              key: "renewal",
              level: "warning" as const,
              title: "Renewal gated",
              description: status.renewal_blocked_reason ?? "Certificate renewal is not currently available.",
            },
          ]
        : []),
    ...(summary.primaryBlocker
      ? [
          {
            key: "blocker",
            level: "primary_blocker" as const,
            title: summary.detail,
            description: summary.nextAction ?? undefined,
          },
        ]
      : []),
    ...(isLocalOnly
      ? [
          {
            key: "local-only",
            level: "informational" as const,
            title: "Local-only exposure mode",
            description:
              "Public HTTPS is not active. The readiness checklist below shows what would be required "
              + "to promote this instance to public HTTPS.",
          },
        ]
      : []),
  ];

  // ── Actions (only on success, avoid stale actions during loading) ──
  const actions: Action[] = state === "success"
    ? [
        ...(isLocalOnly
          ? [
              {
                label: "Configure public HTTPS" as const,
                intent: "navigate" as const,
                kind: "navigation" as const,
                onClick: () => {
                  window.location.href = "/settings";
                },
              },
            ]
          : []),
        {
          label: "Renew TLS",
          intent: "run",
          kind: isLocalOnly ? "secondary" : "primary",
          onClick: () => {
            void triggerRenewal();
          },
          disabled: renewing || !status?.renewal_allowed || isLocalOnly,
        },
        {
          label: "Refresh",
          intent: "run",
          kind: "secondary",
          onClick: () => {
            setRefreshNonce((c) => c + 1);
          },
        },
      ]
    : [];

  const isResolving = state === "loading" && !status;

  return (
    <RegistryManagementPage
      eyebrow="Setup"
      title="Ingress / TLS / Certificates"
      description="TLS posture, public-HTTPS readiness, remediation checklist, and diagnostics — one guided operator surface."
      scope={scope}
      summaryItems={summaryItems}
      attentionItems={attentionItems}
      actions={actions}
      diagnostics={
        <AdvancedDiagnostics title="TLS diagnostics">
          <RawJson data={{ posture, status, checks, renewalResult }} label="State snapshot" />
        </AdvancedDiagnostics>
      }
    >
      {/* Resolving state — shown until instance + TLS posture are known */}
      {isResolving ? (
        <div className="ff-state-block" data-state="loading">
          <div className="ff-skeleton-row" />
          <strong>Resolving TLS posture…</strong>
          <p>Determining instance exposure mode, FQDN, DNS, listener, certificate, and renewal gate status.</p>
        </div>
      ) : null}

      {/* Error state */}
      {state === "error" ? (
        <div className="ff-state-block" data-state="error">
          <strong>Ingress / TLS surface failed to load</strong>
          <p>{error ?? "Ingress or certificate posture could not be restored."}</p>
        </div>
      ) : null}

      {/* Success content — always useful regardless of posture */}
      {state === "success" && status ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <TlsStatusHero summary={summary} />

            <TlsActionBar
              instanceId={instanceId}
              summary={summary}
              renewalAllowed={status.renewal_allowed}
              renewing={renewing}
              onRenew={() => void triggerRenewal()}
              onRefresh={() => setRefreshNonce((current) => current + 1)}
            />

            {isLocalOnly ? (
              <TlsPublicReadinessChecklist items={readinessItems} />
            ) : (
              <TlsRemediationChecklist
                items={remediationItems}
                title="Remediation checklist"
                subtitle="Prioritized steps to resolve TLS blockers. Start with the first item."
              />
            )}
          </div>

          <div className="ff-operator-sidebar">
            <TlsDetailPanel
              summary={summary}
              status={status}
              renewalResult={renewalResult}
              hasLiveCert={hasLiveCert}
            />
          </div>
        </div>
      ) : null}
    </RegistryManagementPage>
  );
}
