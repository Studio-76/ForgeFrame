import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button } from "../components/ui/Button";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { OAuthTargetsSection, OperationResultSection } from "../features/providers/ProvidersSections";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";

/**
 * OAuth Targets page — account-backed provider connections, credential status,
 * and probe actions in a single compact view.
 *
 * Conforms to the Registry Management pattern. Wraps the OAuth target sections
 * in RegistryManagementPage with access-gated empty state, scope indicator,
 * summary metrics, attention items, and collapsed diagnostics.
 */
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
    attentionItems.push({
      key: "access-note",
      level: "informational",
      title:
        "Each provider row shows credential status, available actions, and probe history. Select a row to inspect setup details, env vars, and evidence.",
    });
  }

  // ── Summary items ──────────────────────────────────────
  const oauthTargetCount = data.oauthTargets?.length ?? 0;
  const configuredCount = data.oauthTargets?.filter((t) => t.configured).length ?? 0;
  const readyCount = data.oauthTargets?.filter((t) => t.readiness === "ready").length ?? 0;

  const summaryItems: SummaryStripItem[] = [
    {
      key: "targets",
      label: "OAuth Targets",
      value: oauthTargetCount,
      tone: oauthTargetCount > 0 ? "success" : "neutral",
      status: oauthTargetCount > 0 ? "ready" : "info",
    },
    {
      key: "configured",
      label: "Configured",
      value: configuredCount,
      tone: configuredCount > 0 ? "success" : "neutral",
      status: configuredCount > 0 ? "ready" : "info",
    },
    {
      key: "ready",
      label: "Runtime-ready",
      value: readyCount,
      tone: readyCount === configuredCount && configuredCount > 0 ? "success" : "warning",
      status: readyCount === configuredCount && configuredCount > 0 ? "ready" : "partial",
    },
  ];

  // ── Access gate ───────────────────────────────────────
  if (!access.canRead) {
    return (
      <RegistryManagementPage
        eyebrow="OAuth"
        title="OAuth Targets"
        description="Account-backed provider connections, credential status, and probe actions in a single compact view."
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
      eyebrow="OAuth"
      title="OAuth Targets"
      description="Account-backed provider connections, credential status, and probe actions in a single compact view."
      scope={scopeConfig}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      diagnostics={
        <div className="fg-stack">
          <p className="text-muted">Access: {access.badgeLabel}</p>
          <div className="fg-nav-links">
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Providers</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId)}>Usage &amp; Costs</Link>
          </div>
        </div>
      }
      diagnosticsTitle="OAuth diagnostics"
    >
      {/* Preserve the original PageIntro question text in the page body */}
      <p className="text-meta text-muted mb-3">
        Which OAuth target needs credential setup, probing, or review?
      </p>

      {data.error ? <p className="fg-danger">{data.error}</p> : null}
      <OperationResultSection data={data} actions={actions} />
      <OAuthTargetsSection data={data} actions={actions} />
    </RegistryManagementPage>
  );
}
