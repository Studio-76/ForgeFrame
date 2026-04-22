import { useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";
import {
  ExpansionTargetsSection,
  HarnessControlSection,
  OperationResultSection,
  ProviderInventorySection,
  ProvidersOverviewSection,
} from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

export function ProvidersPage() {
  const [searchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const tenantId = getTenantIdFromSearchParams(searchParams);
  const access = getProvidersAccess(session, sessionReady);
  const { data, actions } = useProvidersControlPlane(access, tenantId);
  const note = access.canMutate
    ? "Setup keeps the default top-level destination for this route. Operations links can still deep-link directly into live provider health and run review without introducing nested routes yet."
    : `${access.summaryDetail} Runtime truth stays visible here without surfacing mutations that the backend will block.`;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Providers & Harness Control Plane"
        description="Live provider truth, harness onboarding, and expansion targets stay separated so operators can scan runtime posture without confusing it with roadmap coverage."
        question="Which provider task are you handling right now: onboarding, live health, or expansion planning?"
        links={[
          {
            label: "Overview",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Start with the route-level summary and current runtime truth.",
          },
          {
            label: "Harness Profiles",
            to: "/providers#harness-control",
            description: access.canMutate
              ? "Preview, verify, probe, and manage saved provider harness profiles."
              : "Inspect saved provider harness profiles, templates, and recent run truth without mutation controls.",
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
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          ...(tenantId ? [{ label: `Tenant scope: ${tenantId}`, tone: "success" as const }] : []),
        ]}
        note={note}
      />
      <div className="fg-stack">
        <div id="provider-overview">
          <ProvidersOverviewSection data={data} actions={actions} />
        </div>
        <OperationResultSection data={data} actions={actions} />
        <div id="harness-control">
          <HarnessControlSection data={data} actions={actions} />
        </div>
        <div id="provider-health-runs">
          <ProviderInventorySection data={data} actions={actions} />
        </div>
        <div id="expansion-targets">
          <ExpansionTargetsSection data={data} actions={actions} />
        </div>
      </div>
    </section>
  );
}
