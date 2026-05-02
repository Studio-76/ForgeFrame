import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { BlockedState } from "../components/ui/StateBlocks";
import {
  ProvidersInventoryTableSection,
} from "../features/providers/ProvidersSections";
import type { ProvidersPageActions, ProvidersPageData } from "../features/providers/providersShared";
import { ActionFeedbackNotice } from "../features/providers/providersSectionUtils";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

/**
 * Quick-setup form shown when no providers exist yet.
 * Walks the user through adding the first provider record.
 */
function FirstProviderSetupCard({
  data,
  actions,
}: {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
}) {
  const isCreatingProvider = data.pendingAction === "create-provider";

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
        <button type="button" disabled={isCreatingProvider} onClick={() => void actions.createProvider()}>
          {isCreatingProvider ? "Adding provider…" : "Add provider"}
        </button>
      </div>
      <p className="fg-note fg-mt-sm">
        Use a stable key like <span className="fg-code">local_ollama</span>. After this, enable it and sync models from the Providers card.
      </p>
      <ActionFeedbackNotice feedback={data.actionFeedback} />
      {data.error && !data.actionFeedback ? <p className="fg-danger fg-mt-sm" role="alert">{data.error}</p> : null}
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
    includeHarness: false,
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
      ? "This page is only for provider records: add, edit, enable, sync, or run the provider's next repair action. Targets, OAuth accounts, and harness proof stay on their own pages."
      : "Start by adding a provider record — this tells the instance which AI backend to use."
    : `${access.summaryDetail} Provider truth and health stay visible here without surfacing mutations that the backend will block.`;

  const description = hasProviders
    ? `${data.providers.length} provider${data.providers.length === 1 ? "" : "s"} registered for this instance.`
    : "Provider records tell ForgeFrame which AI backends are available. Add one to start routing requests through this instance.";

  const question = hasProviders
    ? undefined
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
          <FirstProviderSetupCard data={data} actions={actions} />
          <ActionBar title="Related surfaces" description="Explore once you have providers set up.">
            <div className="fg-actions">
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
            </div>
          </ActionBar>
        </>
      ) : (
        <div className="fg-stack">
          <ProvidersInventoryTableSection data={data} actions={actions} instanceId={instanceId} />
        </div>
      )}
    </section>
  );
}
