import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { BlockedState } from "../components/ui/StateBlocks";
import { HarnessControlSection } from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

export function HarnessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const access = getProvidersAccess(session, sessionReady, instanceId);
  const { data, actions } = useProvidersControlPlane(access, instanceId, {
    includeUsageSummary: true,
    includeHarness: true,
    includeOauthTargets: false,
    includeCompatibilityMatrix: false,
    includeBootstrapReadiness: false,
    includeClientView: false,
  });

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const attentionProfiles = data.profiles.filter((profile) => profile.needs_attention).length;
  const note = !access.canRead
    ? access.summaryDetail
    : access.canMutate
    ? "Harness is the standalone operator surface for saved profiles, templates, contract verification, dry-runs, probes, imports, exports, activation, and rollback."
    : access.canOperate
    ? "This route stays readable and operational for preview, verify, dry-run, and probe work even when write actions remain hidden."
    : `${access.summaryDetail} Preview and diagnostics stay visible here, while verify, dry-run, probe, and profile mutations remain hidden when the backend would reject them.`;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Harness"
        description="Operate generic integration profiles from a dedicated harness workspace: saved profiles and templates on the left, the selected config contract in the center, and real actions plus run history on the right."
        question="Which profile contract are you validating, previewing, probing, importing, exporting, or rolling back right now?"
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          { label: `${data.profiles.length} profile${data.profiles.length === 1 ? "" : "s"}`, tone: data.profiles.length > 0 ? "success" : "warning" },
          { label: `${attentionProfiles} attention`, tone: attentionProfiles > 0 ? "warning" : "neutral" },
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
      <ActionBar
        title="Adjacent harness surfaces"
        description="Leave the harness only when the issue becomes runtime inventory or shared evidence."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Providers</Link>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>Logs</Link>
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
          {data.error ? <p className="fg-danger">{data.error}</p> : null}
          <HarnessControlSection data={data} actions={actions} instanceId={instanceId} />
        </div>
      )}
    </section>
  );
}
