import { useMemo } from "react";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { withQueryParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import {
  ModelDetailPanel,
  ModelFilters,
  ModelList,
  ModelStatusHero,
  useModels,
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

  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const providerRoute = withQueryParams(CONTROL_PLANE_ROUTES.providers, { instanceId });
  const providerTargetsRoute = withQueryParams(CONTROL_PLANE_ROUTES.providerTargets, { instanceId });
  const routingRoute = withQueryParams(CONTROL_PLANE_ROUTES.routing, { instanceId });

  // Show compact scope card when only one instance
  const hasMultipleInstances = instances.length > 1;

  const routeLinks = useMemo(() => [
    {
      label: "Providers",
      to: CONTROL_PLANE_ROUTES.providers,
      description: "Provider configurations",
    },
    {
      label: "Provider Targets",
      to: CONTROL_PLANE_ROUTES.providerTargets,
      description: "Target enablement and priority",
    },
    {
      label: "Routing",
      to: CONTROL_PLANE_ROUTES.routing,
      description: "Routing policies and posture",
    },
  ], []);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Models"
        description="Model inventory showing what is routable, what is blocked, and what needs operator attention."
        badges={
          selectedInstance
            ? [{ label: `Instance: ${selectedInstance.display_name}`, tone: "success" as const }]
            : undefined
        }
        links={routeLinks}
        note="A model without routing-capable targets or verified provider checks is kept visible in the register but not presented as healthy routing inventory."
      />

      {/* Compact instance scope when single instance, full card otherwise */}
      {hasMultipleInstances ? (
        <InstanceScopeCard
          instanceId={instanceId}
          selectedInstance={selectedInstance}
          instances={instances}
          loadState={loadState}
          error={instancesError}
          surfaceLabel="model register"
          onInstanceChange={onInstanceChange}
        />
      ) : (
        <div
          className="fg-card ff-instance-scope-compact"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--fg-space-2)",
            padding: "var(--fg-space-2) var(--fg-space-4)",
          }}
        >
          <span
            style={{
              fontSize: "var(--fg-type-size-meta)",
              color: "var(--fg-color-text-secondary)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Instance
          </span>
          <span
            style={{
              fontSize: "var(--fg-type-size-meta)",
              color: "var(--fg-color-text-primary)",
            }}
          >
            {selectedInstance?.display_name ?? "Default path"}
          </span>
        </div>
      )}

      <ModelStatusHero models={models} summary={summary} />

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

      <div
        className="ff-operator-layout"
        style={{ marginTop: "var(--fg-space-3)" }}
      >
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

        <div className="ff-operator-sidebar">
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
        </div>
      </div>
    </section>
  );
}
