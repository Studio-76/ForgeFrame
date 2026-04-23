import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { HarnessControlSection, OperationResultSection } from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

export function HarnessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const access = getProvidersAccess(session, sessionReady);
  const { data, actions } = useProvidersControlPlane(access, instanceId);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const proofProviders = data.providers.filter((provider) => provider.harness_proof_status !== "none");
  const attentionProfiles = data.profiles.filter((profile) => profile.needs_attention).length;
  const note = access.canMutate
    ? "Harness profile creation, verification, probe, import, export, and proof review are isolated on this route so the Providers module no longer doubles as the main harness workspace."
    : `${access.summaryDetail} Harness proof, runs, and saved profiles stay visible here without exposing mutations the backend would reject.`;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Harness Control Plane"
        description="Saved harness profiles, verification runs, import/export posture, and proof status live on their own route instead of remaining collapsed under Providers."
        question="Do the current harness profiles and runs prove anything real, or is harness truth still being confused with generic provider setup?"
        links={[
          { label: "Harness", to: CONTROL_PLANE_ROUTES.harness, description: "Stay on the dedicated harness profile, run, and proof surface." },
          { label: "Providers", to: CONTROL_PLANE_ROUTES.providers, description: "Return to provider runtime truth when the question shifts away from harness operations." },
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Cross-check whether current harness proof is strong enough for release gates." },
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          { label: `${data.profiles.length} profile${data.profiles.length === 1 ? "" : "s"}`, tone: data.profiles.length > 0 ? "success" : "warning" },
          { label: `${data.runs.length} recent run${data.runs.length === 1 ? "" : "s"}`, tone: data.runs.length > 0 ? "success" : "neutral" },
        ]}
        note={note}
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="harness proof and profile truth"
        onInstanceChange={onInstanceChange}
      />

      <div className="fg-grid fg-grid-compact">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Harness proof posture</h3>
              <p className="fg-muted">Recorded harness proof stays visible here instead of disappearing behind the provider route.</p>
            </div>
            <span className="fg-pill" data-tone={data.state === "success" ? "success" : data.state === "error" ? "danger" : "neutral"}>
              {data.state}
            </span>
          </div>
          <ul className="fg-list">
            <li>Profiles: {data.profiles.length}</li>
            <li>Profiles needing attention: {attentionProfiles}</li>
            <li>Recent runs: {data.runs.length}</li>
            <li>Proof-carrying providers: {proofProviders.length}</li>
          </ul>
          <div className="fg-actions">
            <button type="button" onClick={() => void actions.load()}>
              Refresh harness
            </button>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>
              Open Provider Runtime Truth
            </Link>
          </div>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Proof carriers</h3>
              <p className="fg-muted">Providers with recorded harness proof stay explicit on the dedicated harness route.</p>
            </div>
          </div>
          <ul className="fg-list">
            {proofProviders.length === 0 ? <li>No providers carry harness proof yet.</li> : null}
            {proofProviders.map((provider) => (
              <li key={provider.provider}>
                {provider.label} · proof={provider.harness_proof_status} · profiles={provider.harness_profile_count} · runs={provider.harness_run_count}
              </li>
            ))}
          </ul>
        </article>
      </div>

      {data.error ? <p className="fg-danger">{data.error}</p> : null}
      <OperationResultSection data={data} actions={actions} />
      <HarnessControlSection data={data} actions={actions} />
    </section>
  );
}
