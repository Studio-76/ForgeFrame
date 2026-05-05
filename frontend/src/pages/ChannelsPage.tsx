/**
 * ChannelsPage — delivery channel inventory management surface.
 *
 * Migrated to use the RegistryManagementPage template with scope bar,
 * filter controls, summary strip, channel inventory table, detail panel
 * with edit form, create form, and collapsible diagnostics.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  createChannel,
  fetchChannelDetail,
  fetchChannels,
  updateChannel,
  type ChannelDetail as ChannelDetailType,
  type DeliveryChannelKind,
  type DeliveryChannelStatus,
  type DeliveryChannelSummary,
} from "../api/domain/channels";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildChannelPath, buildNotificationPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { RegistryManagementPage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";
import {
  ChannelList,
  ChannelDetail,
  ChannelCreateForm,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  STATUS_OPTIONS,
  KIND_FILTER_OPTIONS,
} from "../features/channels";
import type { CreateChannelForm, EditChannelForm } from "../features/channels";
import { DiagnosticSection, RawJson } from "../components/ui";

/**
 * Channels page — browse, create, and manage delivery channels.
 */
export function ChannelsPage() {
  const navigate = useNavigate();
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedChannelId = searchParams.get("channelId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as DeliveryChannelStatus | "all" | "") || "all";
  const kindFilter = (searchParams.get("kind")?.trim() as DeliveryChannelKind | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [channels, setChannels] = useState<DeliveryChannelSummary[]>([]);
  const [detail, setDetail] = useState<ChannelDetailType | null>(null);
  const [createForm, setCreateForm] = useState<CreateChannelForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditChannelForm>(DEFAULT_EDIT_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [editTargetDirty, setEditTargetDirty] = useState(false);
  const [editMetadataDirty, setEditMetadataDirty] = useState(false);
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
        setError(loadError instanceof Error ? loadError.message : "Channel instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // ── Channel list ──────────────────────────────────────────────────

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setChannels([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchChannels(instanceId, { status: statusFilter, kind: kindFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setChannels(payload.channels);
        setListState("success");
        setError("");

        const nextChannelId = payload.channels.some((channel) => channel.channel_id === selectedChannelId)
          ? selectedChannelId
          : payload.channels[0]?.channel_id ?? "";
        if (nextChannelId !== selectedChannelId) {
          updateRoute((next) => {
            if (nextChannelId) {
              next.set("channelId", nextChannelId);
            } else {
              next.delete("channelId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setChannels([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Channel inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, kindFilter, refreshNonce, selectedChannelId, statusFilter]);

  // ── Channel detail ────────────────────────────────────────────────

  useEffect(() => {
    if (!canRead || !instanceId || !selectedChannelId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchChannelDetail(selectedChannelId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.channel);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Channel detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedChannelId]);

  // ── Edit form sync ────────────────────────────────────────────────

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setEditTargetDirty(false);
      setEditMetadataDirty(false);
      return;
    }

    setEditForm({
      label: detail.label,
      target: detail.credential_posture.target_masked ? "" : detail.target,
      status: detail.status,
      fallbackChannelId: detail.fallback_channel_id ?? "",
      metadataJson: JSON.stringify(detail.advanced_metadata, null, 2),
    });
    setEditTargetDirty(false);
    setEditMetadataDirty(false);
  }, [detail]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createChannel(instanceId, {
        channel_id: normalizeOptional(createForm.channelId),
        channel_kind: createForm.channelKind,
        label: createForm.label.trim(),
        target: createForm.target.trim(),
        status: createForm.status,
        fallback_channel_id: normalizeOptional(createForm.fallbackChannelId),
        metadata: parseJsonObject(createForm.metadataJson, "Advanced channel metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("channelId", payload.channel.channel_id);
      });
      setMessage(`Channel ${payload.channel.channel_id} created.`);
      setRefreshNonce((current) => current + 1);
      setShowCreate(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Channel creation failed.");
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
      if (editTargetDirty && !editForm.target.trim()) {
        throw new Error("Target is required when rotating or replacing a stored channel destination.");
      }
      const payload = await updateChannel(instanceId, detail.channel_id, {
        label: editForm.label.trim(),
        target: editTargetDirty ? editForm.target.trim() : undefined,
        status: editForm.status,
        fallback_channel_id: normalizeOptional(editForm.fallbackChannelId),
        metadata: editMetadataDirty ? parseJsonObject(editForm.metadataJson, "Advanced channel metadata") : undefined,
      });
      setMessage(`Channel ${payload.channel.channel_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Channel update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  // ── Template props ────────────────────────────────────────────────

  const currentInstance = instances.find((inst) => inst.instance_id === instanceId);

  const actions: Action[] = [
    {
      label: "Create channel",
      kind: "primary",
      intent: "configure",
      onClick: () => setShowCreate((current) => !current),
    },
  ];

  const summaryItems = [
    { key: "total", label: "Total channels", value: channels.length, tone: channels.length > 0 ? "info" as const : "neutral" as const },
    { key: "canMutate", label: "Access", value: canMutate ? "Writable" : "Read only", tone: canMutate ? "success" as const : "warning" as const },
  ];

  const diagnosticsContent = (
    <>
      <DiagnosticSection label="Channel list payload">
        <RawJson data={channels} />
      </DiagnosticSection>
      <DiagnosticSection label="Channel detail payload">
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

  // ── Session guard returns ─────────────────────────────────────────

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Channels"
          description="ForgeFrame is restoring channel scope before exposing delivery target truth."
          question="Which channel surface should open once the active session is restored?"
          links={[
            { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Return to outbox truth while session state resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Channels stay instance-scoped and must carry fallback posture and notification linkage."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Channels"
          description="This route is reserved for operators and admins who can inspect real delivery-channel truth."
          question="Which adjacent surface should remain open while channel access is outside the current permission envelope?"
          links={[
            { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect delivery truth without opening channels." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Stay on the approval queue while channel truth is unavailable." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic channel shell when the session cannot inspect real delivery targets."
        />
      </section>
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Work Interaction"
      title="Channels"
      description="Persistent delivery-channel inventory with fallback posture, credential hygiene, filtered status/type views, and recent notification linkage."
      scope={{
        label: currentInstance
          ? currentInstance.display_name
          : instanceId || "Select an instance",
        onChange: undefined, // instance selection is handled via the filter dropdown
      }}
      summaryItems={summaryItems}
      filterContent={
        <>
          <label className="flex items-center gap-1.5 text-meta text-muted">
            Instance
            <select
              className="ff-select"
              aria-label="Channel instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("channelId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-meta text-muted">
            Status
            <select
              className="ff-select"
              aria-label="Channel status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("channelId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-meta text-muted">
            Type
            <select
              className="ff-select"
              aria-label="Channel kind filter"
              value={kindFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("kind");
                } else {
                  next.set("kind", nextValue);
                }
                next.delete("channelId");
              })}
            >
              {KIND_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </>
      }
      actions={actions}
      isEmpty={listState === "success" && channels.length === 0 && !showCreate}
      emptyTitle="No channels found"
      emptyDescription="No channels matched the selected filters. Adjust the status or type filter, or create a new channel."
      emptyAction={undefined}
      selectedItemContent={
        <ChannelDetail
          detail={detail}
          detailState={detailState}
          editForm={editForm}
          setEditForm={setEditForm}
          editTargetDirty={editTargetDirty}
          setEditTargetDirty={setEditTargetDirty}
          editMetadataDirty={editMetadataDirty}
          setEditMetadataDirty={setEditMetadataDirty}
          savingUpdate={savingUpdate}
          canMutate={canMutate}
          instanceId={instanceId}
          onNavigateChannel={(channelId: string) => navigate(buildChannelPath({ instanceId, channelId }))}
          onNavigateNotification={(notificationId: string) => navigate(buildNotificationPath({ instanceId, notificationId }))}
          handleUpdate={handleUpdate}
        />
      }
      hasSelection={Boolean(detail)}
      emptyDetailHint="Select a channel from the table to inspect its configuration and credentials."
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Channel diagnostics"
    >
      <ChannelList
        channels={channels}
        listState={listState}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(channelId) => updateRoute((next) => {
          next.set("channelId", channelId);
        })}
      />

      {showCreate ? (
        <div className="mt-4">
          <ChannelCreateForm
            createForm={createForm}
            setCreateForm={setCreateForm}
            savingCreate={savingCreate}
            canMutate={canMutate}
            hasInstance={Boolean(instanceId)}
            handleCreate={handleCreate}
          />
        </div>
      ) : null}
    </RegistryManagementPage>
  );
}
