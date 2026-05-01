import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { BlockedState, EmptyState } from "../components/ui/StateBlocks";
import {
  ProviderHealthSection,
  ProvidersAdvancedDiagnosticsSection,
  ProvidersInventoryTableSection,
  ProvidersManagementOverviewSection,
} from "../features/providers/ProvidersSections";
import type { ProvidersPageActions, ProvidersPageData } from "../features/providers/providersShared";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

/**
 * Quick-setup form shown when no providers exist yet.
 * Walks the user through adding the first provider record.
 */
function FirstProviderSetupCard({
  data,
  actions,
  instanceId,
}: {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
  instanceId?: string | null;
}) {
  return (
    <div className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Set up your first provider</h3>
          <p className="fg-muted">
            A provider tells ForgeFrame which AI backend to talk to — an OpenAI-compatible API, a local Ollama instance,
            or an account-connected provider. Add one to get started.
          </p>
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
        <label>
          Endpoint URL
          <input
            value={data.newProvider.endpointBaseUrl}
            onChange={(event) => actions.setNewProvider((current) => ({ ...current, endpointBaseUrl: event.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
        </label>
      </div>
      <div className="fg-actions fg-mt-sm">
        <button type="button" onClick={() => void actions.createProvider()}>
          Add provider
        </button>
      </div>
      {data.error ? <p className="fg-danger fg-mt-sm">{data.error}</p> : null}
    </div>
  );
}

export function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const access = getProvidersAccess(session, sessionReady, instanceId);
  const { data, actions } = useProvidersControlPlane(access, instanceId, {
    includeUsageSummary: false,
    includeHarness: true,
    includeOauthTargets: false,
    includeCompatibilityMatrix: false,
    includeBootstrapReadiness: false,
    includeClientView: false,
  });
  const hasProviders = data.providers.length > 0;

  const note = !access.canRead
    ? access.summaryDetail
    : access.canMutate
    ? hasProviders
      ? "Provider records, health checks, and target configuration. Harness verification and OAuth provider setup live on their dedicated pages."
      : "Start by adding a provider record — this tells the instance which AI backend to use."
    : `${access.summaryDetail} Provider truth and health stay visible here without surfacing mutations that the backend will block.`;

  const description = hasProviders
    ? "Provider records tell ForgeFrame which AI backends are available — API gateways, local models, or OAuth-connected accounts. Each provider tracks health, readiness, and runtime compatibility."
    : "Provider records tell ForgeFrame which AI backends are available. Add one to start routing requests through this instance.";

  const question = hasProviders
    ? "Select a provider from the inventory below to inspect or edit its configuration."
    : undefined;

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Providers"
        description={description}
        question={question}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note={note}
      />
      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="provider control-plane truth"
        onInstanceChange={onInstanceChange}
      />
      {!access.canRead ? (
        <BlockedState
          title={access.summaryTitle}
          description={access.summaryDetail}
          badgeLabel={access.badgeLabel}
          status="blocked"
        />
      ) : !hasProviders && data.state === "success" ? (
        <>
          <FirstProviderSetupCard data={data} actions={actions} instanceId={instanceId} />
          <ActionBar title="Related surfaces" description="Explore once you have providers set up.">
            <div className="fg-actions">
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
            </div>
          </ActionBar>
        </>
      ) : (
        <>
          <ActionBar>
            <div className="fg-actions">
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
            </div>
          </ActionBar>
          <div className="fg-stack">
            <div id="provider-overview">
              <ProvidersManagementOverviewSection data={data} actions={actions} instanceId={instanceId} />
            </div>
            <ProviderHealthSection data={data} actions={actions} instanceId={instanceId} />
            <div id="provider-inventory">
              <ProvidersInventoryTableSection data={data} actions={actions} instanceId={instanceId} />
            </div>
            <ProvidersAdvancedDiagnosticsSection data={data} />
          </div>
        </>
      )}
    </section>
  );
}
