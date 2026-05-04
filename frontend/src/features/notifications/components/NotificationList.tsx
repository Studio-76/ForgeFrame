/**
 * NotificationList — the grouped outbox table with scope/filter controls.
 *
 * @packageDocumentation
 */

import type { NotificationDeliveryStatus, NotificationSummary, WorkItemPriority } from "../../../api/domain/notifications";
import {
  notificationLaneLabel,
  notificationModeLabel,
  notificationStatusTone,
  linkedContextLabel,
  formatTimestamp,
} from "../helpers";
import { DELIVERY_STATUS_OPTIONS, OUTBOX_GROUPS, PRIORITY_OPTIONS } from "../types";

/** Props for the NotificationList component. */
export type NotificationListProps = {
  /** Available instances for scope selection. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Currently selected instance ID. */
  instanceId: string;
  /** Load state of instances. */
  instancesState: string;
  /** Load state of the list. */
  listState: string;
  /** All matching notifications. */
  notifications: NotificationSummary[];
  /** Currently selected notification ID. */
  selectedNotificationId: string;
  /** Current delivery status filter. */
  deliveryStatusFilter: NotificationDeliveryStatus | "all";
  /** Current priority filter. */
  priorityFilter: WorkItemPriority | "all";
  /** Called when the instance selection changes. */
  onInstanceChange: (instanceId: string) => void;
  /** Called when a filter value changes. */
  onFilterChange: (key: string, value: string) => void;
  /** Called when a notification is selected. */
  onSelectNotification: (notificationId: string) => void;
  /** Called to open the create drawer. */
  onCreateNew: () => void;
  /** Whether the user can mutate. */
  canMutate: boolean;
};

/**
 * Renders the notification scope/filter card and the grouped outbox table.
 */
export function NotificationList({
  instances,
  instanceId,
  instancesState,
  listState,
  notifications,
  selectedNotificationId,
  deliveryStatusFilter,
  priorityFilter,
  onInstanceChange,
  onFilterChange,
  onSelectNotification,
  onCreateNew,
  canMutate,
}: NotificationListProps) {
  const groupedNotifications = OUTBOX_GROUPS
    .map((group) => ({
      ...group,
      items: notifications.filter((notification) => group.statuses.includes(notification.delivery_status)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* ── Scope and filter card ── */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then filter the outbox by exact backend status and priority.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Notification instance"
              value={instanceId}
              onChange={(event) => onInstanceChange(event.target.value)}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Delivery status
            <select
              aria-label="Notification delivery status filter"
              value={deliveryStatusFilter}
              onChange={(event) => onFilterChange("deliveryStatus", event.target.value)}
            >
              {DELIVERY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Notification priority filter"
              value={priorityFilter}
              onChange={(event) => onFilterChange("priority", event.target.value)}
            >
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      {/* ── Outbox table ── */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Outbox table</h3>
            <p className="fg-muted">Grouped by delivery state so preview items stay separate from sent work.</p>
          </div>
          <div className="fg-actions">
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
            <button type="button" disabled={!canMutate} onClick={onCreateNew}>New notification</button>
          </div>
        </div>

        <div className="fg-actions">
          {OUTBOX_GROUPS.map((group) => {
            const count = notifications.filter((notification) => group.statuses.includes(notification.delivery_status)).length;
            return <span key={group.key} className="fg-pill">{group.label}: {count}</span>;
          })}
        </div>

        {listState === "loading" ? <p className="fg-muted">Loading outbox inventory.</p> : null}
        {listState === "success" && notifications.length === 0 ? <p className="fg-muted">No notifications match these filters.</p> : null}

        {groupedNotifications.map((group) => (
          <section key={group.key} className="fg-stack">
            <div className="fg-panel-heading">
              <div>
                <h4>{group.label}</h4>
                <p className="fg-muted">{group.description}</p>
              </div>
              <span className="fg-pill">{group.items.length}</span>
            </div>
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label={`${group.label} notifications`}>
                <thead>
                  <tr>
                    <th>Notification</th>
                    <th>State</th>
                    <th>Lane</th>
                    <th>Retries</th>
                    <th>Linked context</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((notification) => (
                    <tr key={notification.notification_id} className={notification.notification_id === selectedNotificationId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => onSelectNotification(notification.notification_id)}
                        >
                          {notification.title}
                        </button>
                        <div className="fg-muted">{notification.notification_id}</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={notificationStatusTone(notification.delivery_status)}>{notification.delivery_status}</span>
                        <div className="fg-muted">{notificationModeLabel(notification)}</div>
                      </td>
                      <td>
                        <div>{notificationLaneLabel(notification)}</div>
                        <div className="fg-muted">next {formatTimestamp(notification.next_attempt_at, "No send scheduled")}</div>
                      </td>
                      <td>
                        {notification.retry_count}/{notification.max_retries}
                        <div className="fg-muted">{formatTimestamp(notification.last_attempt_at, "No attempts yet")}</div>
                      </td>
                      <td>{linkedContextLabel(notification)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </article>
    </>
  );
}
