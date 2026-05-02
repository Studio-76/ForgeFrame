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
  formatProviderClassLabel,
  type ProvidersManagementSectionProps,
  ProviderClassFields,
  TonePill,
  toneFromReadinessAxis,
} from "./providersSectionUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PrimaryStatus = "ready" | "needs-attention" | "partial" | "disabled" | "misconfigured";

function primaryStatus(provider: ProvidersManagementSectionProps["data"]["providers"][number]): PrimaryStatus {
  if (!provider.enabled) {
    return "disabled";
  }
  if (provider.ready) {
    return "ready";
  }
  if (provider.health_status === "error" || provider.health_status === "attention") {
    return "needs-attention";
  }
  if (provider.ready_target_count > 0 && !provider.ready) {
    return "partial";
  }
  if (provider.last_sync_error || provider.oauth_connect_required) {
    return "misconfigured";
  }
  return "needs-attention";
}

const STATUS_LABEL: Record<PrimaryStatus, string> = {
  ready: "Ready",
  "needs-attention": "Needs attention",
  partial: "Partial",
  disabled: "Disabled",
  misconfigured: "Misconfigured",
};

const STATUS_TONE: Record<PrimaryStatus, "success" | "warning" | "danger" | "neutral"> = {
  ready: "success",
  "needs-attention": "warning",
  partial: "warning",
  disabled: "neutral",
  misconfigured: "danger",
};

function visibleModels(provider: ProvidersManagementSectionProps["data"]["providers"][number]): string {
  const models = provider.models.slice(0, 2).map((model) => model.id);
  if (models.length === 0) {
    return "No models recorded";
  }
  return models.join(", ");
}

function nextActionExplanation(
  provider: ProvidersManagementSectionProps["data"]["providers"][number],
): string {
  switch (provider.next_action_kind) {
    case "sync_models":
      return "Sync provider inventory to refresh model list and targets.";
    case "run_health":
      return "Run health checks to update provider status badges.";
    case "activate_provider":
      return "Enable this provider to allow routing through it.";
    case "review_sync":
      return "Routing is blocked — provider targets need a ready target.";
    case "connect_oauth":
      return "Connect the account on OAuth Targets before routing.";
    case "edit_provider":
      return "Review and save the provider configuration first.";
    default:
      return provider.next_action;
  }
}

function primaryBlockerText(providers: ProvidersManagementSectionProps["data"]["providers"]): string | null {
  const attentionProviders = providers.filter((p) => p.enabled && !p.ready);
  if (attentionProviders.length === 0) {
    return null;
  }
  const first = attentionProviders[0];
  if (first.readiness_reason) {
    return first.readiness_reason;
  }
  if (first.oauth_connect_required) {
    return `${first.label} needs an OAuth connection.`;
  }
  return `${first.label} is not ready for routing.`;
}

function recommendedAction(providers: ProvidersManagementSectionProps["data"]["providers"]): string | null {
  const attentionProviders = providers.filter((p) => p.enabled && !p.ready);
  if (attentionProviders.length === 0) {
    return null;
  }
  const first = attentionProviders[0];
  return `${first.label}: ${first.next_action}`;
}

function formatLastProbe(provider: ProvidersManagementSectionProps["data"]["providers"][number]): string {
  if (provider.last_probe_at) {
    return formatTimestamp(provider.last_probe_at);
  }
  if (provider.health_status === "not-run") {
    return "Not probed";
  }
  return "Never";
}

// ---------------------------------------------------------------------------
// Provider Readiness Hero
// ---------------------------------------------------------------------------

function ProviderReadinessHero({
  providers,
}: {
  providers: ProvidersManagementSectionProps["data"]["providers"];
}) {
  const total = providers.length;
  const enabledCount = providers.filter((p) => p.enabled).length;
  const readyCount = providers.filter((p) => p.ready).length;
  const attentionCount = providers.filter((p) => p.enabled && !p.ready).length;
  const blocker = primaryBlockerText(providers);
  const nextAction = recommendedAction(providers);

  return (
    <div className="ff-status-hero">
      <div className="ff-status-hero-top">
        <p className="ff-status-hero-label">Provider Readiness</p>
        <div className="ff-status-hero-stats">
          <span>{formatMetric(total)} total</span>
          <span>{formatMetric(enabledCount)} enabled</span>
          <span>{formatMetric(readyCount)} runtime-ready</span>
          {attentionCount > 0 ? <span>{formatMetric(attentionCount)} needs attention</span> : null}
        </div>
      </div>
      {blocker ? (
        <p className="ff-status-hero-line">
          Blocked: {blocker}
        </p>
      ) : null}
      {nextAction ? (
        <div className="ff-next-step" data-tone="warning">
          <span className="ff-next-step-label">Next:</span> {nextAction}
        </div>
      ) : (
        <div className="ff-status-hero-actions">
          <span className="ff-status-hero-actions-hint">All providers are ready.</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info boxes for the detail panel view mode
// ---------------------------------------------------------------------------

function DetailInfoBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger" | "success";
}) {
  return (
    <div className={`ff-next-step${tone ? `" data-tone="${tone}` : ""}`} style={{ padding: "0.5rem 0.85rem", fontSize: "var(--fg-type-size-meta)" }}>
      <span className="ff-next-step-label">{label}:</span> {value}
    </div>
  );
}

function providerEndpointSummary(
  draft: ProvidersManagementSectionProps["data"]["providerDrafts"][string],
): string {
  if (draft.providerClass === "oauth_account") {
    return "OAuth account bridge — connect the account on OAuth Targets before probing.";
  }
  return draft.endpointBaseUrl.trim()
    ? `Endpoint: ${draft.endpointBaseUrl.trim()}`
    : "No endpoint URL set.";
}

// ---------------------------------------------------------------------------
// Confirm dialog helper
// ---------------------------------------------------------------------------

function confirmDestructive(action: string, label: string): boolean {
  return window.confirm(`Are you sure you want to ${action} "${label}"? This action cannot be undone.`);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Provider registry section with a readiness hero, compact provider grid,
 * expandable detail panel, view/edit modes, and grouped actions.
 * Designed as a provider setup and readiness workflow rather than a
 * provider database editor.
 */
export function ProvidersInventoryTableSection({ data, actions, instanceId }: ProvidersManagementSectionProps) {
  const location = useLocation();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(data.providers[0]?.provider ?? null);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const selectedProvider = data.providers.find((p) => p.provider === activeProvider) ?? data.providers[0] ?? null;
  const selectedDraft = selectedProvider ? data.providerDrafts[selectedProvider.provider] : null;
  const selectedStatus = selectedProvider ? primaryStatus(selectedProvider) : "disabled";
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

  const handleSelectProvider = (provider: string) => {
    setActiveProvider((current) => (current === provider ? null : provider));
    setEditMode(false);
  };

  const handleToggleProvider = (provider: string, enabled: boolean) => {
    if (enabled && !confirmDestructive("disable", provider)) {
      return;
    }
    void actions.toggleProvider(provider, enabled);
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

  return (
    <div
      id="provider-health-runs"
      ref={anchorRef}
      tabIndex={-1}
      className={location.hash === "#provider-health-runs" ? "is-anchor-target" : ""}
    >
      {/* Status hero */}
      <div className="fg-stack">
        <ProviderReadinessHero providers={data.providers} />

        {/* Action groups */}
        <div className="ff-action-controls">
          <span style={{ fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            Page
          </span>
          <button type="button" className="ff-action-chip" disabled={isLoading} onClick={() => void actions.load()}>
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="ff-action-controls">
          <span style={{ fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            Provider
          </span>
          {data.access.canMutate ? (
            <button type="button" className="ff-action-chip" onClick={() => { setShowAddProvider((current) => !current); setEditMode(false); }}>
              {showAddProvider ? "Hide add form" : "Add provider"}
            </button>
          ) : null}
          {selectedProvider && data.access.canMutate ? (
            <button type="button" className="ff-action-chip" disabled={!selectedProvider} onClick={() => setEditMode((current) => !current)}>
              {editMode ? "View provider" : "Edit provider"}
            </button>
          ) : null}
        </div>

        <div className="ff-action-controls">
          <span style={{ fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            Sync
          </span>
          {selectedProvider && data.access.canMutate ? (
            <button
              type="button"
              className="ff-action-chip"
              disabled={isPending(`sync-provider:${selectedProvider.provider}`)}
              onClick={() => void actions.syncProviderModels(selectedProvider.provider)}
            >
              {isPending(`sync-provider:${selectedProvider.provider}`) ? "Syncing…" : "Sync inventory"}
            </button>
          ) : null}
          {data.access.canMutate ? (
            <button type="button" className="ff-action-chip" disabled={isPending("sync-all-providers")} onClick={() => void actions.syncAllProviders()}>
              {isPending("sync-all-providers") ? "Syncing all…" : "Sync all providers"}
            </button>
          ) : null}
        </div>

        <div className="ff-action-controls">
          <span style={{ fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            Diagnostics
          </span>
          {selectedProvider ? (
            <Link className="ff-action-chip" style={{ textDecoration: "none" }} to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>
              Run provider probe
            </Link>
          ) : null}
          {selectedProvider?.next_action_kind === "review_sync" ? (
            <Link className="ff-action-chip" style={{ textDecoration: "none" }} to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
              Review sync issues
            </Link>
          ) : null}
        </div>

        <div className="ff-nav-links">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
        </div>

        <ActionFeedbackNotice feedback={data.actionFeedback} />

        {/* Add provider form */}
        {showAddProvider && data.access.canMutate ? (
          <div className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Add provider</h4>
                <p className="fg-muted">Register a new AI backend provider for this instance.</p>
              </div>
            </div>
            <div className="fg-inline-form">
              <label>
                Provider key
                <input
                  value={data.newProvider.provider}
                  onChange={(event) => actions.setNewProvider((current) => ({ ...current, provider: event.target.value }))}
                  placeholder="e.g. my_openai"
                />
              </label>
              <label>
                Label
                <input
                  value={data.newProvider.label}
                  onChange={(event) => actions.setNewProvider((current) => ({ ...current, label: event.target.value }))}
                  placeholder="e.g. My OpenAI Gateway"
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
                <button type="button" className="ff-primary-action" disabled={isPending("create-provider")} onClick={() => void actions.createProvider()}>
                  {isPending("create-provider") ? "Adding provider…" : "Add provider"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!data.access.canMutate ? (
          <p className="fg-note">{data.access.summaryDetail}</p>
        ) : null}

        {/* Provider grid */}
        {data.providers.length === 0 ? (
          <div className="fg-provider-empty">
            <p>No providers registered. Add a provider to get started.</p>
          </div>
        ) : (
          <div className="fg-provider-grid">
            <div className="fg-provider-row-header">
              <span>Provider</span>
              <span>Type</span>
              <span>Status</span>
              <span>Last probe</span>
              <span>Targets</span>
              <span>Next action</span>
            </div>

            {data.providers.map((provider) => {
              const status = primaryStatus(provider);
              const isSelected = provider.provider === selectedProvider?.provider;

              return (
                <div key={provider.provider}>
                  {/* Summary row */}
                  <div
                    className={`fg-provider-row-clickable${isSelected ? " is-selected" : ""}`}
                    onClick={() => handleSelectProvider(provider.provider)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectProvider(provider.provider);
                      }
                    }}
                    aria-expanded={isSelected}
                    aria-label={`${provider.label} — ${STATUS_LABEL[status]}`}
                  >
                    <div className="fg-provider-cell fg-provider-cell-name">
                      <span className="fg-provider-name-label">{provider.label}</span>
                      <span className="fg-provider-name-key">{provider.provider}</span>
                    </div>
                    <div className="fg-provider-cell">
                      {formatProviderClassLabel(String(provider.provider_class))}
                    </div>
                    <div className="fg-provider-cell fg-provider-cell-status">
                      <TonePill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
                    </div>
                    <div className="fg-provider-cell">
                      {formatLastProbe(provider)}
                    </div>
                    <div className="fg-provider-cell">
                      {formatMetric(provider.ready_target_count)} / {formatMetric(provider.target_count)} ready
                    </div>
                    <div className="fg-provider-cell">
                      {providerAction(provider, data, actions, instanceId, isPending)}
                    </div>
                  </div>

                  {/* Detail panel — shown for selected provider */}
                  {isSelected && selectedDraft ? (
                    <div className="fg-provider-detail-panel">
                      <div className="fg-provider-detail-body">
                        {/* Mode indicator */}
                        <div className="fg-provider-detail-section">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="fg-provider-detail-label">
                              {editMode ? "Edit mode" : "View mode"}
                            </span>
                            <span className="fg-provider-mode-indicator">
                              {editMode ? "Editing" : "Viewing"} · {selectedProvider.label}
                            </span>
                          </div>
                        </div>

                        {/* State summary (always visible) */}
                        <div className="fg-provider-detail-section">
                          <span className="fg-provider-detail-label">Current state</span>
                          <p className="fg-provider-detail-value">
                            <TonePill label={STATUS_LABEL[selectedStatus]} tone={STATUS_TONE[selectedStatus]} />
                            {selectedProvider.ready
                              ? " Provider is runtime-ready."
                              : ` ${selectedProvider.readiness_reason ?? "Provider is not ready for routing."}`}
                          </p>
                        </div>

                        {/* Why it matters */}
                        <div className="fg-provider-detail-section">
                          <span className="fg-provider-detail-label">Why it matters</span>
                          <p className="fg-provider-detail-meta">
                            {selectedProvider.ready
                              ? "This provider can serve runtime requests through enabled targets."
                              : !selectedProvider.enabled
                                ? "Disabled providers cannot serve requests. Enable the provider to start routing."
                                : selectedProvider.oauth_connect_required
                                  ? "An OAuth connection is required before this provider can route requests."
                                  : selectedProvider.ready_target_count === 0
                                    ? "No targets are ready. Sync the provider inventory and check Provider Targets for readiness."
                                    : "This provider has partial readiness — check the blocking conditions below."}
                          </p>
                        </div>

                        {/* Blocking checks */}
                        {!selectedProvider.ready ? (
                          <div className="fg-provider-detail-section">
                            <span className="fg-provider-detail-label">Blocking checks</span>
                            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)" }}>
                              {!selectedProvider.enabled ? (
                                <li>Provider is disabled — enable it to allow routing.</li>
                              ) : null}
                              {selectedProvider.oauth_connect_required ? (
                                <li>OAuth connection required. Open OAuth Targets to connect.</li>
                              ) : null}
                              {selectedProvider.ready_target_count === 0 ? (
                                <li>No ready targets. Sync inventory and check Provider Targets.</li>
                              ) : null}
                              {selectedProvider.last_sync_error ? (
                                <li>Last sync failed: {selectedProvider.last_sync_error}</li>
                              ) : null}
                              {!selectedProvider.ready && selectedProvider.readiness_reason ? (
                                <li>{selectedProvider.readiness_reason}</li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}

                        {/* Recommended next action */}
                        {!selectedProvider.ready ? (
                          <div className="fg-provider-detail-section">
                            <span className="fg-provider-detail-label">Recommended next action</span>
                            <div className="ff-next-step" data-tone={selectedProvider.next_action_kind === "sync_models" ? "warning" : "danger"}>
                              <span className="ff-next-step-label">{selectedProvider.next_action}</span>
                              <span style={{ fontWeight: 400 }}> — {nextActionExplanation(selectedProvider)}</span>
                            </div>
                          </div>
                        ) : null}

                        {/* Last probe result */}
                        <div className="fg-provider-detail-section">
                          <span className="fg-provider-detail-label">Last probe result</span>
                          <p className="fg-provider-detail-meta">
                            {provider.last_probe_at
                              ? `Probed ${formatTimestamp(provider.last_probe_at)} · health: ${provider.health_status}`
                              : "No probe recorded yet."}
                          </p>
                        </div>

                        {/* Target readiness */}
                        <div className="fg-provider-detail-section">
                          <span className="fg-provider-detail-label">Target readiness</span>
                          <p className="fg-provider-detail-meta">
                            {formatMetric(selectedProvider.ready_target_count)} ready / {formatMetric(selectedProvider.enabled_target_count)} enabled / {formatMetric(selectedProvider.target_count)} total
                          </p>
                        </div>

                        {/* Technical details — collapsed by default */}
                        <details className="ff-collapse-section" style={{ marginTop: "var(--fg-space-3)" }}>
                          <summary>
                            <span className="ff-collapse-summary-text">
                              <h4>Technical details</h4>
                              <p>Provider key, integration class, template, endpoint, auth, timestamps</p>
                            </span>
                          </summary>
                          <div className="ff-collapse-section-body">
                            <div className="fg-detail-grid">
                              <p>Key: {provider.provider}</p>
                              <p>Integration class: {provider.integration_class}</p>
                              <p>Template: {provider.template_id ?? "-"}</p>
                              <p>Endpoint: {provider.config.endpoint_base_url ?? "-"}</p>
                              <p>Auth: {authTypeLabel(provider)}</p>
                              <p>Contract: {provider.contract_classification.replaceAll("-", " ")}</p>
                              <p>Runtime axis: {provider.runtime_readiness} · Streaming axis: {provider.streaming_readiness}</p>
                              <p>Models: {formatMetric(provider.model_count)} · {visibleModels(provider)}</p>
                              <p>Last sync: {formatTimestamp(provider.last_sync_at)} · {provider.last_sync_status}</p>
                              {provider.last_sync_error ? <p className="fg-danger">Sync error: {provider.last_sync_error}</p> : null}
                              <p>Harness proof: {provider.harness_proof_status}</p>
                            </div>
                          </div>
                        </details>

                        {/* Edit form — only visible in edit mode */}
                        {editMode && data.access.canMutate ? (
                          <div className="fg-provider-detail-section" style={{ marginTop: "var(--fg-space-3)" }}>
                            <span className="fg-provider-detail-label">Edit provider</span>
                            <div className="fg-inline-form">
                              <label>
                                Label
                                <input
                                  value={selectedDraft.label}
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
                                onProviderClassChange={(providerClass) => applyProviderClassToEditDraft(selectedProvider.provider, providerClass)}
                                onFieldChange={(field, value) => actions.setProviderDraftField(selectedProvider.provider, field, value)}
                              />
                            </div>
                          </div>
                        ) : null}

                        {/* Action buttons */}
                        {data.access.canMutate ? (
                          <div className="fg-provider-detail-actions">
                            <span style={{ fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                              Actions
                            </span>
                            {editMode ? (
                              <button
                                type="button"
                                className="ff-primary-action"
                                disabled={isPending(`save-provider:${selectedProvider.provider}`)}
                                onClick={() => void actions.saveProvider(selectedProvider.provider)}
                              >
                                {isPending(`save-provider:${selectedProvider.provider}`) ? "Saving…" : "Save provider"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="ff-action-chip"
                              disabled={isPending(`sync-provider:${selectedProvider.provider}`)}
                              onClick={() => void actions.syncProviderModels(selectedProvider.provider)}
                            >
                              {isPending(`sync-provider:${selectedProvider.provider}`) ? "Syncing…" : "Sync inventory"}
                            </button>
                            <button
                              type="button"
                              className="ff-action-chip"
                              disabled={isPending(`toggle-provider:${selectedProvider.provider}`)}
                              onClick={() => handleToggleProvider(selectedProvider.provider, selectedProvider.enabled)}
                            >
                              {isPending(`toggle-provider:${selectedProvider.provider}`)
                                ? selectedProvider.enabled
                                  ? "Disabling…"
                                  : "Enabling…"
                                : selectedProvider.enabled
                                  ? "Disable"
                                  : "Enable"}
                            </button>
                          </div>
                        ) : null}

                        {/* Endpoint summary */}
                        <p className="fg-provider-detail-meta" style={{ marginTop: "var(--fg-space-2)" }}>
                          {providerEndpointSummary(selectedDraft)}
                        </p>

                        {/* Navigation links */}
                        <div className="fg-provider-detail-nav">
                          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>
                            Run provider probe
                          </Link>
                          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
                            Provider Targets
                          </Link>
                          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
                            OAuth Targets
                          </Link>
                        </div>

                        <ActionFeedbackNotice feedback={data.actionFeedback} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {data.error && !data.actionFeedback ? <p className="fg-danger" role="alert">{data.error}</p> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider action renderer — what button or link to show for the next action
// ---------------------------------------------------------------------------

function providerAction(
  provider: ProvidersManagementSectionProps["data"]["providers"][number],
  data: ProvidersManagementSectionProps["data"],
  actions: ProvidersManagementSectionProps["actions"],
  instanceId: ProvidersManagementSectionProps["instanceId"],
  isPending: (key: string) => boolean,
) {
  const pending = (key: string) => isPending(key);

  if (provider.next_action_kind === "connect_oauth") {
    return <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)} style={{ fontSize: "0.75rem" }}>{provider.next_action}</Link>;
  }
  if (provider.next_action_kind === "review_sync") {
    return <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)} style={{ fontSize: "0.75rem" }}>{provider.next_action}</Link>;
  }
  if (provider.next_action_kind === "activate_provider" && data.access.canMutate) {
    return (
      <button
        type="button"
        className="fg-provider-next-action"
        disabled={pending(`toggle-provider:${provider.provider}`)}
        onClick={(e) => { e.stopPropagation(); void actions.toggleProvider(provider.provider, provider.enabled); }}
      >
        {pending(`toggle-provider:${provider.provider}`) ? "Activating…" : "Activate"}
      </button>
    );
  }
  if (provider.next_action_kind === "sync_models" && data.access.canMutate) {
    return (
      <button
        type="button"
        className="fg-provider-next-action"
        disabled={pending(`sync-provider:${provider.provider}`)}
        onClick={(e) => { e.stopPropagation(); void actions.syncProviderModels(provider.provider); }}
      >
        {pending(`sync-provider:${provider.provider}`) ? "Syncing…" : provider.next_action}
      </button>
    );
  }
  if (provider.next_action_kind === "run_health" && data.access.canMutate) {
    return (
      <button
        type="button"
        className="fg-provider-next-action"
        disabled={pending("run-provider-health")}
        onClick={(e) => { e.stopPropagation(); void actions.runHealthChecks(); }}
      >
        {pending("run-provider-health") ? "Checking…" : provider.next_action}
      </button>
    );
  }
  if (provider.next_action_kind === "edit_provider" && data.access.canMutate) {
    return <span className="fg-muted" style={{ fontSize: "0.75rem" }}>{provider.next_action}</span>;
  }
  return <span className="fg-muted" style={{ fontSize: "0.75rem" }}>{provider.next_action}</span>;
}
