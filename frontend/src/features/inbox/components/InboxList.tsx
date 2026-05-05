/**
 * InboxList — the inbox inventory listing with scope/filter controls.
 *
 * @packageDocumentation
 */

import type { AgentSummary } from "../../../api/domain/agents";
import type { ConversationSummary } from "../../../api/domain/conversations";
import type { TaskSummary } from "../../../api/domain/tasks";
import type { InboxStatus, InboxSummary, TriageStatus, WorkItemPriority } from "../../../api/domain/inbox";
import { inboxQueuePosture, inboxSourceLabel } from "../helpers";
import { PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS, TRIAGE_OPTIONS, type InboxSourceFilter } from "../types";

/** Props for the InboxList component. */
export type InboxListProps = {
  /** Available instances for scope selection. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Currently selected instance ID. */
  instanceId: string;
  /** Load state of instances. */
  instancesState: string;
  /** Load state of agents. */
  agentsState: string;
  /** Load state of tasks. */
  tasksState: string;
  /** Load state of conversations. */
  conversationsState: string;
  /** Load state of the list. */
  listState: string;
  /** Current triage filter. */
  triageFilter: TriageStatus | "all";
  /** Current status filter. */
  statusFilter: InboxStatus | "all";
  /** Current priority filter. */
  priorityFilter: WorkItemPriority | "all";
  /** Current source filter. */
  sourceFilter: InboxSourceFilter;
  /** Current owner filter. */
  ownerFilter: string;
  /** Available owner agents based on current data. */
  availableOwnerAgents: AgentSummary[];
  /** All inbox items. */
  items: InboxSummary[];
  /** Currently selected inbox ID. */
  selectedInboxId: string;
  /** Tasks for computing ownership and linkages. */
  tasks: TaskSummary[];
  /** Conversations for computing ownership and linkages. */
  conversations: ConversationSummary[];
  /** Map of conversation IDs to summaries. */
  conversationById: Map<string, ConversationSummary>;
  /** Map of agent IDs to display names. */
  agentNameById: Map<string, string>;
  /** Filtered visible items after source/owner filtering. */
  visibleItems: InboxSummary[];
  /** Called when the instance selection changes. */
  onInstanceChange: (instanceId: string) => void;
  /** Called when a filter value changes. */
  onFilterChange: (key: string, value: string) => void;
  /** Called when an inbox item is selected. */
  onSelectItem: (inboxId: string) => void;
};

/**
 * Renders the inbox scope/filter card and the inventory listing.
 */
export function InboxList({
  instances,
  instanceId,
  instancesState,
  agentsState,
  tasksState,
  conversationsState,
  listState,
  triageFilter,
  statusFilter,
  priorityFilter,
  sourceFilter,
  ownerFilter,
  availableOwnerAgents,
  items,
  selectedInboxId,
  tasks,
  conversations,
  conversationById,
  agentNameById,
  visibleItems,
  onInstanceChange,
  onFilterChange,
  onSelectItem,
}: InboxListProps) {
  const scopeTone =
    instancesState === "error" || agentsState === "error" || tasksState === "error" || conversationsState === "error"
      ? "danger"
      : instancesState === "success" && agentsState !== "loading" && tasksState !== "loading" && conversationsState !== "loading"
        ? "success"
        : "neutral";

  return (
    <>
      {/* ── Scope and filter card ── */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then narrow the triage queue by status, priority, source, and responsible agent/owner.</p>
          </div>
          <span className="fg-pill" data-tone={scopeTone}>
            instances {instancesState} · agents {agentsState} · tasks {tasksState} · conversations {conversationsState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Inbox instance"
              value={instanceId}
              onChange={(event) => onInstanceChange(event.target.value)}
            >
              {instances.map((inst) => (
                <option key={inst.instance_id} value={inst.instance_id}>
                  {inst.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Triage
            <select
              aria-label="Inbox triage filter"
              value={triageFilter}
              onChange={(event) => onFilterChange("triageStatus", event.target.value)}
            >
              {TRIAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Inbox status filter"
              value={statusFilter}
              onChange={(event) => onFilterChange("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Inbox priority filter"
              value={priorityFilter}
              onChange={(event) => onFilterChange("priority", event.target.value)}
            >
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Inbox source filter"
              value={sourceFilter}
              onChange={(event) => onFilterChange("source", event.target.value)}
            >
              {SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Agent / owner
            <select
              aria-label="Inbox owner filter"
              value={ownerFilter}
              onChange={(event) => onFilterChange("owner", event.target.value)}
            >
              <option value="">all agents</option>
              {availableOwnerAgents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      {/* ── Inbox inventory ── */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Inbox inventory</h3>
            <p className="fg-muted">Each row is a triageable work item with explicit source, priority, and next-path linkage into conversation, task, runtime, or approval follow-up.</p>
          </div>
          <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
            {listState}
          </span>
        </div>

        {listState === "loading" ? <p className="fg-muted">Loading inbox inventory.</p> : null}
        {listState === "success" && visibleItems.length === 0 ? <p className="fg-muted">No inbox items matched the selected filters and lenses.</p> : null}

        {visibleItems.length > 0 ? (
          <div className="fg-stack">
            {visibleItems.map((item) => {
              const linkedTask = tasks.find((task) => task.inbox_id === item.inbox_id);
              const linkedConversation = item.conversation_id ? conversationById.get(item.conversation_id) : null;
              const posture = inboxQueuePosture(item);
              const ownerLabel = linkedTask?.owner_id
                ? (agentNameById.get(linkedTask.owner_id) ?? linkedTask.owner_id)
                : linkedConversation?.participant_agent_ids[0]
                  ? (agentNameById.get(linkedConversation.participant_agent_ids[0]) ?? linkedConversation.participant_agent_ids[0])
                  : "unassigned";
              return (
                <button
                  key={item.inbox_id}
                  type="button"
                  className={`fg-data-row${item.inbox_id === selectedInboxId ? " is-current" : ""}`}
                  onClick={() => onSelectItem(item.inbox_id)}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{item.inbox_id}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={posture.tone}>
                        {posture.label}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{item.status} · {item.priority} priority · source {inboxSourceLabel(item)}</span>
                    <span className="fg-muted">triage {item.triage_status} · owner {ownerLabel}</span>
                    <span className="fg-muted">conversation {item.conversation_id ?? "none"} · task {linkedTask?.task_id ?? "none"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </article>
    </>
  );
}
