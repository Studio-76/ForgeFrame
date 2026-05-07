/**
 * RemindersPage — reminder lifecycle management surface.
 *
 * Migrated to use the ReviewQueuePage template with summary items,
 * attention items, grouped reminder table, detail panel, and
 * collapsible diagnostics.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createReminder,
  fetchReminderDetail,
  fetchReminders,
  updateReminder,
  type ReminderDetail,
  type ReminderStatus,
  type ReminderSummary,
} from "../api/domain/reminders";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { Button } from "../components/ui/Button";
import { DiagnosticSection, RawJson } from "../components/ui/AdvancedDiagnostics";
import { ReviewQueuePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";
import {
  ReminderTable,
  ReminderDetailPanel,
  type DrawerMode,
  type CreateReminderForm,
  type EditReminderForm,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DRAWER_FORM_ID,
} from "../features/reminders";

/**
 * Reminders page component.
 */
export function RemindersPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedReminderId = searchParams.get("reminderId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ReminderStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [detail, setDetail] = useState<ReminderDetail | null>(null);
  const [createForm, setCreateForm] = useState<CreateReminderForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditReminderForm>(DEFAULT_EDIT_FORM);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [actionState, setActionState] = useState<Record<"snooze" | "complete" | "cancel", boolean>>({
    snooze: false,
    complete: false,
    cancel: false,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const nowMs = Date.now();
  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  // ── Instance scope ────────────────────────────────────────────────

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
        setError(loadError instanceof Error ? loadError.message : "Reminder instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // ── Reminder list ─────────────────────────────────────────────────

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setReminders([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchReminders(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setReminders(payload.reminders);
        setListState("success");
        setError("");

        const nextReminderId = payload.reminders.some((reminder) => reminder.reminder_id === selectedReminderId)
          ? selectedReminderId
          : payload.reminders[0]?.reminder_id ?? "";
        if (nextReminderId !== selectedReminderId) {
          updateRoute((next) => {
            if (nextReminderId) {
              next.set("reminderId", nextReminderId);
            } else {
              next.delete("reminderId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setReminders([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Reminder inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedReminderId, statusFilter]);

  // ── Reminder detail ───────────────────────────────────────────────

  useEffect(() => {
    if (!canRead || !instanceId || !selectedReminderId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchReminderDetail(selectedReminderId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.reminder);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Reminder detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedReminderId]);

  // ── Edit form sync ────────────────────────────────────────────────

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      taskId: detail.task_id ?? "",
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      dueAt: detail.due_at,
      triggeredAt: detail.triggered_at ?? "",
      notificationId: detail.notification_id ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
  }, [detail]);

  // ── Handlers ──────────────────────────────────────────────────────

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

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createReminder(instanceId, {
        reminder_id: normalizeOptional(createForm.reminderId),
        task_id: normalizeOptional(createForm.taskId),
        automation_id: normalizeOptional(createForm.automationId),
        title: createForm.title.trim(),
        summary: createForm.summary.trim(),
        due_at: createForm.dueAt.trim(),
        metadata: parseJsonObject(createForm.metadataJson, "Reminder metadata"),
      });
      closeDrawer();
      updateRoute((next) => {
        next.set("reminderId", payload.reminder.reminder_id);
      });
      setMessage(`Reminder ${payload.reminder.reminder_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Reminder creation failed.");
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
      const payload = await updateReminder(instanceId, detail.reminder_id, {
        task_id: normalizeOptional(editForm.taskId),
        title: editForm.title.trim(),
        summary: editForm.summary.trim(),
        status: editForm.status,
        due_at: normalizeOptional(editForm.dueAt),
        triggered_at: normalizeOptional(editForm.triggeredAt),
        notification_id: normalizeOptional(editForm.notificationId),
        metadata: parseJsonObject(editForm.metadataJson, "Reminder metadata"),
      });
      setMessage(`Reminder ${payload.reminder.reminder_id} updated.`);
      setRefreshNonce((current) => current + 1);
      setDrawerMode("closed");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Reminder update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAction = async (action: "snooze" | "complete" | "cancel") => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setActionState((current) => ({ ...current, [action]: true }));
    setError("");
    setMessage("");
    try {
      if (action === "snooze") {
        const nextDue = new Date(detail.due_at);
        if (Number.isNaN(nextDue.getTime())) {
          throw new Error("Reminder due_at is invalid and cannot be snoozed.");
        }
        nextDue.setUTCDate(nextDue.getUTCDate() + 1);
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "scheduled",
          due_at: nextDue.toISOString(),
          triggered_at: null,
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} snoozed by one day.`);
      } else if (action === "complete") {
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "dismissed",
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} marked complete.`);
      } else {
        const payload = await updateReminder(instanceId, detail.reminder_id, {
          status: "cancelled",
        });
        setMessage(`Reminder ${payload.reminder.reminder_id} cancelled.`);
      }
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Reminder action '${action}' failed.`);
    } finally {
      setActionState((current) => ({ ...current, [action]: false }));
    }
  };

  // ── Template props ────────────────────────────────────────────────

  const overdueCount = reminders.filter((r) => {
    const dueMs = Date.parse(r.due_at);
    return !Number.isNaN(dueMs) && dueMs < nowMs && r.status !== "triggered" && r.status !== "dismissed" && r.status !== "cancelled";
  }).length;

  const dueNowCount = reminders.filter((r) => r.status === "due").length;

  const summaryItems = [
    { key: "overdue", label: "Overdue", value: overdueCount, tone: overdueCount > 0 ? "danger" as const : "success" as const },
    { key: "due-now", label: "Due now", value: dueNowCount, tone: dueNowCount > 0 ? "warning" as const : "neutral" as const },
    { key: "total", label: "Total reminders", value: reminders.length, tone: reminders.length > 0 ? "info" as const : "neutral" as const },
    { key: "access", label: "Access", value: canMutate ? "Writable" : "Read only", tone: canMutate ? "success" as const : "warning" as const },
  ];

  const actions: Action[] = [
    {
      label: "New reminder",
      kind: "primary",
      intent: "configure",
      onClick: openCreateDrawer,
      disabled: !canMutate,
    },
  ];

  const attentionItems: AttentionPayload[] = [];
  if (overdueCount > 0) {
    attentionItems.push({
      key: "overdue-reminders",
      level: "warning",
      title: `${overdueCount} overdue reminder${overdueCount === 1 ? "" : "s"}`,
      description: "Overdue reminders may require immediate attention.",
    });
  }
  if (dueNowCount > 0) {
    attentionItems.push({
      key: "due-now-reminders",
      level: "informational",
      title: `${dueNowCount} reminder${dueNowCount === 1 ? "" : "s"} due now`,
      description: "Reminders in the due-now window.",
    });
  }
  if (detailState === "error") {
    attentionItems.push({
      key: "detail-error",
      level: "diagnostic",
      title: "Reminder detail load failed",
      description: error || "An error occurred loading reminder detail.",
    });
  }

  const diagnosticsContent = (
    <>
      <DiagnosticSection label="Reminders list payload">
        <RawJson data={reminders} />
      </DiagnosticSection>
      <DiagnosticSection label="Reminder detail payload">
        <RawJson data={detail} />
      </DiagnosticSection>
      {error ? (
        <DiagnosticSection label="Error state">
          <p className="fg-danger">{error}</p>
        </DiagnosticSection>
      ) : null}
      {message ? (
        <DiagnosticSection label="Status message">
          <p>{message}</p>
        </DiagnosticSection>
      ) : null}
    </>
  );

  const drawerModeLabel = drawerMode === "create" ? "Create Reminder" : "Edit Reminder";
  const drawerStatus = drawerMode === "create"
    ? (createForm.title.trim() && createForm.dueAt.trim() ? "form ready" : "title and due date required")
    : (detail ? detail.reminder_id : "select reminder");
  const drawerStatusTone = drawerMode === "create"
    ? (createForm.title.trim() && createForm.dueAt.trim() ? "success" : "danger")
    : detail
      ? (detail.status === "triggered" || detail.status === "dismissed" ? "success" as const : detail.status === "cancelled" ? "neutral" as const : detail.status === "due" ? "danger" as const : "warning" as const)
      : "warning";

  // ── Session guard returns ─────────────────────────────────────────

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Reminders"
          description="Restoring reminder scope before exposing due-state truth."
          question="Which reminder queue should open once the session is restored?"
          links={[
            { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Return to task inventory." },
            { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Open delivery truth when ready." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Reminders are instance-scoped and reconciled with task, automation, and notification linkage."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Reminders"
          description="Operator or admin access required to inspect reminder truth."
          question="Which adjacent surface should open while reminder access is unavailable?"
          links={[
            { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Review linked task truth." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Switch to approval queue." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Session cannot inspect due-state reminder truth."
        />
      </section>
    );
  }

  // ── Main content ──────────────────────────────────────────────────

  return (
    <ReviewQueuePage
      eyebrow="Work Interaction"
      title="Reminders"
      description="Reminders grouped by due pressure with snooze, complete, cancel, and linkage."
      summaryItems={summaryItems}
      actions={actions}
      attentionItems={attentionItems}
      isEmpty={listState === "success" && reminders.length === 0}
      emptyTitle="No reminders found"
      emptyDescription="No reminders matched the selected filters. Adjust the status filter or create a new reminder."
      selectedItemContent={
        <ReminderDetailPanel
          detail={detail}
          detailState={detailState}
          instanceId={instanceId}
          canMutate={canMutate}
          actionState={actionState}
          viewerTimeZone={viewerTimeZone}
          nowMs={nowMs}
          onOpenEdit={openEditDrawer}
          onAction={(action) => void handleAction(action)}
        />
      }
      hasSelection={Boolean(detail)}
      emptyDetailHint="Select a reminder from the queue to inspect due-state truth."
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Reminder diagnostics"
    >
      {/* Error and message banners */}
      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {/* Reminder table with filters */}
      <ReminderTable
        listState={listState}
        reminders={reminders}
        selectedReminderId={selectedReminderId}
        instanceId={instanceId}
        statusFilter={statusFilter}
        instances={instances}
        instancesState={instancesState}
        canMutate={canMutate}
        nowMs={nowMs}
        updateRoute={updateRoute}
        onOpenCreate={openCreateDrawer}
        onSelectReminder={(reminderId) => updateRoute((next) => { next.set("reminderId", reminderId); })}
      />

      {/* Create / Edit drawer */}
      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerModeLabel}
        description={drawerMode === "create"
          ? "Create a persisted follow-up without turning the reminder page back into a permanent form wall."
          : "Adjust linkage, timing, and metadata inside a focused drawer."}
        status={drawerStatus}
        statusTone={drawerStatusTone}
        properties={[
          { label: "Scope", value: instanceId || "No instance selected" },
          { label: "Direct controls", value: "snooze / complete / cancel via reminder PATCH" },
          { label: "Time display", value: `Raw due_at plus viewer timezone (${viewerTimeZone})` },
        ]}
        actions={
          <>
            <Button variant="tertiary" onPress={closeDrawer}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form={DRAWER_FORM_ID}
              isDisabled={!canMutate || (drawerMode === "create" ? savingCreate || !createForm.title.trim() || !createForm.dueAt.trim() : savingUpdate || !detail)}
              onPress={() => {
                const form = document.getElementById(DRAWER_FORM_ID) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating reminder" : "Create reminder") : (savingUpdate ? "Saving reminder" : "Save reminder changes")}
            </Button>
          </>
        }
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          <section className="fg-subcard">
            <h4>Identity</h4>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "create" ? (
                <label>
                  Reminder ID
                  <input value={createForm.reminderId} onChange={(event) => setCreateForm((current) => ({ ...current, reminderId: event.target.value }))} placeholder="reminder_customer_pricing" />
                </label>
              ) : null}
              <label>
                Task ID
                <input
                  value={drawerMode === "create" ? createForm.taskId : editForm.taskId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, taskId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, taskId: nextValue }));
                  }}
                />
              </label>
              {drawerMode === "create" ? (
                <label>
                  Automation ID
                  <input value={createForm.automationId} onChange={(event) => setCreateForm((current) => ({ ...current, automationId: event.target.value }))} />
                </label>
              ) : (
                <label>
                  Notification ID
                  <input value={editForm.notificationId} onChange={(event) => setEditForm((current) => ({ ...current, notificationId: event.target.value }))} />
                </label>
              )}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Timing and state</h4>
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
                placeholder="Follow up now"
              />
            </label>
            <label>
              Summary
              <textarea
                rows={4}
                value={drawerMode === "create" ? createForm.summary : editForm.summary}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, summary: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, summary: nextValue }));
                }}
              />
            </label>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "edit" ? (
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ReminderStatus }))}>
                    <option value="scheduled">scheduled</option>
                    <option value="due">due</option>
                    <option value="triggered">triggered</option>
                    <option value="dismissed">dismissed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>
              ) : null}
              <label>
                Due at
                <input
                  value={drawerMode === "create" ? createForm.dueAt : editForm.dueAt}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, dueAt: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, dueAt: nextValue }));
                  }}
                  placeholder="2026-04-23T10:30:00Z"
                />
              </label>
              {drawerMode === "edit" ? (
                <label>
                  Triggered at
                  <input value={editForm.triggeredAt} onChange={(event) => setEditForm((current) => ({ ...current, triggeredAt: event.target.value }))} />
                </label>
              ) : null}
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Metadata</h4>
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
    </ReviewQueuePage>
  );
}
