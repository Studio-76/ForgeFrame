import { useSearchParams } from "react-router-dom";

import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";
import { Button } from "../components/ui/Button";
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

  const hasTargets = targets.length > 0;
  const hasError = state === "error";
  const isLoading = (state === "idle" || state === "loading") && targets.length === 0;
  const isSuccessEmpty = state === "success" && !hasTargets;

  // ── Scope config ─────────────────────────────────────────
  const scopeLabel = selectedInstance
    ? selectedInstance.display_name
    : instanceId
      ? instanceId
      : undefined;

  const scope = scopeLabel
    ? {
        label: scopeLabel,
        onChange: () => {
          onInstanceChange(null);
        },
      }
    : undefined;

  // ── Summary items ────────────────────────────────────────
  const summaryItems = hasTargets
    ? [
        {
          key: "total",
          label: "Total targets",
          value: readinessSummary.totalTargets,
          tone: "neutral" as const,
        },
        {
          key: "runtime-ready",
          label: "Runtime-ready",
          value: readinessSummary.runtimeReadyCount,
          tone: readinessSummary.runtimeReadyCount > 0 ? ("success" as const) : ("warning" as const),
        },
        {
          key: "enabled",
          label: "Enabled",
          value: targets.filter((t) => t.enabled).length,
          tone: targets.some((t) => t.enabled) ? ("success" as const) : ("warning" as const),
        },
      ]
    : undefined;

  // ── Attention items ──────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (readinessSummary.primaryBlocker) {
    attentionItems.push({
      key: "blocker",
      level: "primary_blocker",
      title: readinessSummary.primaryBlocker,
      description: readinessSummary.nextAction ?? undefined,
    });
  }
  if (!canMutate && hasTargets) {
    attentionItems.push({
      key: "mutations-disabled",
      level: "warning",
      title: "Mutations are not enabled for this session. Changes cannot be saved.",
    });
  }

  // ── Access gate (early return) ───────────────────────────
  if (!canReadTargets) {
    return (
      <RegistryManagementPage
        eyebrow="Routing"
        title="Provider Targets"
        description="Target readiness workflow for the selected instance: see which targets are dispatchable, why others are not, and what to fix next."
        scope={scope}
        isEmpty
        emptyTitle="Provider target review unavailable"
        emptyDescription="This session does not hold provider_targets.read on the active instance scope, so ForgeFrame keeps the operational target register closed here."
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Routing"
      title="Provider Targets"
      description="Target readiness workflow for the selected instance: see which targets are dispatchable, why others are not, and what to fix next."
      scope={scope}
      summaryItems={summaryItems}
      attentionItems={attentionItems}
      isEmpty={isSuccessEmpty}
      emptyTitle="No provider targets exist for this instance"
      emptyDescription="Start from the provider control plane or model register to create routing-eligible targets before trusting runtime dispatch."
      selectedItemContent={
        selectedTarget ? (
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
        ) : null
      }
      hasSelection={selectedTargetKey != null}
      emptyDetailHint="Select a target from the table to inspect its configuration."
      diagnostics={
        <AdvancedDiagnostics title="Provider-target diagnostics">
          <RawJson
            data={{
              filters: {
                providerFilter,
                statusFilter,
                costClassFilter,
                qualityTierFilter,
                capabilityFilter,
                healthFilter,
              },
              selectedTarget: selectedTarget
                ? {
                    target_key: selectedTarget.target_key,
                    label: selectedTarget.label,
                    status: selectedTarget.readiness_status,
                    enabled: selectedTarget.enabled,
                    runtime_ready: selectedTarget.runtime_ready,
                  }
                : null,
            }}
            label="State snapshot"
          />
        </AdvancedDiagnostics>
      }
      diagnosticsTitle="Provider-target diagnostics"
    >
      {/* Loading state */}
      {isLoading ? (
        <div className="ff-state-block" data-state="loading">
          <div className="ff-skeleton-row" />
          <strong>Loading provider target truth</strong>
          <p>
            ForgeFrame is restoring target readiness, enablement, policy flags,
            and runtime proof for the active instance.
          </p>
        </div>
      ) : null}

      {/* Error state */}
      {hasError ? (
        <div className="ff-state-block" data-state="error">
          <strong>Provider target register failed to load</strong>
          <p>{error || "Provider targets could not be restored from the control plane."}</p>
          <div className="ff-state-actions">
            <Button variant="secondary" onPress={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {/* Readiness summary (shown when not error and not empty) */}
      {state !== "error" && !isSuccessEmpty ? (
        <TargetReadinessSummary summary={readinessSummary} targets={targets} />
      ) : null}

      {/* Action bar + target list (when targets exist) */}
      {hasTargets ? (
        <>
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

          <TargetListView
            targets={targets}
            filteredTargets={filteredTargets}
            totalCount={targets.length}
            selectedTargetKey={selectedTargetKey}
            onSelectTarget={setSelectedTargetKey}
          />
        </>
      ) : null}
    </RegistryManagementPage>
  );
}
