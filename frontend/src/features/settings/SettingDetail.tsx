import type { MutableSettingEntry } from "../../api/admin";
import {
  booleanStatusSentence,
  formatBooleanLabel,
  formatSettingValue,
  formatTimestamp,
  riskTone,
  showRiskBadge,
  sourceDescription,
  sourceTone,
  statusKey,
} from "./utils";

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
 * Leads with the setting's purpose and current state in plain language.
 * Shows effective value, source, impact of changing, and recommended caution.
 * Edit mode is deliberate — toggle to reveal value controls, with the
 * current value, draft override, and default all visible for comparison.
 * Provider-grouped settings include context linking to provider setup.
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
          <p className="fg-muted">
            Select a setting from the inventory to inspect its value, defaults, and configuration posture.
          </p>
        </div>
      </div>
    );
  }

  const sk = statusKey(setting.source, setting.overridden);
  const showRisk = showRiskBadge(setting.risk_level);
  const draftValue = drafts[setting.key] ?? formatSettingValue(setting.effective_value);
  const hasChanged = draftValue !== formatSettingValue(setting.effective_value);

  /** Human-readable current value sentence. */
  const currentValueSentence = setting.value_type === "bool"
    ? booleanStatusSentence(setting)
    : formatSettingValue(setting.effective_value);

  /** Human-readable default value. */
  const defaultValueReadable = setting.value_type === "bool"
    ? formatBooleanLabel(setting.default_value)
    : formatSettingValue(setting.default_value);

  /** Whether this is a provider-enablement setting. */
  const isProviderSetting = setting.group === "providers";

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
      {/* ── Title row ── */}
      <div className="ff-detail-panel-title-row">
        <div className="ff-detail-panel-copy">
          <h4>{setting.label}</h4>
          {showRisk ? (
            <span className="ff-settings-detail-risk" data-tone={riskTone(setting.risk_level)}>
              {setting.risk_label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ff-detail-panel-body">
        {/* ── What this controls ── */}
        <div className="ff-settings-desc-block">
          <span className="ff-settings-desc-label">What this controls</span>
          <p>{setting.description}</p>
          {isProviderSetting ? (
            <p className="fg-muted ff-settings-provider-context">
              This controls whether the provider is available for routing. Provider credentials
              and endpoint configuration may also be required — check the{" "}
              <strong>Provider enablement</strong> category or visit the Providers page.
            </p>
          ) : null}
        </div>

        {/* ── Current state panel ── */}
        <div className="ff-settings-current-block">
          <div className="ff-settings-current-row">
            <span className="ff-settings-current-label">Current state</span>
            <span className="ff-settings-current-value">
              {currentValueSentence}
            </span>
            <span
              className={`ff-settings-state-pill ff-settings-state-pill--${sk}`}
            >
              {sourceDescription(setting.source, setting.overridden)}
            </span>
          </div>
        </div>

        {/* ── Impact / caution ── */}
        {setting.risk_note ? (
          <div
            className="ff-settings-impact-block"
            data-tone={riskTone(setting.risk_level)}
          >
            <span className="ff-settings-desc-label">
              {showRisk ? "Impact of changing" : "Note"}
            </span>
            <p>{setting.risk_note}</p>
            {isProviderSetting && setting.value_type === "bool" && setting.effective_value === false ? (
              <p className="fg-muted ff-settings-provider-context">
                Enabling this provider here also requires valid credentials and endpoint configuration
                on the Providers page. Without those, routes targeting this provider will fail.
              </p>
            ) : null}
            {isProviderSetting && setting.value_type === "bool" && setting.effective_value === true ? (
              <p className="fg-muted ff-settings-provider-context">
                Disabling this provider will prevent routes from targeting it. Existing in-flight
                requests may complete, but no new routing will occur.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Edit section ── */}
        {canMutate ? (
          <div className="ff-settings-edit-section">
            <div className="ff-settings-edit-bar">
              <button
                type="button"
                className="ff-primary-action"
                onClick={onToggleEditMode}
                aria-pressed={editMode}
              >
                {editMode ? "Cancel" : "Edit setting"}
              </button>
              {editMode ? (
                <span className="ff-settings-edit-active">Edit mode active</span>
              ) : (
                <span className="ff-settings-edit-inactive">Read-only</span>
              )}
            </div>

            {editMode ? (
              <div className="ff-settings-edit-form">
                {/* Current value (read-only reference) */}
                <div className="ff-settings-edit-comparison">
                  <div className="ff-settings-edit-compare-item">
                    <span className="ff-settings-desc-label">Current value</span>
                    <span className="ff-settings-edit-current-display">
                      {setting.value_type === "bool"
                        ? formatBooleanLabel(setting.effective_value)
                        : formatSettingValue(setting.effective_value)}
                    </span>
                  </div>
                  <label className="ff-settings-edit-compare-item">
                    <span className="ff-settings-desc-label">New effective value</span>
                    {renderValueControl()}
                  </label>
                  <div className="ff-settings-edit-compare-item">
                    <span className="ff-settings-desc-label">Default</span>
                    <span className="ff-settings-edit-default-display">
                      {defaultValueReadable}
                    </span>
                  </div>
                </div>

                {setting.confirmation_required ? (
                  <div className="ff-settings-warning-block">
                    <strong>High-risk setting</strong>
                    <p>
                      {setting.risk_note || "Changing this setting may have significant impact on system behavior."}
                    </p>
                    <p>Saving will require explicit confirmation describing the operational impact.</p>
                  </div>
                ) : null}

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
          </div>
        )}

        {/* ── Meta info ── */}
        <dl className="ff-settings-meta-list">
          <div>
            <dt>Source</dt>
            <dd>
              <span className="fg-pill" data-tone={sourceTone(setting.source)}>
                {setting.source_label}
              </span>
            </dd>
          </div>
          <div>
            <dt>Default value</dt>
            <dd>{defaultValueReadable}</dd>
          </div>
        </dl>

        {/* ── Collapsible: Audit history ── */}
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

        {/* ── Collapsible: Technical details ── */}
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
                <dt>Effective value (raw)</dt>
                <dd className="fg-code">{formatSettingValue(setting.effective_value)}</dd>
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
