import { useSearchParams } from "react-router-dom";

import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import {
  TargetActionBar,
  TargetDetailPanel,
  TargetListView,
  TargetReadinessSummary,
  useProviderTargets,
} from "../features/provider-targets";

/**
 * Provider targets page — operational target management for the selected instance.
 *
 * Displays a readiness summary + remediation callout, then a simplified action bar
 * with collapsible filters, a target table, and an actionable detail panel.
 * Focused on answering: which targets are dispatchable and what to fix if not.
 */
export function ProviderTargetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);

  const {
    targets,
    filteredTargets,
    selectedTarget,
    selectedDraft,
    selectedTargetKey,
    setSelectedTargetKey,
    state,
    error,
    message,
    setError,
    canReadTargets,
    canMutate,
    readinessSummary,
    detailOtherTargets,
    selectedDraftHasChanges,
    selectedTargetBecomesRiskyDefault,

    instances,
    selectedInstance,
    catalogLoadState,
    catalogError,
    onInstanceChange,

    providerFilter,
    setProviderFilter,
    statusFilter,
    setStatusFilter,
    costClassFilter,
    setCostClassFilter,
    qualityTierFilter,
    setQualityTierFilter,
    capabilityFilter,
    setCapabilityFilter,
    healthFilter,
    setHealthFilter,
    providerOptions,
    costClassOptions,
    qualityTierOptions,
    healthOptions,

    load,
    updateDraft,
    toggleTargetReference,
    saveSelectedTarget,
  } = useProviderTargets(instanceId, searchParams, setSearchParams);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Provider Targets"
        description="Target readiness workflow for the selected instance: see which targets are dispatchable, why others are not, and what to fix next."
        question="Which targets can receive runtime traffic right now, and what action gets the rest ready?"
        badges={[
          { label: `${readinessSummary.runtimeReadyCount}/${readinessSummary.totalTargets || 0} runtime-ready`, tone: readinessSummary.runtimeReadyCount > 0 ? "success" : "warning" },
          { label: `${targets.filter((t) => t.enabled).length}/${readinessSummary.totalTargets || 0} enabled`, tone: targets.some((t) => t.enabled) ? "success" : "warning" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(canMutate ? [{ label: "Mutations enabled", tone: "success" as const }] : []),
        ]}
        note="Provider targets are the routing-eligible runtime objects for this instance. Select a target to inspect readiness checks, recommended next actions, and edit policy flags."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={catalogLoadState}
        error={catalogError}
        surfaceLabel="provider target truth"
        onInstanceChange={onInstanceChange}
      />

      {!canReadTargets ? (
        <PermissionState
          title="Provider target review unavailable"
          description="This session does not hold provider_targets.read on the active instance scope, so ForgeFrame keeps the operational target register closed here."
        />
      ) : null}

      {error && state === "error" ? (
        <ErrorState
          title="Provider target register failed to load"
          description={error}
          action={<button type="button" onClick={() => void load()}>Retry</button>}
        />
      ) : null}

      {state === "loading" && targets.length === 0 ? (
        <LoadingState
          title="Loading provider target truth"
          description="ForgeFrame is restoring target readiness, enablement, policy flags, and runtime proof for the active instance."
        />
      ) : null}

      {/* Readiness summary + remediation callout */}
      {canReadTargets && state !== "error" ? (
        <TargetReadinessSummary summary={readinessSummary} targets={targets} />
      ) : null}

      {canReadTargets && state === "success" && targets.length === 0 ? (
        <EmptyState
          title="No provider targets exist for this instance"
          description="Start from the provider control plane or model register to create routing-eligible targets before trusting runtime dispatch."
        />
      ) : null}

      {/* Action bar below summary — controls + collapsible filters */}
      {canReadTargets && state !== "error" && targets.length > 0 ? (
        <TargetActionBar
          instanceId={instanceId}
          canReadTargets={canReadTargets}
          onRefresh={() => void load()}
          providerFilter={providerFilter}
          onProviderFilterChange={setProviderFilter}
          providerOptions={providerOptions}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          costClassFilter={costClassFilter}
          onCostClassFilterChange={setCostClassFilter}
          costClassOptions={costClassOptions}
          qualityTierFilter={qualityTierFilter}
          onQualityTierFilterChange={setQualityTierFilter}
          qualityTierOptions={qualityTierOptions}
          capabilityFilter={capabilityFilter}
          onCapabilityFilterChange={setCapabilityFilter}
          healthFilter={healthFilter}
          onHealthFilterChange={setHealthFilter}
          healthOptions={healthOptions}
        />
      ) : null}

      {/* Target table + detail panel */}
      {canReadTargets && targets.length > 0 ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <TargetListView
              targets={targets}
              filteredTargets={filteredTargets}
              totalCount={targets.length}
              selectedTargetKey={selectedTargetKey}
              onSelectTarget={setSelectedTargetKey}
            />
          </div>

          <div className="ff-operator-sidebar">
            <TargetDetailPanel
              target={selectedTarget}
              draft={selectedDraft}
              canMutate={canMutate}
              instanceId={instanceId}
              otherTargets={detailOtherTargets}
              message={message}
              error={error}
              draftHasChanges={selectedDraftHasChanges}
              becomesRiskyDefault={selectedTargetBecomesRiskyDefault}
              onUpdateDraft={updateDraft}
              onToggleReference={toggleTargetReference}
              onSave={() => void saveSelectedTarget()}
              onDismissError={() => setError("")}
            />
          </div>
        </div>
      ) : null}

      {canReadTargets && targets.length > 0 ? (
        <AdvancedDiagnostics
          title="Advanced diagnostics"
          description="Raw target payloads stay collapsed here so the main table and detail panel remain operational."
          status={`${targets.length} targets`}
          statusTone="neutral"
        >
          <pre>{JSON.stringify({
            filters: {
              providerFilter,
              statusFilter,
              costClassFilter,
              qualityTierFilter,
              capabilityFilter,
              healthFilter,
            },
            selectedTarget: selectedTarget ? {
              target_key: selectedTarget.target_key,
              label: selectedTarget.label,
              status: selectedTarget.readiness_status,
              enabled: selectedTarget.enabled,
              runtime_ready: selectedTarget.runtime_ready,
            } : null,
          }, null, 2)}</pre>
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
