import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  confirmNotification,
  createNotification,
  fetchNotificationDetail,
  fetchNotifications,
  rejectNotification,
  retryNotification,
  updateNotification,
  type NotificationDeliveryAttempt,
  type NotificationDeliveryEffect,
  type NotificationDeliveryStatus,
  type NotificationDetail,
  type NotificationSummary,
  type WorkItemPriority,
} from "../api/domain/notifications";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildAutomationPath,
  buildChannelPath,
  buildConversationPath,
  buildInboxPath,
  buildReminderPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { getWorkInteractionAccess, normalizeOptional, parseInteger, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

type DrawerMode = "closed" | "create" | "edit";
type NotificationAction = "confirm" | "reject" | "retry";
type OutboxGroupKey = "pending_preview" | "queued" | "sent" | "failed" | "rejected";

const DRAWER_FORM_ID = "notifications-drawer-form";

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
const OUTBOX_GROUPS: Array<{
  key: OutboxGroupKey;
  label: string;
  description: string;
  statuses: NotificationDeliveryStatus[];
}> = [
  {
    key: "pending_preview",
    label: "Pending approval / preview",
    description: "Draft and preview-only notifications.",
    statuses: ["draft", "preview"],
  },
  {
    key: "queued",
    label: "Queued",
    description: "Notifications queued, delivering, or in fallback.",
    statuses: ["confirmed", "queued", "delivering", "fallback_queued"],
  },
  {
    key: "sent",
    label: "Sent",
    description: "Notifications with recorded delivery success.",
    statuses: ["delivered"],
  },
  {
    key: "failed",
    label: "Failed",
    description: "Notifications failed or cancelled before delivery.",
    statuses: ["failed", "cancelled"],
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Notifications explicitly rejected.",
    statuses: ["rejected"],
  },
];

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

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function notificationStatusTone(status: NotificationDeliveryStatus): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "delivered":
      return "success";
    case "failed":
    case "rejected":
    case "cancelled":
      return "danger";
    case "draft":
    case "preview":
    case "confirmed":
    case "queued":
    case "delivering":
    case "fallback_queued":
      return "warning";
    default:
      return "neutral";
  }
}

function effectTone(effect: NotificationDeliveryEffect | undefined): "success" | "warning" | "danger" | "neutral" {
  switch (effect) {
    case "sent":
      return "success";
    case "failed":
    case "rejected":
    case "cancelled":
      return "danger";
    case "preview_only":
    case "queued":
      return "warning";
    default:
      return "neutral";
  }
}

function notificationModeLabel(notification: Pick<NotificationSummary, "preview_required" | "delivery_status">): string {
  if (notification.delivery_status === "draft" || notification.delivery_status === "preview" || notification.delivery_status === "rejected") {
    return "Preview only";
  }
  if (notification.delivery_status === "delivered") {
    return "Delivered";
  }
  if (notification.delivery_status === "failed" || notification.delivery_status === "cancelled") {
    return "Delivery blocked";
  }
  return notification.preview_required ? "Preview approved" : "Live delivery";
}

function notificationLaneLabel(notification: Pick<NotificationSummary, "channel_id" | "configured_channel_id" | "fallback_channel_id">): string {
  const configuredChannelId = notification.configured_channel_id ?? notification.channel_id;
  if (configuredChannelId && notification.fallback_channel_id) {
    return `${configuredChannelId} -> ${notification.fallback_channel_id}`;
  }
  if (configuredChannelId) {
    return configuredChannelId;
  }
  if (notification.fallback_channel_id) {
    return `fallback ${notification.fallback_channel_id}`;
  }
  return "No channel linked";
}

function linkedContextLabel(notification: Pick<NotificationSummary, "task_id" | "reminder_id" | "conversation_id" | "inbox_id" | "workspace_id">): string {
  if (notification.task_id) {
    return `task ${notification.task_id}`;
  }
  if (notification.reminder_id) {
    return `reminder ${notification.reminder_id}`;
  }
  if (notification.conversation_id) {
    return `conversation ${notification.conversation_id}`;
  }
  if (notification.inbox_id) {
    return `inbox ${notification.inbox_id}`;
  }
  if (notification.workspace_id) {
    return `workspace ${notification.workspace_id}`;
  }
  return "No linked work object";
}

function attemptKindLabel(attempt: NotificationDeliveryAttempt): string {
  switch (attempt.attempt_kind) {
    case "preview":
      return "Preview capture";
    case "approval":
      return "Approval review";
    case "retry":
      return "Retry attempt";
    case "fallback":
      return "Fallback handoff";
    case "manual_override":
      return "Manual override";
    case "terminal":
      return "Terminal state";
    default:
      return attempt.attempt_kind;
  }
}

function attemptTone(attempt: NotificationDeliveryAttempt): "success" | "warning" | "danger" | "neutral" {
  return notificationStatusTone(attempt.delivery_status);
}

function actionMessage(action: NotificationAction): string {
  switch (action) {
    case "confirm":
      return "confirmed and queued";
    case "reject":
      return "rejected";
    case "retry":
      return "retried";
    default:
      return action;
  }
}

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
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [actionState, setActionState] = useState<"idle" | "confirming" | "rejecting" | "retrying">("idle");
  const [lastActionResult, setLastActionResult] = useState<{ action: NotificationAction; notification: NotificationDetail } | null>(null);
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

  const closeDrawer = () => {
    setDrawerMode("closed");
    setCreateForm(DEFAULT_CREATE_FORM);
  };

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!detail) {
      return;
    }
    setDrawerMode("edit");
  };

  const syncNotification = (notification: NotificationDetail) => {
    setDetail(notification);
    setDetailState("success");
    setNotifications((current) => current.map((item) => (
      item.notification_id === notification.notification_id ? { ...item, ...notification } : item
    )));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    setLastActionResult(null);
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
      closeDrawer();
      updateRoute((next) => {
        next.set("notificationId", payload.notification.notification_id);
      });
      setMessage(`Notification ${payload.notification.notification_id} created.`);
      syncNotification(payload.notification);
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
    setLastActionResult(null);
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
      syncNotification(payload.notification);
      setMessage(`Notification ${payload.notification.notification_id} updated.`);
      setDrawerMode("closed");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Notification update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAction = async (action: NotificationAction) => {
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
      syncNotification(payload.notification);
      setLastActionResult({ action, notification: payload.notification });
      setMessage(`Notification ${payload.notification.notification_id} ${actionMessage(action)}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Notification ${action} failed.`);
    } finally {
      setActionState("idle");
    }
  };

  const groupedNotifications = OUTBOX_GROUPS
    .map((group) => ({
      ...group,
      items: notifications.filter((notification) => group.statuses.includes(notification.delivery_status)),
    }))
    .filter((group) => group.items.length > 0);

  const drawerModeLabel = drawerMode === "create" ? "Create notification" : "Edit notification";
  const drawerStatus = drawerMode === "create" ? "secondary create path" : detail?.notification_id ?? "Select a notification";
  const drawerStatusTone = drawerMode === "create" ? "neutral" : detail ? notificationStatusTone(detail.delivery_status) : "warning";
  const latestAttempt = detail?.delivery_attempts[detail.delivery_attempts.length - 1] ?? null;
  const detailEffect = detail?.delivery_evidence?.effect_state;
  const detailEffectLabel = detailEffect ? detailEffect.replace(/_/g, " ") : "unknown";
  const outboxMode = detail ? notificationModeLabel(detail) : "No selection";
  const fallbackChain = detail?.configured_channel && detail.fallback_channel
    ? `${detail.configured_channel.label} -> ${detail.fallback_channel.label}`
    : detail?.configured_channel
      ? `${detail.configured_channel.label} (no fallback configured)`
      : detail?.fallback_channel
        ? `Fallback only ${detail.fallback_channel.label}`
        : "No delivery route linked";

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Notifications"
          description="Restoring notification scope."
          question="Open outbox when session access resolves."
          links={[
            { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery targets once session scope returns." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Notifications are instance-scoped with preview, retry, reject, and fallback state."
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
          description="Notification data is available to operators and admins."
          question="Use Channels or Approvals until notification access is available."
          links={[
            { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect delivery targets without opening notification history." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approval state while notification truth is unavailable." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="No placeholder outbox shell is rendered without scoped access."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Notifications"
        description="Control notification preview, queue, retry, rejection, and fallback routing."
        question="Select a notification to check delivery state and next action."
        links={[
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Stay on the outbox and delivery control surface." },
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Inspect the active and fallback delivery targets." },
          { label: "Reminders", to: CONTROL_PLANE_ROUTES.reminders, description: "Review due-state truth that may generate notifications." },
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Inspect recurring automations that create notification load." },
        ]}
        badges={[
          { label: `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`, tone: notifications.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Preview and live delivery are separated. Confirm, reject, and retry change persisted outbox state."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

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
              <h3>Outbox table</h3>
              <p className="fg-muted">Grouped by delivery state so preview items stay separate from sent work.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
              <button type="button" disabled={!canMutate} onClick={openCreateDrawer}>New notification</button>
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
                            onClick={() => updateRoute((next) => {
                              next.set("notificationId", notification.notification_id);
                            })}
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

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Delivery detail</h3>
              <p className="fg-muted">Preview, routing, fallback chain, attempts, and next step truth stay visible on the selected notification.</p>
            </div>
            <div className="fg-actions">
              {detail ? <span className="fg-pill">{detail.notification_id}</span> : null}
              <button type="button" disabled={!canMutate || !detail} onClick={openEditDrawer}>Edit selected notification</button>
            </div>
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a notification to inspect outbox truth and delivery evidence.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading notification detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={notificationStatusTone(detail.delivery_status)}>status {detail.delivery_status}</span>
                <span className="fg-pill" data-tone={effectTone(detailEffect)}>{detailEffectLabel}</span>
                <span className="fg-pill">{outboxMode}</span>
                <span className="fg-pill">{detail.priority} priority</span>
              </div>

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
                  <p className="fg-muted">There is no fake send button here. Preview approval and live delivery are deliberately separated so operators do not confuse review with an external send.</p>
                </div>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("confirm")}>
                    {actionState === "confirming" ? "Approving preview" : "Approve preview"}
                  </button>
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("reject")}>
                    {actionState === "rejecting" ? "Rejecting preview" : "Reject preview"}
                  </button>
                  <button type="button" disabled={!canMutate || actionState !== "idle"} onClick={() => void handleAction("retry")}>
                    {actionState === "retrying" ? "Retrying delivery" : "Retry delivery"}
                  </button>
                </div>
              </article>

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
                <p className="fg-muted">This ledger is persisted on the notification record so confirm, reject, retry, and manual state changes remain visible after refresh.</p>
              </article>

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
          ) : null}
        </article>
      </div>

      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerModeLabel}
        description={drawerMode === "create"
          ? "Create is still available, but it is intentionally secondary to the outbox control loop."
          : "Edit routing, content, retry budget, or administrative delivery overrides inside a focused drawer."}
        status={drawerStatus}
        statusTone={drawerStatusTone}
        properties={[
          { label: "Scope", value: instanceId || "No instance selected" },
          { label: "Primary controls", value: "approve preview / reject preview / retry delivery" },
          { label: "Persisted truth", value: "delivery attempts are written to the notification record" },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={!canMutate || (drawerMode === "create" ? savingCreate || !instanceId || !createForm.title.trim() || !createForm.body.trim() : savingUpdate || !detail)}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating notification" : "Create notification") : (savingUpdate ? "Saving notification" : "Save notification")}
            </button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          <section className="fg-subcard">
            <h4>Linkage</h4>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "create" ? (
                <label>
                  Notification ID
                  <input value={createForm.notificationId} onChange={(event) => setCreateForm((current) => ({ ...current, notificationId: event.target.value }))} placeholder="notification_customer_pricing" />
                </label>
              ) : null}
              <label>
                Task ID
                <input
                  value={drawerMode === "create" ? createForm.taskId : detail?.task_id ?? ""}
                  onChange={(event) => {
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, taskId: event.target.value }));
                    }
                  }}
                  disabled={drawerMode !== "create"}
                />
              </label>
              <label>
                Reminder ID
                <input
                  value={drawerMode === "create" ? createForm.reminderId : detail?.reminder_id ?? ""}
                  onChange={(event) => {
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, reminderId: event.target.value }));
                    }
                  }}
                  disabled={drawerMode !== "create"}
                />
              </label>
            </div>
            {drawerMode === "create" ? (
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
            ) : (
              <p className="fg-muted">Task, reminder, conversation, inbox, and workspace linkage on existing notifications remains read-only from this page. Use the owning work object when a relationship must be re-modeled.</p>
            )}
          </section>

          <section className="fg-subcard">
            <h4>Routing and preview</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Channel ID
                <input
                  value={drawerMode === "create" ? createForm.channelId : editForm.channelId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, channelId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, channelId: nextValue }));
                  }}
                />
              </label>
              <label>
                Fallback channel ID
                <input
                  value={drawerMode === "create" ? createForm.fallbackChannelId : editForm.fallbackChannelId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, fallbackChannelId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, fallbackChannelId: nextValue }));
                  }}
                />
              </label>
              <label>
                Preview required
                <select
                  value={drawerMode === "create" ? createForm.previewRequired : editForm.previewRequired}
                  onChange={(event) => {
                    const nextValue = event.target.value as "yes" | "no";
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, previewRequired: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, previewRequired: nextValue }));
                  }}
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Priority
                <select
                  value={drawerMode === "create" ? createForm.priority : editForm.priority}
                  onChange={(event) => {
                    const nextValue = event.target.value as WorkItemPriority;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, priority: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, priority: nextValue }));
                  }}
                >
                  {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Max retries
                <input
                  value={drawerMode === "create" ? createForm.maxRetries : editForm.maxRetries}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, maxRetries: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, maxRetries: nextValue }));
                  }}
                />
              </label>
              {drawerMode === "edit" ? (
                <label>
                  Delivery status
                  <select value={editForm.deliveryStatus} onChange={(event) => setEditForm((current) => ({ ...current, deliveryStatus: event.target.value as NotificationDeliveryStatus }))}>
                    {DELIVERY_STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Message content</h4>
            <label>
              Title
              <input
                value={drawerMode === "create" ? createForm.title : editForm.title}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, title: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, title: nextValue }));
                }}
                placeholder="Preview before send"
              />
            </label>
            <label>
              Body
              <textarea
                rows={6}
                value={drawerMode === "create" ? createForm.body : editForm.body}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, body: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, body: nextValue }));
                }}
              />
            </label>
          </section>

          <section className="fg-subcard">
            <h4>Administrative metadata</h4>
            {drawerMode === "edit" ? (
              <label>
                Last error
                <input value={editForm.lastError} onChange={(event) => setEditForm((current) => ({ ...current, lastError: event.target.value }))} />
              </label>
            ) : null}
            <label>
              Metadata JSON
              <textarea
                rows={6}
                value={drawerMode === "create" ? createForm.metadataJson : editForm.metadataJson}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, metadataJson: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, metadataJson: nextValue }));
                }}
              />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </section>
  );
}
