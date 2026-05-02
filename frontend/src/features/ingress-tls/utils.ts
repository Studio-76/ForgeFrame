import type { StatusTone } from "../../components/ui/StatusBadge";
import type { IngressTlsStatusResponse } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { RemediationItem, TlsSummary, BootstrapCheck } from "./types";

/**
 * Map a blocker code to its action label (task-specific, not generic).
 */
function actionLabelForBlocker(blocker: string): string {
  switch (blocker) {
    case "public_fqdn_missing":
      return "Set public FQDN";
    case "public_fqdn_dns_unresolved":
      return "Verify DNS records";
    case "public_https_listener_not_normative":
      return "Bind HTTPS listener";
    case "port80_helper_not_normative":
      return "Expose port 80 helper";
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return "Configure TLS mode";
    case "public_tls_acme_email_missing":
      return "Set ACME email";
    case "integrated_tls_automation_missing":
      return "Restore renewal artifacts";
    case "certificate_material_missing":
      return "Issue or import certificate";
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return "Restore same-origin contract";
    default:
      return "Inspect setup";
  }
}

/**
 * Map a blocker code to its detail message.
 */
function detailForBlocker(blocker: string): string {
  switch (blocker) {
    case "public_fqdn_missing":
      return "No public FQDN is configured.";
    case "public_fqdn_dns_unresolved":
      return "The public FQDN does not resolve in DNS.";
    case "public_https_listener_not_normative":
      return "HTTPS listener is not bound to 0.0.0.0:443.";
    case "port80_helper_not_normative":
      return "Port 80 HTTP helper is not on the expected listener.";
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return "TLS mode is not set to integrated ACME.";
    case "public_tls_acme_email_missing":
      return "No ACME operator email is configured.";
    case "integrated_tls_automation_missing":
      return "Integrated ACME renewal automation is not present.";
    case "certificate_material_missing":
      return "No live certificate material is present.";
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return "The same-origin contract is broken.";
    default:
      return `Unrecognized blocker: ${blocker}.`;
  }
}

/**
 * Map a blocker code to "why it matters" explanation.
 */
function whyForBlocker(blocker: string): string {
  switch (blocker) {
    case "public_fqdn_missing":
      return "Without a public FQDN, DNS, TLS, and ACME automation cannot operate.";
    case "public_fqdn_dns_unresolved":
      return "Inbound HTTPS and ACME domain validation both require DNS resolution.";
    case "public_https_listener_not_normative":
      return "The same-origin HTTPS contract requires the listener on 0.0.0.0:443.";
    case "port80_helper_not_normative":
      return "ACME HTTP-01 challenges arrive on port 80 — without it, automated issuance fails.";
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return "Manual or disabled TLS modes prevent automated certificate issuance and renewal.";
    case "public_tls_acme_email_missing":
      return "ACME providers require a contact email for expiry notifications.";
    case "integrated_tls_automation_missing":
      return "Certificates will expire without automatic renewal.";
    case "certificate_material_missing":
      return "HTTPS connections cannot be established without certificate material.";
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return "ForgeFrame requires UI on `/`, runtime on `/v1`, and admin on `/admin` on the same origin.";
    default:
      return "This blocker prevents production readiness.";
  }
}

/**
 * Resolve the tone and status key for a blocker code.
 */
function toneForBlocker(blocker: string): { tone: StatusTone; statusKey: string } {
  switch (blocker) {
    case "public_fqdn_dns_unresolved":
    case "public_https_listener_not_normative":
    case "integrated_tls_automation_missing":
    case "certificate_material_missing":
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return { tone: "danger", statusKey: "blocked" };
    case "public_fqdn_missing":
    case "port80_helper_not_normative":
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
    case "public_tls_acme_email_missing":
      return { tone: "warning", statusKey: "partial" };
    default:
      return { tone: "warning", statusKey: "partial" };
  }
}

/**
 * Resolve the route for a blocker's fix action.
 */
function routeForBlocker(blocker: string, instanceId: string | null): string {
  switch (blocker) {
    case "public_fqdn_missing":
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
    case "public_tls_acme_email_missing":
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return CONTROL_PLANE_ROUTES.settings;
    case "public_fqdn_dns_unresolved":
    case "certificate_material_missing":
      return withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);
    case "public_https_listener_not_normative":
    case "port80_helper_not_normative":
    case "integrated_tls_automation_missing":
      return withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
    default:
      return withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  }
}

/**
 * Derive the overall TLS summary from status and instance metadata.
 */
export function deriveTlsSummary(
  selectedInstance: { exposure_mode?: string; display_name?: string } | null,
  status: IngressTlsStatusResponse | null,
): TlsSummary {
  const isLocalOnly = selectedInstance?.exposure_mode === "local_only";

  if (isLocalOnly) {
    return {
      label: "Local only",
      detail: "This instance is intentionally local-only. Public HTTPS readiness is not the active operating mode.",
      tone: "warning",
      statusKey: "onboarding-only",
      exposureMode: "Local only",
      fqdnStatus: "Not required",
      dnsStatus: "Not required",
      httpsListenerStatus: "Not required",
      certStatus: "Not required",
      primaryBlocker: null,
      nextAction: null,
    };
  }

  if (!status) {
    return {
      label: "Checking status",
      detail: "Ingress, DNS, and certificate evidence are still loading.",
      tone: "neutral",
      statusKey: "partial",
      exposureMode: "Unknown",
      fqdnStatus: "Unknown",
      dnsStatus: "Unknown",
      httpsListenerStatus: "Unknown",
      certStatus: "Unknown",
      primaryBlocker: null,
      nextAction: null,
    };
  }

  const fqdnStatus = status.fqdn ? status.fqdn : "Not configured";
  const dnsStatus = status.dns_resolves ? "Resolved" : "Unresolved";
  const httpsStatus =
    status.public_https_host === "0.0.0.0" && status.public_https_port === 443 ? "0.0.0.0:443" : "Non-normative";
  const certPresent = status.certificate.present === true;
  const certStatus = certPresent
    ? status.certificate.trust_state === "public_ca"
      ? "Live (public CA)"
      : status.certificate.trust_state === "self_signed"
        ? "Self-signed"
        : "Present"
    : "Missing";

  const blockers = status.blockers ?? [];
  const primaryBlocker = blockers.length > 0 ? blockers[0] ?? null : null;

  let nextAction: string | null = null;
  if (primaryBlocker) {
    nextAction = actionLabelForBlocker(primaryBlocker);
  } else if (status.mode_classification === "normative_public_https") {
    nextAction = "Monitor renewal window";
  } else {
    nextAction = "Review setup";
  }

  if (status.mode_classification === "normative_public_https") {
    return {
      label: "Production-ready",
      detail: "The normative same-origin HTTPS contract is satisfied and live certificate material is present.",
      tone: "success",
      statusKey: "ready",
      exposureMode: "Public HTTPS",
      fqdnStatus,
      dnsStatus,
      httpsListenerStatus: httpsStatus,
      certStatus,
      primaryBlocker: null,
      nextAction,
    };
  }

  if (blockers.length === 0) {
    return {
      label: "Exception mode",
      detail: "ForgeFrame is in a conscious exception posture (manual TLS, self-signed, or no FQDN).",
      tone: "warning",
      statusKey: "unsupported",
      exposureMode: status.tls_mode,
      fqdnStatus,
      dnsStatus,
      httpsListenerStatus: httpsStatus,
      certStatus,
      primaryBlocker: null,
      nextAction,
    };
  }

  return {
    label: "Blocked",
    detail: `Public HTTPS is intended but ${blockers.length} blocker${blockers.length !== 1 ? "s" : ""} remain${blockers.length === 1 ? "s" : ""}.`,
    tone: "danger",
    statusKey: "blocked",
    exposureMode: status.tls_mode,
    fqdnStatus,
    dnsStatus,
    httpsListenerStatus: httpsStatus,
    certStatus,
    primaryBlocker,
    nextAction,
  };
}

/**
 * Build a prioritized remediation checklist from the current status and blockers.
 * Items are ordered: blocking first, then warnings, then ready items.
 */
export function buildRemediationChecklist(
  status: IngressTlsStatusResponse | null,
  instanceId: string | null,
  bootstrapChecks: BootstrapCheck[],
): RemediationItem[] {
  if (!status) {
    return [];
  }

  const items: RemediationItem[] = [];
  const blockers = new Set(status.blockers ?? []);

  // Helper to add a remediation item
  const addItem = (
    key: string,
    label: string,
    blockerActive: boolean,
    blockerCode: string,
    readyCondition: boolean,
    readyDetail: string,
    blockedDetail: string,
  ) => {
    const blockerTone = toneForBlocker(blockerCode);
    if (readyCondition) {
      items.push({
        key,
        label,
        status: "completed",
        tone: "success",
        why: `Ready — ${readyDetail}`,
        action: "No action needed",
        actionTo: "",
        actionLabel: "Completed",
        detail: readyDetail,
        priority: "ready",
      });
    } else if (blockerActive) {
      items.push({
        key,
        label,
        status: "blocked",
        tone: blockerTone.tone,
        why: whyForBlocker(blockerCode),
        action: detailForBlocker(blockerCode),
        actionTo: routeForBlocker(blockerCode, instanceId),
        actionLabel: actionLabelForBlocker(blockerCode),
        detail: blockedDetail,
        priority: "blocking",
      });
    } else if (!readyCondition && !blockerActive) {
      // Not applicable — consider it pending
      items.push({
        key,
        label,
        status: "not-applicable",
        tone: "neutral",
        why: "Not applicable in current configuration.",
        action: "Review if needed",
        actionTo: withInstanceScope(CONTROL_PLANE_ROUTES.settings, instanceId),
        actionLabel: "Check settings",
        detail: "Not applicable",
        priority: "not-applicable",
      });
    }
  };

  // 1. TLS mode
  const tlsBlocked =
    blockers.has("tls_mode_disabled") || blockers.has("tls_mode_not_integrated_acme");
  addItem(
    "tls-mode",
    "Enable integrated ACME mode",
    tlsBlocked,
    "tls_mode_not_integrated_acme",
    status.tls_mode === "integrated_acme",
    status.tls_mode,
    "TLS mode must be set to integrated ACME for automated certificate management.",
  );

  // ACME email
  const emailBlocked = blockers.has("public_tls_acme_email_missing");
  const emailReady = status.tls_mode !== "integrated_acme" || !emailBlocked;
  addItem(
    "acme-email",
    "Configure ACME operator email",
    emailBlocked,
    "public_tls_acme_email_missing",
    emailReady,
    "ACME email configured",
    "ACME providers require a contact email for expiry notifications and account recovery.",
  );

  // 2. Public FQDN
  const fqdnBlocked = blockers.has("public_fqdn_missing");
  addItem(
    "fqdn",
    "Configure public FQDN",
    fqdnBlocked,
    "public_fqdn_missing",
    Boolean(status.fqdn),
    status.fqdn ?? "",
    "A public FQDN is required for DNS, TLS, and ACME automation.",
  );

  // 3. DNS resolution
  const dnsBlocked = blockers.has("public_fqdn_dns_unresolved");
  const dnsDetail = status.dns_resolves
    ? status.resolved_addresses.join(", ") || "Resolved"
    : "Unresolved";
  addItem(
    "dns",
    "Verify DNS resolution",
    dnsBlocked,
    "public_fqdn_dns_unresolved",
    status.dns_resolves,
    dnsDetail,
    "The public FQDN does not resolve — publish A/AAAA records.",
  );

  // 4. HTTPS listener (port 443)
  const httpsBlocked = blockers.has("public_https_listener_not_normative");
  const httpsNormative = status.public_https_host === "0.0.0.0" && status.public_https_port === 443;
  addItem(
    "https-listener",
    "Verify HTTPS listener",
    httpsBlocked,
    "public_https_listener_not_normative",
    httpsNormative,
    `${status.public_https_host}:${status.public_https_port}`,
    "HTTPS listener must be bound to 0.0.0.0:443 for production readiness.",
  );

  // Port 80 helper
  const port80Blocked = blockers.has("port80_helper_not_normative");
  addItem(
    "port80",
    "Expose port 80 ACME helper",
    port80Blocked,
    "port80_helper_not_normative",
    status.public_http_helper_port === 80,
    `${status.public_http_helper_host}:${status.public_http_helper_port}`,
    "Port 80 HTTP helper is required for ACME HTTP-01 challenges.",
  );

  // 5. Certificate
  const certBlocked = blockers.has("certificate_material_missing");
  const certReady = status.certificate.present === true;
  addItem(
    "certificate",
    "Issue or import certificate",
    certBlocked,
    "certificate_material_missing",
    certReady,
    status.certificate.trust_state === "public_ca"
      ? "Live public CA certificate"
      : status.certificate.trust_state === "self_signed"
        ? "Self-signed certificate (exception)"
        : "Certificate present",
    "No live certificate material — issue or import before HTTPS can serve.",
  );

  // Same-origin contract
  const originBlockers = [
    "root_ui_not_served_on_slash",
    "root_surface_not_spa",
    "runtime_api_base_not_normative",
    "admin_api_base_not_normative",
  ];
  const originBlocked = originBlockers.some((b) => blockers.has(b));
  addItem(
    "same-origin",
    "Verify same-origin contract",
    originBlocked,
    "root_ui_not_served_on_slash",
    status.mode_classification === "normative_public_https",
    `UI=${status.frontend_root_path}, runtime=${status.runtime_api_base}, admin=${status.admin_api_base}`,
    "The same-origin contract is broken — restore UI on `/`, runtime on `/v1`, admin on `/admin`.",
  );

  // Renewal automation
  const renewalBlocked = blockers.has("integrated_tls_automation_missing");
  addItem(
    "renewal",
    "Verify renewal automation",
    renewalBlocked,
    "integrated_tls_automation_missing",
    status.integrated_tls_automation || renewalBlocked === false,
    status.renewal_allowed ? "Renewal available" : "Renewal gated",
    "Integrated ACME renewal automation is missing — restore renewal artifacts.",
  );

  // Sort: blocking first, then warnings, then ready, then not-applicable
  const priorityOrder: Record<string, number> = {
    blocking: 0,
    warning: 1,
    ready: 2,
    "not-applicable": 3,
  };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}

/**
 * Format a timestamp value for display.
 */
export function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "n/a";
}

/**
 * Validate a raw bootstrap check record.
 */
export function asBootstrapCheck(value: Record<string, unknown>): BootstrapCheck | null {
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

/**
 * Relevant bootstrap check IDs for the TLS surface.
 */
export const RELEVANT_CHECK_IDS = new Set([
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
