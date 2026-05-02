import type { AgentSummary } from "../../api/admin";
import {
  LINK_LENS_OPTIONS,
  STATUS_OPTIONS,
  TRIAGE_OPTIONS,
  type ConversationLinkLens,
  type LoadState,
} from "./types";

/** Props for the {@link ConversationFilterBar} component. */
export interface ConversationFilterBarProps {
  instances: Array<{ instance_id: string; display_name: string }>;
  instanceId: string;
  statusFilter: string;
  triageFilter: string;
  agentFilter: string;
  linkLens: ConversationLinkLens;
  agents: AgentSummary[];
  instancesState: LoadState;
  agentsState: LoadState;
  tasksState: LoadState;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  setLinkLens: React.Dispatch<React.SetStateAction<ConversationLinkLens>>;
}

/**
 * Filter controls for the conversation page.
 * Renders instance, status, triage, agent, and link lens selectors.
 */
export function ConversationFilterBar({
  instances,
  instanceId,
  statusFilter,
  triageFilter,
  agentFilter,
  linkLens,
  agents,
  instancesState,
  agentsState,
  tasksState,
  updateRoute,
  setLinkLens,
}: ConversationFilterBarProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Scope and filter</h3>
          <p className="fg-muted">Choose the instance boundary, then constrain the work surface by lifecycle, triage, responsible agents, and linked task/run/approval objects.</p>
        </div>
        <span
          className="fg-pill"
          data-tone={
            instancesState === "error" || agentsState === "error" || tasksState === "error"
              ? "danger"
              : instancesState === "success" && agentsState !== "loading" && tasksState !== "loading"
                ? "success"
                : "neutral"
          }
        >
          instances {instancesState} · agents {agentsState} · tasks {tasksState}
        </span>
      </div>
      <div className="fg-inline-form">
        <label>
          Instance
          <select
            aria-label="Conversation instance"
            value={instanceId}
            onChange={(event) => updateRoute((next) => {
              next.set("instanceId", event.target.value);
              next.delete("conversationId");
            })}
          >
            {instances.map((instance) => (
              <option key={instance.instance_id} value={instance.instance_id}>
                {instance.display_name} ({instance.instance_id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Conversation status filter"
            value={statusFilter}
            onChange={(event) => updateRoute((next) => {
              const nextStatus = event.target.value;
              if (nextStatus === "all") {
                next.delete("status");
              } else {
                next.set("status", nextStatus);
              }
              next.delete("conversationId");
            })}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Triage
          <select
            aria-label="Conversation triage filter"
            value={triageFilter}
            onChange={(event) => updateRoute((next) => {
              const nextTriage = event.target.value;
              if (nextTriage === "all") {
                next.delete("triageStatus");
              } else {
                next.set("triageStatus", nextTriage);
              }
              next.delete("conversationId");
            })}
          >
            {TRIAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Agent lens
          <select
            aria-label="Conversation agent filter"
            value={agentFilter}
            onChange={(event) => updateRoute((next) => {
              const nextAgentId = event.target.value;
              if (nextAgentId) {
                next.set("agentId", nextAgentId);
              } else {
                next.delete("agentId");
              }
              next.delete("conversationId");
            })}
          >
            <option value="">all agents</option>
            {agents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                {agent.display_name} ({agent.agent_id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Link lens
          <select
            aria-label="Conversation link lens"
            value={linkLens}
            onChange={(event) => setLinkLens(event.target.value as ConversationLinkLens)}
          >
            {LINK_LENS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
