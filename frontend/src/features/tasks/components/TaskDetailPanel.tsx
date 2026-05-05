/**
 * TaskDetailPanel — task detail and actions panel.
 *
 * Renders the selected task's detail with checkpoints, linked objects,
 * status actions, reminder path, and linked reminders/notifications.
 *
 * @packageDocumentation
 */

import { useNavigate } from "react-router-dom";

import type { TaskDetail } from "../../../api/domain/tasks";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import { Button } from "../../../components/ui/Button";
import {
  buildConversationPath,
  buildInboxPath,
  buildWorkspacePath,
  buildArtifactsPath,
  buildReminderPath,
  buildNotificationPath,
} from "../../../app/workInteractionRoutes";
import { taskStatusTone, taskQueuePosture, ownerLabel } from "../helpers";

/**
 * Props for TaskDetailPanel.
 */
export type TaskDetailPanelProps = {
  /** Current task detail. */
  detail: TaskDetail | null;
  /** Detail load state. */
  detailState: LoadState;
  /** Current instance ID for link construction. */
  instanceId: string;
  /** Whether mutations are allowed. */
  canMutate: boolean;
  /** Status action loading states. */
  statusActionState: Record<string, boolean>;
  /** Whether a reminder creation is in progress. */
  creatingReminder: boolean;
  /** Callback to open edit drawer. */
  onOpenEdit: () => void;
  /** Callback for status transitions. */
  onStatusAction: (nextStatus: string) => void;
  /** Callback to create a reminder from the task. */
  onCreateReminder: () => void;
};

/**
 * Task detail panel with checkpoints, linked objects, status actions, and reminders.
 */
export function TaskDetailPanel({
  detail,
  detailState,
  instanceId,
  canMutate,
  statusActionState,
  creatingReminder,
  onOpenEdit,
  onStatusAction,
  onCreateReminder,
}: TaskDetailPanelProps) {
  const navigate = useNavigate();
  const selectedReminder = detail?.reminders[0] ?? null;
  const selectedNotification = detail?.notifications[0] ?? null;

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Task detail</h3>
          <p className="fg-muted">Owner, checkpoints, linked product objects, status actions, and reminder follow-up converge here.</p>
        </div>
        <div className="fg-actions">
          {detail ? <span className="fg-pill">{detail.task_id}</span> : null}
          <Button variant="secondary" isDisabled={!canMutate || !detail} onPress={onOpenEdit}>
            Edit selected task
          </Button>
        </div>
      </div>

      {detailState === "idle" ? <p className="fg-muted">Select a task to inspect task truth, checkpoint state, and linked product objects.</p> : null}
      {detailState === "loading" ? <p className="fg-muted">Loading task detail.</p> : null}

      {detail ? (
        <div className="fg-stack">
          <div className="fg-actions">
            <span className="fg-pill" data-tone={taskStatusTone(detail.status)}>Backend state {detail.status}</span>
            <span className="fg-pill">Queue posture {taskQueuePosture(detail.status)}</span>
            <span className="fg-pill">{detail.priority} priority</span>
            <span className="fg-pill">owner {ownerLabel(detail.owner_id)}</span>
          </div>

          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Summary</h4>
              <ul className="fg-list">
                <li>Task kind: {detail.task_kind}</li>
                <li>Status: {detail.status}</li>
                <li>Queue posture: {taskQueuePosture(detail.status)}</li>
                <li>Priority: {detail.priority}</li>
                <li>Owner: {ownerLabel(detail.owner_id)}</li>
                <li>Due at: {detail.due_at ?? "Not scheduled"}</li>
                <li>Completed at: {detail.completed_at ?? "Not completed"}</li>
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Checkpoints</h4>
              <ul className="fg-list">
                <li>Reminders: {detail.reminders.length}</li>
                <li>Notifications: {detail.notifications.length}</li>
                <li>First reminder: {selectedReminder ? `${selectedReminder.title} (${selectedReminder.status})` : "No reminder linked"}</li>
                <li>First notification: {selectedNotification ? `${selectedNotification.title} (${selectedNotification.delivery_status})` : "No notification linked"}</li>
              </ul>
            </article>
          </div>

          <article className="fg-subcard">
            <h4>Linked objects</h4>
            <ul className="fg-list">
              <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
              <li>Inbox item: {detail.inbox_id ?? "Not linked"}</li>
              <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
              <li>Run / approval / artifact: bridge-only via the linked conversation, inbox item, or workspace</li>
            </ul>
            <div className="fg-actions">
              {detail.conversation_id ? (
                <Button variant="navigation" onPress={() => navigate(buildConversationPath({ instanceId, conversationId: detail.conversation_id! }))}>
                  Open conversation
                </Button>
              ) : null}
              {detail.inbox_id ? (
                <Button variant="navigation" onPress={() => navigate(buildInboxPath({ instanceId, inboxId: detail.inbox_id! }))}>
                  Open inbox item
                </Button>
              ) : null}
              {detail.workspace_id ? (
                <Button variant="navigation" onPress={() => navigate(buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id! }))}>
                  Open workspace
                </Button>
              ) : null}
              {detail.workspace_id ? (
                <Button variant="navigation" onPress={() => navigate(buildArtifactsPath({ instanceId, workspaceId: detail.workspace_id! }))}>
                  Open artifacts
                </Button>
              ) : null}
            </div>
            <p className="fg-muted">The current task backend model does not persist run or approval IDs directly on tasks. Artifact context is reachable through the linked workspace when present; otherwise the missing task-level linkage remains `bridge-only` instead of being faked.</p>
          </article>

          <article className="fg-subcard">
            <h4>Status actions</h4>
            <p className="fg-muted">Apply real lifecycle changes from the detail panel instead of opening the edit drawer for every state transition.</p>
            <div className="fg-actions">
              <Button variant="secondary" isDisabled={!canMutate || statusActionState.open} onPress={() => onStatusAction("open")}>
                {statusActionState.open ? "Reopening" : "Reopen"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || statusActionState.in_progress} onPress={() => onStatusAction("in_progress")}>
                {statusActionState.in_progress ? "Starting" : "Start work"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || statusActionState.blocked} onPress={() => onStatusAction("blocked")}>
                {statusActionState.blocked ? "Blocking" : "Block task"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || statusActionState.done} onPress={() => onStatusAction("done")}>
                {statusActionState.done ? "Completing" : "Complete task"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || statusActionState.cancelled} onPress={() => onStatusAction("cancelled")}>
                {statusActionState.cancelled ? "Cancelling" : "Cancel task"}
              </Button>
            </div>
          </article>

          <article className="fg-subcard">
            <h4>Reminder path</h4>
            <p className="fg-muted">Tasks can create or link reminders directly when a due date exists.</p>
            <div className="fg-actions">
              <Button variant="navigation" onPress={() => navigate(buildReminderPath({ instanceId }))}>
                Open reminders
              </Button>
              {selectedReminder ? (
                <Button variant="navigation" onPress={() => navigate(buildReminderPath({ instanceId, reminderId: selectedReminder.reminder_id }))}>
                  Open first reminder
                </Button>
              ) : null}
              {!selectedReminder && detail.due_at ? (
                <Button variant="secondary" isDisabled={!canMutate || creatingReminder} onPress={onCreateReminder}>
                  {creatingReminder ? "Creating reminder" : "Create reminder from task"}
                </Button>
              ) : null}
            </div>
            {!selectedReminder && !detail.due_at ? (
              <p className="fg-muted">Direct reminder creation is `not-ready` until the task has a due date. Set `due_at` in the drawer before creating the reminder.</p>
            ) : null}
          </article>

          <article className="fg-subcard">
            <h4>Summary text</h4>
            <p>{detail.summary || "No task summary was recorded."}</p>
          </article>

          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Reminders</h4>
              {detail.reminders.length === 0 ? <p className="fg-muted">No reminders are linked to this task.</p> : (
                <ul className="fg-list">
                  {detail.reminders.map((reminder) => (
                    <li key={reminder.reminder_id}>
                      <Button variant="navigation" onPress={() => navigate(buildReminderPath({ instanceId, reminderId: reminder.reminder_id }))}>
                        {reminder.title}
                      </Button>
                      {" · "}{reminder.status}
                      {" · due "}{reminder.due_at}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="fg-subcard">
              <h4>Notifications</h4>
              <div className="fg-actions">
                <Button variant="navigation" onPress={() => navigate(buildNotificationPath({ instanceId }))}>
                  Open notifications
                </Button>
                {selectedNotification ? (
                  <Button variant="navigation" onPress={() => navigate(buildNotificationPath({ instanceId, notificationId: selectedNotification.notification_id }))}>
                    Open first notification
                  </Button>
                ) : null}
              </div>
              {detail.notifications.length === 0 ? <p className="fg-muted">No notifications are linked to this task.</p> : (
                <ul className="fg-list">
                  {detail.notifications.map((notification) => (
                    <li key={notification.notification_id}>
                      <Button variant="navigation" onPress={() => navigate(buildNotificationPath({ instanceId, notificationId: notification.notification_id }))}>
                        {notification.title}
                      </Button>
                      {" · "}{notification.delivery_status}
                      {" · "}{notification.priority}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </div>
      ) : null}
    </article>
  );
}
