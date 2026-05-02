/**
 * Governance actions — edit, correct, revoke, and delete with confirmation.
 *
 * @packageDocumentation
 */

import { type FormEvent, useState } from "react";

import type {
  MemoryKind,
  MemoryLayer,
  MemorySensitivity,
  MemorySourceTrustClass,
} from "../../api/domain/memory";
import type { MemoryDetail } from "../../api/domain/memory";
import type { VisibilityScope } from "../../api/domain/contacts";
import {
  MEMORY_KIND_OPTIONS,
  MEMORY_LAYER_OPTIONS,
  SENSITIVITY_OPTIONS,
  SOURCE_TRUST_OPTIONS,
  VISIBILITY_OPTIONS,
  DEFAULT_EDIT_FORM,
  DEFAULT_CORRECTION_FORM,
  DEFAULT_DELETE_FORM,
  DEFAULT_REVOKE_FORM,
} from "./types";

/** Props for GovernanceActions. */
export interface GovernanceActionsProps {
  /** Selected memory detail (required for actions). */
  detail: MemoryDetail | null;
  /** Edit form state. */
  editForm: typeof DEFAULT_EDIT_FORM;
  /** Update edit form field. */
  setEditFormField: <K extends keyof typeof DEFAULT_EDIT_FORM>(
    key: K,
    value: (typeof DEFAULT_EDIT_FORM)[K],
  ) => void;
  /** Correction form state. */
  correctionForm: typeof DEFAULT_CORRECTION_FORM;
  /** Update correction form field. */
  setCorrectionFormField: <K extends keyof typeof DEFAULT_CORRECTION_FORM>(
    key: K,
    value: (typeof DEFAULT_CORRECTION_FORM)[K],
  ) => void;
  /** Delete form state. */
  deleteForm: typeof DEFAULT_DELETE_FORM;
  /** Update delete form field. */
  setDeleteFormField: <K extends keyof typeof DEFAULT_DELETE_FORM>(
    key: K,
    value: (typeof DEFAULT_DELETE_FORM)[K],
  ) => void;
  /** Revoke form state. */
  revokeForm: typeof DEFAULT_REVOKE_FORM;
  /** Update revoke form field. */
  setRevokeFormField: <K extends keyof typeof DEFAULT_REVOKE_FORM>(
    key: K,
    value: (typeof DEFAULT_REVOKE_FORM)[K],
  ) => void;
  /** Submit update handler. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit correction handler. */
  handleCorrect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit delete handler. */
  handleDelete: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit revoke handler. */
  handleRevoke: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Saving flags. */
  savingUpdate: boolean;
  savingCorrection: boolean;
  savingDelete: boolean;
  savingRevoke: boolean;
  /** Whether user has mutate permission. */
  canMutate: boolean;
}

/**
 * Governance action sections — edit, correct, revoke, delete with confirmation.
 * Only visible when a memory entry is selected.
 */
export function GovernanceActions({
  detail,
  editForm,
  setEditFormField,
  correctionForm,
  setCorrectionFormField,
  deleteForm,
  setDeleteFormField,
  revokeForm,
  setRevokeFormField,
  handleUpdate,
  handleCorrect,
  handleDelete,
  handleRevoke,
  savingUpdate,
  savingCorrection,
  savingDelete,
  savingRevoke,
  canMutate,
}: GovernanceActionsProps) {
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!detail) {
    return null;
  }

  const isDeleted = detail.status === "deleted";
  const canGovern = canMutate && !isDeleted;

  return (
    <article className="fg-card ff-memory-governance">
      <div className="fg-panel-heading">
        <div>
          <h3>Governance actions</h3>
          <p className="fg-muted">
            Edit, correct, revoke, and delete have distinct persistence effects.
          </p>
        </div>
        <span className="fg-pill">{detail.memory_id}</span>
      </div>

      {/* Edit / Save */}
      <form className="ff-memory-gov-form" onSubmit={handleUpdate}>
        <h4>Edit memory</h4>
        <p className="fg-muted">
          Update fields directly. Changes take effect immediately.
        </p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Memory layer
            <select
              value={editForm.memoryLayer}
              onChange={(e) => setEditFormField("memoryLayer", e.target.value as MemoryLayer)}
            >
              {MEMORY_LAYER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Source trust
            <select
              value={editForm.sourceTrustClass}
              onChange={(e) => setEditFormField("sourceTrustClass", e.target.value as MemorySourceTrustClass)}
            >
              {SOURCE_TRUST_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Memory kind
            <select
              value={editForm.memoryKind}
              onChange={(e) => setEditFormField("memoryKind", e.target.value as MemoryKind)}
            >
              {MEMORY_KIND_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Visibility
            <select
              value={editForm.visibilityScope}
              onChange={(e) => setEditFormField("visibilityScope", e.target.value as VisibilityScope)}
            >
              {VISIBILITY_OPTIONS.filter((o) => o !== "all").map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Sensitivity
            <select
              value={editForm.sensitivity}
              onChange={(e) => setEditFormField("sensitivity", e.target.value as MemorySensitivity)}
            >
              {SENSITIVITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Expires at
            <input
              value={editForm.expiresAt}
              onChange={(e) => setEditFormField("expiresAt", e.target.value)}
            />
          </label>
        </div>
        <label>
          Title
          <input
            value={editForm.title}
            onChange={(e) => setEditFormField("title", e.target.value)}
          />
        </label>
        <label>
          Body
          <textarea
            rows={4}
            value={editForm.body}
            onChange={(e) => setEditFormField("body", e.target.value)}
          />
        </label>
        <details className="ff-memory-advanced">
          <summary>Optional fields</summary>
          <div className="fg-grid fg-grid-compact">
            <label>
              Review at
              <input
                value={editForm.reviewAt}
                onChange={(e) => setEditFormField("reviewAt", e.target.value)}
              />
            </label>
            <label>
              Review note
              <input
                value={editForm.reviewNote}
                onChange={(e) => setEditFormField("reviewNote", e.target.value)}
              />
            </label>
            <label>
              Correction note
              <input
                value={editForm.correctionNote}
                onChange={(e) => setEditFormField("correctionNote", e.target.value)}
              />
            </label>
            <label>
              Learning event ID
              <input
                value={editForm.learnedFromEventId}
                onChange={(e) => setEditFormField("learnedFromEventId", e.target.value)}
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Source ID
              <input
                value={editForm.sourceId}
                onChange={(e) => setEditFormField("sourceId", e.target.value)}
              />
            </label>
            <label>
              Contact ID
              <input
                value={editForm.contactId}
                onChange={(e) => setEditFormField("contactId", e.target.value)}
              />
            </label>
            <label>
              Conversation ID
              <input
                value={editForm.conversationId}
                onChange={(e) => setEditFormField("conversationId", e.target.value)}
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Task ID
              <input
                value={editForm.taskId}
                onChange={(e) => setEditFormField("taskId", e.target.value)}
              />
            </label>
            <label>
              Notification ID
              <input
                value={editForm.notificationId}
                onChange={(e) => setEditFormField("notificationId", e.target.value)}
              />
            </label>
            <label>
              Workspace ID
              <input
                value={editForm.workspaceId}
                onChange={(e) => setEditFormField("workspaceId", e.target.value)}
              />
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              checked={editForm.humanOverride}
              onChange={(e) => setEditFormField("humanOverride", e.target.checked)}
            />
            {" "}Human override
          </label>
        </details>
        <details className="ff-memory-advanced">
          <summary>Advanced metadata</summary>
          <label>
            Advanced metadata JSON
            <textarea
              rows={6}
              value={editForm.advancedMetadataJson}
              onChange={(e) => setEditFormField("advancedMetadataJson", e.target.value)}
            />
          </label>
        </details>
        <div className="fg-actions">
          <button
            type="submit"
            disabled={
              !canGovern || savingUpdate || !editForm.title.trim() || !editForm.body.trim()
            }
          >
            {savingUpdate ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* Correct */}
      <form
        className="ff-memory-gov-form ff-memory-gov-destructive"
        onSubmit={(e) => {
          if (!confirmCorrection) {
            e.preventDefault();
            setConfirmCorrection(true);
            return;
          }
          setConfirmCorrection(false);
          void handleCorrect(e);
        }}
      >
        <h4>Correct memory</h4>
        <p className="fg-muted">
          Correction creates a new active successor, supersedes the current truth,
          and preserves revision history.
        </p>
        <label>
          Title
          <input
            value={correctionForm.title}
            onChange={(e) => setCorrectionFormField("title", e.target.value)}
          />
        </label>
        <label>
          Body
          <textarea
            rows={4}
            value={correctionForm.body}
            onChange={(e) => setCorrectionFormField("body", e.target.value)}
          />
        </label>
        <label>
          Correction note
          <input
            value={correctionForm.correctionNote}
            onChange={(e) => setCorrectionFormField("correctionNote", e.target.value)}
            placeholder="Reason for correction"
          />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Memory layer
            <select
              value={correctionForm.memoryLayer}
              onChange={(e) => setCorrectionFormField("memoryLayer", e.target.value as MemoryLayer)}
            >
              {MEMORY_LAYER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Source trust
            <select
              value={correctionForm.sourceTrustClass}
              onChange={(e) => setCorrectionFormField("sourceTrustClass", e.target.value as MemorySourceTrustClass)}
            >
              {SOURCE_TRUST_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Memory kind
            <select
              value={correctionForm.memoryKind}
              onChange={(e) => setCorrectionFormField("memoryKind", e.target.value as MemoryKind)}
            >
              {MEMORY_KIND_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Visibility
            <select
              value={correctionForm.visibilityScope}
              onChange={(e) => setCorrectionFormField("visibilityScope", e.target.value as VisibilityScope)}
            >
              {VISIBILITY_OPTIONS.filter((o) => o !== "all").map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Sensitivity
            <select
              value={correctionForm.sensitivity}
              onChange={(e) => setCorrectionFormField("sensitivity", e.target.value as MemorySensitivity)}
            >
              {SENSITIVITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Expires at
            <input
              value={correctionForm.expiresAt}
              onChange={(e) => setCorrectionFormField("expiresAt", e.target.value)}
            />
          </label>
        </div>
        <details className="ff-memory-advanced">
          <summary>Advanced metadata</summary>
          <label>
            Advanced metadata JSON
            <textarea
              rows={6}
              value={correctionForm.advancedMetadataJson}
              onChange={(e) => setCorrectionFormField("advancedMetadataJson", e.target.value)}
            />
          </label>
        </details>
        <div className="fg-actions">
          {confirmCorrection ? (
            <div className="ff-memory-confirm">
              <span className="ff-memory-confirm-text">
                This will supersede the current memory entry and create a corrected version. Continue?
              </span>
              <button
                type="submit"
                className="ff-memory-confirm-yes"
                disabled={!canGovern || savingCorrection || !correctionForm.title.trim() || !correctionForm.body.trim() || !correctionForm.correctionNote.trim()}
              >
                {savingCorrection ? "Correcting…" : "Confirm correction"}
              </button>
              <button
                type="button"
                className="ff-memory-confirm-no"
                onClick={() => setConfirmCorrection(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!canGovern || savingCorrection || !correctionForm.title.trim() || !correctionForm.body.trim() || !correctionForm.correctionNote.trim()}
            >
              Correct memory
            </button>
          )}
        </div>
      </form>

      {/* Revoke */}
      <form
        className="ff-memory-gov-form ff-memory-gov-destructive"
        onSubmit={(e) => {
          if (!confirmRevoke) {
            e.preventDefault();
            setConfirmRevoke(true);
            return;
          }
          setConfirmRevoke(false);
          void handleRevoke(e);
        }}
      >
        <h4>Revoke memory</h4>
        <p className="fg-muted">
          Revocation keeps the current record in place but marks its truth invalid.
          It does not create a successor and is not deletion.
        </p>
        <label>
          Revocation note
          <input
            value={revokeForm.revocationNote}
            onChange={(e) => setRevokeFormField("revocationNote", e.target.value)}
            placeholder="Reason for revocation"
          />
        </label>
        <div className="fg-actions">
          {confirmRevoke ? (
            <div className="ff-memory-confirm">
              <span className="ff-memory-confirm-text">
                This will mark the current memory entry as revoked. This action cannot be reversed. Continue?
              </span>
              <button
                type="submit"
                className="ff-memory-confirm-yes"
                disabled={!canGovern || savingRevoke || !revokeForm.revocationNote.trim()}
              >
                {savingRevoke ? "Revoking…" : "Confirm revocation"}
              </button>
              <button
                type="button"
                className="ff-memory-confirm-no"
                onClick={() => setConfirmRevoke(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!canGovern || savingRevoke || !revokeForm.revocationNote.trim()}
            >
              Revoke memory
            </button>
          )}
        </div>
      </form>

      {/* Delete */}
      <form
        className="ff-memory-gov-form ff-memory-gov-destructive"
        onSubmit={(e) => {
          if (!confirmDelete) {
            e.preventDefault();
            setConfirmDelete(true);
            return;
          }
          setConfirmDelete(false);
          void handleDelete(e);
        }}
      >
        <h4>Delete memory</h4>
        <p className="fg-muted">
          Deletion tombstones the record and preserves a historical audit trail.
          It is distinct from revocation or correction.
        </p>
        <label>
          Deletion note
          <input
            value={deleteForm.deletionNote}
            onChange={(e) => setDeleteFormField("deletionNote", e.target.value)}
            placeholder="Reason for deletion"
          />
        </label>
        <div className="fg-actions">
          {confirmDelete ? (
            <div className="ff-memory-confirm">
              <span className="ff-memory-confirm-text">
                This will tombstone the memory entry permanently. This action cannot be reversed. Continue?
              </span>
              <button
                type="submit"
                className="ff-memory-confirm-yes"
                disabled={!canGovern || savingDelete}
              >
                {savingDelete ? "Deleting…" : "Confirm deletion"}
              </button>
              <button
                type="button"
                className="ff-memory-confirm-no"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button type="submit" disabled={!canGovern || savingDelete}>
              Delete memory
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
