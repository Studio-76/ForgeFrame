import type { ProvidersPageData } from "./providersShared";
import { formatMetric, formatTimestamp } from "./providersShared";
import {
  formatCatalogLabel,
  MetricTile,
  SectionCard,
  TonePill,
  toneFromOpenAICompatibilityStatus,
} from "./providersSectionUtils";

/**
 * OpenAI compatibility signoff section displaying the hard corpus-level
 * compatibility truth for the current instance, with runtime evidence
 * and known deviations separated.
 */
export function OpenAICompatibilitySection({ data }: { data: ProvidersPageData }) {
  const signoff = data.openaiCompatibilitySignoff;

  if (!signoff) {
    return (
      <SectionCard
        title="OpenAI Compatibility Signoff"
        description="This surface stays explicit about what is verified, partial, blocked by missing live evidence, or entirely absent."
      >
        <p className="fg-muted">No compatibility signoff payload is currently available for this instance.</p>
      </SectionCard>
    );
  }

  const summary = signoff.summary;

  return (
    <SectionCard
      title="OpenAI Compatibility Signoff"
      description="This is the hard corpus-level compatibility truth for the current instance. Runtime evidence and known deviations are separated so `/v1/responses` cannot quietly borrow green status from chat-only paths."
    >
      <div className="fg-grid fg-grid-compact fg-mb-md">
        <MetricTile label="Corpus checks" value={formatMetric(summary.total_checks)} note={`${formatMetric(summary.supported)} supported`} />
        <MetricTile label="Partial" value={formatMetric(summary.partial)} note={`${formatMetric(summary.blocked_by_live_evidence)} blocked by live evidence`} />
        <MetricTile label="Unsupported" value={formatMetric(summary.unsupported)} note={`${formatMetric(summary.skipped)} skipped`} />
        <MetricTile
          label="Overall"
          value={formatCatalogLabel(summary.overall_status)}
          note={summary.signoff_claimable ? "signoff claimable" : "signoff not claimable"}
        />
      </div>

      <div className="fg-card-grid">
        {signoff.rows.map((row) => (
          <article key={row.corpus_class} className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>{row.label}</h4>
                <p className="fg-muted">
                  {row.corpus_class} · route={row.route ?? "-"} · axis={row.provider_axis ?? "-"}
                </p>
              </div>
              <div className="fg-actions">
                <TonePill label={formatCatalogLabel(row.status)} tone={toneFromOpenAICompatibilityStatus(row.status)} />
                <TonePill label={row.live_evidence_required ? "live evidence required" : "repo truth allowed"} tone={row.live_evidence_required ? "warning" : "neutral"} />
              </div>
            </div>

            <div className="fg-detail-grid">
              <p>evidence source={row.evidence_source}</p>
              <p>last verified={formatTimestamp(row.last_verified_at)} · sample request={row.sample_request_id ?? "-"}</p>
              <p>deviation reason: {row.deviation_reason ?? "none"}</p>
              <p>raw diff summary: {row.raw_diff_summary ?? "none"}</p>
              {row.notes ? <p className="fg-note">{row.notes}</p> : null}
            </div>
          </article>
        ))}
      </div>

      <div className="fg-subcard fg-mt-sm">
        <h4>Operator notes</h4>
        <ul className="fg-list">
          {signoff.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
