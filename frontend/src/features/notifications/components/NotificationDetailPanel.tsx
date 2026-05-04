/**
 * NotificationDetailPanel — the delivery detail view with routing info,
 * delivery attempts, linked objects, and action buttons.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";

import type { NotificationDetail, NotificationDeliveryStatus } from "../../../api/domain/notifications";
import {
  buildAutomationPath,
  buildChannelPath,
  buildConversationPath,
  buildInboxPath,
  buildReminderPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../../../app/workInteractionRoutes";
import {
  attemptKindLabel,
  attemptTone,
  effectTone,
  notificationStatusTone,
  formatTimestamp,
} from "../helpers";
import type { NotificationAction } from "../types";

/** Props for the NotificationDetailPanel component. */
export type NotificationDetailPanelProps = {
  /** The notification detail. */
  detail: NotificationDetail;
  /** Load state of the detail. */
  detailState: string;
  /** Currently selected instance ID. */
  instanceId: string;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Current action state (idle | confirming | rejecting | retrying). */
  actionState: string;
  /** Last action result. */
  lastActionResult: { action: NotificationAction; notification: NotificationDetail } | null;
  /** Called to perform an action (confirm/reject/retry). */
  onAction: (action: NotificationAction) => void;
  /** Called to open the edit drawer. */
  onEdit: () => void;
};

/**
 * Renders the notification delivery detail panel with routing info,
 * message preview, delivery attempts, and linked objects.
 */
export function NotificationDetailPanel({
  detail,
  detailState,
  instanceId,
  canMutate,
  actionState,
  lastActionResult,
  onAction,
  onEdit,
}: NotificationDetailPanelProps) {
  const detailEffect = detail?.delivery_evidence?.effect_state;
  const detailEffectLabel = detailEffect ? detailEffect.replace(/_/g, " ") : "unknown";
  const outboxModeLabel = detail.delivery_status === "draft" || detail.delivery_status === "preview" || detail.delivery_status === "rejected"
    ? "Preview only"
    : detail.delivery_status === "delivered"
      ? "Delivered"
      : detail.delivery_status === "failed" || detail.delivery_status === "cancelled"
        ? "Delivery blocked"
        : detail.preview_required
          ? "Preview approved"
          : "Live delivery";
  const fallbackChain = detail?.configured_channel && detail.fallback_channel
    ? `${detail.configured_channel.label} -> ${detail.fallback_channel.label}`
    : detail?.configured_channel
      ? `${detail.configured_channel.label} (no fallback configured)`
      : detail?.fallback_channel
        ? `Fallback only ${detail.fallback_channel.label}`
        : "No delivery route linked";

  if (detailState === "idle") {
    return <p className="fg-muted">Select a notification to inspect outbox truth and delivery evidence.</p>;
  }

  if (detailState === "loading") {
    return <p className="fg-muted">Loading notification detail.</p>;
  }

  return (
    <div className="fg-stack">
      <div className="fg-actions">
        <span className="fg-pill" data-tone={notificationStatusTone(detail.delivery_status)}>status {detail.delivery_status}</span>
        <span className="fg-pill" data-tone={effectTone(detailEffect)}>{detailEffectLabel}</span>
        <span className="fg-pill">{outboxModeLabel}</span>
        <span className="fg-pill">{detail.priority} priority</span>
      </div>

      {/* ── Message preview ── */}
      <article className="fg-subcard">
        <h4>Message preview</h4>
        <div className="fg-stack">
          <p><strong>{detail.title}</strong></p>
          <p>{detail.body}</p>
          <ul className="fg-list">
            <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
            <li>Outward effect: {detailEffectLabel}</li>
            <li>Evidence note: {detail.delivery_evidence?.evidence_note ?? "No delivery evidence is available."}</li>
          </ul>
        </div>
        <div className="fg-actions">
          <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => onAction("confirm")}>
            {actionState === "confirming" ? "Approving preview" : "Approve preview"}
          </button>
          <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => onAction("reject")}>
            {actionState === "rejecting" ? "Rejecting preview" : "Reject preview"}
          </button>
          <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => onAction("retry")}>
            {actionState === "retrying" ? "Retrying delivery" : "Retry delivery"}
          </button>
          <button type="button" disabled={!canMutate} onClick={onEdit}>Edit</button>
        </div>
      </article>

      {/* ── Latest queue mutation ── */}
      {lastActionResult ? (
        <article className="fg-subcard">
          <h4>Latest queue mutation</h4>
          <ul className="fg-list">
            <li>Action: {lastActionResult.action}</li>
            <li>New status: {lastActionResult.notification.delivery_status}</li>
            <li>Resulting effect: {lastActionResult.notification.delivery_evidence?.effect_state.replace(/_/g, " ") ?? "unknown"}</li>
            <li>Next step: {lastActionResult.notification.delivery_evidence?.next_step ?? "No next step recorded."}</li>
          </ul>
        </article>
      ) : null}

      {/* ── Target and fallback chain ── */}
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Target and fallback chain</h4>
          <ul className="fg-list">
            <li>Configured primary channel: {detail.configured_channel ? `${detail.configured_channel.label} (${detail.configured_channel.channel_id})` : "Not linked"}</li>
            <li>Active delivery channel: {detail.channel ? `${detail.channel.label} (${detail.channel.channel_id})` : "Not linked"}</li>
            <li>Target contact: {detail.channel?.target ?? detail.configured_channel?.target ?? "No target configured"}</li>
            <li>Fallback chain: {fallbackChain}</li>
            <li>Fallback target: {detail.fallback_channel?.target ?? "No fallback target configured"}</li>
            <li>Current channel health: {detail.channel?.status ?? "Unknown"}</li>
          </ul>
          <div className="fg-actions">
            {detail.configured_channel ? <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.configured_channel.channel_id })}>Open configured channel</Link> : null}
            {detail.channel && detail.channel.channel_id !== detail.configured_channel?.channel_id ? <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.channel.channel_id })}>Open active delivery channel</Link> : null}
            {detail.fallback_channel ? <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.fallback_channel.channel_id })}>Open fallback channel</Link> : null}
          </div>
        </article>

        {/* ── Failure and next step ── */}
        <article className="fg-subcard">
          <h4>Failure and next step</h4>
          <ul className="fg-list">
            <li>Last error: {detail.last_error ?? "No provider error recorded"}</li>
            <li>Next attempt: {formatTimestamp(detail.next_attempt_at, "No retry scheduled")}</li>
            <li>Delivered at: {formatTimestamp(detail.delivered_at, "Not delivered")}</li>
            <li>Rejected at: {formatTimestamp(detail.rejected_at, "Not rejected")}</li>
            <li>Next step: {detail.delivery_evidence?.next_step ?? "No next step recorded"}</li>
          </ul>
        </article>
      </div>

      {/* ── Delivery attempts ── */}
      <article className="fg-subcard">
        <h4>Delivery attempts</h4>
        {detail.delivery_attempts.length === 0 ? (
          <p className="fg-muted">No delivery evidence or state transitions have been persisted yet.</p>
        ) : (
          <ul className="fg-list">
            {detail.delivery_attempts.map((attempt) => (
              <li key={attempt.attempt_id}>
                <span className="fg-pill" data-tone={attemptTone(attempt)}>{attempt.delivery_status}</span>
                {" "}{attemptKindLabel(attempt)}
                {" · "}{formatTimestamp(attempt.happened_at)}
                {" · "}{attempt.channel_label ?? attempt.channel_id ?? "No channel"}
                {" · "}{attempt.detail}
                {attempt.next_step ? ` Next: ${attempt.next_step}` : ""}
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* ── Linked objects ── */}
      <article className="fg-subcard">
        <h4>Linked objects</h4>
        <ul className="fg-list">
          <li>Task: {detail.task ? detail.task.title : detail.task_id ?? "Not linked"}</li>
          <li>Reminder: {detail.reminder ? detail.reminder.title : detail.reminder_id ?? "Not linked"}</li>
          <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
          <li>Inbox item: {detail.inbox_id ?? "Not linked"}</li>
          <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
          <li>Automation: {detail.reminder?.automation_id ?? "Bridge-only via linked reminder"}</li>
        </ul>
        <div className="fg-actions">
          {detail.task ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.task_id })}>Open task</Link> : null}
          {detail.reminder ? <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: detail.reminder.reminder_id })}>Open reminder</Link> : null}
          {detail.reminder?.automation_id ? <Link className="fg-nav-link" to={buildAutomationPath({ instanceId, automationId: detail.reminder.automation_id })}>Open automation</Link> : null}
          {detail.conversation_id ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id })}>Open conversation</Link> : null}
          {detail.inbox_id ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_id })}>Open inbox item</Link> : null}
          {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
        </div>
      </article>
    </div>
  );
}
