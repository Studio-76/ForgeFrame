/**
 * NotificationsPage — control notification preview, queue, retry,
 * rejection, and fallback routing.
 *
 * Uses the IncidentResponsePage template for consistent layout with
 * attention items, summary strip, actions, selected-item detail, and
 * collapsed diagnostics.
 *
 * Feature module at {@link features/notifications}.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  confirmNotification,
  createNotification,
  fetchNotificationDetail,
  fetchNotifications,
  rejectNotification,
  retryNotification,
  updateNotification,
  type NotificationDeliveryStatus,
  type NotificationDetail,
  type NotificationSummary,
  type WorkItemPriority,
} from "../api/domain/notifications";
import { fetchInstances } from "../api/domain/instances";
import { useAppSession } from "../app/session";
import { IncidentResponsePage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { DiagnosticSection, RawJson } from "../components/ui";
import { getWorkInteractionAccess, normalizeOptional, parseInteger, parseJsonObject } from "./workInteractionPageSupport";

import {
  NotificationList,
  NotificationDetailPanel,
  NotificationCreateForm,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  actionMessage,
} from "../features/notifications";

import type { CreateForm, DrawerMode, EditForm, NotificationAction } from "../features/notifications";

type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Notifications page — outbox and delivery control surface exposed through
 * the IncidentResponsePage template with a scope/filter card, grouped
 * outbox table, delivery detail panel, create/edit form, and diagnostics.
 */
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
  const [createForm, setCreateForm] = useState<CreateForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditForm>(DEFAULT_EDIT_FORM);
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

  // ── Effects ─────────────────────────────────────────────────────────

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

  // ── Handlers ────────────────────────────────────────────────────────

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

  // ── Inline handlers ─────────────────────────────────────────────────

  const handleInstanceChange = (nextInstanceId: string) => {
    updateRoute((next) => {
      next.set("instanceId", nextInstanceId);
      next.delete("notificationId");
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    updateRoute((next) => {
      if (value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.delete("notificationId");
    });
  };

  const handleSelectNotification = (notificationId: string) => {
    updateRoute((next) => {
      next.set("notificationId", notificationId);
    });
  };

  const handleCreateFormChange = (field: string, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value } as CreateForm));
  };

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value } as EditForm));
  };

  // ── Derived data ────────────────────────────────────────────────────

  const groupedNotifications = [
    { key: "pending_preview", items: notifications.filter((n) => ["draft", "preview"].includes(n.delivery_status)) },
    { key: "queued", items: notifications.filter((n) => ["confirmed", "queued", "delivering", "fallback_queued"].includes(n.delivery_status)) },
    { key: "sent", items: notifications.filter((n) => n.delivery_status === "delivered") },
    { key: "failed", items: notifications.filter((n) => ["failed", "cancelled"].includes(n.delivery_status)) },
    { key: "rejected", items: notifications.filter((n) => n.delivery_status === "rejected") },
  ];

  // ── Template props ──────────────────────────────────────────────────

  const attentionItems: AttentionPayload[] = [];
  if (error) {
    attentionItems.push({
      key: "error",
      level: "warning",
      title: error,
    });
  }
  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational",
      title: message,
    });
  }

  const summaryItems = groupedNotifications
    .filter((g) => g.items.length > 0)
    .map((group) => ({
      key: group.key,
      label: group.key.replace(/_/g, " "),
      value: group.items.length,
      tone: group.key === "failed" || group.key === "rejected" ? "danger" as const
        : group.key === "queued" ? "warning" as const
          : group.key === "sent" ? "success" as const
            : "neutral" as const,
    }));

  const selectedItemContent = detail ? (
    <NotificationDetailPanel
      detail={detail}
      detailState={detailState}
      instanceId={instanceId}
      canMutate={canMutate}
      actionState={actionState}
      lastActionResult={lastActionResult}
      onAction={(action) => void handleAction(action)}
      onEdit={openEditDrawer}
    />
  ) : null;

  const diagnosticsContent = (
    <>
      <DiagnosticSection label="Filters">
        <RawJson data={{ deliveryStatusFilter, priorityFilter }} />
      </DiagnosticSection>
      <DiagnosticSection label="Load states">
        <RawJson data={{ instancesState, listState, detailState }} />
      </DiagnosticSection>
      <DiagnosticSection label="Raw notification list">
        <RawJson data={notifications} />
      </DiagnosticSection>
    </>
  );

  // ── Session guards ──────────────────────────────────────────────────

  if (!sessionReady) {
    return (
      <IncidentResponsePage
        eyebrow="Work Interaction"
        title="Notifications"
        description="Restoring notification scope."
        noIncidents
        noIncidentsConfig={{
          title: "Checking access",
          description: "Restoring notification scope before exposing delivery state.",
        }}
      />
    );
  }

  if (!canRead) {
    return (
      <IncidentResponsePage
        eyebrow="Work Interaction"
        title="Notifications"
        description="Operator or admin access required to inspect notification state."
        noIncidents
        noIncidentsConfig={{
          title: "Operator or admin required",
          description: "Session cannot inspect notification delivery state.",
        }}
      />
    );
  }

  return (
    <IncidentResponsePage
      eyebrow="Work Interaction"
      title="Notifications"
      description="Preview, queue, retry, rejection, and fallback routing."
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      selectedItemContent={selectedItemContent}
      hasSelection={Boolean(detail)}
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Notification diagnostics"
    >
      {/* ── Scope, filters, and outbox table ── */}
      <NotificationList
        instances={instances}
        instanceId={instanceId}
        instancesState={instancesState}
        listState={listState}
        notifications={notifications}
        selectedNotificationId={selectedNotificationId}
        deliveryStatusFilter={deliveryStatusFilter}
        priorityFilter={priorityFilter}
        onInstanceChange={handleInstanceChange}
        onFilterChange={handleFilterChange}
        onSelectNotification={handleSelectNotification}
        onCreateNew={openCreateDrawer}
        canMutate={canMutate}
      />

      {/* ── Create/edit form (rendered inline when drawer is open) ── */}
      <NotificationCreateForm
        drawerMode={drawerMode}
        createForm={createForm}
        editForm={editForm}
        savingCreate={savingCreate}
        savingUpdate={savingUpdate}
        canMutate={canMutate}
        instanceId={instanceId}
        detailExists={Boolean(detail)}
        onCreateFormChange={handleCreateFormChange}
        onEditFormChange={handleEditFormChange}
        onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}
        onClose={closeDrawer}
      />
    </IncidentResponsePage>
  );
}
