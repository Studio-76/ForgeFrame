import { useState } from "react";
import { Link } from "react-router-dom";

import type { ProviderClassKey } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { formatMetric, formatProviderAxis, formatTimestamp } from "./providersShared";
import {
  authTypeLabel,
  currentProviderClassDescriptor,
  formatCompatibilityDepth,
  formatContractClassification,
  formatHealthLabel,
  formatProviderClassLabel,
  MetricTile,
  ProviderClassFields,
  type ProvidersManagementSectionProps,
  SectionCard,
  TonePill,
  toneFromHealthStatus,
  toneFromReadinessAxis,
} from "./providersSectionUtils";

/**
 * Providers inventory table section with create/edit provider forms,
 * inventory table, and inline draft editing for selected providers.
 */
export function ProvidersInventoryTableSection({ data, actions, instanceId }: ProvidersManagementSectionProps) {
  const [activeProvider, setActiveProvider] = useState<string | null>(data.providers[0]?.provider ?? null);
  const selectedProvider = data.providers.find((provider) => provider.provider === activeProvider) ?? data.providers[0] ?? null;
  const selectedDraft = selectedProvider ? data.providerDrafts[selectedProvider.provider] : null;

  const applyProviderClassToCreateDraft = (providerClass: ProviderClassKey) => {
    const descriptor = currentProviderClassDescriptor(providerClass, data.supportedProviderClasses);
    actions.setNewProvider((current) => ({
      ...current,
      providerClass,
      integrationClass: descriptor.integration_class,
      templateId: descriptor.template_id ?? "",
      endpointBaseUrl: descriptor.default_config.endpoint_base_url ?? "",
      authScheme: descriptor.default_config.auth_scheme ?? (providerClass === "oauth_account" ? "oauth_account" : "bearer"),
      oauthMode: descriptor.default_config.oauth_mode ?? "account_portal",
    }));
  };

  const applyProviderClassToEditDraft = (provider: string, providerClass: ProviderClassKey) => {
    const descriptor = currentProviderClassDescriptor(providerClass, data.supportedProviderClasses);
    actions.setProviderDraftField(provider, "providerClass", providerClass);
    actions.setProviderDraftField(provider, "integrationClass", descriptor.integration_class);
    actions.setProviderDraftField(provider, "templateId", descriptor.template_id ?? "");
    actions.setProviderDraftField(provider, "endpointBaseUrl", descriptor.default_config.endpoint_base_url ?? "");
    actions.setProviderDraftField(provider, "authScheme", descriptor.default_config.auth_scheme ?? (providerClass === "oauth_account" ? "oauth_account" : "bearer"));
    actions.setProviderDraftField(provider, "oauthMode", descriptor.default_config.oauth_mode ?? "account_portal");
  };

  return (
    <>
      <SectionCard title="Provider hinzufügen" description="Create a real provider record with a supported runtime class instead of leaving placeholder onboarding controls behind.">
        {data.access.canMutate ? (
          <div className="fg-inline-form">
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
            <ProviderClassFields
              prefix="Provider "
              providerClass={data.newProvider.providerClass}
              integrationClass={data.newProvider.integrationClass}
              templateId={data.newProvider.templateId}
              endpointBaseUrl={data.newProvider.endpointBaseUrl}
              authScheme={data.newProvider.authScheme}
              oauthMode={data.newProvider.oauthMode}
              supportedProviderClasses={data.supportedProviderClasses}
              onProviderClassChange={applyProviderClassToCreateDraft}
              onFieldChange={(field, value) => actions.setNewProvider((current) => ({ ...current, [field]: value }))}
            />
            <div className="fg-actions fg-actions-end">
              <button type="button" onClick={() => void actions.createProvider()}>
                Provider hinzufügen
              </button>
            </div>
          </div>
        ) : (
          <p className="fg-note">{data.access.summaryDetail}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Provider Inventory"
        description="Live provider records only. OAuth/account work and harness proof stay on their dedicated pages."
        actions={
          selectedProvider && data.access.canMutate ? (
            <div className="fg-actions">
              <button type="button" onClick={() => void actions.saveProvider(selectedProvider.provider)}>
                Save provider
              </button>
              <button type="button" onClick={() => void actions.syncProviderModels(selectedProvider.provider)}>
                Sync models
              </button>
              <button type="button" onClick={() => void actions.toggleProvider(selectedProvider.provider, selectedProvider.enabled)}>
                {selectedProvider.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="fg-table-wrap">
          <table className="fg-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Axis</th>
                <th>Auth type</th>
                <th>Runtime status</th>
                <th>Health</th>
                <th>Models</th>
                <th>Targets</th>
                <th>Last probe</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((provider) => {
                const isSelected = provider.provider === selectedProvider?.provider;
                return (
                  <tr key={provider.provider} className={isSelected ? "is-selected" : ""}>
                    <td>
                      <button className="fg-table-trigger" type="button" onClick={() => setActiveProvider(provider.provider)}>
                        <strong>{provider.label}</strong>
                      </button>
                      <div className="fg-muted">
                        <span className="fg-code">{provider.provider}</span> · {formatProviderClassLabel(String(provider.provider_class))}
                      </div>
                      <div className="fg-muted">
                        compatibility {formatContractClassification(provider.contract_classification)} · {formatCompatibilityDepth(provider.compatibility_depth ?? "none")}
                      </div>
                    </td>
                    <td>{formatProviderAxis(provider.provider_axis)}</td>
                    <td>{authTypeLabel(provider)}</td>
                    <td>
                      <div className="fg-actions">
                        <TonePill label={provider.enabled ? "enabled" : "disabled"} tone={provider.enabled ? "success" : "neutral"} />
                        <TonePill label={provider.ready ? "ready" : provider.runtime_readiness} tone={provider.ready ? "success" : toneFromReadinessAxis(provider.runtime_readiness)} />
                        {provider.oauth_connect_required ? <TonePill label="connect required" tone="warning" /> : null}
                      </div>
                    </td>
                    <td>
                      <TonePill label={formatHealthLabel(provider.health_status)} tone={toneFromHealthStatus(provider.health_status)} />
                      <div className="fg-muted">
                        {formatMetric(provider.healthy_model_count)} healthy / {formatMetric(provider.attention_model_count)} attention
                      </div>
                    </td>
                    <td>
                      {formatMetric(provider.model_count)}
                      <div className="fg-muted">{provider.models.slice(0, 2).map((model) => model.id).join(", ") || "none"}</div>
                    </td>
                    <td>
                      {formatMetric(provider.ready_target_count)} ready / {formatMetric(provider.enabled_target_count)} enabled / {formatMetric(provider.target_count)} total
                    </td>
                    <td>{formatTimestamp(provider.last_probe_at)}</td>
                    <td>
                      <div className="fg-actions">
                        {provider.next_action_kind === "connect_oauth" ? (
                          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
                            {provider.next_action}
                          </Link>
                        ) : null}
                        {provider.next_action_kind === "activate_provider" && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.toggleProvider(provider.provider, provider.enabled)}>
                            Activate
                          </button>
                        ) : null}
                        {(provider.next_action_kind === "sync_models" || provider.next_action_kind === "review_sync") && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.syncProviderModels(provider.provider)}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {provider.next_action_kind === "run_health" && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.runHealthChecks()}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {provider.next_action_kind === "edit_provider" && data.access.canMutate ? (
                          <button type="button" onClick={() => setActiveProvider(provider.provider)}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {!data.access.canMutate && provider.next_action_kind !== "connect_oauth" ? (
                          <span className="fg-muted">{provider.next_action}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedProvider && selectedDraft ? (
          <div className="fg-subcard fg-mt-md">
            <div className="fg-panel-heading">
              <div>
                <h4>{selectedProvider.label}</h4>
                <p className="fg-muted">
                  <span className="fg-code">{selectedProvider.provider}</span> · last sync {formatTimestamp(selectedProvider.last_sync_at)}
                </p>
              </div>
              <div className="fg-actions">
                <TonePill label={selectedProvider.next_action} tone={selectedProvider.oauth_connect_required ? "warning" : "neutral"} />
                {selectedProvider.readiness_reason ? <span className="fg-muted">{selectedProvider.readiness_reason}</span> : null}
              </div>
            </div>

            <div className="fg-inline-form">
              <label>
                Label
                <input
                  value={selectedDraft.label}
                  disabled={!data.access.canMutate}
                  onChange={(event) => actions.setProviderDraftField(selectedProvider.provider, "label", event.target.value)}
                />
              </label>
              <ProviderClassFields
                prefix="Provider "
                providerClass={selectedDraft.providerClass}
                integrationClass={selectedDraft.integrationClass}
                templateId={selectedDraft.templateId}
                endpointBaseUrl={selectedDraft.endpointBaseUrl}
                authScheme={selectedDraft.authScheme}
                oauthMode={selectedDraft.oauthMode}
                supportedProviderClasses={data.supportedProviderClasses}
                disabled={!data.access.canMutate}
                onProviderClassChange={(providerClass) => applyProviderClassToEditDraft(selectedProvider.provider, providerClass)}
                onFieldChange={(field, value) => actions.setProviderDraftField(selectedProvider.provider, field, value)}
              />
            </div>

            <div className="fg-actions fg-mt-sm">
              {data.access.canMutate ? (
                <>
                  <button type="button" onClick={() => void actions.saveProvider(selectedProvider.provider)}>
                    Save provider
                  </button>
                  <button type="button" onClick={() => void actions.syncProviderModels(selectedProvider.provider)}>
                    Sync models
                  </button>
                  <button type="button" onClick={() => void actions.toggleProvider(selectedProvider.provider, selectedProvider.enabled)}>
                    {selectedProvider.enabled ? "Disable" : "Enable"}
                  </button>
                </>
              ) : null}
            </div>

            {selectedProvider.last_sync_error ? <p className="fg-danger fg-mt-sm">Last sync error: {selectedProvider.last_sync_error}</p> : null}
          </div>
        ) : null}
      </SectionCard>
    </>
  );
}
