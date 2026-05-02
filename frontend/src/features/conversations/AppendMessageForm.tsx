import { type FormEvent } from "react";

import type {
  AgentSummary,
  ConversationDetail,
} from "../../api/domain";
import {
  MESSAGE_ROLE_OPTIONS,
  SESSION_KIND_OPTIONS,
  type AppendConversationForm,
} from "./types";

/** Props for the {@link AppendMessageForm} component. */
export interface AppendMessageFormProps {
  detail: ConversationDetail;
  appendForm: AppendConversationForm;
  canMutate: boolean;
  savingAppend: boolean;
  mentionSelectableAgents: AgentSummary[];
  roundtableSelectableAgents: AgentSummary[];
  handoffSelectableAgents: AgentSummary[];
  composerStructuredSelections: string[];
  instanceId: string;
  handleAppend: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setAppendForm: React.Dispatch<React.SetStateAction<AppendConversationForm>>;
}

/**
 * Message composer with structured agent routing.
 * Renders the append message form with thread/session context, agent routing, and message body.
 */
export function AppendMessageForm({
  detail,
  appendForm,
  canMutate,
  savingAppend,
  mentionSelectableAgents,
  roundtableSelectableAgents,
  handoffSelectableAgents,
  composerStructuredSelections,
  instanceId,
  handleAppend,
  setAppendForm,
}: AppendMessageFormProps) {
  return (
    <form className="fg-stack" onSubmit={handleAppend}>
      <h4>Append message</h4>
      <p className="fg-muted">Message composer with structured @Agent routing. Mentions, handoffs, review requests, blockers, and roundtables are persisted as first-class conversation objects.</p>
      <article className="fg-subcard">
        <h4>Structured agent routing</h4>
        {composerStructuredSelections.length === 0 ? (
          <p className="fg-muted">No structured agent routing is selected yet. The composer will still persist the message against the chosen thread/session context.</p>
        ) : (
          <ul className="fg-list">
            {composerStructuredSelections.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </article>
      <div className="fg-grid fg-grid-compact">
        <label>
          Thread
          <select value={appendForm.threadId} onChange={(event) => setAppendForm((current) => ({ ...current, threadId: event.target.value }))}>
            <option value="">active thread</option>
            {detail.threads.map((thread) => (
              <option key={thread.thread_id} value={thread.thread_id}>{thread.title} ({thread.thread_id})</option>
            ))}
          </select>
        </label>
        <label>
          Session
          <select value={appendForm.sessionId} onChange={(event) => setAppendForm((current) => ({ ...current, sessionId: event.target.value }))}>
            <option value="">latest or new</option>
            {detail.sessions.map((sessionItem) => (
              <option key={sessionItem.session_id} value={sessionItem.session_id}>
                {sessionItem.session_kind} ({sessionItem.session_id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Start new session
          <select value={appendForm.startNewSession} onChange={(event) => setAppendForm((current) => ({ ...current, startNewSession: event.target.value as "yes" | "no" }))}>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Session kind
          <select value={appendForm.sessionKind} onChange={(event) => setAppendForm((current) => ({ ...current, sessionKind: event.target.value as import("../../api/domain").ConversationSessionKind }))}>
            {SESSION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Message role
          <select value={appendForm.messageRole} onChange={(event) => setAppendForm((current) => ({ ...current, messageRole: event.target.value as import("../../api/domain").ConversationMessageRole }))}>
            {MESSAGE_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Continuity key
          <input value={appendForm.continuityKey} onChange={(event) => setAppendForm((current) => ({ ...current, continuityKey: event.target.value }))} placeholder="assistant-review-2" />
        </label>
      </div>
      <label>
        Thread title
        <input value={appendForm.threadTitle} onChange={(event) => setAppendForm((current) => ({ ...current, threadTitle: event.target.value }))} placeholder="Follow-up" />
      </label>
      <div className="fg-card-grid">
        <label>
          Mention agents
          <select
            multiple
            size={Math.min(Math.max(mentionSelectableAgents.length, 3), 6)}
            value={appendForm.mentionAgentIds}
            onChange={(event) => setAppendForm((current) => ({
              ...current,
              mentionAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
            }))}
          >
            {mentionSelectableAgents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                @{agent.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Roundtable agents
          <select
            multiple
            size={Math.min(Math.max(roundtableSelectableAgents.length, 3), 6)}
            value={appendForm.roundtableAgentIds}
            onChange={(event) => setAppendForm((current) => ({
              ...current,
              roundtableAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
            }))}
          >
            {roundtableSelectableAgents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                {agent.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Handoff to
          <select
            value={appendForm.handoffToAgentId}
            onChange={(event) => setAppendForm((current) => ({ ...current, handoffToAgentId: event.target.value }))}
          >
            <option value="">none</option>
            {handoffSelectableAgents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>
            ))}
          </select>
        </label>
        <label>
          Review request
          <select
            value={appendForm.reviewRequestAgentId}
            onChange={(event) => setAppendForm((current) => ({ ...current, reviewRequestAgentId: event.target.value }))}
          >
            <option value="">none</option>
            {handoffSelectableAgents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>
            ))}
          </select>
        </label>
        <label>
          Blocker owner
          <select
            value={appendForm.blockerAgentId}
            onChange={(event) => setAppendForm((current) => ({ ...current, blockerAgentId: event.target.value }))}
          >
            <option value="">none</option>
            {handoffSelectableAgents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="fg-muted">Composer routing follows the live registry. Mention targets come from mention-capable modes; handoff, review, and blocker ownership only expose owner-capable modes.</p>
      <label>
        Structured payload JSON
        <textarea rows={4} value={appendForm.structuredPayloadJson} onChange={(event) => setAppendForm((current) => ({ ...current, structuredPayloadJson: event.target.value }))} />
      </label>
      <label>
        Message body
        <textarea rows={4} value={appendForm.body} onChange={(event) => setAppendForm((current) => ({ ...current, body: event.target.value }))} />
      </label>
      <div className="fg-actions">
        <button type="submit" disabled={!canMutate || savingAppend || !appendForm.body.trim()}>
          {savingAppend ? "Appending message" : "Append message"}
        </button>
      </div>
    </form>
  );
}
