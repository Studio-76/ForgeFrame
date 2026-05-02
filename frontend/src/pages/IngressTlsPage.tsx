import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchBootstrapReadiness,
  fetchIngressTlsStatus,
  renewIngressTls,
  type IngressTlsRenewalResult,
  type IngressTlsStatusResponse,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { BlockedState, ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";

type LoadState = "idle" | "loading" | "success" | "error";
type BootstrapCheck = { id: string; ok: boolean; details: string };
type ChecklistRow = {
  key: string;
  label: string;
  summary: string;
  evidence: string;
  nextAction: string;
  linkTo: string;
  linkLabel: string;
  tone: StatusTone;
  statusKey: string;
};
type BlockerRow = {
  key: string;
  blocker: string;
  detail: string;
  why: string;
  howToFix: string;
  linkTo: string;
  linkLabel: string;
  tone: StatusTone;
  statusKey: string;
};

const RELEVANT_CHECK_IDS = new Set([
  "root_ui_on_slash",
  "same_origin_runtime_api",
  "public_fqdn_configured",
  "public_dns_resolution",
  "public_https_listener",
  "port80_certificate_helper",
  "certificate_material",
  "tls_mode_classification",
  "tls_certificate_management",
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

function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "n/a";
}

function blockerDetail(
  blocker: string,
  options: { instanceId: string | null },
): {
  detail: string;
  why: string;
  howToFix: string;
  linkTo: string;
  linkLabel: string;
  tone: StatusTone;
  statusKey: string;
} {
  const { instanceId } = options;
  const onboardingLink = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  const healthLink = withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);

  switch (blocker) {
    case "public_fqdn_missing":
      return {
        detail: "No public FQDN is configured.",
        why: "Without a public FQDN, DNS, TLS, and ACME automation cannot operate.",
        howToFix: "Record the real public FQDN in Settings before claiming public HTTPS readiness.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "partial",
      };
    case "public_fqdn_dns_unresolved":
      return {
        detail: "The public FQDN does not resolve in DNS.",
        why: "If DNS does not resolve, inbound HTTPS traffic cannot reach ForgeFrame and ACME cannot validate domain ownership.",
        howToFix: "Publish A/AAAA records so the public FQDN resolves to this host.",
        linkTo: healthLink,
        linkLabel: "Open Health",
        tone: "danger",
        statusKey: "blocked",
      };
    case "public_https_listener_not_normative":
      return {
        detail: "The public HTTPS listener is not bound to the normative 0.0.0.0:443 surface.",
        why: "The same-origin HTTPS contract requires the listener on 0.0.0.0:443 for production readiness.",
        howToFix: "Bind the public HTTPS listener to 0.0.0.0:443 on the normative same-origin surface.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "danger",
        statusKey: "blocked",
      };
    case "port80_helper_not_normative":
      return {
        detail: "The port 80 HTTP helper is not on the expected listener.",
        why: "ACME HTTP-01 challenges arrive on port 80. Without the helper, automated certificate issuance fails.",
        howToFix: "Expose the HTTP helper on port 80 so ACME challenge traffic can reach ForgeFrame.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "warning",
        statusKey: "partial",
      };
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return {
        detail: "TLS mode is not set to integrated ACME.",
        why: "Manual or disabled TLS modes prevent automated certificate issuance and renewal.",
        howToFix: "Switch to integrated ACME mode in Settings to enable automated certificate management.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "unsupported",
      };
    case "public_tls_acme_email_missing":
      return {
        detail: "No ACME operator email is configured.",
        why: "ACME providers require a contact email for expiry notifications and account recovery.",
        howToFix: "Configure the operator ACME email before enabling automated certificate issuance or renewal.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "partial",
      };
    case "integrated_tls_automation_missing":
      return {
        detail: "Integrated ACME renewal automation is not present.",
        why: "Without the renewal timer and artifacts, certificates will expire without automatic renewal.",
        howToFix: "Restore the shipped ACME renewal artifacts and timer from setup progress.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "danger",
        statusKey: "blocked",
      };
    case "certificate_material_missing":
      return {
        detail: "No live certificate material is present.",
        why: "Without certificate material, HTTPS connections cannot be established.",
        howToFix: "Issue or import certificate material, then refresh this page to verify the live certificate truth.",
        linkTo: healthLink,
        linkLabel: "Open Health",
        tone: "danger",
        statusKey: "blocked",
      };
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return {
        detail: "The same-origin contract is broken.",
        why: "ForgeFrame requires UI on /, runtime on /v1, and admin on /admin on the same HTTPS origin.",
        howToFix: "Restore the same-origin contract: UI on `/`, runtime on `/v1`, and admin on `/admin`.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "danger",
        statusKey: "blocked",
      };
    default:
      return {
        detail: `Unrecognized blocker: ${blocker}.`,
        why: "This blocker was reported by the ingress health check but has no mapped remediation.",
        howToFix: "Inspect onboarding and health to reconcile the public ingress contract.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "warning",
        statusKey: "partial",
      };
  }
}

function overallPosture(
  selectedInstance: { exposure_mode?: string; display_name?: string } | null,
  status: IngressTlsStatusResponse | null,
): {
  label: string;
  detail: string;
  tone: StatusTone;
  statusKey: string;
} {
  if (selectedInstance?.exposure_mode === "local_only") {
    return {
      label: "Local only",
      detail: "This instance is intentionally local-only. Public HTTPS readiness is not the active operating mode.",
      tone: "warning",
      statusKey: "onboarding-only",
    };
  }
  if (!status) {
    return {
      label: "Checking status",
      detail: "Ingress, DNS, and certificate evidence are still loading.",
      tone: "neutral",
      statusKey: "partial",
    };
  }
  if (status.mode_classification === "normative_public_https") {
    return {
      label: "Publicly production-ready",
      detail: "The normative same-origin HTTPS contract is satisfied and the live certificate path is present.",
      tone: "success",
      statusKey: "ready",
    };
  }
  if (
    status.tls_mode !== "integrated_acme"
    || !status.fqdn
    || status.certificate.trust_state === "self_signed"
  ) {
    return {
      label: "Exception mode",
      detail: "ForgeFrame is exposed through a conscious exception posture such as manual TLS, self-signed material, or no public FQDN.",
      tone: "warning",
      statusKey: "unsupported",
    };
  }
  return {
    label: "Blocked",
    detail: "Public HTTPS is intended, but DNS, listener, or certificate evidence still blocks production readiness.",
    tone: "danger",
    statusKey: "blocked",
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
        setNextSteps(payload.next_steps ?? []);
        setStatus(ingressStatus);
        setState("success");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setChecks([]);
        setNextSteps([]);
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

  const posture = overallPosture(selectedInstance, status);
  const onboardingLink = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  const healthLink = withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);
  const blockCount = status?.blockers.length ?? 0;
  const bootstrapById = new Map(checks.map((check) => [check.id, check]));
  const isLocalOnly = selectedInstance?.exposure_mode === "local_only";
  const hasLiveCert = status?.certificate.present === true;

  const checklistRows: ChecklistRow[] = status ? [
    {
      key: "fqdn",
      label: "FQDN",
      summary: status.fqdn ? "Public FQDN configured" : "No public FQDN",
      evidence: status.fqdn ?? "missing",
      nextAction: status.fqdn
        ? "Keep the configured hostname stable and continue validating DNS plus certificate evidence."
        : "Record the real public FQDN before claiming a public HTTPS surface.",
      linkTo: CONTROL_PLANE_ROUTES.settings,
      linkLabel: "Open Settings",
      tone: status.fqdn ? "success" : "warning",
      statusKey: status.fqdn ? "ready" : "unsupported",
    },
    {
      key: "dns",
      label: "DNS",
      summary: status.dns_resolves ? "Public DNS resolves" : "DNS unresolved",
      evidence: status.resolved_addresses.join(", ") || bootstrapById.get("public_dns_resolution")?.details || "unresolved",
      nextAction: status.dns_resolves
        ? "Recheck the certificate window and listener contract after DNS changes settle."
        : "Publish A/AAAA records so the FQDN resolves to this host.",
      linkTo: healthLink,
      linkLabel: "Open Health",
      tone: status.dns_resolves ? "success" : "danger",
      statusKey: status.dns_resolves ? "ready" : "blocked",
    },
    {
      key: "port80",
      label: "Port 80 helper",
      summary: status.public_http_helper_port === 80 ? "ACME helper on port 80" : "HTTP helper not on 80",
      evidence: `${status.public_http_helper_host}:${status.public_http_helper_port}`,
      nextAction: status.public_http_helper_port === 80
        ? "Keep the helper restricted to ACME or minimal redirect traffic."
        : "Expose the helper listener on port 80 for ACME challenge handling.",
      linkTo: onboardingLink,
      linkLabel: "Open setup progress",
      tone: status.public_http_helper_port === 80 ? "success" : "warning",
      statusKey: status.public_http_helper_port === 80 ? "ready" : "partial",
    },
    {
      key: "port443",
      label: "Port 443 listener",
      summary: status.public_https_host === "0.0.0.0" && status.public_https_port === 443 ? "Normative public HTTPS listener" : "Non-normative HTTPS listener",
      evidence: `${status.public_https_host}:${status.public_https_port}`,
      nextAction: status.public_https_host === "0.0.0.0" && status.public_https_port === 443
        ? "Continue validating the same-origin root path and live certificate truth."
        : "Bind the public HTTPS surface to 0.0.0.0:443.",
      linkTo: onboardingLink,
      linkLabel: "Open setup progress",
      tone: status.public_https_host === "0.0.0.0" && status.public_https_port === 443 ? "success" : "danger",
      statusKey: status.public_https_host === "0.0.0.0" && status.public_https_port === 443 ? "ready" : "blocked",
    },
    {
      key: "https",
      label: "Same-origin HTTPS surface",
      summary: status.mode_classification === "normative_public_https" ? "Same-origin HTTPS contract satisfied" : "Same-origin HTTPS contract incomplete",
      evidence: `ui=${status.frontend_root_path}; runtime=${status.runtime_api_base}; admin=${status.admin_api_base}; mode=${status.tls_mode}`,
      nextAction: status.mode_classification === "normative_public_https"
        ? "Public runtime and admin paths are aligned on the expected origin."
        : "Restore UI on `/`, runtime on `/v1`, and admin on `/admin` on the same HTTPS origin.",
      linkTo: CONTROL_PLANE_ROUTES.settings,
      linkLabel: "Open Settings",
      tone: status.mode_classification === "normative_public_https" ? "success" : "danger",
      statusKey: status.mode_classification === "normative_public_https" ? "ready" : "blocked",
    },
    {
      key: "certificate",
      label: "Certificate",
      summary: !status.certificate.present
        ? "Certificate missing"
        : status.certificate.trust_state === "self_signed"
          ? "Self-signed certificate"
          : "Live certificate present",
      evidence: [
        status.certificate.certificate_path,
        status.certificate.issuer ?? "issuer=n/a",
        status.certificate.valid_to ? `valid_to=${status.certificate.valid_to}` : null,
        status.certificate.last_error ? `error=${status.certificate.last_error}` : null,
      ].filter(Boolean).join(" · "),
      nextAction: !status.certificate.present
        ? "Issue or renew certificate material, then refresh this surface."
        : status.certificate.trust_state === "self_signed"
          ? "Treat self-signed material as an explicit exception state, not as public-production readiness."
          : "Monitor the renewal window and execute renew only when the ACME contract remains satisfied.",
      linkTo: healthLink,
      linkLabel: "Open Health",
      tone: !status.certificate.present ? "danger" : status.certificate.trust_state === "self_signed" ? "warning" : "success",
      statusKey: !status.certificate.present ? "blocked" : status.certificate.trust_state === "self_signed" ? "unsupported" : "ready",
    },
  ] : [];

  const checklistColumns: EntityTableColumn<ChecklistRow>[] = [
    {
      key: "check",
      header: "Check",
      render: (row) => (
        <div>
          <strong>{row.label}</strong>
          <div className="fg-muted">{row.summary}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.summary}
        </StatusBadge>
      ),
    },
    {
      key: "evidence",
      header: "Evidence",
      render: (row) => row.evidence,
    },
    {
      key: "action",
      header: "Next action",
      render: (row) => (
        <div className="fg-stack">
          <span>{row.nextAction}</span>
          <Link className="fg-nav-link" to={row.linkTo}>{row.linkLabel}</Link>
        </div>
      ),
    },
  ];

  const blockerRows: BlockerRow[] = (status?.blockers ?? []).map((blocker) => {
    const mapped = blockerDetail(blocker, { instanceId });
    return {
      key: blocker,
      blocker,
      detail: mapped.detail,
      why: mapped.why,
      howToFix: mapped.howToFix,
      linkTo: mapped.linkTo,
      linkLabel: mapped.linkLabel,
      tone: mapped.tone,
      statusKey: mapped.statusKey,
    };
  });

  const blockerColumns: EntityTableColumn<BlockerRow>[] = [
    {
      key: "blocker",
      header: "Blocker",
      render: (row) => (
        <div>
          <strong>{row.blocker}</strong>
          <div className="fg-muted">{row.detail}</div>
        </div>
      ),
    },
    {
      key: "why",
      header: "Why it matters",
      render: (row) => <span className="fg-muted">{row.why}</span>,
    },
    {
      key: "fix",
      header: "How to fix",
      render: (row) => row.howToFix,
    },
    {
      key: "link",
      header: "Fix it here",
      render: (row) => <Link className="fg-nav-link" to={row.linkTo}>{row.linkLabel}</Link>,
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Ingress / TLS / Certificates"
        description="FQDN, DNS, public listeners, same-origin posture, certificate truth, and renewal gating — one focused operator surface."
        badges={[
          { label: posture.label, tone: posture.tone },
          { label: status?.renewal_allowed ? "Renew available" : "Renew gated", tone: status?.renewal_allowed ? "success" : "warning" },
        ]}
        note="Self-signed material, manual TLS, no public FQDN, or local-only exposure stay explicit exception states. ForgeFrame does not paint them green."
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

      {state === "success" && isLocalOnly ? (
        <BlockedState
          title="Local-only exposure mode"
          description="Public HTTPS readiness is not the active deployment goal for this instance. Missing FQDN or certificate evidence reflects the declared local-only posture — not a hidden production gap."
          status="onboarding-only"
          badgeLabel="Only local"
        />
      ) : null}

      {state === "success" && status ? (
        <>
          {/* ── Status Hero ── */}
          <section className="ff-status-hero" aria-label="Ingress status">
            <div className="ff-status-hero-top">
              <div>
                <h3 className="ff-status-hero-label">{posture.label}</h3>
                <p className="ff-status-hero-line">{posture.detail}</p>
              </div>
              <StatusBadge tone={posture.tone} status={posture.statusKey}>
                {posture.label}
              </StatusBadge>
            </div>

            <div className="ff-status-hero-stats">
              <span>FQDN: {status.fqdn ?? "none"}</span>
              <span>DNS: {status.dns_resolves ? "resolved" : "unresolved"}</span>
              <span>Certificate: {status.certificate.present ? status.certificate.trust_state : "missing"}</span>
              <span>Renewal: {status.renewal_allowed ? "available" : "gated"}</span>
              <span>{blockCount} blocker{blockCount !== 1 ? "s" : ""}</span>
            </div>

            {blockCount > 0 ? (
              <div className="ff-next-step" data-tone="danger">
                <span className="ff-next-step-label">Next: fix {blockCount} blocker{blockCount !== 1 ? "s" : ""}</span>
                <span>{status.blockers[0]}</span>
              </div>
            ) : posture.statusKey === "ready" ? (
              <div className="ff-next-step" data-tone="success">
                <span className="ff-next-step-label">Ingress is production-ready</span>
                <span>The normative same-origin HTTPS contract is satisfied. Monitor the certificate renewal window.</span>
              </div>
            ) : posture.statusKey === "unsupported" ? (
              <div className="ff-next-step" data-tone="warning">
                <span className="ff-next-step-label">Conscious exception mode</span>
                <span>Manual TLS, self-signed material, or no FQDN is an explicit posture. No blockers — but this is NOT public-production ready.</span>
              </div>
            ) : (
              <div className="ff-next-step" data-tone="neutral">
                <span className="ff-next-step-label">No action required</span>
                <span>Ingress surface is operating as expected.</span>
              </div>
            )}
          </section>

          {/* ── Controls ── */}
          <section className="ff-action-bar">
            <div className="ff-action-bar-header">
              <div className="ff-action-bar-copy">
                <h3>Ingress controls</h3>
                <p>Renew certificates or navigate to related surfaces.</p>
              </div>
              <div className="ff-action-controls">
                <button type="button" onClick={() => setRefreshNonce((current) => current + 1)}>
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void triggerRenewal()}
                  disabled={!status?.renewal_allowed || renewing}
                >
                  {renewing ? "Renewing certificates" : "Renew certificates"}
                </button>
              </div>
            </div>
            <div className="ff-nav-links">
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.settings}>Settings</Link>
              <Link className="fg-nav-link" to={onboardingLink}>Setup progress</Link>
              <Link className="fg-nav-link" to={healthLink}>Health</Link>
            </div>
          </section>

          <div className="ff-operator-layout">
            <div className="ff-operator-main">
              <EntityTable
                title="Ingress checklist"
                description="Each row shows live evidence plus the next operator action for FQDN, DNS, listeners, same-origin HTTPS, and certificate posture."
                columns={checklistColumns}
                rows={checklistRows}
                rowKey={(row) => row.key}
                tableLabel="Ingress and TLS checklist"
              />

              <EntityTable
                title="Current blockers"
                description="Each blocker explains what is wrong, why it matters, how to fix it, and where the fix happens."
                columns={blockerColumns}
                rows={blockerRows}
                rowKey={(row) => row.key}
                tableLabel="Ingress and TLS blockers"
                emptyTitle="No active blockers"
                emptyDescription="This ingress surface currently shows no open blockers against the normative public HTTPS contract."
                footer={nextSteps.length > 0 ? (
                  <div className="fg-stack">
                    <strong>Bootstrap evidence next steps</strong>
                    <ul className="fg-list">
                      {nextSteps.slice(0, 3).map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                ) : null}
              />
            </div>

            <div className="ff-operator-sidebar">
              <DetailPanel
                title="Certificate truth"
                description={status.public_origin ?? "No public origin configured"}
                status={posture.label}
                statusTone={posture.tone}
                statusKey={posture.statusKey}
                sticky
              >
                <div className="fg-stack">
                  {hasLiveCert ? (
                    <section className="fg-subcard">
                      <h4>Certificate lifetime</h4>
                      <p>Trust state: {status.certificate.trust_state}</p>
                      <p>Issuer: {status.certificate.issuer ?? "n/a"}</p>
                      <p>Subject: {status.certificate.subject ?? "n/a"}</p>
                      <p>Valid from: {formatTimestamp(status.certificate.valid_from)}</p>
                      <p>Valid to: {formatTimestamp(status.certificate.valid_to)}</p>
                      <p>Renewal due: {formatTimestamp(status.certificate.renewal_due_at)}</p>
                      <p>Days remaining: {status.certificate.days_remaining ?? "n/a"}</p>
                    </section>
                  ) : (
                    <section className="fg-subcard">
                      <h4>Certificate lifetime</h4>
                      <p className="fg-muted">No live certificate is present. Certificate lifetime and trust details are not applicable.</p>
                    </section>
                  )}

                  <section className="fg-subcard">
                    <h4>Renew gate</h4>
                    <p>Supported: {String(status.renewal_supported)}</p>
                    <p>Allowed now: {String(status.renewal_allowed)}</p>
                    <p>Blocked reason: {status.renewal_blocked_reason ?? "none"}</p>
                    <p>Certificate path: {status.certificate.certificate_path}</p>
                    <p>Key path: {status.certificate.key_path}</p>
                  </section>

                  {renewalResult ? (
                    <section className="fg-subcard">
                      <h4>Last renew operation</h4>
                      <StatusBadge tone={renewalResult.status === "ok" ? "success" : renewalResult.status === "blocked" ? "warning" : "danger"}>
                        {renewalResult.status}
                      </StatusBadge>
                      <p>{renewalResult.details ?? renewalResult.stderr ?? renewalResult.stdout ?? "Renew operation returned without extra output."}</p>
                    </section>
                  ) : null}

                  <AdvancedDiagnostics
                    title="Renew operation output"
                    description="Raw script output stays collapsed until needed for troubleshooting."
                    status={renewalResult?.status ?? "idle"}
                    statusTone={
                      renewalResult?.status === "ok"
                        ? "success"
                        : renewalResult?.status === "failed"
                          ? "danger"
                          : renewalResult?.status === "blocked"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {renewalResult ? <pre>{JSON.stringify(renewalResult, null, 2)}</pre> : <p className="fg-muted">No renewal operation has been executed from this surface yet.</p>}
                  </AdvancedDiagnostics>

                  <AdvancedDiagnostics
                    title="Raw ingress truth"
                    description="Live API payload and bootstrap evidence for strict audit work."
                    status="advanced"
                    statusTone="neutral"
                  >
                    <pre>{JSON.stringify({ status, checks }, null, 2)}</pre>
                  </AdvancedDiagnostics>
                </div>
              </DetailPanel>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
