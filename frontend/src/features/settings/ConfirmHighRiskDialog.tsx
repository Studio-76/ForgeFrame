import { useState } from "react";

import type { MutableSettingEntry } from "../../api/admin";
import { formatBooleanLabel, formatSettingValue, formatTimestamp, riskTone, showRiskBadge } from "./utils";

/**
 * Props for the ConfirmHighRiskDialog component.
 */
export interface ConfirmHighRiskDialogProps {
  /** Whether the dialog is visible. */
  visible: boolean;
  /** The setting being confirmed. */
  item: MutableSettingEntry | null;
  /** The action being confirmed ("save" or "reset"). */
  action: "save" | "reset" | null;
  /** Callback when the user confirms the action. */
  onConfirm: () => void;
  /** Callback when the user cancels. */
  onCancel: () => void;
}

/**
 * Confirmation dialog for high-risk setting changes.
 *
 * Shows the setting name, current and target values, risk level,
 * and operational impact in clear terms. Requires explicit acknowledgment
 * before the confirm button becomes active.
 */
export function ConfirmHighRiskDialog({
  visible,
  item,
  action,
  onConfirm,
  onCancel,
}: ConfirmHighRiskDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!visible || !item || !action) {
    return null;
  }

  const isSave = action === "save";
  const title = isSave ? "Confirm override" : "Confirm reset";
  const actionLabel = isSave ? "Apply override" : "Reset to default";

  /** Human-readable current value. */
  const currentValueReadable = item.value_type === "bool"
    ? formatBooleanLabel(item.effective_value)
    : formatSettingValue(item.effective_value);

  /** Human-readable default value. */
  const defaultValueReadable = item.value_type === "bool"
    ? formatBooleanLabel(item.default_value)
    : formatSettingValue(item.default_value);

  /** Draft value (for save actions). */
  const draftValueReadable = item.value_type === "bool"
    ? formatBooleanLabel(item.effective_value)
    : "";

  return (
    <div className="ff-dialog-underlay" onClick={onCancel} role="presentation">
      <div
        className="ff-dialog-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="ff-dialog-title">{title}</h2>

        <div className="ff-settings-confirm-body">
          <div className="ff-settings-desc-block">
            <span className="ff-settings-desc-label">Setting</span>
            <p><strong>{item.label}</strong></p>
            <p className="fg-muted fg-code">{item.key}</p>
          </div>

          <dl className="ff-settings-meta-list">
            <div>
              <dt>Current value</dt>
              <dd className="ff-settings-confirm-value">{currentValueReadable}</dd>
            </div>
            {isSave ? (
              <div>
                <dt>New value</dt>
                <dd className="ff-settings-confirm-value">{draftValueReadable || "Changed"}</dd>
              </div>
            ) : (
              <div>
                <dt>Will reset to</dt>
                <dd className="ff-settings-confirm-value">{defaultValueReadable}</dd>
              </div>
            )}
            <div>
              <dt>Source</dt>
              <dd>{item.source_label}</dd>
            </div>
            <div>
              <dt>Last changed</dt>
              <dd>{formatTimestamp(item.updated_at, "Never")}</dd>
            </div>
          </dl>

          <div className="ff-settings-warning-block" data-tone="danger">
            <strong>Operational impact: {item.risk_label}</strong>
            <p>
              {item.risk_note || "This is a high-risk setting. Changing it may affect system behavior, security posture, or operational stability."}
            </p>
            {isSave ? (
              <p>
                Saving will create a persisted override. The new value will take effect
                according to the setting's lifecycle — some changes apply immediately,
                others may require a restart.
              </p>
            ) : (
              <p>
                Resetting will remove the active override and restore the environment default.
                The previous override value will be lost.
              </p>
            )}
          </div>

          <label className="ff-settings-confirm-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              aria-label="I understand the risk of changing this setting"
            />
            <span>I understand the operational impact and want to proceed</span>
          </label>
        </div>

        <div className="ff-action-controls ff-settings-confirm-actions">
          <button
            type="button"
            onClick={onCancel}
            className="ff-settings-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!acknowledged}
            className="ff-settings-confirm-btn"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
