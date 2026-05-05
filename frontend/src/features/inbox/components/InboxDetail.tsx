/**
 * InboxDetail — the inbox item detail view with quick actions, summary,
 * conversation summary, related tasks, and edit form.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { Link } from "react-router-dom";

import type { TaskSummary } from "../../../api/domain/tasks";
import type { InboxDetail as InboxDetailType } from "../../../api/domain/inbox";
import { buildConversationPath, buildTaskPath, buildWorkspacePath, buildArtifactsPath } from "../../../app/workInteractionRoutes";
import { inboxQueuePosture, inboxSourceLabel, buildExecutionRoute, buildApprovalRoute } from "../helpers";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TRIAGE_OPTIONS, type EditForm } from "../types";

/** Props for the InboxDetail component. */
export type InboxDetailProps = {
  /** The inbox item detail. */
  detail: InboxDetailType;
  /** Load state of the detail. */
  detailState: string;
  /** Currently selected instance ID. */
  instanceId: string;
  /** Whether the user can mutate inbox items. */
  canMutate: boolean;
  /** Related tasks for this inbox item. */
  relatedTasks: TaskSummary[];
  /** Map of agent IDs to display names. */
  agentNameById: Map<string, string>;
  /** Load state of tasks. */
  tasksState: string;
  /** Current edit form values. */
  editForm: EditForm;
  /** Whether an update is being saved. */
  savingUpdate: boolean;
  /** Per-action loading state for quick actions. */
  quickActionState: Record<string, boolean>;
  /** Called when a quick action is triggered. */
  onQuickAction: (actionKey: string, payload: Partial<Pick<InboxDetailType, "triage_status" | "status">>) => void;
  /** Called to create a conversation from this inbox item. */
  onCreateConversation: () => void;
  /** Called to create a task from this inbox item. */
  onCreateTask: () => void;
  /** Called when the edit form is submitted. */
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  /** Called when an edit form field changes. */
  onEditFormChange: (field: string, value: string) => void;
};

/**
 * Renders the full inbox item detail panel including quick actions,
 * summary, conversation summary, related tasks, and edit form.
 */
export function InboxDetail({
  detail,
  detailState,
  instanceId,
  canMutate,
  relatedTasks,
  agentNameById,
  tasksState,
  editForm,
  savingUpdate,
  quickActionState,
  onQuickAction,
  onCreateConversation,
  onCreateTask,
  onUpdate,
  onEditFormChange,
}: InboxDetailProps) {
  return (
    <>
      {/* ── Detail header and quick actions ── */}
      <div className="fg-stack">
        <div className="fg-actions">
          <span className="fg-pill" data-tone={inboxQueuePosture(detail).tone}>Queue posture {inboxQueuePosture(detail).label}</span>
          <span className="fg-pill">{detail.priority} priority</span>
          <span className="fg-pill">source {inboxSourceLabel(detail)}</span>
        </div>

        <div className="fg-card-grid">
          <article className="fg-subcard">
            <h4>Summary</h4>
            <ul className="fg-list">
              <li>Inbox ID: <span className="fg-code">{detail.inbox_id}</span></li>
              <li>Instance scope: <span className="fg-code">{detail.instance_id}</span></li>
              <li>Execution scope: <span className="fg-code">{detail.company_id}</span></li>
              <li>Triage: {detail.triage_status}</li>
              <li>Status: {detail.status}</li>
              <li>Queue posture: {inboxQueuePosture(detail).label}</li>
              <li>Priority: {detail.priority}</li>
              <li>Source: {inboxSourceLabel(detail)}</li>
              <li>Latest message: {detail.latest_message_at ?? "Not recorded"}</li>
            </ul>
          </article>
          <article className="fg-subcard">
            <h4>Next path</h4>
            <ul className="fg-list">
              <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
              <li>Thread: {detail.thread_id ?? "Not linked"}</li>
              <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
              <li>Run: {detail.run_id ?? "Not linked"}</li>
              <li>Approval: {detail.approval_id ?? "Not linked"}</li>
              <li>Artifact: {detail.artifact_id ?? "Not linked"}</li>
              <li>Decision: {detail.decision_id ?? "Not linked"}</li>
              <li>Contact: {detail.contact_ref ?? "Not recorded"}</li>
              <li>Tasks: {relatedTasks.length > 0 ? `${relatedTasks.length} linked` : "No linked task"}</li>
            </ul>
            <div className="fg-actions">
              {detail.conversation_id
                ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id })}>Open conversation</Link>
                : (
                  <button type="button" disabled={!canMutate || quickActionState.create_conversation} onClick={onCreateConversation}>
                    {quickActionState.create_conversation ? "Creating conversation" : "Create conversation from item"}
                  </button>
                )}
              {relatedTasks[0]
                ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: relatedTasks[0].task_id })}>Open task</Link>
                : (
                  <button type="button" disabled={!canMutate || quickActionState.create_task} onClick={onCreateTask}>
                    {quickActionState.create_task ? "Creating task" : "Create follow-up task"}
                  </button>
                )}
              {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
              {detail.artifact_id ? <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>Open artifact</Link> : null}
              {detail.run_id ? <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.run_id)}>Open execution review</Link> : null}
              {detail.approval_id ? <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.approval_id)}>Open approval review</Link> : null}
            </div>
          </article>
        </div>

        {/* ── Triage actions ── */}
        <article className="fg-subcard">
          <h4>Triage actions</h4>
          <p className="fg-muted">Drive the queue directly from here instead of opening the generic edit form for every state transition.</p>
          <div className="fg-actions">
            <button type="button" disabled={!canMutate || quickActionState.relevant} onClick={() => onQuickAction("relevant", { triage_status: "relevant", status: "open" })}>
              {quickActionState.relevant ? "Setting relevant" : "Mark relevant"}
            </button>
            <button type="button" disabled={!canMutate || quickActionState.delegated} onClick={() => onQuickAction("delegated", { triage_status: "delegated", status: "open" })}>
              {quickActionState.delegated ? "Delegating" : "Delegate"}
            </button>
            <button type="button" disabled={!canMutate || quickActionState.blocked} onClick={() => onQuickAction("blocked", { triage_status: "blocked", status: "open" })}>
              {quickActionState.blocked ? "Blocking" : "Block"}
            </button>
            <button type="button" disabled={!canMutate || quickActionState.waiting} onClick={() => onQuickAction("waiting", { status: "snoozed" })}>
              {quickActionState.waiting ? "Waiting" : "Wait"}
            </button>
            <button type="button" disabled={!canMutate || quickActionState.done} onClick={() => onQuickAction("done", { triage_status: "done", status: "closed" })}>
              {quickActionState.done ? "Completing" : "Done"}
            </button>
            <button type="button" disabled={!canMutate || quickActionState.archive} onClick={() => onQuickAction("archive", { status: "archived" })}>
              {quickActionState.archive ? "Archiving" : "Archive"}
            </button>
          </div>
        </article>

        {/* ── Summary text ── */}
        <article className="fg-subcard">
          <h4>Summary text</h4>
          <p>{detail.summary || "No inbox summary was recorded."}</p>
        </article>

        {/* ── Conversation summary ── */}
        <article className="fg-subcard">
          <h4>Conversation summary</h4>
          {detail.conversation ? (
            <ul className="fg-list">
              <li>
                <Link to={buildConversationPath({ instanceId, conversationId: detail.conversation.conversation_id })}>
                  {detail.conversation.subject}
                </Link>
              </li>
              <li>Status: {detail.conversation.status}</li>
              <li>Triage: {detail.conversation.triage_status}</li>
              <li>Threads: {detail.conversation.thread_count} · sessions {detail.conversation.session_count} · messages {detail.conversation.message_count}</li>
            </ul>
          ) : (
            <p className="fg-muted">No conversation summary is linked to this inbox item.</p>
          )}
        </article>

        {/* ── Related tasks ── */}
        <article className="fg-subcard">
          <h4>Related tasks</h4>
          {tasksState === "loading" ? <p className="fg-muted">Loading linked tasks.</p> : null}
          {relatedTasks.length === 0 ? <p className="fg-muted">No task is currently linked to this inbox item. Use the direct create action above if follow-up should move into task tracking.</p> : null}
          {relatedTasks.length > 0 ? (
            <ul className="fg-list">
              {relatedTasks.map((task) => (
                <li key={task.task_id}>
                  <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: task.task_id })}>{task.title}</Link>
                  {" · "}{task.status}
                  {" · owner "}{task.owner_id ? (agentNameById.get(task.owner_id) ?? task.owner_id) : "unassigned"}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>

      {/* ── Inbox settings / edit form ── */}
      <article className="fg-card" style={{ marginTop: "1rem" }}>
        <div className="fg-panel-heading">
          <div>
            <h3>Inbox settings</h3>
            <p className="fg-muted">Use the form below for deeper edits. Fast triage should happen through the direct actions above.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">{detail.inbox_id}</span>
        </div>
        <form className="fg-stack" onSubmit={onUpdate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Conversation ID
              <input value={editForm.conversationId} onChange={(event) => onEditFormChange("conversationId", event.target.value)} />
            </label>
            <label>
              Thread ID
              <input value={editForm.threadId} onChange={(event) => onEditFormChange("threadId", event.target.value)} />
            </label>
            <label>
              Workspace ID
              <input value={editForm.workspaceId} onChange={(event) => onEditFormChange("workspaceId", event.target.value)} />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Title
              <input value={editForm.title} onChange={(event) => onEditFormChange("title", event.target.value)} />
            </label>
            <label>
              Contact ref
              <input value={editForm.contactRef} onChange={(event) => onEditFormChange("contactRef", event.target.value)} />
            </label>
          </div>
          <label>
            Summary
            <textarea rows={3} value={editForm.summary} onChange={(event) => onEditFormChange("summary", event.target.value)} />
          </label>
          <div className="fg-grid fg-grid-compact">
            <label>
              Triage
              <select value={editForm.triageStatus} onChange={(event) => onEditFormChange("triageStatus", event.target.value)}>
                {TRIAGE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={editForm.priority} onChange={(event) => onEditFormChange("priority", event.target.value)}>
                {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={editForm.status} onChange={(event) => onEditFormChange("status", event.target.value)}>
                {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Run ID
              <input value={editForm.runId} onChange={(event) => onEditFormChange("runId", event.target.value)} />
            </label>
            <label>
              Artifact ID
              <input value={editForm.artifactId} onChange={(event) => onEditFormChange("artifactId", event.target.value)} />
            </label>
            <label>
              Approval ID
              <input value={editForm.approvalId} onChange={(event) => onEditFormChange("approvalId", event.target.value)} />
            </label>
          </div>
          <label>
            Decision ID
            <input value={editForm.decisionId} onChange={(event) => onEditFormChange("decisionId", event.target.value)} />
          </label>
          <label>
            Metadata JSON
            <textarea rows={6} value={editForm.metadataJson} onChange={(event) => onEditFormChange("metadataJson", event.target.value)} />
          </label>
          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingUpdate}>
              {savingUpdate ? "Saving inbox item" : "Save inbox item"}
            </button>
          </div>
        </form>
      </article>
    </>
  );
}
