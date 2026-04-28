import { useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
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
    : access.canMutate
    ? "Account-backed targets get a dedicated operator surface here so bridge posture, session truth, and probe actions do not disappear inside the broader providers page."
    : `${access.summaryDetail} Contract classification, session truth, and probe evidence stay visible here even when mutation controls remain hidden.`;

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
        title="OAuth Targets & Operations"
        description="Account-backed provider axes, bridge-only slices, session truth, and probe posture get their own operator surface instead of hiding inside generic provider onboarding."
        question="Which OAuth/account target are you classifying, probing, or de-risking right now?"
        links={[
          {
            label: "OAuth Targets",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId),
            description: "Stay on the dedicated surface for account-backed target truth and probe operations.",
          },
          {
            label: "Providers",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId),
            description: "Return to the wider provider control plane when you need runtime inventory context.",
          },
          {
            label: "Harness",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId),
            description: "Open the dedicated harness module when the question shifts to profile proof and probe operations.",
          },
          {
            label: "Onboarding",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId),
            description: "Check go-live posture, bootstrap readiness, and instance-wide next steps.",
          },
          {
            label: "Usage & Costs",
            to: withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId),
            description: "Review avoided-cost versus metered-cost posture for account-backed traffic.",
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
        surfaceLabel="OAuth/account operator truth"
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
          <OperationResultSection data={data} actions={actions} />
          <OAuthTargetsSection data={data} actions={actions} />
        </div>
      )}
    </section>
  );
}
