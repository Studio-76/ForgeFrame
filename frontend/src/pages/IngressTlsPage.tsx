import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchBootstrapReadiness,
  fetchIngressTlsStatus,
  renewIngressTls,
  type IngressTlsRenewalResult,
  type IngressTlsStatusResponse,
} from "../api/admin";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ErrorState, LoadingState } from "../components/ui/StateBlocks";
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

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Ingress / TLS / Certificates"
        description="TLS readiness, remediation checklist, and diagnostics — one guided operator surface."
        badges={[
          { label: summary.label, tone: summary.tone },
          { label: status?.renewal_allowed ? "Renew available" : "Renew gated", tone: status?.renewal_allowed ? "success" : "warning" },
        ]}
        note="Self-signed material, manual TLS, no public FQDN, or local-only exposure stay explicit exception states."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="ingress, TLS, and certificate posture"
        onInstanceChange={onInstanceChange}
      />

      {state === "loading" && !status ? (
        <LoadingState
          title="Loading ingress and TLS posture"
          description="Restoring FQDN, DNS, listener, certificate, and renewal gate evidence."
        />
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Ingress / TLS surface failed to load"
          description={error ?? "Ingress or certificate posture could not be restored."}
          action={<button type="button" onClick={() => setRefreshNonce((current) => current + 1)}>Retry</button>}
        />
      ) : null}

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

      {state === "success" && isLocalOnly ? (
        <div className="ff-state-block" data-state="blocked">
          <strong>Local-only exposure mode</strong>
          <p>Public HTTPS readiness is not the active deployment goal for this instance. Missing FQDN or certificate evidence reflects the declared local-only posture — not a hidden production gap.</p>
        </div>
      ) : null}
    </section>
  );
}
