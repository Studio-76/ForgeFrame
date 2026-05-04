import { useNavigate, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button } from "../components/ui/Button";
import { HarnessControlSection } from "../features/harness";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

/**
 * Harness page — guided workspace for integration profiles.
 *
 * Conforms to the Registry Management pattern. Wraps the decomposed
 * harness feature module in RegistryManagementPage with attention-based
 * access handling, summary metrics, scope indicator, and collapsed
 * diagnostics for adjacent-surface navigation.
 */
export function HarnessPage() {
  const navigate = useNavigate();
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

  // ── Scope config ───────────────────────────────────────
  const scopeConfig = selectedInstance
    ? {
        label: selectedInstance.display_name,
        onChange: instanceId
          ? () => onInstanceChange(null)
          : undefined,
      }
    : undefined;

  // ── Attention items ────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];

  if (!access.canRead) {
    attentionItems.push({
      key: "access-blocked",
      level: "primary_blocker",
      title: access.summaryTitle,
      description: access.summaryDetail,
    });
  } else {
    const note = access.canMutate
      ? "Harness is the guided workspace for integration profiles: select a preset, inspect the config, run verification actions, and manage lifecycle \u2014 all from one place."
      : access.canOperate
        ? "This route stays readable and operational for preview, verify, dry-run, and probe work even when write actions remain hidden."
        : `${access.summaryDetail} Preview and diagnostics stay visible here, while verify, dry-run, probe, and profile mutations remain hidden when the backend would reject them.`;

    attentionItems.push({
      key: "access-note",
      level: "informational",
      title: note,
    });
  }

  // ── Summary items ──────────────────────────────────────
  const profileCount = data.profiles.length;
  const templateCount = data.templates.length;
  const totalRuns = data.runSummary.total ?? 0;

  const summaryItems: SummaryStripItem[] = [
    {
      key: "profiles",
      label: "Profiles",
      value: profileCount,
      tone: profileCount > 0 ? "success" : "warning",
      status: profileCount > 0 ? "ready" : "info",
    },
    {
      key: "templates",
      label: "Templates",
      value: templateCount,
      tone: templateCount > 0 ? "success" : "neutral",
      status: templateCount > 0 ? "ready" : "info",
    },
    {
      key: "runs",
      label: "Runs",
      value: totalRuns,
      tone: totalRuns > 0 ? "info" : "neutral",
      status: totalRuns > 0 ? "ready" : null,
    },
  ];

  // ── Access gate ───────────────────────────────────────
  if (!access.canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Configure"
        title="Harness"
        description="Guided workspace for integration profiles: choose a preset or template, inspect the configuration, run verification actions, and manage lifecycle."
        isEmpty
        emptyTitle={access.summaryTitle}
        emptyDescription={access.summaryDetail}
        emptyAction={
          selectedInstance && instancesError
            ? undefined
            : (
              <Button variant="navigation" onPress={() => onInstanceChange(null)}>
                Change instance scope
              </Button>
            )
        }
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Configure"
      title="Harness"
      description="Guided workspace for integration profiles: choose a preset or template, inspect the configuration, run verification actions, and manage lifecycle."
      scope={scopeConfig}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      diagnostics={
        <div className="flex flex-wrap gap-1">
          <Button variant="navigation" onPress={() => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId))}>
            Setup progress
          </Button>
          <Button variant="navigation" onPress={() => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId))}>
            Providers
          </Button>
          <Button variant="navigation" onPress={() => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId))}>
            Logs
          </Button>
        </div>
      }
      diagnosticsTitle="Harness diagnostics"
    >
      {data.error ? <p className="fg-danger">{data.error}</p> : null}
      <HarnessControlSection data={data} actions={actions} instanceId={instanceId} />
    </RegistryManagementPage>
  );
}
