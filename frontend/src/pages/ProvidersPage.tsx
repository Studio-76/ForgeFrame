import { useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
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
    includeHarness: false,
    includeOauthTargets: false,
    includeCompatibilityMatrix: false,
    includeBootstrapReadiness: false,
    includeClientView: false,
  });
  const note = !access.canRead
    ? access.summaryDetail
    : access.canMutate
    ? "Providers stays dedicated to runtime inventory, add/edit, lifecycle changes, compatibility short status, and health. OAuth targets and harness proof stay on their own routes."
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
        description="Manage live providers here: inventory, add/edit, enable/disable, sync, compatibility short status, and health. OAuth targets and harness proof are kept on dedicated routes."
        question="Which provider are you configuring, syncing, validating, or recovering right now?"
        links={[
          {
            label: "Overview",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId),
            description: "Start with the live provider inventory and runtime truth for the current instance.",
          },
          {
            label: "Harness",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId),
            description: access.canMutate
              ? "Open the dedicated harness module for profile creation, verification, probe, import, and export work."
              : "Inspect dedicated harness proof, profile, and run truth without reopening the provider inventory.",
          },
          {
            label: "Provider Targets",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId),
            description: "Open the target register when you need per-target routing and priority detail.",
          },
          {
            label: "OAuth Targets",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId),
            description: "Open the dedicated operator surface for account-backed target classification, connect state, probes, and session truth.",
          },
        ]}
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
      ) : (
        <div className="fg-stack">
          <div id="provider-overview">
            <ProvidersManagementOverviewSection data={data} actions={actions} instanceId={instanceId} />
          </div>
          <div id="provider-health-runs">
            <ProviderHealthSection data={data} actions={actions} />
          </div>
          <ProvidersInventoryTableSection data={data} actions={actions} instanceId={instanceId} />
          <ProvidersAdvancedDiagnosticsSection data={data} />
        </div>
      )}
    </section>
  );
}
