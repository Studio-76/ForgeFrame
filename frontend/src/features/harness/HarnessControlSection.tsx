/**
 * Harness Control Section — main harness workspace delegate.
 *
 * Assembles the decomposed harness components into a guided integration
 * profile workflow. Layout:
 *  1. Status hero (overview + next step)
 *  2. Three-column workspace: profiles | current profile + draft | actions
 *  3. Run history (collapsible)
 *  4. Advanced diagnostics (collapsible)
 */
import { useEffect } from "react";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { buildDraftFromProfile } from "../providers/providersSectionUtils";
import type { HarnessControlSectionProps } from "./types";
import { deriveHarnessStatus } from "./utils";
import { useHarnessState } from "./useHarnessState";
import { HarnessStatusHero } from "./HarnessStatusHero";
import { HarnessProfileList } from "./HarnessProfileList";
import { HarnessTemplatesList } from "./HarnessTemplatesList";
import { HarnessCurrentProfile } from "./HarnessCurrentProfile";
import { HarnessDraftEditor } from "./HarnessDraftEditor";
import { HarnessActionPanel } from "./HarnessActionPanel";
import { HarnessRunHistory } from "./HarnessRunHistory";
import { HarnessDiagnostics } from "./HarnessDiagnostics";

/**
 * Main harness workspace — guided integration profile workflow.
 */
export function HarnessControlSection({
  data,
  actions,
  instanceId,
}: HarnessControlSectionProps) {
  const ui = useHarnessState(data);
  const harnessStatus = deriveHarnessStatus(data);

  // Sync run filter provider to selected profile
  useEffect(() => {
    const nextProviderFilter = ui.selectedProfile?.provider_key ?? "all";
    if (data.runFilters.provider !== nextProviderFilter) {
      actions.setRunFilter("provider", nextProviderFilter);
    }
  }, [actions, data.runFilters.provider, ui.selectedProfile?.provider_key]);

  const proofProviders = data.providers.filter(
    (p) => p.harness_proof_status !== "none",
  );
  const logSurfaceLink = withInstanceScope(
    CONTROL_PLANE_ROUTES.logs,
    instanceId,
  );

  const handleEnterEditMode = () => {
    if (ui.selectedProfile) {
      actions.setNewHarness(buildDraftFromProfile(ui.selectedProfile));
    }
    ui.setEditMode("editing");
  };

  const handleCreateDraft = () => {
    if (ui.selectedProfile) {
      actions.setNewHarness(buildDraftFromProfile(ui.selectedProfile));
    }
    ui.setEditMode("creating");
  };

  const handleSaveDraft = () => {
    void actions.upsertHarness();
    ui.setEditMode("view");
  };

  const handleCancelEdit = () => {
    ui.setEditMode("view");
  };

  const handleSetDraftFromProfile = () => {
    if (ui.selectedProfile) {
      actions.setNewHarness(buildDraftFromProfile(ui.selectedProfile));
    }
    ui.setEditMode("creating");
  };

  // Actions
  const handleVerify = () => {
    void actions.verifyHarnessProfile(
      ui.selectedProfile!.provider_key,
      ui.actionModel,
      ui.actionMessage,
    );
  };

  const handlePreview = () => {
    void actions.previewHarnessProfile(
      ui.selectedProfile!.provider_key,
      ui.actionModel,
      ui.actionMessage,
    );
  };

  const handleDryRun = () => {
    void actions.dryRunHarnessProfile(
      ui.selectedProfile!.provider_key,
      ui.actionModel,
      ui.actionMessage,
    );
  };

  const handleProbe = () => {
    void actions.probeHarnessProfile(
      ui.selectedProfile!.provider_key,
      ui.actionModel,
    );
  };

  return (
    <>
      {/* ─── Status Bar (stats in page template summaryItems) ─── */}
      <HarnessStatusHero
        summary={harnessStatus}
      />

      {/* ─── 3-Column Workspace ─── */}
      <div className="ff-harness-layout">
        {/* Left Column: Profile Presets + Templates */}
        <div className="fg-stack">
          <div className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Profiles</h3>
                <p className="fg-muted">
                  Select a profile to inspect and operate. Use a template
                  below to create a new one.
                </p>
              </div>
            </div>
            {data.profiles.length === 0 ? (
              <p className="fg-muted fg-mt-sm">
                No saved harness profiles yet. Use a template below to
                create one.
              </p>
            ) : (
              <HarnessProfileList
                profiles={data.profiles}
                runs={data.runs}
                runOps={data.runOps}
                providers={data.providers}
                selectedProfileKey={ui.selectedProfileKey}
                onSelectProfile={ui.setSelectedProfileKey}
              />
            )}

            <HarnessTemplatesList
              templates={data.templates}
              canMutate={data.access.canMutate}
              newHarness={data.newHarness}
              setNewHarness={actions.setNewHarness}
            />
          </div>
        </div>

        {/* Center Column: Current Profile + Draft / Editor */}
        <div className="fg-stack">
          {ui.editMode === "view" ? (
            <HarnessCurrentProfile
              profile={ui.selectedProfile}
              lastRun={ui.selectedProfileLastRun}
              proof={ui.selectedProfileProof}
              lastHarnessAction={data.lastHarnessAction}
              logSurfaceLink={logSurfaceLink}
              editMode={ui.editMode}
              canMutate={data.access.canMutate}
              onEnterEditMode={handleEnterEditMode}
              onCreateDraft={handleCreateDraft}
            />
          ) : (
            <div className="fg-card">
              <HarnessDraftEditor
                data={data}
                actions={actions}
                onSave={handleSaveDraft}
                onCancel={handleCancelEdit}
              />
            </div>
          )}
        </div>

        {/* Right Column: Actions */}
        <div className="fg-stack">
          <div className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Actions</h3>
                <p className="fg-muted">
                  Preview is read-safe. Verify, dry-run, and probe require
                  operator access.
                </p>
              </div>
            </div>
            <HarnessActionPanel
              profile={ui.selectedProfile}
              actions={actions}
              canOperate={data.access.canOperate}
              canMutate={data.access.canMutate}
              canExportRedacted={data.access.canExportRedacted}
              canExportFull={data.access.canExportFull}
              actionModel={ui.actionModel}
              actionMessage={ui.actionMessage}
              rollbackRevision={ui.rollbackRevision}
              rollbackOptions={ui.rollbackOptions}
              onActionModelChange={ui.setActionModel}
              onActionMessageChange={ui.setActionMessage}
              onRollbackRevisionChange={ui.setRollbackRevision}
              onSetDraftFromProfile={handleSetDraftFromProfile}
              onVerify={handleVerify}
              onPreview={handlePreview}
              onDryRun={handleDryRun}
              onProbe={handleProbe}
            />
          </div>
        </div>
      </div>

      {/* ─── Run History ─── */}
      <HarnessRunHistory
        runs={ui.selectedProfileRuns}
        runFilters={data.runFilters}
        runOps={data.runOps}
        runSummary={data.runSummary}
        instanceId={instanceId}
        profileLabel={ui.selectedProfile?.label ?? null}
        showRunDetails={ui.showRunDetails}
        onToggleShowDetails={() => ui.setShowRunDetails(!ui.showRunDetails)}
        onSetFilter={(field, value) => actions.setRunFilter(field, value)}
      />

      {/* ─── Diagnostics ─── */}
      <HarnessDiagnostics
        importPayload={data.importPayload}
        operationResult={data.operationResult}
        lastHarnessAction={data.lastHarnessAction}
        canMutate={data.access.canMutate}
        canExportRedacted={data.access.canExportRedacted}
        onImportPayloadChange={actions.setImportPayload}
        proofProviders={proofProviders}
        selectedProfile={ui.selectedProfile}
      />
    </>
  );
}
