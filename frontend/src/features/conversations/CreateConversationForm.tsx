import type { FormEvent } from "react";

import type {
  AgentSummary,
  ConversationSessionKind,
  ConversationMessageRole,
  TriageStatus,
  WorkItemPriority,
} from "../../api/domain";
import {
  MESSAGE_ROLE_OPTIONS,
  PRIORITY_OPTIONS,
  SESSION_KIND_OPTIONS,
  TRIAGE_OPTIONS,
  type CreateConversationForm,
} from "./types";

/** Props for the {@link CreateConversationForm} component. */
export interface CreateConversationFormProps {
  createForm: CreateConversationForm;
  canMutate: boolean;
  savingCreate: boolean;
  instanceId: string;
  participantSelectableAgents: AgentSummary[];
  mentionSelectableAgents: AgentSummary[];
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateConversationForm>>;
}

/**
 * Create conversation form.
 * Renders all fields needed to create a durable conversation with initial thread,
 * initial session, initial message, and optional inbox entry.
 */
export function CreateConversationFormComponent({
  createForm,
  canMutate,
  savingCreate,
  instanceId,
  participantSelectableAgents,
  mentionSelectableAgents,
  handleCreate,
  setCreateForm,
}: CreateConversationFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Create conversation</h3>
          <p className="fg-muted">Create a durable conversation with initial thread, initial session, initial message, and optional inbox entry.</p>
        </div>
        <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
      </div>
      <form className="fg-stack" onSubmit={handleCreate}>
        <div className="fg-grid fg-grid-compact">
          <label>
            Conversation ID
            <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} placeholder="conversation_customer_pricing" />
          </label>
          <label>
            Workspace ID
            <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
          </label>
        </div>
        <label>
          Subject
          <input value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Customer pricing conversation" />
        </label>
        <label>
          Summary
          <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Triage
            <select value={createForm.triageStatus} onChange={(event) => setCreateForm((current) => ({ ...current, triageStatus: event.target.value as TriageStatus }))}>
              {TRIAGE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Create inbox entry
            <select value={createForm.createInboxEntry} onChange={(event) => setCreateForm((current) => ({ ...current, createInboxEntry: event.target.value as "yes" | "no" }))}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Contact ref
            <input value={createForm.contactRef} onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))} placeholder="contact://customer/acme" />
          </label>
          <label>
            Run ID
            <input value={createForm.runId} onChange={(event) => setCreateForm((current) => ({ ...current, runId: event.target.value }))} placeholder="run_alpha" />
          </label>
          <label>
            Artifact ID
            <input value={createForm.artifactId} onChange={(event) => setCreateForm((current) => ({ ...current, artifactId: event.target.value }))} placeholder="artifact_alpha" />
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Approval ID
            <input value={createForm.approvalId} onChange={(event) => setCreateForm((current) => ({ ...current, approvalId: event.target.value }))} placeholder="run:instance_alpha:company_alpha:approval-1" />
          </label>
          <label>
            Decision ID
            <input value={createForm.decisionId} onChange={(event) => setCreateForm((current) => ({ ...current, decisionId: event.target.value }))} placeholder="decision_preview_alpha" />
          </label>
          <label>
            Initial thread title
            <input value={createForm.initialThreadTitle} onChange={(event) => setCreateForm((current) => ({ ...current, initialThreadTitle: event.target.value }))} />
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Initial session
            <select value={createForm.initialSessionKind} onChange={(event) => setCreateForm((current) => ({ ...current, initialSessionKind: event.target.value as ConversationSessionKind }))}>
              {SESSION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Initial message role
            <select value={createForm.initialMessageRole} onChange={(event) => setCreateForm((current) => ({ ...current, initialMessageRole: event.target.value as ConversationMessageRole }))}>
              {MESSAGE_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Continuity key
            <input value={createForm.initialContinuityKey} onChange={(event) => setCreateForm((current) => ({ ...current, initialContinuityKey: event.target.value }))} placeholder="assistant-review-1" />
          </label>
        </div>
        <div className="fg-card-grid">
          <label>
            Participants
            <select
              multiple
              size={Math.min(Math.max(participantSelectableAgents.length, 3), 6)}
              value={createForm.participantAgentIds}
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                participantAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
              }))}
            >
              {participantSelectableAgents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.display_name} ({agent.role_kind})
                </option>
              ))}
            </select>
          </label>
          <label>
            Initial mentions
            <select
              multiple
              size={Math.min(Math.max(mentionSelectableAgents.length, 3), 6)}
              value={createForm.initialMentionAgentIds}
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                initialMentionAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
              }))}
            >
              {mentionSelectableAgents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  @{agent.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="fg-muted">Conversation creation respects agent participation modes: owner-capable agents populate participant lists, while mention pickers exclude `handoff_only` agents.</p>
        <label>
          Initial message
          <textarea rows={4} value={createForm.initialMessageBody} onChange={(event) => setCreateForm((current) => ({ ...current, initialMessageBody: event.target.value }))} />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Inbox title
            <input value={createForm.inboxTitle} onChange={(event) => setCreateForm((current) => ({ ...current, inboxTitle: event.target.value }))} placeholder="Triage pricing request" />
          </label>
          <label>
            Inbox summary
            <input value={createForm.inboxSummary} onChange={(event) => setCreateForm((current) => ({ ...current, inboxSummary: event.target.value }))} placeholder="Customer is waiting for pricing confirmation." />
          </label>
        </div>
        <label>
          Metadata JSON
          <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
        </label>
        <div className="fg-actions">
          <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.subject.trim() || !createForm.initialMessageBody.trim()}>
            {savingCreate ? "Creating conversation" : "Create conversation"}
          </button>
        </div>
      </form>
    </article>
  );
}
