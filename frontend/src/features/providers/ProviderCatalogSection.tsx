import type { ProvidersPageData } from "./providersShared";
import { formatMetric, formatTimestamp, joinList } from "./providersShared";
import { formatProviderAxis } from "./providersShared";
import {
  formatCatalogLabel,
  MetricTile,
  SectionCard,
  TonePill,
  toneFromCatalogMaturity,
  toneFromCatalogSignoff,
} from "./providersSectionUtils";

/**
 * Provider contract catalog section showing the V9 provider truth backlog:
 * docs-declared contract rows, current repo surface, missing proof,
 * and blocked live signoff.
 */
export function ProviderCatalogSection({ data }: { data: ProvidersPageData }) {
  const summary = data.providerCatalogSummary;

  return (
    <SectionCard
      title="Provider Contract Catalog"
      description="This catalog is the V9 provider truth backlog: docs-declared contract rows, current repo surface, missing proof, and blocked live signoff are separated so documentation cannot masquerade as runtime support."
    >
      {summary ? (
        <div className="fg-grid fg-grid-compact fg-mb-md">
          <MetricTile label="Catalog rows" value={formatMetric(summary.total_providers)} note={`${formatMetric(summary.documented_only)} documented only`} />
          <MetricTile label="Contract ready" value={formatMetric(summary.contract_ready)} note={`${formatMetric(summary.adapter_ready_without_live_proof)} adapter ready without live proof`} />
          <MetricTile label="Runtime ready" value={formatMetric(summary.runtime_ready)} note={`${formatMetric(summary.partial_runtime)} partial runtime`} />
          <MetricTile label="Live signoff blocked" value={formatMetric(summary.blocked_live_signoffs)} note={`${formatMetric(summary.pending_live_signoffs)} pending review`} />
        </div>
      ) : null}

      <div className="fg-card-grid">
        {data.providerCatalog.map((entry) => {
          const latestEvidence = ["docs_declared", "repo_observed", "live_probe_verified", "streaming_verified", "tool_calling_verified"].map(
            (evidenceClass) => entry.evidence_log.filter((item) => item.evidence_class === evidenceClass).at(-1),
          );
          const latestSignoff = entry.signoff_history.at(-1);
          return (
            <article key={entry.provider_id} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>
                    {entry.display_name} ({entry.provider_id})
                  </h4>
                  <p className="fg-muted">
                    class={formatCatalogLabel(entry.provider_class)} · raw={entry.raw_class} · axis={formatProviderAxis(entry.product_axis)}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill label={`maturity ${formatCatalogLabel(entry.maturity_status)}`} tone={toneFromCatalogMaturity(entry.maturity_status)} />
                  <TonePill label={`signoff ${formatCatalogLabel(entry.live_signoff_status)}`} tone={toneFromCatalogSignoff(entry.live_signoff_status)} />
                  <TonePill label={`evidence ${formatCatalogLabel(entry.evidence_status)}`} tone={entry.evidence_status === "repo_observed" || entry.evidence_status === "live_probe_verified" ? "success" : "neutral"} />
                </div>
              </div>

              <div className="fg-detail-grid">
                <p>
                  auth modes={entry.auth_modes_supported.length > 0 ? joinList(entry.auth_modes_supported) : "none"} · api modes=
                  {entry.api_modes_supported.length > 0 ? joinList(entry.api_modes_supported) : "none"}
                </p>
                <p>
                  runtime binding={entry.runtime_provider_binding ?? "-"} · oauth binding={entry.oauth_target_binding ?? "-"} · axis binding=
                  {entry.product_axis_binding ?? "-"}
                </p>
                <p>
                  streaming claim={entry.streaming_support_claim} · tools claim={entry.tools_support_claim} · responses claim=
                  {entry.responses_support_claim}
                </p>
                <p>
                  base URL={entry.base_url_default ?? "-"} · override env={entry.base_url_override_env ?? "-"} · token env=
                  {entry.token_env_vars.length > 0 ? joinList(entry.token_env_vars) : "-"}
                </p>
                <p>
                  source docs={entry.source_docs.length > 0 ? joinList(entry.source_docs) : "-"} · local refs={formatMetric(entry.local_reference_paths.length)}
                </p>
                <p>safe next action: {entry.safe_next_action}</p>
                {entry.missing_evidence.length > 0 ? <p className="fg-note">missing evidence: {entry.missing_evidence.join(" | ")}</p> : null}
                {entry.signoff_notes ? <p className="fg-note">signoff note: {entry.signoff_notes}</p> : null}
              </div>

              <details className="fg-mt-sm">
                <summary>Current contract vs evidence</summary>
                <ul className="fg-list">
                  {latestEvidence.map((item, index) =>
                    item ? (
                      <li key={`${item.evidence_class}-${index}`}>
                        {formatCatalogLabel(item.evidence_class)} · status={formatCatalogLabel(item.status)} · source={formatCatalogLabel(item.source_kind)} · recorded=
                        {formatTimestamp(item.recorded_at)} · details={item.details}
                      </li>
                    ) : null,
                  )}
                </ul>
                {latestSignoff ? (
                  <p className="fg-note">
                    latest signoff={formatCatalogLabel(latestSignoff.status)} · recorded={formatTimestamp(latestSignoff.recorded_at)} · details=
                    {latestSignoff.details}
                  </p>
                ) : null}
              </details>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
