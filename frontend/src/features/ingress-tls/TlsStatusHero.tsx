import { StatusBadge } from "../../components/ui/StatusBadge";
import type { TlsSummary } from "./types";

/**
 * Top-level TLS summary panel showing exposure mode, FQDN status, DNS status,
 * HTTPS listener status, certificate status, the primary blocker, and the next
 * recommended action in a single glance.
 */
export function TlsStatusHero({ summary }: { summary: TlsSummary }) {
  return (
    <section className="ff-status-hero" aria-label="TLS readiness summary">
      <div className="ff-status-hero-top">
        <div>
          <h3 className="ff-status-hero-label">{summary.label}</h3>
          <p className="ff-status-hero-line">{summary.detail}</p>
        </div>
        <StatusBadge tone={summary.tone} status={summary.statusKey}>
          {summary.label}
        </StatusBadge>
      </div>

      <div className="ff-status-hero-stats">
        <span title="Exposure mode">Mode: {summary.exposureMode}</span>
        <span title="Public FQDN status">FQDN: {summary.fqdnStatus}</span>
        <span title="DNS resolution status">DNS: {summary.dnsStatus}</span>
        <span title="HTTPS listener status">HTTPS: {summary.httpsListenerStatus}</span>
        <span title="Certificate status">Cert: {summary.certStatus}</span>
      </div>

      {summary.primaryBlocker ? (
        <div className="ff-next-step" data-tone="danger">
          <span className="ff-next-step-label">Next: {summary.nextAction ?? "Fix blocker"}</span>
          <span>{summary.primaryBlocker}</span>
        </div>
      ) : summary.statusKey === "ready" ? (
        <div className="ff-next-step" data-tone="success">
          <span className="ff-next-step-label">Production-ready</span>
          <span>The normative same-origin HTTPS contract is satisfied. Monitor the certificate renewal window.</span>
        </div>
      ) : summary.statusKey === "unsupported" || summary.statusKey === "onboarding-only" ? (
        <div className="ff-next-step" data-tone="warning">
          <span className="ff-next-step-label">Exception mode</span>
          <span>Manual TLS, self-signed, local-only, or no FQDN is an explicit posture. This is NOT public-production ready.</span>
        </div>
      ) : null}
    </section>
  );
}
