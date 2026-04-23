import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createChannel,
  fetchChannelDetail,
  fetchChannels,
  fetchInstances,
  updateChannel,
  type ChannelDetail,
  type DeliveryChannelKind,
  type DeliveryChannelStatus,
  type DeliveryChannelSummary,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildChannelPath, buildNotificationPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<DeliveryChannelStatus | "all"> = ["all", "active", "disabled", "degraded"];
const KIND_OPTIONS: DeliveryChannelKind[] = ["in_app", "email", "webhook", "slack"];

const DEFAULT_CREATE_FORM = {
  channelId: "",
  channelKind: "email" as DeliveryChannelKind,
  label: "",
  target: "",
  status: "active" as DeliveryChannelStatus,
  fallbackChannelId: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  label: "",
  target: "",
  status: "active" as DeliveryChannelStatus,
  fallbackChannelId: "",
  metadataJson: "{}",
};

export function ChannelsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedChannelId = searchParams.get("channelId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as DeliveryChannelStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [channels, setChannels] = useState<DeliveryChannelSummary[]>([]);
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
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
        setError(loadError instanceof Error ? loadError.message : "Channel instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setChannels([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchChannels(instanceId, { status: statusFilter, limit: 100 })
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
  }, [canRead, instanceId, refreshNonce, selectedChannelId, statusFilter]);

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

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      label: detail.label,
      target: detail.target,
      status: detail.status,
      fallbackChannelId: detail.fallback_channel_id ?? "",
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
      const payload = await createChannel(instanceId, {
        channel_id: normalizeOptional(createForm.channelId),
        channel_kind: createForm.channelKind,
        label: createForm.label.trim(),
        target: createForm.target.trim(),
        status: createForm.status,
        fallback_channel_id: normalizeOptional(createForm.fallbackChannelId),
        metadata: parseJsonObject(createForm.metadataJson, "Channel metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("channelId", payload.channel.channel_id);
      });
      setMessage(`Channel ${payload.channel.channel_id} created.`);
      setRefreshNonce((current) => current + 1);
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
      const payload = await updateChannel(instanceId, detail.channel_id, {
        label: editForm.label.trim(),
        target: editForm.target.trim(),
        status: editForm.status,
        fallback_channel_id: normalizeOptional(editForm.fallbackChannelId),
        metadata: parseJsonObject(editForm.metadataJson, "Channel metadata"),
      });
      setMessage(`Channel ${payload.channel.channel_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Channel update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

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
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Channels"
        description="Persistent delivery-channel inventory with fallback posture, target truth, and recent notification linkage."
        question="Are delivery targets actually configured and visible, or is external communication still hiding behind implicit defaults?"
        links={[
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Stay on the channel inventory and detail surface." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Open outbox truth that flows through these channels." },
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Review recurring rules that target these channels." },
        ]}
        badges={[
          { label: `${channels.length} channel${channels.length === 1 ? "" : "s"}`, tone: channels.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Channels are first-class delivery records. Fallback posture is not allowed to hide in env vars or one-off code paths."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the channel inventory by operational posture.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Channel instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("channelId");
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
            Status
            <select
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
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Channel inventory</h3>
              <p className="fg-muted">Each row is a persisted delivery target with explicit fallback posture.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading channel inventory.</p> : null}
          {listState === "success" && channels.length === 0 ? <p className="fg-muted">No channels matched the selected filters.</p> : null}

          {channels.length > 0 ? (
            <div className="fg-stack">
              {channels.map((channel) => (
                <button
                  key={channel.channel_id}
                  type="button"
                  className={`fg-data-row${channel.channel_id === selectedChannelId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("channelId", channel.channel_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{channel.channel_id}</span>
                      <strong>{channel.label}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={channel.status === "active" ? "success" : channel.status === "degraded" ? "warning" : "danger"}>{channel.status}</span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{channel.channel_kind} · {channel.target}</span>
                    <span className="fg-muted">notifications {channel.notification_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Channel detail</h3>
              <p className="fg-muted">Fallback posture and recent notification linkage converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.channel_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a channel to inspect fallback and delivery truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading channel detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Kind: {detail.channel_kind}</li>
                  <li>Status: {detail.status}</li>
                  <li>Target: {detail.target}</li>
                  <li>Fallback: {detail.fallback_channel_id ?? "No fallback configured"}</li>
                  <li>Notifications: {detail.notification_count}</li>
                </ul>
                <div className="fg-actions">
                  {detail.fallback_channel_id ? <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: detail.fallback_channel_id })}>Open fallback channel</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Recent notifications</h4>
                {detail.recent_notifications.length === 0 ? <p className="fg-muted">No recent notifications target this channel.</p> : (
                  <ul className="fg-list">
                    {detail.recent_notifications.map((notification) => (
                      <li key={notification.notification_id}>
                        <Link to={buildNotificationPath({ instanceId, notificationId: notification.notification_id })}>{notification.title}</Link>
                        {" · "}{notification.delivery_status}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create channel</h3>
              <p className="fg-muted">Create a persisted delivery target instead of relying on invisible config.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Channel ID
                <input value={createForm.channelId} onChange={(event) => setCreateForm((current) => ({ ...current, channelId: event.target.value }))} placeholder="channel_ops_email" />
              </label>
              <label>
                Channel kind
                <select value={createForm.channelKind} onChange={(event) => setCreateForm((current) => ({ ...current, channelKind: event.target.value as DeliveryChannelKind }))}>
                  {KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as DeliveryChannelStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Label
              <input value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ops email" />
            </label>
            <label>
              Target
              <input value={createForm.target} onChange={(event) => setCreateForm((current) => ({ ...current, target: event.target.value }))} placeholder="ops@example.com" />
            </label>
            <label>
              Fallback channel ID
              <input value={createForm.fallbackChannelId} onChange={(event) => setCreateForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} placeholder="channel_ops_slack" />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.label.trim() || !createForm.target.trim()}>
                {savingCreate ? "Creating channel" : "Create channel"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit channel</h3>
              <p className="fg-muted">Keep fallback posture and target truth coherent for the selected channel.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.channel_id : "Select a channel"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <label>
                Label
                <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
              </label>
              <label>
                Target
                <input value={editForm.target} onChange={(event) => setEditForm((current) => ({ ...current, target: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as DeliveryChannelStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Fallback channel ID
                  <input value={editForm.fallbackChannelId} onChange={(event) => setEditForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving channel" : "Save channel"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a channel before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
