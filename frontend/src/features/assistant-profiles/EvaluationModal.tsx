/**
 * Evaluation modal for testing assistant actions against a profile.
 *
 * Appears as a focused modal dialog contextual to the selected profile.
 * Explains what action is being tested and what verdict will be produced.
 *
 * @packageDocumentation
 */

import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import type {
  AssistantActionEvaluation,
  AssistantActionKind,
  AssistantActionMode,
  WorkItemPriority,
} from "../../api/domain/assistant-profiles";
import {
  ACTION_MODE_OPTIONS,
  ACTION_KIND_OPTIONS,
  PRIORITY_OPTIONS,
  type YesNo,
  type EvaluationFormState,
  DEFAULT_EVALUATION_FORM,
} from "./types";
import { formatJson } from "./utils";

/** Props for {@link EvaluationModal}. */
export type EvaluationModalProps = {
  /** Whether the modal is open. */
  open: boolean;
  /** The selected profile display name (for context). */
  profileName: string;
  /** Current evaluation form state. */
  form: EvaluationFormState;
  /** Form state setter. */
  setForm: Dispatch<SetStateAction<EvaluationFormState>>;
  /** Submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Whether evaluation is in progress. */
  evaluating: boolean;
  /** Whether the form is disabled. */
  disabled: boolean;
  /** Last evaluation result (shown after submission). */
  evaluation: AssistantActionEvaluation | null;
  /** Called to close the modal. */
  onClose: () => void;
};

/**
 * Modal dialog for evaluating an assistant action against the selected profile.
 *
 * Tests a policy decision without leaving the page. Shows the verdict
 * inline after evaluation completes.
 */
export function EvaluationModal({
  open,
  profileName,
  form,
  setForm,
  onSubmit,
  evaluating,
  disabled,
  evaluation,
  onClose,
}: EvaluationModalProps) {
  if (!open) {
    return null;
  }

  const updateForm = <Key extends keyof EvaluationFormState>(key: Key, value: EvaluationFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="ff-dialog-underlay" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="ff-dialog-panel" onClick={(e) => e.stopPropagation()} style={{ width: "min(600px, 90vw)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="ff-dialog-title">
          <h3>Evaluate assistant action</h3>
          <p className="fg-muted" style={{ fontSize: "0.875rem" }}>
            Testing policy for <strong>{profileName}</strong>
          </p>
        </div>

        <form className="fg-stack" onSubmit={onSubmit}>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
            This tool simulates a real action request against the selected profile's governance
            policies. The result shows whether the action would be allowed, require preview,
            require approval, or be blocked given the current quiet hours, delivery rules,
            and permission settings.
          </p>

          <div className="fg-grid fg-grid-compact">
            <label>
              Action mode
              <select value={form.actionMode} onChange={(e) => updateForm("actionMode", e.target.value as AssistantActionMode)}>
                {ACTION_MODE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            <label>
              Action kind
              <select value={form.actionKind} onChange={(e) => updateForm("actionKind", e.target.value as AssistantActionKind)}>
                {ACTION_KIND_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={form.priority} onChange={(e) => updateForm("priority", e.target.value as WorkItemPriority)}>
                {PRIORITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            <label>
              Requires external delivery
              <select value={form.requiresExternalDelivery} onChange={(e) => updateForm("requiresExternalDelivery", e.target.value as YesNo)}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <div className="fg-grid fg-grid-compact">
            <label>
              Channel ID
              <input value={form.channelId} onChange={(e) => updateForm("channelId", e.target.value)} />
            </label>
            <label>
              Target contact ID
              <input value={form.targetContactId} onChange={(e) => updateForm("targetContactId", e.target.value)} />
            </label>
            <label>
              Occurred at
              <input value={form.occurredAt} onChange={(e) => updateForm("occurredAt", e.target.value)} placeholder="2026-04-23T02:00:00Z" />
            </label>
            <label>
              Approval reference
              <input value={form.approvalReference} onChange={(e) => updateForm("approvalReference", e.target.value)} placeholder="approval-123" />
            </label>
          </div>

          <label>
            Evaluation metadata JSON
            <textarea rows={3} value={form.metadataJson} onChange={(e) => updateForm("metadataJson", e.target.value)} />
          </label>

          {/* Evaluation result */}
          {evaluation ? (
            <article className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>Evaluation result</h4>
                </div>
                <span className="fg-pill" data-tone={evaluation.decision === "blocked" ? "danger" : evaluation.decision === "allow" ? "success" : "warning"}>
                  {evaluation.decision}
                </span>
              </div>
              <ul className="fg-list">
                <li>Action: {evaluation.action_mode} / {evaluation.action_kind}</li>
                <li>Priority: {evaluation.priority}</li>
                <li>Quiet hours active: {evaluation.quiet_hours_active ? "Yes" : "No"}</li>
                <li>Preview required: {evaluation.preview_required ? "Yes" : "No"}</li>
                <li>Approval required: {evaluation.approval_required ? "Yes" : "No"}</li>
              </ul>
              <p className="fg-muted">Reasons: {evaluation.reasons.join(", ") || "no additional reasons"}</p>
            </article>
          ) : null}

          <div className="fg-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={onClose} style={{ background: "none", border: "1px solid var(--border-subtle, rgba(255,255,255,0.2))" }}>
              Close
            </button>
            <button type="submit" disabled={disabled || evaluating}>
              {evaluating ? "Evaluating..." : "Evaluate assistant action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
