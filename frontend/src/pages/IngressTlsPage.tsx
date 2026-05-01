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
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { BlockedState, ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

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

function certificateLifetimeLabel(status: IngressTlsStatusResponse | null): string {
  const daysRemaining = status?.certificate.days_remaining;
  if (typeof daysRemaining === "number") {
    return `${daysRemaining} days`;
  }
  return status?.certificate.present ? "Unknown" : "No live certificate";
}

function certificateWindowLabel(status: IngressTlsStatusResponse | null): string {
  if (status?.certificate.renewal_due_at) {
    return `Due ${status.certificate.renewal_due_at}`;
  }
  if (status?.certificate.present) {
    return "No renewal window recorded";
  }
  return "Not scheduled";
}

function blockerRoute(
  blocker: string,
  options: { instanceId: string | null },
): { detail: string; linkTo: string; linkLabel: string; tone: StatusTone; statusKey: string } {
  const { instanceId } = options;
  const onboardingLink = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  const healthLink = withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);

  switch (blocker) {
    case "public_fqdn_missing":
      return {
        detail: "Record the real public FQDN before claiming public HTTPS readiness.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "partial",
      };
    case "public_fqdn_dns_unresolved":
      return {
        detail: "Publish A/AAAA records so the public FQDN resolves to this host.",
        linkTo: healthLink,
        linkLabel: "Open Health",
        tone: "danger",
        statusKey: "blocked",
      };
    case "public_https_listener_not_normative":
      return {
        detail: "Bind the public HTTPS listener to 0.0.0.0:443 on the normative same-origin surface.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "danger",
        statusKey: "blocked",
      };
    case "port80_helper_not_normative":
      return {
        detail: "Expose the HTTP helper on port 80 so ACME challenge traffic can reach ForgeFrame.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "warning",
        statusKey: "partial",
      };
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return {
        detail: "Manual, disabled, or exception TLS modes stay non-green until an explicit integrated ACME path is restored.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "unsupported",
      };
    case "public_tls_acme_email_missing":
      return {
        detail: "Configure the operator ACME email before enabling automated certificate issuance or renewal.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "warning",
        statusKey: "partial",
      };
    case "integrated_tls_automation_missing":
      return {
        detail: "Restore the shipped ACME renewal artifacts and timer before relying on automated certificate management.",
        linkTo: onboardingLink,
        linkLabel: "Open setup progress",
        tone: "danger",
        statusKey: "blocked",
      };
    case "certificate_material_missing":
      return {
        detail: "Issue or import certificate material, then refresh this page to verify the live certificate truth.",
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
        detail: "Restore the same-origin contract: UI on `/`, runtime on `/v1`, and admin on `/admin`.",
        linkTo: CONTROL_PLANE_ROUTES.settings,
        linkLabel: "Open Settings",
        tone: "danger",
        statusKey: "blocked",
      };
    default:
      return {
        detail: "Inspect onboarding and health to reconcile the public ingress contract.",
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
      label: "Only local",
      detail: "The selected instance is intentionally local-only. Public HTTPS readiness is not the active operating mode.",
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

  const summaryItems: SummaryStripItem[] = [
    {
      key: "overall",
      label: "Overall exposure state",
      value: posture.label,
      meta: posture.detail,
      tone: posture.tone,
      status: posture.statusKey,
    },
    {
      key: "certificate-lifetime",
      label: "Certificate lifetime",
      value: certificateLifetimeLabel(status),
      meta: status?.certificate.valid_to ? `Valid to ${status.certificate.valid_to}` : "No valid certificate lifetime is currently recorded.",
      tone: status?.certificate.present ? "success" : "warning",
      status: status?.certificate.present ? "ready" : "blocked",
    },
    {
      key: "renewal-window",
      label: "Renewal window",
      value: certificateWindowLabel(status),
      meta: status?.renewal_allowed
        ? "Renew is available because integrated ACME, FQDN, DNS, and helper prerequisites are currently satisfied."
        : `Renew is blocked by ${status?.renewal_blocked_reason ?? "missing ingress truth"}.`,
      tone: status?.renewal_allowed ? "success" : "warning",
      status: status?.renewal_allowed ? "ready" : "partial",
    },
    {
      key: "blockers",
      label: "Open blockers",
      value: blockCount,
      meta: blockCount > 0 ? status?.blockers.join(", ") : "No active ingress or certificate blockers are currently recorded.",
      tone: blockCount > 0 ? "danger" : "success",
      status: blockCount > 0 ? "blocked" : "ready",
    },
  ];

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
    const mapped = blockerRoute(blocker, { instanceId });
    return {
      key: blocker,
      blocker,
      detail: mapped.detail,
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
      key: "state",
      header: "State",
      render: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusKey.replace(/_/g, " ")}
        </StatusBadge>
      ),
    },
    {
      key: "link",
      header: "Follow-up",
      render: (row) => <Link className="fg-nav-link" to={row.linkTo}>{row.linkLabel}</Link>,
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Ingress / TLS / Certificates"
        description="FQDN, DNS, public listeners, same-origin posture, certificate truth, and renewal gating stay on one operator surface."
        badges={[
          { label: posture.label, tone: posture.tone },
          { label: status?.renewal_allowed ? "Renew available" : "Renew gated", tone: status?.renewal_allowed ? "success" : "warning" },
        ]}
        note="Self-signed material, manual TLS, no public FQDN, or local-only exposure stay explicit exception states here. ForgeFrame does not paint them green."
      />

      <ActionBar
        title="Exposure and certificate control"
        description="Use this surface to decide whether the selected deployment is publicly production-ready, intentionally exceptional, blocked, or still local-only."
        actions={(
          <div className="fg-actions">
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
            <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.settings}>Settings</Link>
            <Link className="fg-nav-link" to={onboardingLink}>Setup progress</Link>
            <Link className="fg-nav-link" to={healthLink}>Health</Link>
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

      {state === "success" && selectedInstance?.exposure_mode === "local_only" ? (
        <BlockedState
          title="Local-only exposure mode"
          description="Public HTTPS readiness is not the active deployment goal for this instance. Treat any missing FQDN or certificate evidence as a declared local-only posture, not as a hidden production gap."
          status="onboarding-only"
          badgeLabel="Only local"
        />
      ) : null}

      {state === "success" && status ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Ingress checklist"
              description="Each row shows the live evidence plus the next operator action for FQDN, DNS, listeners, same-origin HTTPS, and certificate posture."
              columns={checklistColumns}
              rows={checklistRows}
              rowKey={(row) => row.key}
              tableLabel="Ingress and TLS checklist"
            />

            <EntityTable
              title="Current blockers"
              description="Blockers stay short and actionable, with direct follow-ups into settings, onboarding, or health."
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
                  description="Raw script output stays collapsed until it is needed for troubleshooting."
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
      ) : null}
    </section>
  );
}
