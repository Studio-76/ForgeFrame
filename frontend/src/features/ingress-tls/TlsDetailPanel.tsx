import { StatusBadge } from "../../components/ui/StatusBadge";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../../components/ui/DetailPanel";
import type { IngressTlsStatusResponse, IngressTlsRenewalResult } from "../../api/domain";
import { formatTimestamp } from "./utils";
import type { TlsSummary } from "./types";

/**
 * Side panel for the TLS surface with collapsed technical details.
 * Certificate lifetime, renewal gate, renewal output, and raw ingress
 * diagnostics are all hidden by default behind expandable sections.
 */
export function TlsDetailPanel({
  summary,
  status,
  renewalResult,
  hasLiveCert,
}: {
  summary: TlsSummary;
  status: IngressTlsStatusResponse;
  renewalResult: IngressTlsRenewalResult | null;
  hasLiveCert: boolean;
}) {
  return (
    <DetailPanel
      title="Certificate diagnostics"
      description={status.public_origin ?? "No public origin configured"}
      status={summary.label}
      statusTone={summary.tone}
      statusKey={summary.statusKey}
      sticky
    >
      <div className="fg-stack">
        {/* Certificate lifetime — collapsed when no live certificate */}
        {hasLiveCert ? (
          <details className="ff-collapse-section" open={hasLiveCert}>
            <summary>
              <span className="ff-collapse-summary-text">
                <h3>Certificate lifetime</h3>
                <p>Trust state, issuer, validity window, and renewal due date.</p>
              </span>
            </summary>
            <div className="ff-collapse-section-body">
              <section className="fg-subcard">
                <p>Trust state: {status.certificate.trust_state}</p>
                <p>Issuer: {status.certificate.issuer ?? "n/a"}</p>
                <p>Subject: {status.certificate.subject ?? "n/a"}</p>
                <p>Valid from: {formatTimestamp(status.certificate.valid_from)}</p>
                <p>Valid to: {formatTimestamp(status.certificate.valid_to)}</p>
                <p>Renewal due: {formatTimestamp(status.certificate.renewal_due_at)}</p>
                <p>Days remaining: {status.certificate.days_remaining ?? "n/a"}</p>
              </section>
            </div>
          </details>
        ) : (
          <section className="fg-subcard">
            <h4>Certificate lifetime</h4>
            <p className="fg-muted">No live certificate is present. Certificate lifetime and trust details are not applicable.</p>
          </section>
        )}

        {/* Renewal gate info — collapsed */}
        <details className="ff-collapse-section">
          <summary>
            <span className="ff-collapse-summary-text">
              <h3>Renewal gate</h3>
              <p>Whether certificate renewal is supported and currently allowed.</p>
            </span>
          </summary>
          <div className="ff-collapse-section-body">
            <section className="fg-subcard">
              <p>Supported: {String(status.renewal_supported)}</p>
              <p>Allowed now: {String(status.renewal_allowed)}</p>
              <p>Blocked reason: {status.renewal_blocked_reason ?? "none"}</p>
            </section>
          </div>
        </details>

        {/* Renewal operation output — hidden until run */}
        {renewalResult ? (
          <section className="fg-subcard">
            <h4>Last renew operation</h4>
            <StatusBadge
              tone={renewalResult.status === "ok" ? "success" : renewalResult.status === "blocked" ? "warning" : "danger"}
            >
              {renewalResult.status}
            </StatusBadge>
            <p>{renewalResult.details ?? renewalResult.stderr ?? renewalResult.stdout ?? "Renew operation returned without extra output."}</p>
          </section>
        ) : null}

        {/* Renewal operation output — raw details, collapsed */}
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
          {renewalResult ? (
            <pre>{JSON.stringify(renewalResult, null, 2)}</pre>
          ) : (
            <p className="fg-muted">No renewal operation has been executed from this surface yet.</p>
          )}
        </AdvancedDiagnostics>

        {/* Raw ingress truth in diagnostics drawer */}
        <AdvancedDiagnostics
          title="Raw ingress truth"
          description="Live API payload, bootstrap evidence, and raw blocker codes for audit work."
          status="advanced"
          statusTone="neutral"
        >
          <pre>{JSON.stringify(status, null, 2)}</pre>
        </AdvancedDiagnostics>
      </div>
    </DetailPanel>
  );
}
