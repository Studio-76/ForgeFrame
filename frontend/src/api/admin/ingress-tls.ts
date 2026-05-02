/**
 * Ingress TLS management API functions and types.
 *
 * @packageDocumentation
 */

import {
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Ingress TLS types
// ---------------------------------------------------------------------------

/** Ingress TLS certificate status info. */
export type IngressTlsCertificateStatus = {
  present: boolean;
  certificate_path: string;
  key_path: string;
  trust_state: "missing" | "self_signed" | "public_ca" | "unknown";
  issuer?: string | null;
  subject?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  last_issued_at?: string | null;
  last_renewed_at?: string | null;
  renewal_due_at?: string | null;
  days_remaining?: number | null;
  last_error?: string | null;
};

/** Ingress TLS status response. */
export type IngressTlsStatusResponse = {
  status: "ok";
  fqdn?: string | null;
  public_origin?: string | null;
  frontend_root_path: string;
  runtime_api_base: string;
  admin_api_base: string;
  public_https_host: string;
  public_https_port: number;
  public_http_helper_host: string;
  public_http_helper_port: number;
  tls_mode: string;
  acme_directory_url: string;
  acme_webroot_path: string;
  integrated_tls_automation: boolean;
  dns_resolves: boolean;
  resolved_addresses: string[];
  certificate: IngressTlsCertificateStatus;
  mode_classification: "normative_public_https" | "limited_exception";
  renewal_supported: boolean;
  renewal_allowed: boolean;
  renewal_blocked_reason?: string | null;
  blockers: string[];
  checked_at: string;
};

/** Ingress TLS renewal result. */
export type IngressTlsRenewalResult = {
  status: string;
  command?: string[];
  blocked_reason?: string | null;
  details?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
};

// ---------------------------------------------------------------------------
// Ingress TLS API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the current ingress TLS status.
 * @returns Ingress TLS status response.
 */
export function fetchIngressTlsStatus(): Promise<IngressTlsStatusResponse> {
  return fetchJson<IngressTlsStatusResponse>("/admin/ingress/tls");
}

/**
 * Renew the ingress TLS certificate.
 * @returns Response with renewal result.
 */
export function renewIngressTls() {
  return fetchJson<{ status: string; renewal: IngressTlsRenewalResult; ingress: IngressTlsStatusResponse }>("/admin/ingress/tls/renew", {
    method: "POST",
    body: "{}",
  });
}
