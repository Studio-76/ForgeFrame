import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  confirmNotification,
  createNotification,
  fetchInstances,
  fetchNotificationDetail,
  fetchNotifications,
  rejectNotification,
  retryNotification,
  updateNotification,
  type NotificationDeliveryStatus,
  type NotificationDetail,
  type NotificationSummary,
  type WorkItemPriority,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildChannelPath, buildReminderPath, buildTaskPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseInteger, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const DELIVERY_STATUS_OPTIONS: Array<NotificationDeliveryStatus | "all"> = [
  "all",
  "draft",
  "preview",
  "confirmed",
  "queued",
  "delivering",
  "delivered",
  "failed",
  "fallback_queued",
  "rejected",
  "cancelled",
];
const PRIORITY_OPTIONS: Array<WorkItemPriority | "all"> = ["all", "low", "normal", "high", "critical"];

const DEFAULT_CREATE_FORM = {
  notificationId: "",
  taskId: "",
  reminderId: "",
  conversationId: "",
  inboxId: "",
  workspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  title: "",
  body: "",
  priority: "normal" as WorkItemPriority,
  previewRequired: "yes" as "yes" | "no",
  maxRetries: "0",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  channelId: "",
  fallbackChannelId: "",
  title: "",
  body: "",
  deliveryStatus: "preview" as NotificationDeliveryStatus,
  priority: "normal" as WorkItemPriority,
  previewRequired: "yes" as "yes" | "no",
  maxRetries: "0",
  lastError: "",
  metadataJson: "{}",
};

export function NotificationsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedNotificationId = searchParams.get("notificationId")?.trim() ?? "";
  const deliveryStatusFilter = (searchParams.get("deliveryStatus")?.trim() as NotificationDeliveryStatus | "all" | "") || "all";
  const priorityFilter = (searchParams.get("priority")?.trim() as WorkItemPriority | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [actionState, setActionState] = useState<"idle" | "confirming" | "rejecting" | "retrying">("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Notification instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setNotifications([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchNotifications(instanceId, {
      deliveryStatus: deliveryStatusFilter,
      priority: priorityFilter,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setNotifications(payload.notifications);
        setListState("success");
        setError("");

        const nextNotificationId = payload.notifications.some((notification) => notification.notification_id === selectedNotificationId)
          ? selectedNotificationId
          : payload.notifications[0]?.notification_id ?? "";
        if (nextNotificationId !== selectedNotificationId) {
          updateRoute((next) => {
            if (nextNotificationId) {
              next.set("notificationId", nextNotificationId);
            } else {
              next.delete("notificationId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setNotifications([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Notification inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, deliveryStatusFilter, instanceId, priorityFilter, refreshNonce, selectedNotificationId]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedNotificationId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchNotificationDetail(selectedNotificationId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.notification);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Notification detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedNotificationId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      channelId: detail.channel_id ?? "",
      fallbackChannelId: detail.fallback_channel_id ?? "",
      title: detail.title,
      body: detail.body,
      deliveryStatus: detail.delivery_status,
      priority: detail.priority,
      previewRequired: detail.preview_required ? "yes" : "no",
      maxRetries: String(detail.max_retries),
      lastError: detail.last_error ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createNotification(instanceId, {
        notification_id: normalizeOptional(createForm.notificationId),
        task_id: normalizeOptional(createForm.taskId),
        reminder_id: normalizeOptional(createForm.reminderId),
        conversation_id: normalizeOptional(createForm.conversationId),
        inbox_id: normalizeOptional(createForm.inboxId),
        workspace_id: normalizeOptional(createForm.workspaceId),
        channel_id: normalizeOptional(createForm.channelId),
        fallback_channel_id: normalizeOptional(createForm.fallbackChannelId),
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        priority: createForm.priority,
        preview_required: createForm.previewRequired === "yes",
        max_retries: parseInteger(createForm.maxRetries, 0),
        metadata: parseJsonObject(createForm.metadataJson, "Notification metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("notificationId", payload.notification.notification_id);
      });
      setMessage(`Notification ${payload.notification.notification_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Notification creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateNotification(instanceId, detail.notification_id, {
        channel_id: normalizeOptional(editForm.channelId),
        fallback_channel_id: normalizeOptional(editForm.fallbackChannelId),
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        delivery_status: editForm.deliveryStatus,
        priority: editForm.priority,
        preview_required: editForm.previewRequired === "yes",
        max_retries: parseInteger(editForm.maxRetries, detail.max_retries),
        last_error: normalizeOptional(editForm.lastError),
        metadata: parseJsonObject(editForm.metadataJson, "Notification metadata"),
      });
      setMessage(`Notification ${payload.notification.notification_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Notification update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAction = async (action: "confirm" | "reject" | "retry") => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setActionState(action === "confirm" ? "confirming" : action === "reject" ? "rejecting" : "retrying");
    setError("");
    setMessage("");
    try {
      const payload = action === "confirm"
        ? await confirmNotification(instanceId, detail.notification_id)
        : action === "reject"
          ? await rejectNotification(instanceId, detail.notification_id)
          : await retryNotification(instanceId, detail.notification_id);
      setMessage(`Notification ${payload.notification.notification_id} ${action}ed.`);
      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Notification ${action} failed.`);
    } finally {
      setActionState("idle");
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Notifications"
          description="ForgeFrame is restoring delivery scope before exposing outbox truth."
          question="Which notification queue should open once the active session is restored?"
          links={[
            { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery targets once session scope returns." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Notifications stay instance-scoped and must expose preview, retry, reject, and fallback truth."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Notifications"
          description="This route is reserved for operators and admins who can inspect real delivery and outbox truth."
          question="Which adjacent surface should remain open while notification access is outside the current permission envelope?"
          links={[
            { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery targets without opening notification history." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approval state while notification truth is unavailable." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic outbox shell when the session cannot inspect real notification state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Notifications"
        description="Persistent notification and outbox surface with preview, retry, reject, fallback, and link-back truth for tasks, reminders, and channels."
        question="Are outbound actions actually visible and governable, or is delivery still hiding behind implicit side effects?"
        links={[
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Stay on the notification inventory and detail surface." },
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Open the delivery targets used by these notifications." },
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Inspect due-state truth that can feed notifications." },
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Review recurring rules that generate notifications." },
        ]}
        badges={[
          { label: `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`, tone: notifications.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Notifications are first-class delivery records. Preview, rejection, retry, and fallback state must remain visible and operator-controlled."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the outbox by delivery status and priority.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Notification instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("notificationId");
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
            Delivery status
            <select
              aria-label="Notification delivery status filter"
              value={deliveryStatusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("deliveryStatus");
                } else {
                  next.set("deliveryStatus", nextValue);
                }
                next.delete("notificationId");
              })}
            >
              {DELIVERY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Notification priority filter"
              value={priorityFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("priority");
                } else {
                  next.set("priority", nextValue);
                }
                next.delete("notificationId");
              })}
            >
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Notification inventory</h3>
              <p className="fg-muted">Each row is a persisted outbox record with delivery state, not an invisible side effect.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading notification inventory.</p> : null}
          {listState === "success" && notifications.length === 0 ? <p className="fg-muted">No notifications matched the selected filters.</p> : null}

          {notifications.length > 0 ? (
            <div className="fg-stack">
              {notifications.map((notification) => (
                <button
                  key={notification.notification_id}
                  type="button"
                  className={`fg-data-row${notification.notification_id === selectedNotificationId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("notificationId", notification.notification_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{notification.notification_id}</span>
                      <strong>{notification.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={notification.delivery_status === "delivered" ? "success" : notification.delivery_status === "failed" || notification.delivery_status === "rejected" ? "danger" : "warning"}>
                        {notification.delivery_status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{notification.priority} priority · channel {notification.channel_id ?? "none"}</span>
                    <span className="fg-muted">retry {notification.retry_count}/{notification.max_retries}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Notification detail</h3>
              <p className="fg-muted">Task, reminder, channel, and delivery action truth converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.notification_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a notification to inspect delivery truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading notification detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Status: {detail.delivery_status}</li>
                  <li>Priority: {detail.priority}</li>
                  <li>Preview required: {detail.preview_required ? "yes" : "no"}</li>
                  <li>Channel: {detail.channel_id ?? "Not linked"}</li>
                  <li>Fallback channel: {detail.fallback_channel_id ?? "Not configured"}</li>
                  <li>Retry count: {detail.retry_count}/{detail.max_retries}</li>
                  <li>Next attempt: {detail.next_attempt_at ?? "Not scheduled"}</li>
                  <li>Last error: {detail.last_error ?? "None"}</li>
                </ul>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("confirm")}>
                    {actionState === "confirming" ? "Confirming" : "Confirm notification"}
                  </button>
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("reject")}>
                    {actionState === "rejecting" ? "Rejecting" : "Reject notification"}
                  </button>
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("retry")}>
                    {actionState === "retrying" ? "Retrying" : "Retry notification"}
                  </button>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Body</h4>
                <p>{detail.body}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Task linkage</h4>
                  {detail.task ? (
                    <div className="fg-stack">
                      <p><strong>{detail.task.title}</strong>{" · "}{detail.task.status}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.task_id })}>Open task</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No task is linked to this notification.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Reminder linkage</h4>
                  {detail.reminder ? (
                    <div className="fg-stack">
                      <p><strong>{detail.reminder.title}</strong>{" · "}{detail.reminder.status}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildReminderPath({ instanceId, reminderId: detail.reminder.reminder_id })}>Open reminder</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No reminder is linked to this notification.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Channel linkage</h4>
                  {detail.channel ? (
                    <div className="fg-stack">
                      <p><strong>{detail.channel.label}</strong>{" · "}{detail.channel.status}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.channel.channel_id })}>Open channel</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No channel is linked to this notification.</p>}
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create notification</h3>
              <p className="fg-muted">Create a persisted delivery record instead of relying on hidden side effects.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Notification ID
                <input value={createForm.notificationId} onChange={(event) => setCreateForm((current) => ({ ...current, notificationId: event.target.value }))} placeholder="notification_customer_pricing" />
              </label>
              <label>
                Task ID
                <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} />
              </label>
              <label>
                Reminder ID
                <input value={createForm.reminderId} onChange={(event) => setCreateForm((current) => ({ ...current, reminderId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} />
              </label>
              <label>
                Inbox ID
                <input value={createForm.inboxId} onChange={(event) => setCreateForm((current) => ({ ...current, inboxId: event.target.value }))} />
              </label>
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Channel ID
                <input value={createForm.channelId} onChange={(event) => setCreateForm((current) => ({ ...current, channelId: event.target.value }))} />
              </label>
              <label>
                Fallback channel ID
                <input value={createForm.fallbackChannelId} onChange={(event) => setCreateForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} />
              </label>
            </div>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Preview before send" />
            </label>
            <label>
              Body
              <textarea rows={4} value={createForm.body} onChange={(event) => setCreateForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Priority
                <select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                  {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Preview required
                <select value={createForm.previewRequired} onChange={(event) => setCreateForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
              <label>
                Max retries
                <input value={createForm.maxRetries} onChange={(event) => setCreateForm((current) => ({ ...current, maxRetries: event.target.value }))} />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.body.trim()}>
                {savingCreate ? "Creating notification" : "Create notification"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit notification</h3>
              <p className="fg-muted">Keep the selected notification aligned with channel, retry, preview, and fallback truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.notification_id : "Select a notification"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Channel ID
                  <input value={editForm.channelId} onChange={(event) => setEditForm((current) => ({ ...current, channelId: event.target.value }))} />
                </label>
                <label>
                  Fallback channel ID
                  <input value={editForm.fallbackChannelId} onChange={(event) => setEditForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} />
                </label>
              </div>
              <label>
                Title
                <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Body
                <textarea rows={4} value={editForm.body} onChange={(event) => setEditForm((current) => ({ ...current, body: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Delivery status
                  <select value={editForm.deliveryStatus} onChange={(event) => setEditForm((current) => ({ ...current, deliveryStatus: event.target.value as NotificationDeliveryStatus }))}>
                    {DELIVERY_STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Priority
                  <select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                    {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Preview required
                  <select value={editForm.previewRequired} onChange={(event) => setEditForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Max retries
                  <input value={editForm.maxRetries} onChange={(event) => setEditForm((current) => ({ ...current, maxRetries: event.target.value }))} />
                </label>
                <label>
                  Last error
                  <input value={editForm.lastError} onChange={(event) => setEditForm((current) => ({ ...current, lastError: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving notification" : "Save notification"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a notification before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
