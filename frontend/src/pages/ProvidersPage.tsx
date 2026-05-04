import { Link, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button } from "../components/ui/Button";
import {
  ProvidersInventoryTableSection,
} from "../features/providers/ProvidersSections";
import { formatMetric } from "../features/providers/providersShared";
import { getProvidersAccess } from "../features/providers/providersShared";
import { useProvidersControlPlane } from "../features/providers/useProvidersControlPlane";
import type { ProviderControlItem } from "../api/domain";

/**
 * Counts providers requiring operator attention.
 */
function attentionProviderCount(providers: ProviderControlItem[]): number {
  return providers.filter((p) => p.enabled && !p.ready).length;
}

/**
 * Builds attention items from provider readiness state.
 */
function buildProviderAttentionItems(
  providers: ProviderControlItem[],
): AttentionPayload[] {
  const items: AttentionPayload[] = [];
  const attention = providers.filter((p) => p.enabled && !p.ready);

  for (const provider of attention.slice(0, 3)) {
    const reason = provider.readiness_reason
      ?? (provider.oauth_connect_required
        ? `${provider.label} needs an OAuth connection.`
        : null)
      ?? `${provider.label} is not ready for routing.`;
    items.push({
      key: `provider:${provider.provider}`,
      level: attention.length === 1 ? "primary_blocker" : "warning",
      title: reason,
      description: `${provider.next_action} — ${provider.label}`,
    });
  }

  if (attention.length > 3) {
    items.push({
      key: "more-attention",
      level: "warning",
      title: `${attention.length - 3} more provider(s) need attention.`,
    });
  }

  if (attention.length === 0 && providers.length > 0) {
    items.push({
      key: "all-ready",
      level: "healthy",
      title: "All providers are operational.",
    });
  }

  return items;
}

/**
 * Builds the scope-change handler.
 */
function buildScopeOnChange(
  instanceId: string | null,
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams) => void,
): (() => void) | undefined {
  if (!instanceId) return undefined;
  return () => {
    const next = new URLSearchParams(searchParams);
    next.delete("instanceId");
    setSearchParams(next);
  };
}

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
  const hasProviders = data.providers.length > 0;
  const readyCount = data.providers.filter((p) => p.ready).length;
  const enabledCount = data.providers.filter((p) => p.enabled).length;
  const attentionCount = attentionProviderCount(data.providers);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  // ── Access gate ───────────────────────────────────────
  if (!access.canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Setup"
        title="Providers"
        description="Provider records tell ForgeFrame which AI backends are available."
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

  // ── Normal page ───────────────────────────────────────
  const description = hasProviders
    ? `${data.providers.length} provider${data.providers.length === 1 ? "" : "s"} registered for this instance.`
    : "Provider records tell ForgeFrame which AI backends are available. Add one to start routing requests through this instance.";

  const scopeLabel = selectedInstance
    ? selectedInstance.display_name
    : instanceId
      ? instanceId
      : undefined;

  const attentionItems = buildProviderAttentionItems(data.providers);

  const summaryItems = hasProviders
    ? [
        {
          key: "total",
          label: "Total",
          value: formatMetric(data.providers.length),
          tone: "neutral" as const,
          status: "info" as const,
        },
        {
          key: "enabled",
          label: "Enabled",
          value: formatMetric(enabledCount),
          tone: enabledCount > 0 ? "success" as const : "neutral" as const,
          status: enabledCount > 0 ? "ready" as const : "info" as const,
        },
        {
          key: "ready",
          label: "Runtime-ready",
          value: formatMetric(readyCount),
          tone: readyCount === enabledCount && enabledCount > 0 ? "success" as const : "warning" as const,
          status: readyCount === enabledCount && enabledCount > 0 ? "ready" as const : "partial" as const,
        },
        ...(attentionCount > 0
          ? [{
              key: "attention" as const,
              label: "Needs attention" as const,
              value: formatMetric(attentionCount) as string,
              tone: "danger" as const,
              status: "blocked" as const,
            }]
          : []),
      ]
    : undefined;

  return (
    <RegistryManagementPage
      eyebrow="Setup"
      title="Providers"
      description={description}
      scope={scopeLabel ? { label: scopeLabel, onChange: buildScopeOnChange(instanceId, searchParams, setSearchParams) } : undefined}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      isEmpty={false}
      emptyDetailHint={
        data.access.canMutate
          ? "Start by adding a provider record — this tells the instance which AI backend to use."
          : `${access.summaryDetail} Provider truth and health stay visible here.`
      }
      diagnostics={
        <div className="fg-stack">
          <p className="text-muted">Access: {access.badgeLabel}</p>
          {data.error ? <p className="fg-danger">{data.error}</p> : null}
          <div className="fg-nav-links">
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.dashboard, instanceId)}>Setup progress</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>Harness</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>Provider Targets</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>OAuth Targets</Link>
          </div>
        </div>
      }
      diagnosticsTitle="Provider diagnostics"
    >
      <ProvidersInventoryTableSection data={data} actions={actions} instanceId={instanceId} />
    </RegistryManagementPage>
  );
}
