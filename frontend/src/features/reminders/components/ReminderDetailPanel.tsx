/**
 * ReminderDetailPanel — reminder detail and actions panel.
 *
 * Renders the selected reminder's detail with timing, origin, steering
 * actions, task linkage, and notification linkage.
 *
 * @packageDocumentation
 */

import { useNavigate } from "react-router-dom";

import type { ReminderDetail } from "../../../api/domain/reminders";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import { Button } from "../../../components/ui/Button";
import {
  buildTaskPath,
  buildConversationPath,
  buildAutomationPath,
  buildNotificationPath,
} from "../../../app/workInteractionRoutes";
import { reminderStatusTone, reminderDueBucket, reminderIsClosed } from "../helpers";

/**
 * Props for ReminderDetailPanel.
 */
export type ReminderDetailPanelProps = {
  /** Current reminder detail. */
  detail: ReminderDetail | null;
  /** Detail load state. */
  detailState: LoadState;
  /** Current instance ID for link construction. */
  instanceId: string;
  /** Whether mutations are allowed. */
  canMutate: boolean;
  /** Action loading states (snooze, complete, cancel). */
  actionState: Record<"snooze" | "complete" | "cancel", boolean>;
  /** Viewer timezone string. */
  viewerTimeZone: string;
  /** Current timestamp for due bucket calculations. */
  nowMs: number;
  /** Callback to open edit drawer. */
  onOpenEdit: () => void;
  /** Callback for reminder actions (snooze, complete, cancel). */
  onAction: (action: "snooze" | "complete" | "cancel") => void;
};

/**
 * Reminder detail panel with timing, origin, steering actions, and linkage.
 */
export function ReminderDetailPanel({
  detail,
  detailState,
  instanceId,
  canMutate,
  actionState,
  viewerTimeZone,
  nowMs,
  onOpenEdit,
  onAction,
}: ReminderDetailPanelProps) {
  const navigate = useNavigate();
  const originConversationId = detail?.task?.conversation_id ?? detail?.notification?.conversation_id ?? null;
  const linkedTask = detail?.task ?? null;
  const linkedNotification = detail?.notification ?? null;

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Reminder detail</h3>
          <p className="fg-muted">Origin, exact due timing, steering actions, and delivery linkage converge here.</p>
        </div>
        <div className="fg-actions">
          {detail ? <span className="fg-pill">{detail.reminder_id}</span> : null}
          <Button variant="secondary" isDisabled={!canMutate || !detail} onPress={onOpenEdit}>
            Edit selected reminder
          </Button>
        </div>
      </div>

      {detailState === "idle" ? <p className="fg-muted">Select a reminder to inspect due-state truth.</p> : null}
      {detailState === "loading" ? <p className="fg-muted">Loading reminder detail.</p> : null}

      {detail ? (
        <div className="fg-stack">
          <div className="fg-actions">
            <span className="fg-pill" data-tone={reminderStatusTone(detail.status)}>{detail.status}</span>
            <span className="fg-pill">{reminderDueBucket(detail, nowMs)}</span>
            <span className="fg-pill">timezone {viewerTimeZone}</span>
          </div>

          <article className="fg-subcard">
            <h4>Timing</h4>
            <ul className="fg-list">
              <li>Exact due at: {detail.due_at}</li>
              <li>Viewer time zone: {viewerTimeZone}</li>
              <li>Due bucket: {reminderDueBucket(detail, nowMs)}</li>
              <li>Triggered at: {detail.triggered_at ?? "Not triggered"}</li>
            </ul>
            <p className="fg-muted">ForgeFrame shows the raw ISO deadline from the backend and labels the effective urgency bucket separately so overdue reminders are immediately visible.</p>
          </article>

          <article className="fg-subcard">
            <h4>Origin</h4>
            <ul className="fg-list">
              <li>Task: {detail.task_id ?? "Not linked"}</li>
              <li>Conversation: {originConversationId ?? "Bridge-only through task or notification"}</li>
              <li>Automation: {detail.automation_id ?? "Not linked"}</li>
              <li>Notification: {detail.notification_id ?? "Not linked"}</li>
            </ul>
            <div className="fg-actions">
              {linkedTask ? (
                <Button variant="navigation" onPress={() => navigate(buildTaskPath({ instanceId, taskId: linkedTask.task_id }))}>
                  Open task
                </Button>
              ) : null}
              {originConversationId ? (
                <Button variant="navigation" onPress={() => navigate(buildConversationPath({ instanceId, conversationId: originConversationId }))}>
                  Open conversation
                </Button>
              ) : null}
              {detail.automation_id ? (
                <Button variant="navigation" onPress={() => navigate(buildAutomationPath({ instanceId, automationId: detail.automation_id! }))}>
                  Open automation
                </Button>
              ) : null}
              {linkedNotification ? (
                <Button variant="navigation" onPress={() => navigate(buildNotificationPath({ instanceId, notificationId: linkedNotification.notification_id }))}>
                  Open notification
                </Button>
              ) : null}
            </div>
          </article>

          <article className="fg-subcard">
            <h4>Reminder actions</h4>
            <p className="fg-muted">Snooze, complete, and cancel use the real reminder update API. Closed reminders stay visible but are no longer presented as actively steerable.</p>
            <div className="fg-actions">
              <Button variant="secondary" isDisabled={!canMutate || reminderIsClosed(detail.status) || actionState.snooze} onPress={() => onAction("snooze")}>
                {actionState.snooze ? "Snoozing" : "Snooze 1 day"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || reminderIsClosed(detail.status) || actionState.complete} onPress={() => onAction("complete")}>
                {actionState.complete ? "Completing" : "Complete reminder"}
              </Button>
              <Button variant="secondary" isDisabled={!canMutate || reminderIsClosed(detail.status) || actionState.cancel} onPress={() => onAction("cancel")}>
                {actionState.cancel ? "Cancelling" : "Cancel reminder"}
              </Button>
            </div>
            {reminderIsClosed(detail.status) ? (
              <p className="fg-muted">This reminder is already completed or cancelled. Use the drawer only for corrective metadata edits, not as a fake active control surface.</p>
            ) : null}
          </article>

          <article className="fg-subcard">
            <h4>Summary text</h4>
            <p>{detail.summary || "No reminder summary was recorded."}</p>
          </article>

          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Task linkage</h4>
              {linkedTask ? (
                <div className="fg-stack">
                  <p>
                    <strong>{linkedTask.title}</strong>
                    {" · "}{linkedTask.status}
                  </p>
                  <div className="fg-actions">
                    <Button variant="navigation" onPress={() => navigate(buildTaskPath({ instanceId, taskId: linkedTask.task_id }))}>
                      Open task
                    </Button>
                  </div>
                </div>
              ) : <p className="fg-muted">No task is linked to this reminder.</p>}
            </article>

            <article className="fg-subcard">
              <h4>Notification linkage</h4>
              {linkedNotification ? (
                <div className="fg-stack">
                  <p>
                    <strong>{linkedNotification.title}</strong>
                    {" · "}{linkedNotification.delivery_status}
                  </p>
                  <div className="fg-actions">
                    <Button variant="navigation" onPress={() => navigate(buildNotificationPath({ instanceId, notificationId: linkedNotification.notification_id }))}>
                      Open notification
                    </Button>
                  </div>
                </div>
              ) : <p className="fg-muted">No notification is linked to this reminder.</p>}
            </article>
          </div>
        </div>
      ) : null}
    </article>
  );
}
