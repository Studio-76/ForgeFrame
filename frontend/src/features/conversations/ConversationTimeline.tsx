import { Link } from "react-router-dom";

import type { ConversationDetail } from "../../api/domain";
import { buildAgentsPath } from "../../app/workInteractionRoutes";
import type {
  LoadState,
  TimelineItem,
} from "./types";

/** Props for the {@link ConversationTimeline} component. */
export interface ConversationTimelineProps {
  detail: ConversationDetail | null;
  detailState: LoadState;
  filteredTimelineItems: TimelineItem[];
  threadTitleById: Map<string, string>;
  sessionById: Map<string, ConversationDetail["sessions"][number]>;
  resolveAgentLabel: (agentId: string | null | undefined) => string;
  instanceId: string;
}

/**
 * Message/event timeline panel.
 * Renders the center column showing the current work header and filtered timeline items.
 */
export function ConversationTimeline({
  detail,
  detailState,
  filteredTimelineItems,
  threadTitleById,
  sessionById,
  resolveAgentLabel,
  instanceId,
}: ConversationTimelineProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Continuation timeline</h3>
          <p className="fg-muted">Messages and system events stay in one chronological stream, with thread/session context and structured agent routing visible beside each contribution.</p>
        </div>
        {detail ? <span className="fg-pill">{detail.conversation_id}</span> : null}
      </div>

      {detailState === "idle"
        ? <p className="fg-muted">Select a conversation to inspect the live thread and continue work from the correct session context.</p>
        : null}
      {detailState === "loading" ? <p className="fg-muted">Loading conversation detail.</p> : null}

      {detail ? (
        <div className="fg-stack">
          <article className="fg-subcard">
            <h4>Current work header</h4>
            <div className="fg-detail-grid">
              <span className="fg-muted">{detail.subject}</span>
              <span className="fg-muted">active thread {threadTitleById.get(detail.active_thread_id ?? "") ?? detail.active_thread_id ?? "not set"}</span>
              <span className="fg-muted">latest message {detail.latest_message_at ?? "not recorded"}</span>
              <span className="fg-muted">structured @Agent routing ready</span>
            </div>
            <p>{detail.summary || "No conversation summary was recorded."}</p>
          </article>

          <article className="fg-subcard">
            <h4>Timeline</h4>
            {filteredTimelineItems.length === 0
              ? <p className="fg-muted">No timeline items matched the selected thread and agent lenses.</p>
              : null}
            {filteredTimelineItems.length > 0 ? (
              <div className="fg-stack">
                {filteredTimelineItems.map((item) => {
                  if (item.kind === "event") {
                    return (
                      <article key={item.event.event_id} className="fg-subcard">
                        <div className="fg-panel-heading">
                          <div>
                            <strong>System event</strong>
                            <p className="fg-muted">{item.event.created_at} · {threadTitleById.get(item.event.thread_id) ?? item.event.thread_id}</p>
                          </div>
                          <span className="fg-pill" data-tone="warning">{item.event.event_type}</span>
                        </div>
                        <p>{item.event.summary}</p>
                        <p className="fg-muted">
                          {item.event.target_agent_id ? `Target ${resolveAgentLabel(item.event.target_agent_id)}` : "No target agent"}
                          {item.event.related_object_type && item.event.related_object_id
                            ? ` · ${item.event.related_object_type}:${item.event.related_object_id}`
                            : ""}
                        </p>
                      </article>
                    );
                  }

                  const sessionItem = item.message.session_id ? sessionById.get(item.message.session_id) : null;
                  const contributorLabel = item.message.message_role === "assistant" || item.message.author_type === "agent"
                    ? "Agent"
                    : item.message.message_role === "system" || item.message.message_role === "tool"
                      ? "System"
                      : "Human";
                  const contributorTone = contributorLabel === "Agent"
                    ? "success"
                    : contributorLabel === "System"
                      ? "warning"
                      : "neutral";
                  const authorLabel = contributorLabel === "Agent"
                    ? resolveAgentLabel(
                      item.events[0]?.target_agent_id ?? item.mentions[0]?.agent_id ?? item.message.author_id,
                    )
                    : contributorLabel === "System"
                      ? "System event stream"
                      : "Human operator";

                  return (
                    <article key={item.message.message_id} className="fg-subcard">
                      <div className="fg-panel-heading">
                        <div>
                          <strong>{authorLabel}</strong>
                          <p className="fg-muted">
                            {item.message.created_at}
                            {" · "}{threadTitleById.get(item.message.thread_id) ?? item.message.thread_id}
                            {sessionItem ? ` · ${sessionItem.session_kind} session` : " · no session"}
                            {sessionItem?.continuity_key ? ` · ${sessionItem.continuity_key}` : ""}
                          </p>
                        </div>
                        <span className="fg-pill" data-tone={contributorTone}>{contributorLabel}</span>
                      </div>
                      <p>{item.message.body}</p>
                      {Object.keys(item.message.structured_payload).length > 0 ? (
                        <pre>{JSON.stringify(item.message.structured_payload, null, 2)}</pre>
                      ) : null}
                      <div className="fg-detail-grid">
                        <span className="fg-muted">role {item.message.message_role}</span>
                        <span className="fg-muted">author {item.message.author_type}</span>
                        <span className="fg-muted">mentions {item.mentions.length}</span>
                        <span className="fg-muted">events {item.events.length}</span>
                      </div>
                      {item.mentions.length > 0 ? (
                        <ul className="fg-list">
                          {item.mentions.map((mention) => (
                            <li key={mention.mention_id}>
                              <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: mention.agent_id })}>
                                {mention.token}
                              </Link>
                              {" · "}{mention.agent_display_name}
                              {" · "}{mention.status}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </article>
  );
}
