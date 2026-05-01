import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { formatMetric, toBooleanValue } from "./providersShared";
import { MetricTile, SectionCard } from "./providersSectionUtils";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

/**
 * Control-Plane summary section showing load state, enabled providers,
 * harness profiles, compatibility rows, OAuth targets, and clients.
 */
export function ProvidersOverviewSection({ data, actions }: SectionProps) {
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const readyProviders = data.providers.filter((provider) => provider.ready).length;
  const attentionProfiles = data.profiles.filter((profile) => profile.needs_attention).length;
  const readyCompatibilityRows = data.compatibilityMatrix.filter((row) => row.ready).length;
  const clientsNeedingAttention = data.clients.filter((client) => toBooleanValue(client.needs_attention)).length;
  const configuredOauthTargets = data.oauthTargets.filter((target) => toBooleanValue(target.configured)).length;

  return (
    <SectionCard
      title="Control-Plane Summary"
      description="Current runtime truth is separated from roadmap and onboarding targets. Live provider inventory and compatibility stay below, while harness profiles now live on the dedicated Harness route."
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
        <MetricTile label="Load state" value={data.state} note={data.state === "loading" ? "refresh in progress" : "last control-plane snapshot"} />
        <MetricTile label="Enabled providers" value={formatMetric(enabledProviders)} note={`${formatMetric(readyProviders)} ready for runtime use`} />
        <MetricTile label="Harness profiles" value={formatMetric(data.profiles.length)} note={`${formatMetric(attentionProfiles)} need operator attention`} />
        <MetricTile label="Compatibility rows" value={formatMetric(data.compatibilityMatrix.length)} note={`${formatMetric(readyCompatibilityRows)} ready now`} />
        <MetricTile label="OAuth targets configured" value={formatMetric(configuredOauthTargets)} note={`${formatMetric(data.oauthTotalOps)} persisted operations`} />
        <MetricTile label="Clients needing attention" value={formatMetric(clientsNeedingAttention)} note={`${formatMetric(data.clients.length)} client records loaded`} />
      </div>

      {!data.access.canMutate ? (
        <p className="fg-note fg-mt-md">
          {data.access.summaryTitle}: {data.access.summaryDetail}
        </p>
      ) : null}

      <p className="fg-note fg-mt-md">
        Runtime truth: provider cards, client view, and the compatibility matrix describe what the backend currently exposes here. Saved harness profiles and proof actions moved to the dedicated Harness module so this route no longer acts as the primary harness surface.
      </p>

      {data.error ? <p className="fg-danger">{data.error}</p> : null}
    </SectionCard>
  );
}
