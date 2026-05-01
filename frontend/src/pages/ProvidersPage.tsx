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
  ProviderHealthSection,
  ProvidersAdvancedDiagnosticsSection,
  ProvidersInventoryTableSection,
  ProvidersManagementOverviewSection,
} from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

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
  const note = !access.canRead
    ? access.summaryDetail
    : access.canMutate
    ? "This page focuses on provider inventory, lifecycle, compatibility, and health."
    : `${access.summaryDetail} Provider truth and health stay visible here without surfacing mutations that the backend will block.`;

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
        description="Manage live providers: inventory, lifecycle, compatibility, and health."
        question="Which provider are you configuring, syncing, validating, or recovering right now?"
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
      <ActionBar
        title="Related provider surfaces"
        description="Use these routes when the task moves beyond provider inventory."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Providers</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
        </div>
      </ActionBar>
      {!access.canRead ? (
        <BlockedState
          title={access.summaryTitle}
          description={access.summaryDetail}
          badgeLabel={access.badgeLabel}
          status="blocked"
        />
      ) : (
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
      )}
    </section>
  );
}
