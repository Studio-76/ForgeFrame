import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createAutomation,
  fetchAutomationDetail,
  fetchAutomations,
  triggerAutomation,
  updateAutomation,
  type AutomationDetail,
  type AutomationStatus,
  type AutomationSummary,
} from "../api/domain/automations";
import { fetchInstances } from "../api/domain/instances";
import { useAppSession } from "../app/session";
import { getWorkInteractionAccess, normalizeOptional, type LoadState } from "./workInteractionPageSupport";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { Action } from "../components/ui/models/action";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";

import {
  AutomationList,
  AutomationDetailPanel,
  AutomationCreateForm as AutomationCreateFormComponent,
  AutomationEditForm as AutomationEditFormComponent,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  STATUS_OPTIONS,
  automationStatusTone,
  buildAutomationPayload,
} from "../features/automations";
import type { AutomationCreateForm, AutomationEditForm } from "../features/automations/types";

export function AutomationsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedAutomationId = searchParams.get("automationId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AutomationStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [createForm, setCreateForm] = useState<AutomationCreateForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<AutomationEditForm>(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [showCreateAdvancedSchedule, setShowCreateAdvancedSchedule] = useState(false);
  const [showEditAdvancedSchedule, setShowEditAdvancedSchedule] = useState(false);
  const [lastTriggerResult, setLastTriggerResult] = useState<{ triggeredAt: string; automation: AutomationDetail } | null>(null);
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

  // ── Data fetching effects ──

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Automation instance scope could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setAutomations([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchAutomations(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setAutomations(payload.automations);
        setListState("success");
        setError("");

        const nextAutomationId = payload.automations.some((a) => a.automation_id === selectedAutomationId)
          ? selectedAutomationId
          : payload.automations[0]?.automation_id ?? "";
        if (nextAutomationId !== selectedAutomationId) {
          updateRoute((next) => {
            if (nextAutomationId) {
              next.set("automationId", nextAutomationId);
            } else {
              next.delete("automationId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setAutomations([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Automation inventory could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAutomationId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedAutomationId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchAutomationDetail(selectedAutomationId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.automation);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Automation detail could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAutomationId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setShowEditAdvancedSchedule(false);
      return;
    }
    setEditForm({
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      cadenceMinutes: String(detail.cadence_minutes),
      nextRunAt: detail.next_run_at,
      targetTaskId: detail.target_task_id ?? "",
      targetConversationId: detail.target_conversation_id ?? "",
      targetInboxId: detail.target_inbox_id ?? "",
      targetWorkspaceId: detail.target_workspace_id ?? "",
      channelId: detail.channel_id ?? "",
      fallbackChannelId: detail.fallback_channel_id ?? "",
      previewRequired: detail.preview_required ? "yes" : "no",
      taskTemplateTitle: "",
      taskTemplateSummary: "",
      notificationTitle: "",
      notificationBody: "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setShowEditAdvancedSchedule(false);
  }, [detail]);

  useEffect(() => {
    setLastTriggerResult(null);
  }, [selectedAutomationId]);

  // ── Event handlers ──

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createAutomation(instanceId, {
        automation_id: normalizeOptional(createForm.automationId) ?? undefined,
        action_kind: createForm.actionKind,
        ...buildAutomationPayload(createForm) as {
          title: string;
          summary: string;
          cadence_minutes: number;
          next_run_at: string;
          target_task_id: string | null;
          target_conversation_id: string | null;
          target_inbox_id: string | null;
          target_workspace_id: string | null;
          channel_id: string | null;
          fallback_channel_id: string | null;
          preview_required: boolean;
          task_template_title: string | null;
          task_template_summary: string | null;
          notification_title: string | null;
          notification_body: string | null;
          metadata: Record<string, unknown>;
        },
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setShowCreateAdvancedSchedule(false);
      updateRoute((next) => { next.set("automationId", payload.automation.automation_id); });
      setMessage(`Automation ${payload.automation.automation_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Automation creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateAutomation(instanceId, detail.automation_id, {
        status: editForm.status,
        ...buildAutomationPayload(editForm),
      });
      setMessage(`Automation ${payload.automation.automation_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Automation update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleTrigger = async () => {
    if (!canMutate || !instanceId || !detail) return;

    setTriggering(true);
    setError("");
    setMessage("");
    try {
      const payload = await triggerAutomation(instanceId, detail.automation_id);
      setLastTriggerResult({
        triggeredAt: new Date().toISOString(),
        automation: payload.automation,
      });
      setMessage(`Automation ${payload.automation.automation_id} tested now.`);
      setRefreshNonce((current) => current + 1);
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : "Automation trigger failed.");
    } finally {
      setTriggering(false);
    }
  };

  const handleAutomationRowClick = (row: AutomationSummary) => {
    updateRoute((next) => { next.set("automationId", row.automation_id); });
  };

  const handleInstanceChange = (value: string) => {
    updateRoute((next) => { next.set("instanceId", value); next.delete("automationId"); });
  };

  const handleStatusChange = (value: string) => {
    updateRoute((next) => {
      if (value === "all") {
        next.delete("status");
      } else {
        next.set("status", value);
      }
      next.delete("automationId");
    });
  };

  // ── Derived state ──

  const matchedInstance = instances.find((i) => i.instance_id === instanceId);
  const currentInstanceLabel = matchedInstance
    ? `${matchedInstance.display_name} (${instanceId})`
    : instanceId || "Select instance";

  const attentionItems: AttentionPayload[] = [];
  if (error) {
    attentionItems.push({
      key: "error",
      level: "primary_blocker",
      title: "Error",
      description: error,
    });
  }
  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational",
      title: message,
    });
  }
  if (instancesState === "error") {
    attentionItems.push({
      key: "instances_load_error",
      level: "warning",
      title: "Instance scope could not be loaded",
    });
  }
  if (listState === "error") {
    attentionItems.push({
      key: "list_load_error",
      level: "warning",
      title: "Automation inventory could not be loaded",
    });
  }
  if (detailState === "error") {
    attentionItems.push({
      key: "detail_load_error",
      level: "warning",
      title: "Automation detail could not be loaded",
    });
  }

  const openCreateDrawer = () => {
    setError("");
    setMessage("");
  };

  const actions: Action[] = [
    {
      label: `Create automation`,
      kind: "primary",
      intent: "configure",
      disabled: !canMutate || !instanceId,
      onClick: openCreateDrawer,
    },
  ];

  // ── Early returns for auth/session ──

  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Automations"
        description="ForgeFrame is restoring recurring-rule scope before exposing trigger truth."
        attentionItems={[
          { key: "session", level: "warning", title: "Checking access", description: "Session state is resolving." },
        ]}
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Automations"
        description="This route is reserved for operators and admins who can inspect real recurring-rule truth."
        attentionItems={[
          {
            key: "permission",
            level: "primary_blocker",
            title: "Operator or admin required",
            description: "ForgeFrame does not render a cosmetic automation shell when the session cannot inspect recurring-rule truth.",
          },
        ]}
      />
    );
  }

  // ── Main render ──

  return (
    <>
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Automations"
        description="Persistent recurring rules with cadence, target linkage, trigger history, and last materialized task, reminder, or notification."
        scope={{
          label: currentInstanceLabel,
          onChange:
            instances.length > 1
              ? () => {
                  const nextIdx = instances.findIndex((i) => i.instance_id === instanceId);
                  const next = instances[(nextIdx + 1) % instances.length];
                  if (next) handleInstanceChange(next.instance_id);
                }
              : undefined,
        }}
        attentionItems={attentionItems}
        summaryItems={[
          {
            key: "total",
            label: "Automations",
            value: automations.length,
            tone: automations.length > 0 ? "success" : "warning",
          },
          {
            key: "access",
            label: "Access",
            value: canMutate ? "Read/write" : "Read only",
            tone: canMutate ? "success" : "neutral",
          },
        ]}
        actions={actions}
        filterContent={
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              Instance
              <select
                className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
                aria-label="Automation instance"
                value={instanceId}
                onChange={(event) => handleInstanceChange(event.target.value)}
              >
                {instances.map((instance) => (
                  <option key={instance.instance_id} value={instance.instance_id}>
                    {instance.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              Status
              <select
                className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
                aria-label="Automation status filter"
                value={statusFilter}
                onChange={(event) => handleStatusChange(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </>
        }
        hasSelection={detail != null}
        selectedItemContent={
          detail ? (
            <AutomationDetailPanel
              detail={detail}
              instanceId={instanceId}
              detailState={detailState}
              canMutate={canMutate}
              triggering={triggering}
              lastTriggerResult={lastTriggerResult}
              onTrigger={() => void handleTrigger()}
            />
          ) : undefined
        }
        emptyDetailHint="Select an automation to inspect recurring-rule truth."
        diagnostics={
          <AdvancedDiagnostics title="Automation diagnostics" defaultOpen={false}>
            <div className="fg-stack">
              <p className="text-meta text-muted">Internal state for debugging registry behavior.</p>
              <div className="fg-grid fg-grid-compact">
                <div><strong>instanceId:</strong> {instanceId || "—"}</div>
                <div><strong>selectedAutomationId:</strong> {selectedAutomationId || "—"}</div>
                <div><strong>statusFilter:</strong> {statusFilter}</div>
                <div><strong>listState:</strong> {listState}</div>
                <div><strong>detailState:</strong> {detailState}</div>
                <div><strong>instancesState:</strong> {instancesState}</div>
                <div><strong>canRead:</strong> {String(canRead)}</div>
                <div><strong>canMutate:</strong> {String(canMutate)}</div>
              </div>
              {detail ? (
                <RawJson data={detail} label="Current detail payload" />
              ) : null}
            </div>
          </AdvancedDiagnostics>
        }
      >
        <AutomationList
          automations={automations}
          selectedAutomationId={selectedAutomationId}
          loading={listState === "loading"}
          error={listState === "error" ? error : null}
          onRowClick={handleAutomationRowClick}
        />
      </RegistryManagementPage>

      {/* ── Create and edit forms ── */}
      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create automation</h3>
              <p className="fg-muted">Create a recurring rule with a structured schedule editor. Advanced raw cadence stays available, but it is not the default authoring path.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>
              {canMutate ? "Writable" : "Admin only"}
            </span>
          </div>
          <AutomationCreateFormComponent
            createForm={createForm}
            setCreateForm={setCreateForm}
            savingCreate={savingCreate}
            canMutate={canMutate}
            instanceId={instanceId}
            showCreateAdvancedSchedule={showCreateAdvancedSchedule}
            setShowCreateAdvancedSchedule={setShowCreateAdvancedSchedule}
            onSubmit={handleCreate}
          />
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit automation</h3>
              <p className="fg-muted">Keep cadence, targets, and preview posture coherent for the selected recurring rule. Structured schedule inputs stay primary; raw cadence is explicitly advanced.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
              {detail ? detail.automation_id : "Select an automation"}
            </span>
          </div>
          <AutomationEditFormComponent
            editForm={editForm}
            setEditForm={setEditForm}
            savingUpdate={savingUpdate}
            canMutate={canMutate}
            hasDetail={detail != null}
            detailAutomationId={detail?.automation_id ?? ""}
            showEditAdvancedSchedule={showEditAdvancedSchedule}
            setShowEditAdvancedSchedule={setShowEditAdvancedSchedule}
            onSubmit={handleUpdate}
          />
        </article>
      </div>
    </>
  );
}
