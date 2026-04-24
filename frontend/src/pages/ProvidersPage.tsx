import { useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import {
  ExpansionTargetsSection,
  OpenAICompatibilitySection,
  OperationResultSection,
  ProviderCatalogSection,
  ProviderInventorySection,
  ProvidersOverviewSection,
} from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

export function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const access = getProvidersAccess(session, sessionReady);
  const { data, actions } = useProvidersControlPlane(access, instanceId);
  const note = access.canMutate
    ? "Setup keeps the default top-level destination for this route. Operations links can still deep-link directly into live provider health and run review without introducing nested routes yet."
    : `${access.summaryDetail} Runtime truth stays visible here without surfacing mutations that the backend will block.`;

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
        title="Providers Control Plane"
        description="Live provider truth, compatibility posture, and expansion targets stay here. Dedicated harness work moved to its own module instead of continuing as a hidden sub-surface of provider setup."
        question="Which provider task are you handling right now: live runtime posture, compatibility truth, or expansion planning?"
        links={[
          {
            label: "Overview",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Start with the route-level summary and current runtime truth.",
          },
          {
            label: "Harness",
            to: CONTROL_PLANE_ROUTES.harness,
            description: access.canMutate
              ? "Open the dedicated harness module for profile creation, verification, probe, import, and export work."
              : "Inspect dedicated harness proof, profile, and run truth without reopening the provider module.",
          },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Jump straight to live provider inventory, compatibility, and run posture.",
          },
          {
            label: "Expansion Targets",
            to: "/providers#expansion-targets",
            description: "Review planned or partial provider coverage without implying runtime readiness.",
          },
          {
            label: "OAuth Targets",
            to: CONTROL_PLANE_ROUTES.oauthTargets,
            description: "Open the dedicated operator surface for account-backed target classification, probes, and session truth.",
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
      <div className="fg-stack">
        <div id="provider-overview">
          <ProvidersOverviewSection data={data} actions={actions} />
        </div>
        <OperationResultSection data={data} actions={actions} />
        <div id="provider-health-runs">
          <ProviderInventorySection data={data} actions={actions} />
        </div>
        <div id="provider-catalog">
          <ProviderCatalogSection data={data} />
        </div>
        <div id="provider-openai-compatibility">
          <OpenAICompatibilitySection data={data} />
        </div>
        <div id="expansion-targets">
          <ExpansionTargetsSection data={data} actions={actions} />
        </div>
      </div>
    </section>
  );
}
