/**
 * ReminderTable — reminder inventory grouped list component.
 *
 * Renders the filter controls and grouped reminder list for the active
 * instance scope. Groups reminders by overdue, due now, upcoming, and
 * completed/cancelled.
 *
 * @packageDocumentation
 */

import type { ReminderStatus, ReminderSummary } from "../../../api/domain/reminders";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import { Button } from "../../../components/ui/Button";
import { STATUS_OPTIONS, type ReminderGroupKey } from "../types";
import { reminderStatusTone, reminderGroupKey, reminderGroupHeading } from "../helpers";

/**
 * Props for ReminderTable.
 */
export type ReminderTableProps = {
  /** Current reminder list state. */
  listState: LoadState;
  /** Currently loaded reminders. */
  reminders: ReminderSummary[];
  /** Currently selected reminder ID (from URL params). */
  selectedReminderId: string;
  /** Current instance ID for scope. */
  instanceId: string;
  /** Current status filter value. */
  statusFilter: ReminderStatus | "all";
  /** Instances available for scope selection. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Instances load state. */
  instancesState: LoadState;
  /** Whether mutations are allowed. */
  canMutate: boolean;
  /** Current timestamp for grouping calculations. */
  nowMs: number;
  /**
   * Callback to update route params.
   * Receives a mutate callback that modifies URLSearchParams.
   */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  /** Callback to open the create drawer. */
  onOpenCreate: () => void;
  /** Callback to select a reminder by ID. */
  onSelectReminder: (reminderId: string) => void;
};

/**
 * Reminder inventory table with instance scope, status filters, and urgency grouping.
 */
export function ReminderTable({
  listState,
  reminders,
  selectedReminderId,
  instanceId,
  statusFilter,
  instances,
  instancesState,
  canMutate,
  nowMs,
  updateRoute,
  onOpenCreate,
  onSelectReminder,
}: ReminderTableProps) {
  const groupedReminders: Record<ReminderGroupKey, ReminderSummary[]> = {
    overdue: [],
    due_now: [],
    upcoming: [],
    completed_cancelled: [],
  };

  reminders.forEach((reminder) => {
    groupedReminders[reminderGroupKey(reminder, nowMs)].push(reminder);
  });

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Scope and filter</h3>
          <p className="fg-muted">Choose the instance boundary, then filter by backend reminder status. ForgeFrame additionally groups the visible results into overdue, due now, upcoming, and completed / cancelled.</p>
        </div>
        <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
      </div>
      <div className="fg-inline-form">
        <label>
          Instance
          <select
            aria-label="Reminder instance"
            value={instanceId}
            onChange={(event) => updateRoute((next) => {
              next.set("instanceId", event.target.value);
              next.delete("reminderId");
            })}
          >
            {instances.map((instance) => (
              <option key={instance.instance_id} value={instance.instance_id}>
                {instance.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Reminder status filter"
            value={statusFilter}
            onChange={(event) => updateRoute((next) => {
              const nextValue = event.target.value;
              if (nextValue === "all") {
                next.delete("status");
              } else {
                next.set("status", nextValue);
              }
              next.delete("reminderId");
            })}
          >
            {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="fg-panel-heading">
        <div>
          <h3>Reminder inventory</h3>
          <p className="fg-muted">Visible reminders are grouped by urgency so overdue follow-ups surface before background upkeep.</p>
        </div>
        <div className="fg-actions">
          <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          <Button variant="secondary" isDisabled={!canMutate} onPress={onOpenCreate}>
            New reminder
          </Button>
        </div>
      </div>

      {listState === "loading" ? <p className="fg-muted">Loading reminder inventory.</p> : null}
      {listState === "success" && reminders.length === 0 ? <p className="fg-muted">No reminders matched the selected filters.</p> : null}

      {reminders.length > 0 ? (
        <div className="fg-stack">
          {(["overdue", "due_now", "upcoming", "completed_cancelled"] as ReminderGroupKey[]).map((group) => (
            groupedReminders[group].length > 0 ? (
              <article key={group} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{reminderGroupHeading(group)}</h4>
                    <p className="fg-muted">{groupedReminders[group].length} reminder{groupedReminders[group].length === 1 ? "" : "s"} in this bucket.</p>
                  </div>
                </div>
                <div className="fg-stack">
                  {groupedReminders[group].map((reminder) => (
                    <Button
                      key={reminder.reminder_id}
                      variant="navigation"
                      className={`fg-data-row${reminder.reminder_id === selectedReminderId ? " is-current" : ""}`}
                      onPress={() => onSelectReminder(reminder.reminder_id)}
                    >
                      <div className="fg-panel-heading fg-data-row-heading">
                        <div className="fg-page-header">
                          <span className="fg-code">{reminder.reminder_id}</span>
                          <strong>{reminder.title}</strong>
                        </div>
                        <div className="fg-actions">
                          <span className="fg-pill" data-tone={reminderStatusTone(reminder.status)}>{reminder.status}</span>
                        </div>
                      </div>
                      <div className="fg-detail-grid">
                        <span className="fg-muted">task {reminder.task_id ?? "none"} · automation {reminder.automation_id ?? "none"} · notification {reminder.notification_id ?? "none"}</span>
                        <span className="fg-muted">due {reminder.due_at} · timezone UTC</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </article>
            ) : null
          ))}
        </div>
      ) : null}
    </article>
  );
}
