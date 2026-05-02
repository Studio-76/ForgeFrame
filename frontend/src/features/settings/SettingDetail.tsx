import type { MutableSettingEntry } from "../../api/admin";
import { formatSettingValue, formatTimestamp, riskTone, sourceDescription, sourceTone } from "./utils";

/**
 * Props for the SettingDetail component.
 */
export interface SettingDetailProps {
  /** The currently selected setting, or null. */
  setting: MutableSettingEntry | null;
  /** Current draft values keyed by setting key. */
  drafts: Record<string, string>;
  /** Callback to update a draft value. */
  onDraftChange: (key: string, value: string) => void;
  /** Whether edit mode is active. */
  editMode: boolean;
  /** Callback to toggle edit mode. */
  onToggleEditMode: () => void;
  /** Whether the user can mutate settings. */
  canMutate: boolean;
  /** Whether a save is in progress for the current setting. */
  saving: boolean;
  /** Whether a reset is in progress for the current setting. */
  resetting: boolean;
  /** Callback to initiate a save. */
  onSave: (item: MutableSettingEntry) => void;
  /** Callback to initiate a reset. */
  onReset: (item: MutableSettingEntry) => void;
}

/**
 * Detail panel for a selected setting.
 *
 * Shows a human-readable description of the setting, its current
 * effective value, override/default state, source, risk level, and
 * recommended caution text. Edit/reset controls are hidden behind
 * an explicit edit mode toggle. Audit history and technical metadata
 * are in collapsible sections.
 */
export function SettingDetail({
  setting,
  drafts,
  onDraftChange,
  editMode,
  onToggleEditMode,
  canMutate,
  saving,
  resetting,
  onSave,
  onReset,
}: SettingDetailProps) {
  if (!setting) {
    return (
      <div className="ff-detail-panel">
        <div className="ff-detail-panel-body">
          <h4>Setting detail</h4>
          <p className="fg-muted">Select a setting from the inventory to inspect its value, defaults, and configuration posture.</p>
        </div>
      </div>
    );
  }

  const overrideState = sourceDescription(setting.source, setting.overridden);
  const overrideActive = setting.source === "override" && setting.overridden;
  const draftValue = drafts[setting.key] ?? formatSettingValue(setting.effective_value);
  const hasChanged = draftValue !== formatSettingValue(setting.effective_value);

  const renderValueControl = () => {
    const commonProps = {
      "aria-label": `${setting.label} effective value`,
      value: draftValue,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onDraftChange(setting.key, event.target.value);
      },
      disabled: !editMode,
    };

    if (setting.allowed_values.length > 0 || setting.value_type === "bool") {
      return (
        <select {...commonProps}>
          {setting.value_type === "bool" ? (
            <>
              <option value="true">true</option>
              <option value="false">false</option>
            </>
          ) : (
            setting.allowed_values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))
          )}
        </select>
      );
    }

    return <input {...commonProps} />;
  };

  return (
    <div className="ff-detail-panel">
      <div className="ff-detail-panel-title-row">
        <div className="ff-detail-panel-copy">
          <h4>{setting.label}</h4>
          <p className="fg-muted fg-code">{setting.key}</p>
        </div>
        <span className="ff-status-badge" data-tone={riskTone(setting.risk_level)}>
          {setting.risk_label}
        </span>
      </div>

      <div className="ff-detail-panel-body">
        {/* Description section */}
        <div className="ff-settings-desc-block">
          <span className="ff-settings-desc-label">What this controls</span>
          <p>{setting.description}</p>
        </div>

        {/* Current value and state */}
        <div className="ff-settings-value-block">
          <div className="ff-settings-value-row">
            <span className="ff-settings-value-label">Current value</span>
            <span className="ff-settings-value-current">{formatSettingValue(setting.effective_value)}</span>
            <span
              className={`ff-settings-state-pill${overrideActive ? " is-override" : ""}`}
            >
              {overrideState}
            </span>
          </div>
          {overrideActive ? (
            <p className="ff-settings-value-note">
              This setting has a persisted override. Resetting will restore the environment default.
            </p>
          ) : (
            <p className="ff-settings-value-note">
              This setting is using its environment default. No override is active.
            </p>
          )}
        </div>

        {/* Source and risk info */}
        <dl className="ff-settings-meta-list">
          <div>
            <dt>Default value</dt>
            <dd>{formatSettingValue(setting.default_value)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <span className="fg-pill" data-tone={sourceTone(setting.source)}>
                {setting.source_label}
              </span>
            </dd>
          </div>
          {setting.risk_note ? (
            <div className="ff-settings-risk-note" data-tone={riskTone(setting.risk_level)}>
              <dt>Caution</dt>
              <dd>{setting.risk_note}</dd>
            </div>
          ) : null}
        </dl>

        {/* Edit mode toggle and controls */}
        {canMutate ? (
          <div className="ff-settings-edit-section">
            <div className="ff-settings-edit-bar">
              <span className={editMode ? "ff-settings-edit-active" : "ff-settings-edit-inactive"}>
                {editMode ? "Edit mode active" : "Read-only view"}
              </span>
              <button
                type="button"
                className="ff-settings-edit-toggle"
                onClick={onToggleEditMode}
                aria-pressed={editMode}
              >
                {editMode ? "Cancel editing" : "Edit setting"}
              </button>
            </div>

            {editMode ? (
              <div className="ff-settings-edit-form">
                <label>
                  New effective value
                  {renderValueControl()}
                </label>

                {setting.confirmation_required ? (
                  <div className="ff-settings-warning-block">
                    <strong>High-risk setting</strong>
                    <p>
                      {setting.risk_note || "Changing this setting may have significant impact on system behavior."}
                      {" "}Saving will require explicit confirmation.
                    </p>
                  </div>
                ) : null}

                <p className="fg-muted ff-settings-save-note">
                  {hasChanged
                    ? "Saving creates a persisted override for this setting. Reset restores the environment default."
                    : "Change the value above before saving."}
                </p>

                <div className="ff-action-controls">
                  <button
                    type="button"
                    onClick={() => onSave(setting)}
                    disabled={saving || !hasChanged}
                  >
                    {saving ? "Saving…" : "Save override"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReset(setting)}
                    disabled={!setting.overridden || resetting}
                  >
                    {resetting ? "Resetting…" : "Reset to default"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ff-settings-readonly-block">
            <p className="fg-muted">
              This session can review setting values and defaults, but editing is
              restricted to admin sessions with write access.
            </p>
            {setting.overridden ? (
              <p className="fg-muted">
                An override is currently active. An admin can review and manage it.
              </p>
            ) : (
              <p className="fg-muted">
                This setting is using its environment default.
              </p>
            )}
          </div>
        )}

        {/* Collapsible: Audit history */}
        <details className="ff-collapse-section">
          <summary>
            <div className="ff-collapse-summary-text">
              <span>Audit history</span>
              {setting.updated_at ? (
                <p className="fg-muted">Last changed {formatTimestamp(setting.updated_at, "never")}</p>
              ) : (
                <p className="fg-muted">No changes recorded</p>
              )}
            </div>
          </summary>
          <div className="ff-collapse-section-body">
            <dl className="ff-settings-meta-list">
              <div>
                <dt>Last updated</dt>
                <dd>{formatTimestamp(setting.updated_at)}</dd>
              </div>
              <div>
                <dt>Updated by</dt>
                <dd>{setting.updated_by ?? "Environment default (no override)"}</dd>
              </div>
            </dl>
          </div>
        </details>

        {/* Collapsible: Technical details */}
        <details className="ff-collapse-section">
          <summary>
            <div className="ff-collapse-summary-text">
              <span>Technical details</span>
              <p className="fg-muted">Key, value type, mutability, and source metadata</p>
            </div>
          </summary>
          <div className="ff-collapse-section-body">
            <dl className="ff-settings-meta-list">
              <div>
                <dt>Key</dt>
                <dd className="fg-code">{setting.key}</dd>
              </div>
              <div>
                <dt>Value type</dt>
                <dd>{setting.value_type}</dd>
              </div>
              <div>
                <dt>Mutable</dt>
                <dd>{setting.mutable ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Confirmation required</dt>
                <dd>{setting.confirmation_required ? "Yes — high-risk setting" : "No"}</dd>
              </div>
              <div>
                <dt>Allowed values</dt>
                <dd>{setting.allowed_values.length > 0 ? setting.allowed_values.join(", ") : "Any valid value"}</dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{setting.group_label} ({setting.group})</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{setting.category}</dd>
              </div>
            </dl>
          </div>
        </details>
      </div>
    </div>
  );
}
