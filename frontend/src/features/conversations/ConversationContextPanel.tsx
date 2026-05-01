import { Link } from "react-router-dom";

import type {
  AgentSummary,
  ConversationDetail,
  TaskSummary,
} from "../../api/admin";
import {
  buildAgentsPath,
  buildArtifactsPath,
  buildConversationPath,
  buildInboxPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../../app/workInteractionRoutes";
import {
  MESSAGE_DIRECTION_OPTIONS,
  type LoadState,
  type MessageDirectionLens,
} from "./types";
import { buildApprovalRoute, buildExecutionRoute } from "./utils";

/** Props for the {@link ConversationContextPanel} component. */
export interface ConversationContextPanelProps {
  detail: ConversationDetail | null;
  instanceId: string;
  threadLensId: string;
  messageDirectionLens: MessageDirectionLens;
  messageAgentLensId: string;
  selectableAgents: AgentSummary[];
  visibleTasks: TaskSummary[];
  tasksState: LoadState;
  resolveAgentLabel: (agentId: string | null | undefined) => string;
  setThreadLensId: React.Dispatch<React.SetStateAction<string>>;
  setMessageDirectionLens: React.Dispatch<React.SetStateAction<MessageDirectionLens>>;
  setMessageAgentLensId: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Context panel for the conversation page.
 * Renders the right column with lens controls, linked objects, tasks, thread/session context,
 * agent participation, and mentions/events.
 */
export function ConversationContextPanel({
  detail,
  instanceId,
  threadLensId,
  messageDirectionLens,
  messageAgentLensId,
  selectableAgents,
  visibleTasks,
  tasksState,
  resolveAgentLabel,
  setThreadLensId,
  setMessageDirectionLens,
  setMessageAgentLensId,
}: ConversationContextPanelProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Context and objects</h3>
          <p className="fg-muted">Thread, session, tasks, runs, approvals, workspaces, artifacts, and agent events stay visible on the right so continuation never loses its runtime or governance context.</p>
        </div>
        <span className="fg-pill" data-tone={detail ? "success" : "neutral"}>
          {detail ? "Context loaded" : "No conversation selected"}
        </span>
      </div>

      {detail ? (
        <div className="fg-stack">
          <article className="fg-subcard">
            <h4>Conversation lenses</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Thread lens
                <select value={threadLensId} onChange={(event) => setThreadLensId(event.target.value)}>
                  <option value="all">all threads</option>
                  {detail.threads.map((thread) => (
                    <option key={thread.thread_id} value={thread.thread_id}>{thread.title}</option>
                  ))}
                </select>
              </label>
              <label>
                An/von Agent
                <select value={messageDirectionLens} onChange={(event) => setMessageDirectionLens(event.target.value as MessageDirectionLens)}>
                  {MESSAGE_DIRECTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Agent
                <select value={messageAgentLensId} onChange={(event) => setMessageAgentLensId(event.target.value)}>
                  <option value="">all agents</option>
                  {selectableAgents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>

          <article className="fg-subcard">
            <h4>Linked objects</h4>
            <ul className="fg-list">
              <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
              <li>Run: {detail.run_id ?? "Not linked"}</li>
              <li>Approval: {detail.approval_id ?? "Not linked"}</li>
              <li>Artifact: {detail.artifact_id ?? "Not linked"}</li>
              <li>Decision: {detail.decision_id ?? "Not linked"}</li>
              <li>Tasks: {visibleTasks.length > 0 ? `${visibleTasks.length} linked` : tasksState === "loading" ? "Loading" : "No linked tasks"}</li>
            </ul>
            <div className="fg-actions">
              {detail.workspace_id ? (
                <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>
                  Open workspace
                </Link>
              ) : null}
              {detail.run_id ? (
                <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.run_id)}>
                  Open execution review
                </Link>
              ) : null}
              {detail.approval_id ? (
                <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.approval_id)}>
                  Open approval review
                </Link>
              ) : null}
              {detail.artifact_id ? (
                <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>
                  Open artifact
                </Link>
              ) : null}
              {detail.inbox_items[0] ? (
                <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_items[0].inbox_id })}>
                  Open inbox item
                </Link>
              ) : null}
              {visibleTasks[0] ? (
                <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: visibleTasks[0].task_id })}>
                  Open task
                </Link>
              ) : null}
            </div>
          </article>

          <article className="fg-subcard">
            <h4>Related tasks</h4>
            {tasksState === "loading" ? <p className="fg-muted">Loading task links.</p> : null}
            {visibleTasks.length === 0 ? <p className="fg-muted">No tasks are currently linked to this conversation.</p> : null}
            {visibleTasks.length > 0 ? (
              <ul className="fg-list">
                {visibleTasks.map((task) => (
                  <li key={task.task_id}>
                    <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: task.task_id })}>{task.title}</Link>
                    {" · "}{task.status}
                    {" · "}{task.priority}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <article className="fg-subcard">
            <h4>Thread and session context</h4>
            <ul className="fg-list">
              {detail.threads.map((thread) => (
                <li key={thread.thread_id}>
                  <span className="fg-code">{thread.thread_id}</span>
                  {" · "}{thread.title}
                  {" · "}{thread.status}
                  {" · messages "}{thread.message_count}
                </li>
              ))}
              {detail.sessions.map((sessionItem) => (
                <li key={sessionItem.session_id}>
                  <span className="fg-code">{sessionItem.session_id}</span>
                  {" · "}{sessionItem.session_kind}
                  {" · "}{sessionItem.continuity_key ?? "no continuity key"}
                </li>
              ))}
            </ul>
          </article>

          <article className="fg-subcard">
            <h4>Agent participation</h4>
            {detail.participants.length === 0
              ? <p className="fg-muted">No agent participants were recorded.</p>
              : (
                <ul className="fg-list">
                  {detail.participants.map((participant) => (
                    <li key={participant.participant_id}>
                      <Link className="fg-nav-link" to={buildConversationPath({
                        instanceId,
                        conversationId: detail.conversation_id,
                        agentId: participant.agent_id ?? undefined,
                      })}>
                        {participant.display_label}
                      </Link>
                      {" · "}{participant.participant_kind}
                      {" · "}{participant.participant_status}
                      {participant.agent_id ? (
                        <>
                          {" · "}
                          <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: participant.agent_id })}>
                            Open agent
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
          </article>

          <article className="fg-subcard">
            <h4>Mentions and events</h4>
            {detail.mentions.length === 0 && detail.events.length === 0
              ? <p className="fg-muted">No structured mentions or agent events were recorded.</p>
              : null}
            {detail.mentions.length > 0 ? (
              <ul className="fg-list">
                {detail.mentions.map((mention) => (
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
            {detail.events.length > 0 ? (
              <ul className="fg-list">
                {detail.events.map((eventItem) => (
                  <li key={eventItem.event_id}>
                    <strong>{eventItem.summary}</strong>
                    {" · "}{eventItem.event_type}
                    {eventItem.target_agent_id ? ` · ${resolveAgentLabel(eventItem.target_agent_id)}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </div>
      ) : (
        <p className="fg-muted">Select a conversation to expose lenses, tasks, sessions, approvals, workspace links, and agent events.</p>
      )}
    </article>
  );
}
