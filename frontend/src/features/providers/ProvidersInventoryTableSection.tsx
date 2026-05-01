import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import type { ProviderClassKey } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { formatMetric, formatTimestamp } from "./providersShared";
import {
  ActionFeedbackNotice,
  authTypeLabel,
  currentProviderClassDescriptor,
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

function visibleModels(provider: ProvidersManagementSectionProps["data"]["providers"][number]): string {
  const models = provider.models.slice(0, 2).map((model) => model.id);
  if (models.length === 0) {
    return "No models recorded";
  }
  return models.join(", ");
}

/**
 * Explains what the provider inventory action actually does.
 * @param provider - Provider currently shown in the action row.
 * @returns Plain operator-facing explanation for the next action.
 */
function providerActionExplanation(provider: ProvidersManagementSectionProps["data"]["providers"][number]): string {
  if (provider.next_action_kind === "sync_models") {
    return "Sync updates inventory only. Live endpoint probes run in Harness.";
  }
  if (provider.next_action_kind === "run_health") {
    return "Health updates readiness badges from runtime state. Use Harness for a live probe.";
  }
  if (provider.next_action_kind === "activate_provider") {
    return "Enable after endpoint settings are saved and at least one target is ready.";
  }
  if (provider.next_action_kind === "review_sync") {
    return "Routing is blocked until Provider Targets has a ready target.";
  }
  if (provider.next_action_kind === "connect_oauth") {
    return "Connect the account target before routing requests.";
  }
  return "Save settings before running the next repair step.";
}

/**
 * Builds the endpoint or account route summary for the selected provider.
 * @param draft - Editable provider draft for the selected provider.
 * @returns Human-readable route target summary.
 */
function providerEndpointSummary(draft: ProvidersManagementSectionProps["data"]["providerDrafts"][string]): string {
  if (draft.providerClass === "oauth_account") {
    return "OAuth account bridge — connect the account on OAuth Targets before probing.";
  }
  return draft.endpointBaseUrl.trim()
    ? `Endpoint saved in this draft: ${draft.endpointBaseUrl.trim()}`
    : "No endpoint URL is set yet.";
}

/**
 * Builds the stable key used to track a pending provider action.
 * @param kind - Provider action category.
 * @param provider - Optional provider identifier for scoped actions.
 * @returns Pending action key shared with the providers hook.
 */
function providerPendingKey(kind: "save" | "sync" | "toggle", provider: string): string {
  if (kind === "save") {
    return `save-provider:${provider}`;
  }
  if (kind === "sync") {
    return `sync-provider:${provider}`;
  }
  return `toggle-provider:${provider}`;
}

/**
 * Providers record section with a compact status summary, toggleable
 * create form, provider cards, and inline draft editing for the selected
 * provider.
 */
export function ProvidersInventoryTableSection({ data, actions, instanceId }: ProvidersManagementSectionProps) {
  const location = useLocation();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(data.providers[0]?.provider ?? null);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const selectedProvider = data.providers.find((provider) => provider.provider === activeProvider) ?? data.providers[0] ?? null;
  const selectedDraft = selectedProvider ? data.providerDrafts[selectedProvider.provider] : null;
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const readyProviders = data.providers.filter((provider) => provider.ready).length;
  const attentionProviders = data.providers.filter((provider) => provider.health_status !== "healthy").length;
  const readyTargets = data.providers.reduce((total, provider) => total + provider.ready_target_count, 0);
  const allTargets = data.providers.reduce((total, provider) => total + provider.target_count, 0);
  const isLoading = data.state === "loading";
  const isPending = (key: string) => data.pendingAction === key;

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

  useEffect(() => {
    if (location.hash !== "#provider-health-runs") {
      return;
    }
    const target = anchorRef.current;
    if (!target) {
      return;
    }
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start" });
    }
    target.focus();
  }, [location.hash]);

  const providerAction = (provider: ProvidersManagementSectionProps["data"]["providers"][number]) => {
    if (provider.next_action_kind === "connect_oauth") {
      return <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>{provider.next_action}</Link>;
    }
    if (provider.next_action_kind === "review_sync") {
      return <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>{provider.next_action}</Link>;
    }
    if (provider.next_action_kind === "activate_provider" && data.access.canMutate) {
      const pending = isPending(providerPendingKey("toggle", provider.provider));
      return (
        <button type="button" disabled={pending} onClick={() => void actions.toggleProvider(provider.provider, provider.enabled)}>
          {pending ? "Activating…" : "Activate"}
        </button>
      );
    }
    if (provider.next_action_kind === "sync_models" && data.access.canMutate) {
      const pending = isPending(providerPendingKey("sync", provider.provider));
      return (
        <button type="button" disabled={pending} onClick={() => void actions.syncProviderModels(provider.provider)}>
          {pending ? "Syncing…" : provider.next_action}
        </button>
      );
    }
    if (provider.next_action_kind === "run_health" && data.access.canMutate) {
      const pending = isPending("run-provider-health");
      return (
        <button type="button" disabled={pending} onClick={() => void actions.runHealthChecks()}>
          {pending ? "Checking…" : provider.next_action}
        </button>
      );
    }
    if (provider.next_action_kind === "edit_provider" && data.access.canMutate) {
      return <button type="button" onClick={() => setActiveProvider(provider.provider)}>{provider.next_action}</button>;
    }
    return <span className="fg-muted">{provider.next_action}</span>;
  };

  return (
    <SectionCard
      id="provider-health-runs"
      cardRef={anchorRef}
      tabIndex={-1}
      className={location.hash === "#provider-health-runs" ? "is-anchor-target" : ""}
      title="Providers"
      description="Manage provider records. Sync updates inventory; live endpoint probes run from Harness."
      actions={
        <>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
          <button type="button" disabled={isLoading} onClick={() => void actions.load()}>{isLoading ? "Refreshing…" : "Refresh"}</button>
          {data.access.canMutate ? (
            <button type="button" disabled={isPending("sync-all-providers")} onClick={() => void actions.syncAllProviders()}>
              {isPending("sync-all-providers") ? "Syncing all…" : "Sync all"}
            </button>
          ) : null}
          {data.access.canMutate ? (
            <button type="button" onClick={() => setShowAddProvider((current) => !current)}>
              {showAddProvider ? "Hide add form" : "Add provider"}
            </button>
          ) : null}
        </>
      }
    >
      <ActionFeedbackNotice feedback={data.actionFeedback} />

      <div className="fg-grid fg-grid-compact fg-mb-md">
        <MetricTile label="Registered" value={formatMetric(data.providers.length)} note={`${formatMetric(enabledProviders)} enabled`} />
        <MetricTile label="Runtime ready" value={formatMetric(readyProviders)} note={`${formatMetric(data.providers.length - readyProviders)} not ready`} />
        <MetricTile label="Needs attention" value={formatMetric(attentionProviders)} note="health or readiness" />
        <MetricTile label="Ready targets" value={`${formatMetric(readyTargets)} / ${formatMetric(allTargets)}`} note="details on Provider Targets" />
      </div>

      {showAddProvider ? (
        <div className="fg-subcard fg-mb-md">
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
                <button type="button" disabled={isPending("create-provider")} onClick={() => void actions.createProvider()}>
                  {isPending("create-provider") ? "Adding provider…" : "Add provider"}
                </button>
              </div>
              <p className="fg-note">Save endpoint/auth, sync inventory, then run a Harness live probe.</p>
            </div>
          ) : (
            <p className="fg-note">{data.access.summaryDetail}</p>
          )}
        </div>
      ) : null}

      <div className="fg-stack">
        {data.providers.map((provider) => {
          const isSelected = provider.provider === selectedProvider?.provider;
          return (
            <div key={provider.provider} className={`fg-subcard${isSelected ? " is-selected" : ""}`}>
              <div className="fg-panel-heading">
                <div>
                  <button className="fg-table-trigger" type="button" onClick={() => setActiveProvider(provider.provider)}>
                    <h4>{provider.label}</h4>
                  </button>
                  <p className="fg-muted">
                    <span className="fg-code">{provider.provider}</span> · {formatProviderClassLabel(String(provider.provider_class))} · {authTypeLabel(provider)}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill label={provider.enabled ? "enabled" : "disabled"} tone={provider.enabled ? "success" : "neutral"} />
                  <TonePill label={provider.ready ? "ready" : provider.runtime_readiness} tone={provider.ready ? "success" : toneFromReadinessAxis(provider.runtime_readiness)} />
                  <TonePill label={formatHealthLabel(provider.health_status)} tone={toneFromHealthStatus(provider.health_status)} />
                  {providerAction(provider)}
                </div>
              </div>
              <div className="fg-detail-grid">
                <p>Models: {formatMetric(provider.model_count)} · {visibleModels(provider)}</p>
                <p>Targets: {formatMetric(provider.ready_target_count)} ready / {formatMetric(provider.target_count)} total</p>
                <p>Last probe: {formatTimestamp(provider.last_probe_at)}</p>
                <p>{provider.ready ? "Runtime is ready." : provider.readiness_reason ?? "Runtime is not ready."}</p>
                <p className="fg-muted">{providerActionExplanation(provider)}</p>
              </div>
            </div>
          );
        })}
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

            <div className="fg-provider-action-plan fg-mb-md">
              <div>
                <strong>Next step</strong>
                <p>{providerActionExplanation(selectedProvider)}</p>
              </div>
              <div>
                <strong>Live endpoint test</strong>
                <p>
                  These buttons do not send chat/completions requests. Use Harness when you want to see LM Studio receive a real request.
                </p>
              </div>
              <div>
                <strong>Endpoint</strong>
                <p>{providerEndpointSummary(selectedDraft)}</p>
              </div>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>
                Open Harness live probe
              </Link>
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
                  <button
                    type="button"
                    disabled={isPending(providerPendingKey("save", selectedProvider.provider))}
                    onClick={() => void actions.saveProvider(selectedProvider.provider)}
                  >
                    {isPending(providerPendingKey("save", selectedProvider.provider)) ? "Saving…" : "Save provider"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending(providerPendingKey("sync", selectedProvider.provider))}
                    onClick={() => void actions.syncProviderModels(selectedProvider.provider)}
                  >
                    {isPending(providerPendingKey("sync", selectedProvider.provider)) ? "Syncing inventory…" : "Sync inventory"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending(providerPendingKey("toggle", selectedProvider.provider))}
                    onClick={() => void actions.toggleProvider(selectedProvider.provider, selectedProvider.enabled)}
                  >
                    {isPending(providerPendingKey("toggle", selectedProvider.provider))
                      ? selectedProvider.enabled
                        ? "Disabling…"
                        : "Enabling…"
                      : selectedProvider.enabled
                        ? "Disable"
                        : "Enable"}
                  </button>
                </>
              ) : null}
            </div>
            {data.access.canMutate ? (
              <p className="fg-note fg-mt-sm">
                Save endpoint/auth edits, sync inventory, then run a Harness probe for live proof.
              </p>
            ) : null}

            <ActionFeedbackNotice feedback={data.actionFeedback} />

            {selectedProvider.last_sync_error ? <p className="fg-danger fg-mt-sm">Last sync error: {selectedProvider.last_sync_error}</p> : null}
          </div>
        ) : null}
    </SectionCard>
  );
}
