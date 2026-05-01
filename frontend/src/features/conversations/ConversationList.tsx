import type {
  ConversationDetail,
  ConversationSummary,
} from "../../api/admin";
import type { EditConversationForm, LoadState } from "./types";

/** Props for the {@link ConversationList} component. */
export interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedConversationId: string;
  listState: LoadState;
  visibleConversations: ConversationSummary[];
  detail: ConversationDetail | null;
  threadLensId: string;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  setThreadLensId: React.Dispatch<React.SetStateAction<string>>;
  setEditForm: React.Dispatch<React.SetStateAction<EditConversationForm>>;
}

/**
 * Conversation list panel with thread lane.
 * Renders the left column showing visible conversation items and active thread selector.
 */
export function ConversationList({
  visibleConversations,
  listState,
  selectedConversationId,
  detail,
  threadLensId,
  updateRoute,
  setThreadLensId,
  setEditForm,
}: ConversationListProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Conversation and thread inventory</h3>
          <p className="fg-muted">Choose the work item on the left, then stay in the middle timeline to continue the thread instead of drifting into metadata-only editing.</p>
        </div>
        <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
          {listState}
        </span>
      </div>

      {listState === "loading" ? <p className="fg-muted">Loading conversation inventory.</p> : null}
      {listState === "success" && visibleConversations.length === 0
        ? <p className="fg-muted">No conversations matched the selected filters and link lens.</p>
        : null}

      {visibleConversations.length > 0 ? (
        <div className="fg-stack">
          {visibleConversations.map((conversation) => (
            <button
              key={conversation.conversation_id}
              type="button"
              className={`fg-data-row${conversation.conversation_id === selectedConversationId ? " is-current" : ""}`}
              onClick={() => updateRoute((next) => {
                next.set("conversationId", conversation.conversation_id);
              })}
            >
              <div className="fg-panel-heading fg-data-row-heading">
                <div className="fg-page-header">
                  <span className="fg-code">{conversation.conversation_id}</span>
                  <strong>{conversation.subject}</strong>
                </div>
                <div className="fg-actions">
                  <span className="fg-pill" data-tone={conversation.triage_status === "done" ? "success" : conversation.triage_status === "blocked" ? "danger" : "warning"}>
                    {conversation.triage_status}
                  </span>
                </div>
              </div>
              <div className="fg-detail-grid">
                <span className="fg-muted">{conversation.status} · {conversation.priority} priority · inbox {conversation.inbox_count}</span>
                <span className="fg-muted">threads {conversation.thread_count} · sessions {conversation.session_count} · messages {conversation.message_count}</span>
                <span className="fg-muted">participants {conversation.participant_count} · mentions {conversation.mention_count} · events {conversation.event_count}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {detail?.threads.length ? (
        <article className="fg-subcard">
          <h4>Thread lane</h4>
          <div className="fg-stack">
            {detail.threads.map((thread) => (
              <button
                key={thread.thread_id}
                type="button"
                className={`fg-data-row${thread.thread_id === detail.active_thread_id ? " is-current" : ""}`}
                onClick={() => {
                  setThreadLensId(thread.thread_id);
                  setEditForm((current) => ({ ...current, activeThreadId: thread.thread_id }));
                }}
              >
                <strong>{thread.title}</strong>
                <span className="fg-muted">{thread.status} · messages {thread.message_count} · sessions {thread.session_count}</span>
              </button>
            ))}
          </div>
        </article>
      ) : null}
    </article>
  );
}
