import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { formatMetric, formatTimestamp, joinList, toBooleanValue, toStringValue } from "./providersShared";
import { formatProviderAxis } from "./providersShared";
import {
  EvidenceSummary,
  formatCatalogLabel,
  formatCompatibilityDepth,
  formatContractClassification,
  formatHealthLabel,
  formatProviderClassLabel,
  ReadinessAxisPills,
  SectionCard,
  TonePill,
  toneFromContractClassification,
  toneFromHealthStatus,
  toneFromProofStatus,
  toneFromReadinessAxis,
} from "./providersSectionUtils";

export type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

/**
 * Live provider inventory section displaying provider cards with
 * contract, runtime, streaming readiness, model details, and inline
 * label/lifecycle controls. Also includes the compatibility matrix
 * and client operational view.
 */
export function ProviderInventorySection({ data, actions }: SectionProps) {
  return (
    <>
      <SectionCard
        title="Live Provider Inventory"
        description={
          data.access.canMutate
            ? "These records reflect current control-plane/runtime provider state, not future onboarding targets. Runtime and streaming readiness stay visible as separate axes."
            : "These records reflect current control-plane/runtime provider state, not future onboarding targets. Create, label, lifecycle, and sync controls stay hidden for permission-limited sessions."
        }
      >
        {data.access.canMutate ? (
          <div className="fg-inline-form fg-mb-md">
            <label>
              Provider key
              <input
                value={data.newProvider.provider}
                onChange={(event) => actions.setNewProvider((current) => ({ ...current, provider: event.target.value }))}
                placeholder="provider_key"
              />
            </label>
            <label>
              Label
              <input
                value={data.newProvider.label}
                onChange={(event) => actions.setNewProvider((current) => ({ ...current, label: event.target.value }))}
                placeholder="Provider label"
              />
            </label>
            <div className="fg-actions fg-actions-end">
              <button type="button" onClick={() => void actions.createProvider()}>
                Create provider
              </button>
            </div>
          </div>
        ) : (
          <p className="fg-note fg-mb-md">{data.access.summaryDetail}</p>
        )}

        <div className="fg-card-grid">
          {data.providers.map((provider) => (
            <article key={provider.provider} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>
                    {provider.label} ({provider.provider})
                  </h4>
                  <p className="fg-muted">
                    {provider.integration_class} · template={provider.template_id ?? "-"} · last sync={formatTimestamp(provider.last_sync_at)}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill
                    label={`contract ${formatContractClassification(provider.contract_classification)}`}
                    tone={toneFromContractClassification(provider.contract_classification)}
                  />
                  <TonePill label={provider.enabled ? "enabled" : "disabled"} tone={provider.enabled ? "success" : "neutral"} />
                  <TonePill
                    label={provider.ready ? "ready" : "not ready"}
                    tone={provider.ready ? "success" : toneFromReadinessAxis(provider.runtime_readiness === "partial" || provider.streaming_readiness === "partial" ? "partial" : "planned")}
                  />
                  <TonePill label={`harness ${provider.harness_proof_status}`} tone={toneFromProofStatus(provider.harness_proof_status)} />
                  <ReadinessAxisPills
                    runtimeReadiness={provider.runtime_readiness}
                    streamingReadiness={provider.streaming_readiness}
                  />
                </div>
              </div>

              <div className="fg-detail-grid">
                <p>
                  contract={formatContractClassification(provider.contract_classification)} · runtime axis={provider.runtime_readiness} · streaming axis={provider.streaming_readiness} · provider axis=
                  {formatProviderAxis(provider.provider_axis)} · compatibility depth={formatCompatibilityDepth(provider.compatibility_depth ?? "none")}
                </p>
                <p>
                  auth={provider.auth_mechanism ?? "unknown"} · tool calling={provider.tool_calling_level ?? "none"} · oauth required=
                  {String(provider.oauth_required)} · oauth mode={provider.oauth_mode ?? "-"} · discovery supported={String(provider.discovery_supported)}
                </p>
                <p>
                  models={formatMetric(provider.model_count)} · provider errors={formatMetric(data.providerErrors[provider.provider] ?? 0)} · harness profiles=
                  {formatMetric(provider.harness_profile_count)} · harness runs={formatMetric(provider.harness_run_count)}
                </p>
                <p>
                  harness needs attention={formatMetric(provider.harness_needs_attention_count)} · oauth failures=
                  {formatMetric(provider.oauth_failure_count)} · sync status={provider.last_sync_status}
                </p>
                <p>
                  harness proof={provider.harness_proof_status} · proven profiles=
                  {provider.harness_proven_profile_keys.length > 0 ? joinList(provider.harness_proven_profile_keys) : "-"}
                </p>
                {provider.readiness_reason ? <p className="fg-note">readiness reason: {provider.readiness_reason}</p> : null}
                {provider.last_sync_error ? <p className="fg-danger">last sync error: {provider.last_sync_error}</p> : null}
              </div>

              {data.access.canMutate ? (
                <div className="fg-inline-form fg-mt-sm">
                  <label>
                    Label
                    <input
                      value={data.providerLabelDrafts[provider.provider] ?? provider.label}
                      onChange={(event) => actions.setProviderLabelDraft(provider.provider, event.target.value)}
                    />
                  </label>
                  <div className="fg-actions fg-actions-end">
                    <button type="button" onClick={() => void actions.saveProviderLabel(provider.provider)}>
                      Save label
                    </button>
                    <button type="button" onClick={() => void actions.toggleProvider(provider.provider, provider.enabled)}>
                      {provider.enabled ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => void actions.syncProviderModels(provider.provider)}>
                      Sync models
                    </button>
                  </div>
                </div>
              ) : null}

              {provider.models.length > 0 ? (
                <details className="fg-mt-sm">
                  <summary>Model truth</summary>
                  <ul className="fg-list">
                    {provider.models.map((model) => (
                      <li key={model.id}>
                        {model.id} · source={model.source} · discovery={model.discovery_status} · runtime={model.runtime_status ?? "unknown"} · availability=
                        {model.availability_status ?? "unknown"} · health={model.health_status} · active={String(model.active)} · errors=
                        {formatMetric(data.modelErrors[model.id] ?? 0)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="fg-muted fg-mt-sm">
                  No models currently indexed for this provider.
                </p>
              )}
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Compatibility Matrix" description="This matrix is runtime/control-plane truth for wired providers, not the expansion backlog.">
        <div className="fg-card-grid">
          {data.compatibilityMatrix.map((row) => (
            <article key={row.provider} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>{row.label}</h4>
                  <p className="fg-muted">{row.provider}</p>
                </div>
                <div className="fg-actions">
                  <TonePill
                    label={`contract ${formatContractClassification(row.contract_classification)}`}
                    tone={toneFromContractClassification(row.contract_classification)}
                  />
                  <TonePill
                    label={row.ready ? "ready" : "not ready"}
                    tone={row.ready ? "success" : toneFromReadinessAxis(row.runtime_readiness === "partial" || row.streaming_readiness === "partial" ? "partial" : "planned")}
                  />
                  <TonePill label={`proof ${row.proof_status}`} tone={toneFromProofStatus(row.proof_status)} />
                  <ReadinessAxisPills runtimeReadiness={row.runtime_readiness} streamingReadiness={row.streaming_readiness} />
                </div>
              </div>
              <div className="fg-detail-grid">
                <p>
                  compatibility depth={formatCompatibilityDepth(row.compatibility_depth)} · contract={formatContractClassification(row.contract_classification)} · runtime axis={row.runtime_readiness} · streaming axis={row.streaming_readiness} · provider axis=
                  {formatProviderAxis(row.provider_axis)}
                </p>
                <p>
                  oauth required={String(row.oauth_required)} · ui models={formatMetric(row.ui_models)} · streaming={row.streaming} · tool calling=
                  {row.tool_calling} · vision={row.vision} · discovery={row.discovery}
                </p>
                <p>
                  proof={row.proof_status} · proven profiles={row.proven_profile_keys.length > 0 ? joinList(row.proven_profile_keys) : "-"}
                </p>
                <p>typed deviations / unsupported notes: {row.notes}</p>
              </div>
              <EvidenceSummary
                evidence={row.evidence}
                title="Compatibility evidence"
                description="The public OpenAI-compatible contract stays partial until these proof axes are observed instead of merely configured."
              />
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Client / Consumer Operational View" description="Operator-facing client state stays close to provider truth so attention items are visible without implying deeper workflow automation.">
        <ul className="fg-list">
          {data.clients.slice(0, 15).map((client) => (
            <li key={toStringValue(client.client_id)}>
              {toStringValue(client.client_id)} · requests={formatMetric(client.requests)} · errors={formatMetric(client.errors)} · error rate=
              {formatMetric(client.error_rate, 2)} · actual cost={formatMetric(client.actual_cost, 4)} · needs attention={toStringValue(client.needs_attention)}
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
