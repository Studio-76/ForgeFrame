import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import type { HealthConfig } from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { asRecord, formatMetric, formatTimestamp, toStringValue } from "./providersShared";
import {
  authTypeLabel,
  formatHarnessMode,
  formatHealthLabel,
  latestRunForProfile,
  MetricTile,
  SectionCard,
  TonePill,
  toneFromHealthStatus,
} from "./providersSectionUtils";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

type ProviderHealthSectionProps = SectionProps & {
  instanceId?: string | null;
};

function representativeProviderModel(
  provider: ProvidersPageData["providers"][number],
  latestRun: ProvidersPageData["runs"][number] | null,
): string {
  if (latestRun?.model) {
    return latestRun.model;
  }
  const attentionModel = provider.models.find((model) => model.health_status !== "healthy");
  if (attentionModel?.id) {
    return attentionModel.id;
  }
  return provider.models[0]?.id ?? "No model recorded";
}

function latestProviderError(
  provider: ProvidersPageData["providers"][number],
  latestRun: ProvidersPageData["runs"][number] | null,
): string {
  if (latestRun?.error) {
    return latestRun.error;
  }
  const modelError = provider.models.find((model) => model.status_reason)?.status_reason;
  if (modelError) {
    return modelError;
  }
  if (provider.last_sync_error) {
    return provider.last_sync_error;
  }
  if (provider.oauth_connect_required) {
    return "OAuth connection required before provider health can succeed.";
  }
  return provider.readiness_reason ?? "No error recorded";
}

function providerSetupLink(provider: ProvidersPageData["providers"][number], instanceId?: string | null): {
  label: string;
  to: string;
} {
  if (provider.oauth_connect_required || provider.next_action_kind === "connect_oauth") {
    return {
      label: "Open OAuth Targets",
      to: withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId),
    };
  }
  if (provider.target_count === 0 || provider.ready_target_count === 0 || provider.next_action_kind === "review_sync") {
    return {
      label: "Open Provider Targets",
      to: withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId),
    };
  }
  return {
    label: "Open Provider Inventory",
    to: withInstanceScope(`${CONTROL_PLANE_ROUTES.providers}#provider-inventory`, instanceId),
  };
}

function formatHealthRunTimestamp(
  provider: ProvidersPageData["providers"][number],
  latestRun: ProvidersPageData["runs"][number] | null,
): string {
  if (latestRun) {
    return `${formatHarnessMode(latestRun.mode)} · ${formatTimestamp(latestRun.executed_at)}`;
  }
  if (provider.last_health_check_at) {
    return `provider check · ${formatTimestamp(provider.last_health_check_at)}`;
  }
  if (provider.last_probe_at) {
    return `probe only · ${formatTimestamp(provider.last_probe_at)}`;
  }
  return "No run recorded";
}

/**
 * Provider health and runs section displaying probe status, health config
 * controls, run history, and detailed per-provider diagnostics.
 */
export function ProviderHealthSection({ data, actions, instanceId }: ProviderHealthSectionProps) {
  const location = useLocation();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const healthyProviders = data.providers.filter((provider) => provider.health_status === "healthy").length;
  const notRunProviders = data.providers.filter((provider) => provider.health_status === "not-run").length;
  const attentionProviders = data.providers.filter((provider) => provider.health_status === "attention" || provider.health_status === "error");
  const providerHealthEnabled = data.healthConfig?.provider_health_enabled ?? false;
  const modelHealthEnabled = data.healthConfig?.model_health_enabled ?? false;
  const latestFailedRun = asRecord(data.runOps.last_failed_run);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>(attentionProviders[0]?.provider ?? data.providers[0]?.provider ?? "");

  useEffect(() => {
    const nextSelectedKey = attentionProviders[0]?.provider ?? data.providers[0]?.provider ?? "";
    if (!data.providers.some((provider) => provider.provider === selectedProviderKey)) {
      setSelectedProviderKey(nextSelectedKey);
    }
  }, [attentionProviders, data.providers, selectedProviderKey]);

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

  const selectedProvider = data.providers.find((provider) => provider.provider === selectedProviderKey) ?? data.providers[0] ?? null;
  const selectedProviderRun = selectedProvider ? latestRunForProfile(selectedProvider.provider, data.runs, data.runOps) : null;
  const selectedProviderSetup = selectedProvider ? providerSetupLink(selectedProvider, instanceId) : null;
  const selectedProviderError = selectedProvider ? latestProviderError(selectedProvider, selectedProviderRun) : "No provider selected.";

  return (
    <SectionCard
      id="provider-health-runs"
      cardRef={anchorRef}
      tabIndex={-1}
      className={location.hash === "#provider-health-runs" ? "is-anchor-target" : ""}
      title="Provider Health & Runs"
      description="Latest probe results, health check configuration, and run history for each provider."
      actions={
        <>
          {data.access.canMutate ? (
            <button type="button" onClick={() => void actions.runHealthChecks()}>
              Run health now
            </button>
          ) : null}
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
            Open OAuth Targets
          </Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
            Open Provider Targets
          </Link>
        </>
      }
    >
      <div className="fg-grid fg-grid-compact fg-mb-md">
        <MetricTile label="Healthy" value={formatMetric(healthyProviders)} note={`${formatMetric(attentionProviders.length)} need attention`} />
        <MetricTile label="Not run" value={formatMetric(notRunProviders)} note={data.healthConfig ? `${data.healthConfig.interval_seconds}s interval` : "no health config"} />
        <MetricTile label="Model checks" value={modelHealthEnabled ? "enabled" : "disabled"} note={providerHealthEnabled ? "provider checks enabled" : "provider checks disabled"} />
        <MetricTile
          label="Last failed run"
          value={toStringValue(latestFailedRun?.status, "none")}
          note={latestFailedRun ? `${formatTimestamp(toStringValue(latestFailedRun.executed_at, ""))} · ${toStringValue(latestFailedRun.provider_key, "unknown provider")}` : "no failed run recorded"}
        />
      </div>

      {data.access.canMutate && data.healthConfig ? (
        <div className="fg-inline-form fg-mb-md">
          <label>
            Provider checks
            <select
              value={providerHealthEnabled ? "enabled" : "disabled"}
              onChange={(event) => void actions.updateHealth({ provider_health_enabled: event.target.value === "enabled" })}
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Model checks
            <select
              value={modelHealthEnabled ? "enabled" : "disabled"}
              onChange={(event) => void actions.updateHealth({ model_health_enabled: event.target.value === "enabled" })}
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Probe mode
            <select value={data.healthConfig.probe_mode} onChange={(event) => void actions.updateHealth({ probe_mode: event.target.value as HealthConfig["probe_mode"] })}>
              <option value="provider">provider</option>
              <option value="discovery">discovery</option>
              <option value="synthetic_probe">synthetic probe</option>
            </select>
          </label>
          <label>
            Interval seconds
            <input
              type="number"
              min={30}
              value={data.healthConfig.interval_seconds}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (Number.isFinite(nextValue) && nextValue >= 30) {
                  void actions.updateHealth({ interval_seconds: nextValue });
                }
              }}
            />
          </label>
        </div>
      ) : null}

      <div className="fg-table-wrap">
        <table className="fg-table" aria-label="Provider health and runs">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Target / model</th>
              <th>Last run</th>
              <th>Status</th>
              <th>Error</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((provider) => {
              const latestRun = latestRunForProfile(provider.provider, data.runs, data.runOps);
              const setupLink = providerSetupLink(provider, instanceId);
              const isSelected = provider.provider === selectedProvider?.provider;
              return (
              <tr key={provider.provider} className={isSelected ? "is-selected" : ""}>
                <td>
                  <button className="fg-table-trigger" type="button" onClick={() => setSelectedProviderKey(provider.provider)}>
                    <strong>{provider.label}</strong>
                  </button>
                  <div className="fg-muted">{provider.provider}</div>
                  <div className="fg-muted">{authTypeLabel(provider)}</div>
                </td>
                <td>
                  <strong>{representativeProviderModel(provider, latestRun)}</strong>
                  <div className="fg-muted">
                    {formatMetric(provider.ready_target_count)} ready / {formatMetric(provider.enabled_target_count)} enabled / {formatMetric(provider.target_count)} targets
                  </div>
                </td>
                <td>
                  {formatHealthRunTimestamp(provider, latestRun)}
                  <div className="fg-muted">probe {formatTimestamp(provider.last_probe_at)}</div>
                </td>
                <td>
                  <TonePill label={formatHealthLabel(provider.health_status)} tone={toneFromHealthStatus(provider.health_status)} />
                  <div className="fg-muted">
                    {latestRun ? `${formatHarnessMode(latestRun.mode)} · ${latestRun.status}` : provider.runtime_readiness}
                  </div>
                </td>
                <td>
                  {latestProviderError(provider, latestRun)}
                  <div className="fg-muted">{provider.ready ? "runtime ready" : provider.readiness_reason ?? "runtime not ready"}</div>
                </td>
                <td>
                  <div className="fg-actions">
                    {provider.next_action_kind === "run_health" && data.access.canMutate ? (
                      <button type="button" onClick={() => void actions.runHealthChecks()}>
                        {provider.next_action}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setSelectedProviderKey(provider.provider)}>
                      Show probe
                    </button>
                    <Link className="fg-nav-link" to={setupLink.to}>
                      {setupLink.label}
                    </Link>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {selectedProvider ? (
        <div className="fg-subcard fg-mt-md">
          <div className="fg-panel-heading">
            <div>
              <h4>{selectedProvider.label}</h4>
              <p className="fg-muted">
                {selectedProviderRun
                  ? `Latest run ${formatHarnessMode(selectedProviderRun.mode)} at ${formatTimestamp(selectedProviderRun.executed_at)}`
                  : `No harness run recorded. Last provider signal ${formatTimestamp(selectedProvider.last_health_check_at ?? selectedProvider.last_probe_at)}`}
              </p>
            </div>
            <div className="fg-actions">
              <TonePill label={formatHealthLabel(selectedProvider.health_status)} tone={toneFromHealthStatus(selectedProvider.health_status)} />
              {selectedProviderSetup ? (
                <Link className="fg-nav-link" to={selectedProviderSetup.to}>
                  {selectedProviderSetup.label}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="fg-detail-grid">
            <p>
              Target/model: {representativeProviderModel(selectedProvider, selectedProviderRun)} · last probe {formatTimestamp(selectedProvider.last_probe_at)}
            </p>
            <p>
              Latest run status: {selectedProviderRun ? `${selectedProviderRun.status} · ${toStringValue(selectedProviderRun.error, "no run error")}` : "not-ready"}
            </p>
            <p>
              Next action: {selectedProvider.next_action} · ready targets {formatMetric(selectedProvider.ready_target_count)}
            </p>
            <p>Error handoff: {selectedProviderError}</p>
          </div>
          <div className="fg-actions">
            {data.access.canMutate ? (
              <button type="button" onClick={() => void actions.runHealthChecks()}>
                Run health now
              </button>
            ) : null}
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
              Open OAuth Targets
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
              Open Provider Targets
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(`${CONTROL_PLANE_ROUTES.providers}#provider-inventory`, instanceId)}>
              Open Provider Inventory
            </Link>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
