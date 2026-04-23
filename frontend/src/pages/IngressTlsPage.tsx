import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchBootstrapReadiness, fetchIngressTlsStatus, renewIngressTls, type IngressTlsStatusResponse } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
type BootstrapCheck = { id: string; ok: boolean; details: string };

const RELEVANT_CHECK_IDS = new Set([
  "root_ui_on_slash",
  "same_origin_runtime_api",
  "public_https_listener",
  "port80_certificate_helper",
  "tls_certificate_management",
  "linux_host_installation",
]);

function asBootstrapCheck(value: Record<string, unknown>): BootstrapCheck | null {
  const id = typeof value.id === "string" ? value.id : null;
  if (!id) {
    return null;
  }
  return {
    id,
    ok: Boolean(value.ok),
    details: typeof value.details === "string" ? value.details : "",
  };
}

export function IngressTlsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<BootstrapCheck[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<IngressTlsStatusResponse | null>(null);
  const [renewalNote, setRenewalNote] = useState<string>("");

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
        setNextSteps(payload.next_steps ?? []);
        setStatus(ingressStatus);
        setReady(ingressStatus.mode_classification === "normative_public_https");
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setChecks([]);
        setNextSteps([]);
        setStatus(null);
        setReady(false);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Ingress / TLS surface loading failed.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const triggerRenewal = async () => {
    setRenewalNote("Running certificate renewal...");
    try {
      const result = await renewIngressTls();
      const renewalState = typeof result.renewal?.status === "string" ? result.renewal.status : "unknown";
      setRenewalNote(`Certificate renewal result: ${renewalState}`);
    } catch (renewalError) {
      setRenewalNote(renewalError instanceof Error ? renewalError.message : "Certificate renewal failed.");
    }
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Ingress / TLS / Certificates"
        description="Public listener, same-origin, root-path, port-80 helper, and certificate automation truth are visible here instead of hiding behind external proxy assumptions."
        question="Is this ForgeFrame instance actually in the normative public HTTPS posture, or is it still operating in a degraded exception mode?"
        links={[
          { label: "Bootstrap / Readiness", to: CONTROL_PLANE_ROUTES.onboarding, description: "Return to the bootstrap checklist and go-live handoff." },
          { label: "Instances", to: CONTROL_PLANE_ROUTES.instances, description: "Inspect the selected instance deployment and exposure mode." },
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Cross-check whether ingress and TLS blockers still stop release claims." },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${selectedInstance.display_name}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: ready ? "Normative HTTPS posture" : "Blocked / degraded", tone: ready ? "success" : "warning" },
        ]}
        note="This route only renders shipped bootstrap-readiness evidence. Missing integrated TLS automation stays visible here as a real blocker, not as a hidden external dependency."
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

      {state === "loading" ? <article className="fg-card"><p className="fg-muted">Loading ingress and TLS posture.</p></article> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      {state === "success" ? (
        <div className="fg-grid">
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Public origin checks</h3>
                <p className="fg-muted">These checks describe whether ForgeFrame currently meets the target public origin contract.</p>
              </div>
              <div className="fg-actions">
                <button type="button" onClick={() => void triggerRenewal()}>
                  Renew certificates
                </button>
              </div>
            </div>
            <ul className="fg-list">
              <li>Instance exposure mode: {selectedInstance?.exposure_mode ?? "n/a"}</li>
              <li>Deployment mode: {selectedInstance?.deployment_mode ?? "n/a"}</li>
              <li>FQDN: {status?.fqdn ?? "not configured"}</li>
              <li>Public origin: {status?.public_origin ?? "not configured"}</li>
              <li>HTTPS listener: {status ? `${status.public_https_host}:${status.public_https_port}` : "n/a"}</li>
              <li>HTTP helper: {status ? `${status.public_http_helper_host}:${status.public_http_helper_port}` : "n/a"}</li>
              <li>TLS mode: {status?.tls_mode ?? "n/a"}</li>
              <li>DNS resolves: {status ? String(status.dns_resolves) : "n/a"}</li>
              {checks.map((check) => (
                <li key={check.id}>{check.id} · ok={String(check.ok)} · {check.details}</li>
              ))}
            </ul>
            {renewalNote ? <p className="fg-note fg-mt-sm">{renewalNote}</p> : null}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Certificate posture</h3>
                <p className="fg-muted">Real certificate material, expiry, and last-error truth stay visible here.</p>
              </div>
            </div>
            <ul className="fg-list">
              <li>Certificate present: {status ? String(status.certificate.present) : "n/a"}</li>
              <li>Certificate path: {status?.certificate.certificate_path ?? "n/a"}</li>
              <li>Key path: {status?.certificate.key_path ?? "n/a"}</li>
              <li>Issuer: {status?.certificate.issuer ?? "n/a"}</li>
              <li>Subject: {status?.certificate.subject ?? "n/a"}</li>
              <li>Last issued: {status?.certificate.last_issued_at ?? "n/a"}</li>
              <li>Last renewed: {status?.certificate.last_renewed_at ?? "n/a"}</li>
              <li>Renewal due: {status?.certificate.renewal_due_at ?? "n/a"}</li>
              <li>Valid to: {status?.certificate.valid_to ?? "n/a"}</li>
              <li>Days remaining: {status?.certificate.days_remaining ?? "n/a"}</li>
              <li>Last error: {status?.certificate.last_error ?? "none"}</li>
            </ul>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Current blockers</h3>
                <p className="fg-muted">Failed ingress and certificate checks stay explicit here.</p>
              </div>
            </div>
            <ul className="fg-list">
              {status?.blockers.length === 0 ? <li>No ingress or TLS blockers recorded.</li> : null}
              {status?.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              {nextSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
