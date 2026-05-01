import { Link } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { formatMetric } from "./providersShared";
import {
  MetricTile,
  SectionCard,
  type ProvidersManagementSectionProps,
} from "./providersSectionUtils";

/**
 * Overview section showing provider runtime inventory summary with metrics
 * for enabled/ready providers, health attention items, and navigation links
 * to related surfaces.
 */
export function ProvidersManagementOverviewSection({
  data,
  actions,
  instanceId,
}: ProvidersManagementSectionProps) {
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const readyProviders = data.providers.filter((provider) => provider.ready).length;
  const connectRequired = data.providers.filter((provider) => provider.oauth_connect_required).length;
  const healthAttention = data.providers.filter((provider) => provider.health_status !== "healthy").length;

  return (
    <SectionCard
      title="Provider Runtime Inventory"
      description="Live provider inventory, configuration, sync, compatibility, and health."
      actions={
        <>
          <button type="button" onClick={() => void actions.load()}>
            Refresh
          </button>
          {data.access.canMutate ? (
            <button type="button" onClick={() => void actions.syncAllProviders()}>
              Sync all providers
            </button>
          ) : null}
        </>
      }
    >
      <div className="fg-grid fg-grid-compact">
        <MetricTile label="Providers" value={formatMetric(data.providers.length)} note={`${formatMetric(enabledProviders)} enabled`} />
        <MetricTile label="Runtime ready" value={formatMetric(readyProviders)} note={`${formatMetric(connectRequired)} connect required`} />
        <MetricTile label="Health attention" value={formatMetric(healthAttention)} note={data.healthConfig ? `probe mode ${data.healthConfig.probe_mode}` : "no health config"} />
        <MetricTile
          label="Cross-reference"
          value="Harness + OAuth"
          note={instanceId ? `instance ${instanceId}` : "current control-plane scope"}
        />
      </div>

      {!data.access.canMutate ? (
        <p className="fg-note fg-mt-md">
          {data.access.summaryTitle}: {data.access.summaryDetail}
        </p>
      ) : null}

      <div className="fg-actions fg-mt-md">
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>
          Open Harness
        </Link>
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
          Open OAuth Targets
        </Link>
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
          Open Provider Targets
        </Link>
      </div>

      {data.error ? <p className="fg-danger fg-mt-md">{data.error}</p> : null}
    </SectionCard>
  );
}
