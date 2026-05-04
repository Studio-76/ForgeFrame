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
import { Button } from "../components/ui/Button";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";
import {
  TlsStatusHero,
  TlsRemediationChecklist,
  TlsActionBar,
  TlsDetailPanel,
  deriveTlsSummary,
  buildRemediationChecklist,
  asBootstrapCheck,
  RELEVANT_CHECK_IDS,
} from "../features/ingress-tls";
import type { LoadState, BootstrapCheck } from "../features/ingress-tls";

/**
 * Ingress / TLS / Certificates page — a guided TLS remediation workflow.
 *
 * The page surfaces TLS readiness at a glance, shows the top blocker and
 * next action first, converts blockers into a prioritized remediation
 * checklist, hides raw diagnostics behind expandable sections, and uses
 * task-specific action labels instead of generic navigation buttons.
 */
export function IngressTlsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
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
      setState("loading");
      setError(null);
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
  const isLocalOnly = selectedInstance?.exposure_mode === "local_only";
  const hasLiveCert = status?.certificate.present === true;
  const remediationItems = buildRemediationChecklist(status, instanceId, checks);

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

  // ── Summary items ────────────────────────────────────────
  const summaryItems = [
    { key: "status", label: "Status", value: summary.label, tone: summary.tone },
    {
      key: "cert",
      label: "Certificate",
      value: hasLiveCert ? "Present" : "Missing",
      tone: hasLiveCert ? ("success" as const) : ("danger" as const),
    },
    ...(status?.certificate.days_remaining != null
      ? [
          {
            key: "expiry",
            label: "Expiry (days)",
            value: status.certificate.days_remaining,
            tone: status.certificate.days_remaining > 30 ? ("success" as const) : ("warning" as const),
          },
        ]
      : []),
  ];

  // ── Attention items ──────────────────────────────────────
  const attentionItems: AttentionPayload[] = [
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
              "Public HTTPS readiness is not the active deployment goal for this instance. "
              + "Missing FQDN or certificate evidence reflects the declared local-only posture "
              + "— not a hidden production gap.",
          },
        ]
      : []),
  ];

  // ── Actions ──────────────────────────────────────────────
  const actions: Action[] = [
    {
      label: "Renew TLS",
      intent: "run",
      kind: "primary",
      onClick: () => {
        void triggerRenewal();
      },
      disabled: renewing || !status?.renewal_allowed,
    },
    {
      label: "Refresh",
      intent: "run",
      kind: "secondary",
      onClick: () => {
        setRefreshNonce((c) => c + 1);
      },
    },
  ];

  return (
    <RegistryManagementPage
      eyebrow="Setup"
      title="Ingress / TLS / Certificates"
      description="TLS readiness, remediation checklist, and diagnostics — one guided operator surface."
      scope={scope}
      summaryItems={summaryItems}
      attentionItems={attentionItems}
      actions={actions}
      diagnostics={
        <AdvancedDiagnostics title="TLS diagnostics">
          <RawJson data={{ status, checks, renewalResult }} label="State snapshot" />
        </AdvancedDiagnostics>
      }
    >
      {/* Loading state */}
      {state === "loading" && !status ? (
        <div className="ff-state-block" data-state="loading">
          <div className="ff-skeleton-row" />
          <strong>Loading ingress and TLS posture</strong>
          <p>Restoring FQDN, DNS, listener, certificate, and renewal gate evidence.</p>
        </div>
      ) : null}

      {/* Error state */}
      {state === "error" ? (
        <div className="ff-state-block" data-state="error">
          <strong>Ingress / TLS surface failed to load</strong>
          <p>{error ?? "Ingress or certificate posture could not be restored."}</p>
          <div className="ff-state-actions">
            <Button
              variant="secondary"
              onPress={() => setRefreshNonce((current) => current + 1)}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {/* Success content */}
      {state === "success" && status ? (
        <>
          <TlsStatusHero summary={summary} />

          <TlsActionBar
            instanceId={instanceId}
            summary={summary}
            renewalAllowed={status.renewal_allowed}
            renewing={renewing}
            onRenew={() => void triggerRenewal()}
            onRefresh={() => setRefreshNonce((current) => current + 1)}
          />

          {isLocalOnly ? null : (
            <div className="ff-operator-layout">
              <div className="ff-operator-main">
                <TlsRemediationChecklist items={remediationItems} />
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
          )}
        </>
      ) : null}

      {/* Local-only blocked state */}
      {state === "success" && isLocalOnly ? (
        <div className="ff-state-block" data-state="blocked">
          <strong>Local-only exposure mode</strong>
          <p>
            Public HTTPS readiness is not the active deployment goal for this instance.
            Missing FQDN or certificate evidence reflects the declared local-only posture
            — not a hidden production gap.
          </p>
        </div>
      ) : null}
    </RegistryManagementPage>
  );
}
