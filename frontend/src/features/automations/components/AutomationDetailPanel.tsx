/**
 * Automation detail panel — shows summary, trigger history, target linkage,
 * governance posture, and latest test result.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { AutomationDetail } from "../../../api/domain/automations";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import {
  automationHasExternalEffect,
  automationStatusTone,
  cadenceToStructured,
} from "../helpers";

/** Props for AutomationDetailPanel. */
export interface AutomationDetailPanelProps {
  /** The currently selected automation detail, or null. */
  detail: AutomationDetail | null;
  /** The current instance ID. */
  instanceId: string;
  /** Detail loading state. */
  detailState: LoadState;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Whether a trigger is in progress. */
  triggering: boolean;
  /** Latest trigger result. */
  lastTriggerResult: { triggeredAt: string; automation: AutomationDetail } | null;
  /** Handler for triggering the automation. */
  onTrigger: () => void;
}

/**
 * Detail panel for a selected automation — shows lifecycle state,
 * target linkage, and governance posture.
 */
export function AutomationDetailPanel({
  detail,
  instanceId,
  detailState,
  canMutate,
  triggering,
  lastTriggerResult,
  onTrigger,
}: AutomationDetailPanelProps) {
  if (detailState === "idle") {
    return <p className="text-meta text-muted px-1 py-3">Select an automation to inspect recurring-rule truth.</p>;
  }

  if (detailState === "loading") {
    return <p className="text-meta text-muted px-1 py-3">Loading automation detail.</p>;
  }

  if (!detail) {
    return null;
  }

  const schedule = cadenceToStructured(detail.cadence_minutes);

  const linkStyles = "fg-nav-link";

  return (
    <div className="fg-stack">
      {/* ── Summary ── */}
      <article className="fg-subcard">
        <h4>Summary</h4>
        <ul className="fg-list">
          <li>Status: {detail.status}</li>
          <li>Action kind: {detail.action_kind}</li>
          <li>Schedule: every {schedule.every} {schedule.unit}</li>
          <li>Raw cadence minutes: {detail.cadence_minutes}</li>
          <li>Next run: {detail.next_run_at}</li>
          <li>Last run: {detail.last_run_at ?? "Never triggered"}</li>
          <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
        </ul>
        <div className="fg-actions">
          <button
            type="button"
            className="ff-btn-secondary ff-btn-sm"
            disabled={!canMutate || triggering}
            onClick={onTrigger}
          >
            {triggering ? "Testing automation" : "Test now"}
          </button>
        </div>
      </article>

      {/* ── Trigger history ── */}
      <article className="fg-subcard">
        <h4>Trigger history</h4>
        <ul className="fg-list">
          <li>Last run at: {detail.last_run_at ?? "Never triggered"}</li>
          <li>Next run at: {detail.next_run_at}</li>
          <li>Last task output: {detail.last_task_id ?? "None"}</li>
          <li>Last reminder output: {detail.last_reminder_id ?? "None"}</li>
          <li>Last notification output: {detail.last_notification_id ?? "None"}</li>
          <li>Historical run ledger: bridge-only in the current backend model</li>
        </ul>
        <div className="fg-actions">
          {detail.last_task_id ? (
            <Link className={linkStyles} to={`/tasks?instanceId=${instanceId}&taskId=${detail.last_task_id}`}>
              Open last task
            </Link>
          ) : null}
          {detail.last_reminder_id ? (
            <Link className={linkStyles} to={`/reminders?instanceId=${instanceId}&reminderId=${detail.last_reminder_id}`}>
              Open last reminder
            </Link>
          ) : null}
          {detail.last_notification_id ? (
            <Link className={linkStyles} to={`/notifications?instanceId=${instanceId}&notificationId=${detail.last_notification_id}`}>
              Open last notification
            </Link>
          ) : null}
        </div>
        <p className="text-meta text-muted">
          ForgeFrame currently receives the latest materialized outputs and `last_run_at`, but no full per-run ledger or run object linkage. That limit is shown explicitly instead of being faked as history.
        </p>
      </article>

      {/* ── Latest test trigger ── */}
      {lastTriggerResult ? (
        <article className="fg-subcard">
          <h4>Latest test trigger</h4>
          <ul className="fg-list">
            <li>Triggered at: {lastTriggerResult.triggeredAt}</li>
            <li>Last run after test: {lastTriggerResult.automation.last_run_at ?? "No last run returned"}</li>
            <li>Resulting task: {lastTriggerResult.automation.last_task_id ?? "None"}</li>
            <li>Resulting reminder: {lastTriggerResult.automation.last_reminder_id ?? "None"}</li>
            <li>Resulting notification: {lastTriggerResult.automation.last_notification_id ?? "None"}</li>
          </ul>
          <div className="fg-actions">
            {lastTriggerResult.automation.last_task_id ? (
              <Link className={linkStyles} to={`/tasks?instanceId=${instanceId}&taskId=${lastTriggerResult.automation.last_task_id}`}>
                Open tested task
              </Link>
            ) : null}
            {lastTriggerResult.automation.last_reminder_id ? (
              <Link className={linkStyles} to={`/reminders?instanceId=${instanceId}&reminderId=${lastTriggerResult.automation.last_reminder_id}`}>
                Open tested reminder
              </Link>
            ) : null}
            {lastTriggerResult.automation.last_notification_id ? (
              <Link className={linkStyles} to={`/notifications?instanceId=${instanceId}&notificationId=${lastTriggerResult.automation.last_notification_id}`}>
                Open tested notification
              </Link>
            ) : null}
          </div>
        </article>
      ) : null}

      {/* ── Target linkage ── */}
      <article className="fg-subcard">
        <h4>Target linkage</h4>
        <ul className="fg-list">
          <li>Task: {detail.target_task_id ?? "Not linked"}</li>
          <li>Conversation: {detail.target_conversation_id ?? "Not linked"}</li>
          <li>Inbox: {detail.target_inbox_id ?? "Not linked"}</li>
          <li>Workspace: {detail.target_workspace_id ?? "Not linked"}</li>
          <li>Channel: {detail.channel_id ?? "Not linked"}</li>
          <li>Fallback channel: {detail.fallback_channel_id ?? "Not configured"}</li>
        </ul>
        <div className="fg-actions">
          {detail.target_task_id ? (
            <Link className={linkStyles} to={`/tasks?instanceId=${instanceId}&taskId=${detail.target_task_id}`}>
              Open target task
            </Link>
          ) : null}
          {detail.target_conversation_id ? (
            <Link className={linkStyles} to={`/conversations?instanceId=${instanceId}&conversationId=${detail.target_conversation_id}`}>
              Open conversation
            </Link>
          ) : null}
          {detail.target_inbox_id ? (
            <Link className={linkStyles} to={`/inbox?instanceId=${instanceId}&inboxId=${detail.target_inbox_id}`}>
              Open inbox item
            </Link>
          ) : null}
          {detail.target_workspace_id ? (
            <Link className={linkStyles} to={`/workspaces?instanceId=${instanceId}&workspaceId=${detail.target_workspace_id}`}>
              Open workspace
            </Link>
          ) : null}
          {detail.channel_id ? (
            <Link className={linkStyles} to={`/channels?instanceId=${instanceId}&channelId=${detail.channel_id}`}>
              Open channel
            </Link>
          ) : null}
        </div>
      </article>

      {/* ── Governance ── */}
      <article className="fg-subcard">
        <h4>Governance</h4>
        <ul className="fg-list">
          <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
          <li>External effect: {automationHasExternalEffect(detail) ? "possible" : "internal only"}</li>
          <li>Approval-specific governance: bridge-only in the current automation model</li>
        </ul>
        <p className="text-meta text-muted">
          {automationHasExternalEffect(detail)
            ? (detail.preview_required
              ? "This automation can create outward-facing delivery objects, but preview gating is still required before final delivery."
              : "This automation can create outward-facing delivery objects without preview gating. Treat it as high-impact automation, not as harmless housekeeping.")
            : "This automation currently materializes internal follow-up objects only and does not present as an external delivery rule."}
        </p>
      </article>
    </div>
  );
}
