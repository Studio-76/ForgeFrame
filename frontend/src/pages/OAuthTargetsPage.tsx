import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { BlockedState } from "../components/ui/StateBlocks";
import { OAuthTargetsSection, OperationResultSection } from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

export function OAuthTargetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const access = getProvidersAccess(session, sessionReady, instanceId);
  const { data, actions } = useProvidersControlPlane(access, instanceId, {
    includeUsageSummary: true,
    includeHarness: false,
    includeOauthTargets: true,
    includeCompatibilityMatrix: false,
    includeBootstrapReadiness: true,
    includeClientView: false,
  });
  const note = !access.canRead
    ? access.summaryDetail
    : "Each provider row shows credential status, available actions, and probe history. Select a row to inspect setup details, env vars, and evidence.";

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
        eyebrow="OAuth"
        title="OAuth Targets"
        description="Account-backed provider connections, credential status, and probe actions in a single compact view."
        question="Which OAuth target needs credential setup, probing, or review?"
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
        surfaceLabel="OAuth/account operator truth"
        onInstanceChange={onInstanceChange}
      />
      <ActionBar
        title="Related surfaces"
        description="Navigate to adjacent provider and runtime views."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Providers</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId)}>Usage &amp; Costs</Link>
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
          <OperationResultSection data={data} actions={actions} />
          <OAuthTargetsSection data={data} actions={actions} />
        </div>
      )}
    </section>
  );
}
