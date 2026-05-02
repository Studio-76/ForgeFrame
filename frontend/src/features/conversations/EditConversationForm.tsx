import { type FormEvent } from "react";

import type {
  ConversationDetail,
  ConversationStatus,
  TriageStatus,
  WorkItemPriority,
} from "../../api/admin";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TRIAGE_OPTIONS,
  type EditConversationForm,
} from "./types";

/** Props for the {@link EditConversationFormComponent} component. */
export interface EditConversationFormProps {
  detail: ConversationDetail | null;
  editForm: EditConversationForm;
  canMutate: boolean;
  savingUpdate: boolean;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setEditForm: React.Dispatch<React.SetStateAction<EditConversationForm>>;
}

/**
 * Edit conversation settings form.
 * Renders the right-side edit form for updating conversation metadata, status,
 * triage, priority, linked objects, and active thread.
 */
export function EditConversationFormComponent({
  detail,
  editForm,
  canMutate,
  savingUpdate,
  handleUpdate,
  setEditForm,
}: EditConversationFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Conversation settings</h3>
          <p className="fg-muted">Create and edit remain secondary actions. Use them to keep summary, triage, and object linkage coherent around the active work thread.</p>
        </div>
        <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
          {detail ? detail.conversation_id : "Select a conversation"}
        </span>
      </div>

      {detail ? (
        <div className="fg-stack">
          <form className="fg-stack" onSubmit={handleUpdate}>
            <label>
              Subject
              <input value={editForm.subject} onChange={(event) => setEditForm((current) => ({ ...current, subject: event.target.value }))} />
            </label>
            <label>
              Summary
              <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Workspace ID
                <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
              </label>
              <label>
                Status
                <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ConversationStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Active thread
                <select value={editForm.activeThreadId} onChange={(event) => setEditForm((current) => ({ ...current, activeThreadId: event.target.value }))}>
                  <option value="">none</option>
                  {detail.threads.map((thread) => (
                    <option key={thread.thread_id} value={thread.thread_id}>{thread.title} ({thread.thread_id})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Triage
                <select value={editForm.triageStatus} onChange={(event) => setEditForm((current) => ({ ...current, triageStatus: event.target.value as TriageStatus }))}>
                  {TRIAGE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                  {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Contact ref
                <input value={editForm.contactRef} onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Run ID
                <input value={editForm.runId} onChange={(event) => setEditForm((current) => ({ ...current, runId: event.target.value }))} />
              </label>
              <label>
                Artifact ID
                <input value={editForm.artifactId} onChange={(event) => setEditForm((current) => ({ ...current, artifactId: event.target.value }))} />
              </label>
              <label>
                Approval ID
                <input value={editForm.approvalId} onChange={(event) => setEditForm((current) => ({ ...current, approvalId: event.target.value }))} />
              </label>
            </div>
            <label>
              Decision ID
              <input value={editForm.decisionId} onChange={(event) => setEditForm((current) => ({ ...current, decisionId: event.target.value }))} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingUpdate}>
                {savingUpdate ? "Saving conversation" : "Save conversation"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="fg-muted">Select a conversation before attempting a mutation or continuation.</p>
      )}
    </article>
  );
}
