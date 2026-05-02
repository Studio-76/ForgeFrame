import { useState } from "react";

import type { MutableSettingEntry } from "../../api/admin";
import { formatSettingValue, formatTimestamp, riskTone } from "./utils";

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
 * Shows the setting name, current and new values, risk level,
 * and a caution message. Requires the user to acknowledge the
 * risk before the confirm button becomes active.
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
              <dd>{formatSettingValue(item.effective_value)}</dd>
            </div>
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
            <strong>Risk: {item.risk_label}</strong>
            <p>
              {item.risk_note || "This is a high-risk setting. Changing it may affect system behavior, security posture, or operational stability."}
            </p>
            {isSave ? (
              <p>Saving will create a persisted override for this setting.</p>
            ) : (
              <p>Resetting will remove the override and restore the environment default.</p>
            )}
          </div>

          <label className="ff-settings-confirm-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              aria-label="I understand the risk of changing this setting"
            />
            <span>I understand the risk and want to proceed</span>
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
