import { useMemo } from "react";
import { Link } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { withQueryParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { RegistryManagementPage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DiagnosticSection } from "../components/ui/AdvancedDiagnostics";
import { RawJson } from "../components/ui/AdvancedDiagnostics";
import {
  ModelDetailPanel,
  ModelFilters,
  ModelList,
  ModelStatusHero,
  useModels,
  deriveUsabilityState,
} from "../features/models";

/**
 * Models page — persistent model register with routing keys, capability
 * profiles, and target coverage.
 *
 * Displays a clean model list with primary usability state, action-oriented
 * detail panel, and quick filters for ready/needs-attention/disabled models.
 */
export function ModelsPage() {
  const {
    instanceId,
    models,
    filteredModels,
    summary,
    state,
    error,
    selectedModel,
    selectedModelKey,
    searchValue,
    providerFilter,
    filterKey,
    syncState,
    syncMessage,
    canMutateProviderDiscovery,
    providerOptions,
    setSearchValue,
    setProviderFilter,
    setFilterKey,
    selectModel,
    onInstanceChange,
    handleSyncSelectedProvider,
    handleRefresh,
  } = useModels();

  const { loadState: instancesLoadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const providerRoute = withQueryParams(CONTROL_PLANE_ROUTES.providers, { instanceId });
  const providerTargetsRoute = withQueryParams(CONTROL_PLANE_ROUTES.providerTargets, { instanceId });
  const routingRoute = withQueryParams(CONTROL_PLANE_ROUTES.routing, { instanceId });

  // ── Navigation actions (replacing routeLinks) ────────────────
  const actions = useMemo<Action[]>(() => [
    {
      label: "Providers",
      href: withQueryParams(CONTROL_PLANE_ROUTES.providers, { instanceId }),
      description: "Provider configurations",
      kind: "navigation",
      intent: "navigate",
    },
    {
      label: "Provider Targets",
      href: withQueryParams(CONTROL_PLANE_ROUTES.providerTargets, { instanceId }),
      description: "Target enablement and priority",
      kind: "navigation",
      intent: "navigate",
    },
    {
      label: "Routing",
      href: withQueryParams(CONTROL_PLANE_ROUTES.routing, { instanceId }),
      description: "Routing policies and posture",
      kind: "navigation",
      intent: "navigate",
    },
  ], [instanceId]);

  // ── Summary items from model data ───────────────────────────
  const summaryItems = useMemo(() => {
    const total = summary.total_models ?? models.length;
    if (total === 0) return [];

    let ready = 0;
    let needsAttention = 0;
    let inactive = 0;

    for (const model of models) {
      const usability = deriveUsabilityState(model);
      switch (usability) {
        case "ready":
          ready++;
          break;
        case "needs_verification":
        case "no_routable_target":
        case "degraded":
          needsAttention++;
          break;
        default:
          inactive++;
          break;
      }
    }

    return [
      { key: "total", label: "Total", value: total, tone: "neutral" as const },
      ...(ready > 0
        ? [{ key: "ready", label: "Ready", value: ready, tone: "success" as const }]
        : []),
      ...(needsAttention > 0
        ? [{ key: "attention", label: "Needs attention", value: needsAttention, tone: "warning" as const }]
        : []),
      ...(inactive > 0
        ? [{ key: "inactive", label: "Inactive", value: inactive, tone: "neutral" as const }]
        : []),
    ];
  }, [models, summary]);

  // ── Scope config ───────────────────────────────────────────
  const scope = {
    label: selectedInstance?.display_name ?? "Default path",
    ...(instanceId
      ? {
          onChange: () => {
            onInstanceChange(null);
          },
        }
      : {}),
  };

  return (
    <RegistryManagementPage
      eyebrow="Setup"
      title="Models"
      description="Model inventory showing what is routable, what is blocked, and what needs operator attention."
      scope={scope}
      summaryItems={summaryItems}
      actions={actions}
      filterContent={
        <ModelFilters
          models={models}
          filterKey={filterKey}
          searchValue={searchValue}
          providerFilter={providerFilter}
          providerOptions={providerOptions}
          onFilterKeyChange={setFilterKey}
          onSearchChange={setSearchValue}
          onProviderFilterChange={setProviderFilter}
        />
      }
      selectedItemContent={
        selectedModel ? (
          <ModelDetailPanel
            model={selectedModel}
            state={state}
            syncState={syncState}
            syncMessage={syncMessage}
            canMutateProviderDiscovery={canMutateProviderDiscovery}
            onSync={handleSyncSelectedProvider}
            providerRoute={providerRoute}
            providerTargetsRoute={providerTargetsRoute}
            routingRoute={routingRoute}
          />
        ) : null
      }
      hasSelection={selectedModelKey != null}
      emptyDetailHint="Select a model from the list to inspect its configuration."
      diagnostics={
        <AdvancedDiagnostics title="Model diagnostics">
          <DiagnosticSection label="Page State">
            <RawJson
              data={{
                state,
                error: error || undefined,
                instancesError: instancesError || undefined,
                instancesLoadState,
                instanceId,
                filteredModelCount: filteredModels.length,
                syncState,
                syncMessage: syncMessage || undefined,
              }}
              label="State snapshot"
            />
          </DiagnosticSection>
          <DiagnosticSection label="Related Pages">
            <div className="fg-nav-links">
              <Link
                className="fg-nav-link"
                to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}
              >
                Providers
              </Link>
              <Link
                className="fg-nav-link"
                to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}
              >
                Provider Targets
              </Link>
              <Link
                className="fg-nav-link"
                to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}
              >
                Routing
              </Link>
            </div>
          </DiagnosticSection>
        </AdvancedDiagnostics>
      }
      diagnosticsTitle="Models diagnostics"
    >
      <ModelStatusHero models={models} summary={summary} />
      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          <ModelList
            models={filteredModels}
            totalCount={models.length}
            state={state}
            error={error}
            selectedModelKey={selectedModelKey}
            onSelectModel={selectModel}
            onRetry={handleRefresh}
          />
        </div>
      </div>
    </RegistryManagementPage>
  );
}
