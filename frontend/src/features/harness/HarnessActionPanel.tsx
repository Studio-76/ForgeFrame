/**
 * Harness action panel — grouped action sections with clear hierarchy.
 *
 * Actions are grouped into:
 * 1. Primary: Verify profile
 * 2. Safe tests: Preview, Dry-run, Probe
 * 3. Lifecycle: Save, Deactivate, Rollback (hidden behind "Advanced actions")
 * 4. Import/Export: Export, Import (hidden behind "Advanced actions")
 */
import { useState } from "react";

import { TonePill } from "../providers/providersSectionUtils";
import type { ProvidersPageData } from "../providers/providersShared";
import type { ProvidersPageActions } from "../providers/providersShared";

export type HarnessActionPanelProps = {
  profile: ProvidersPageData["profiles"][number] | null;
  actions: ProvidersPageActions;
  canOperate: boolean;
  canMutate: boolean;
  canExportRedacted: boolean;
  canExportFull: boolean;
  actionModel: string;
  actionMessage: string;
  rollbackRevision: number | null;
  rollbackOptions: number[];
  onActionModelChange: (model: string) => void;
  onActionMessageChange: (message: string) => void;
  onRollbackRevisionChange: (revision: number | null) => void;
  onSetDraftFromProfile: () => void;
  onVerify: () => void;
  onPreview: () => void;
  onDryRun: () => void;
  onProbe: () => void;
};

/**
 * Grouped action panel with primary, safe-test, lifecycle, and advanced sections.
 */
export function HarnessActionPanel({
  profile,
  actions: pageActions,
  canOperate,
  canMutate,
  canExportRedacted,
  canExportFull,
  actionModel,
  actionMessage,
  rollbackRevision,
  rollbackOptions,
  onActionModelChange,
  onActionMessageChange,
  onRollbackRevisionChange,
  onSetDraftFromProfile,
  onVerify,
  onPreview,
  onDryRun,
  onProbe,
}: HarnessActionPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!profile) {
    return (
      <div className="ff-harness-empty">
        <strong>Select a profile first</strong>
        <p>
          Choose a profile from the list to run harness actions,
          view results, and manage lifecycle.
        </p>
      </div>
    );
  }

  return (
    <div className="fg-stack">
      {/* Action parameters */}
      <div className="fg-grid fg-grid-compact">
        <label>
          Model
          <select
            value={actionModel}
            onChange={(e) => onActionModelChange(e.target.value)}
          >
            {(profile.models.length ? profile.models : [actionModel]).map(
              (model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Message
          <input
            value={actionMessage}
            onChange={(e) => onActionMessageChange(e.target.value)}
            placeholder="Test message"
          />
        </label>
      </div>

      {/* Primary action: Verify */}
      {canOperate ? (
        <div className="ff-action-group ff-action-group-primary">
          <span className="ff-action-group-label">Verify</span>
          <button
            type="button"
            className="ff-primary-action"
            onClick={onVerify}
            title="Run full verification against the selected profile"
          >
            Verify profile
          </button>
        </div>
      ) : null}

      {/* Safe test actions */}
      <div className="ff-action-group">
        <span className="ff-action-group-label">Safe tests</span>
        <div className="ff-action-group-buttons">
          <button
            type="button"
            onClick={onPreview}
            title="Preview request — read-safe, no side effects"
          >
            Preview request
          </button>
          {canOperate ? (
            <>
              <button
                type="button"
                onClick={onDryRun}
                title="Dry-run request against the profile"
              >
                Run dry-run request
              </button>
              <button
                type="button"
                onClick={onProbe}
                title="Live probe of the provider endpoint"
              >
                Run provider probe
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Draft actions */}
      {canMutate ? (
        <div className="ff-action-group">
          <span className="ff-action-group-label">Draft</span>
          <div className="ff-action-group-buttons">
            <button
              type="button"
              onClick={onSetDraftFromProfile}
              title="Fill the editable draft with this profile's current settings (does not save)"
            >
              Create draft from preset
            </button>
          </div>
        </div>
      ) : null}

      {/* Advanced actions (collapsed by default) */}
      <details
        className="ff-collapse-section"
        open={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <summary>
          <div className="ff-collapse-summary-text">
            <h3>Advanced actions</h3>
            <p>
              Lifecycle management, rollback, import/export, and other
              operational tasks.
            </p>
          </div>
        </summary>
        <div className="ff-collapse-section-body fg-stack fg-mt-sm">
          {/* Lifecycle actions */}
          {canMutate ? (
            <div className="ff-action-group">
              <span className="ff-action-group-label">Lifecycle</span>
              <div className="ff-action-group-buttons">
                <button
                  type="button"
                  onClick={() =>
                    pageActions.toggleHarnessProfile(
                      profile.provider_key,
                      profile.enabled,
                    )
                  }
                >
                  {profile.enabled ? "Deactivate" : "Activate"}
                </button>
                {rollbackOptions.length > 0 ? (
                  <label className="ff-action-with-select">
                    <select
                      value={rollbackRevision === null ? "" : String(rollbackRevision)}
                      onChange={(e) =>
                        onRollbackRevisionChange(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">no prior revision</option>
                      {rollbackOptions.map((rev) => (
                        <option key={rev} value={rev}>
                          revision {rev}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        rollbackRevision !== null
                          ? pageActions.rollbackHarnessProfile(
                              profile.provider_key,
                              rollbackRevision,
                            )
                          : undefined
                      }
                      disabled={rollbackRevision === null}
                    >
                      Rollback
                    </button>
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Import/Export */}
          {(canExportRedacted || canExportFull) || canMutate ? (
            <div className="ff-action-group">
              <span className="ff-action-group-label">Import / Export</span>
              <div className="ff-action-group-buttons">
                {canExportRedacted ? (
                  <button
                    type="button"
                    onClick={() => pageActions.exportHarness(true)}
                  >
                    Export (redacted)
                  </button>
                ) : null}
                {canExportFull ? (
                  <button
                    type="button"
                    onClick={() => pageActions.exportHarness(false)}
                  >
                    Export (full)
                  </button>
                ) : null}
                {canMutate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => pageActions.importHarness(true)}
                    >
                      Dry-run import
                    </button>
                    <button
                      type="button"
                      onClick={() => pageActions.importHarness(false)}
                    >
                      Apply import
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
