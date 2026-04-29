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
const KIND_FILTER_OPTIONS: Array<DeliveryChannelKind | "all"> = ["all", ...KIND_OPTIONS];

const CHANNEL_KIND_CONFIG: Record<DeliveryChannelKind, {
  title: string;
  hint: string;
  placeholder: string;
}> = {
  email: {
    title: "Mailbox target",
    hint: "Use a real mailbox or distribution list. ForgeFrame shows the destination but never renders credential material.",
    placeholder: "ops@example.com",
  },
  slack: {
    title: "Slack destination",
    hint: "Persist the channel or handle here. Secret webhook or app credentials stay outside the visible form fields.",
    placeholder: "#ops-alerts",
  },
  webhook: {
    title: "Webhook endpoint",
    hint: "Stored webhook targets are masked after save. Enter a new endpoint only when rotating the integration.",
    placeholder: "https://hooks.example.com/services/...",
  },
  in_app: {
    title: "In-app destination",
    hint: "Use the in-product route or queue target for delivery that stays inside ForgeFrame.",
    placeholder: "operator://inbox/primary",
  },
};

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

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function channelStatusTone(status: DeliveryChannelStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "degraded":
      return "warning";
    case "disabled":
      return "danger";
    default:
      return "warning";
  }
}

function fallbackRankLabel(rank: number): string {
  if (rank <= 0) {
    return "primary / standalone";
  }
  return `fallback #${rank}`;
}

export function ChannelsPage() {
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
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
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

  const createKindConfig = CHANNEL_KIND_CONFIG[createForm.channelKind];
  const editKindConfig = detail ? CHANNEL_KIND_CONFIG[detail.channel_kind] : CHANNEL_KIND_CONFIG.email;

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
        description="Persistent delivery-channel inventory with fallback posture, credential hygiene, filtered status/type views, and recent notification linkage."
        question="Are delivery targets actually configured and governable, or is external communication still hiding behind implicit defaults and invisible secrets?"
        links={[
          { label: "Channels", to: CONTROL_PLANE_ROUTES.channels, description: "Stay on the channel inventory and detail surface." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Open outbox truth that flows through these channels." },
          { label: "Automations", to: CONTROL_PLANE_ROUTES.automations, description: "Review recurring rules that target these channels." },
        ]}
        badges={[
          { label: `${channels.length} channel${channels.length === 1 ? "" : "s"}`, tone: channels.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Channels are first-class delivery records. Fallback posture is not allowed to hide in env vars or one-off code paths, and credentials never render back into the UI."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the channel inventory by operational posture and delivery type.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : "neutral"}>
            instances {instancesState} · inventory {listState} · detail {detailState}
          </span>
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
          <label>
            Type
            <select
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
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Channel inventory</h3>
              <p className="fg-muted">Each row is a persisted delivery endpoint with explicit status, scope, fallback rank, and recent outcome truth.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading channel inventory.</p> : null}
          {listState === "success" && channels.length === 0 ? <p className="fg-muted">No channels matched the selected status and type filters.</p> : null}

          {channels.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Channel inventory">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Scope</th>
                    <th>Fallback rank</th>
                    <th>Last success</th>
                    <th>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => (
                    <tr key={channel.channel_id} className={channel.channel_id === selectedChannelId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => {
                            next.set("channelId", channel.channel_id);
                          })}
                        >
                          {channel.label}
                        </button>
                        <div className="fg-muted">{channel.channel_id}</div>
                        <div className="fg-muted">{channel.target}</div>
                      </td>
                      <td>{channel.channel_kind}</td>
                      <td><span className="fg-pill" data-tone={channelStatusTone(channel.status)}>{channel.status}</span></td>
                      <td>{channel.scope_label}</td>
                      <td>{fallbackRankLabel(channel.fallback_rank)}</td>
                      <td>{formatTimestamp(channel.last_success_at, "Never delivered")}</td>
                      <td>
                        {channel.last_error ?? "No recent delivery error"}
                        <div className="fg-muted">{formatTimestamp(channel.last_failure_at, "No failure recorded")}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Channel detail</h3>
              <p className="fg-muted">Credential posture, fallback chain, and recent notification linkage converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.channel_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a channel to inspect fallback and credential truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading channel detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={channelStatusTone(detail.status)}>{detail.status}</span>
                <span className="fg-pill">{detail.channel_kind}</span>
                <span className="fg-pill">{detail.scope_label}</span>
                <span className="fg-pill">{fallbackRankLabel(detail.fallback_rank)}</span>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Delivery posture</h4>
                  <ul className="fg-list">
                    <li>Target: {detail.target}</li>
                    <li>Notifications: {detail.notification_count}</li>
                    <li>Last success: {formatTimestamp(detail.last_success_at, "Never delivered")}</li>
                    <li>Last failure: {formatTimestamp(detail.last_failure_at, "No failure recorded")}</li>
                    <li>Last error: {detail.last_error ?? "No recent delivery error"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Credential / secret posture</h4>
                  <ul className="fg-list">
                    <li>Storage state: {detail.credential_posture.storage_state}</li>
                    <li>Target masked: {detail.credential_posture.target_masked ? "yes" : "no"}</li>
                    <li>Redacted fields: {detail.credential_posture.redacted_fields.length > 0 ? detail.credential_posture.redacted_fields.join(", ") : "none"}</li>
                    <li>External references: {detail.credential_posture.external_reference_fields.length > 0 ? detail.credential_posture.external_reference_fields.join(", ") : "none"}</li>
                  </ul>
                  <p className="fg-muted">{detail.credential_posture.summary}</p>
                  <details>
                    <summary>Advanced metadata (sanitized)</summary>
                    <pre>{JSON.stringify(detail.advanced_metadata, null, 2)}</pre>
                  </details>
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Fallback chain</h4>
                  {detail.fallback_chain.length === 0 ? <p className="fg-muted">No fallback chain is recorded for this channel.</p> : (
                    <ul className="fg-list">
                      {detail.fallback_chain.map((channel) => (
                        <li key={channel.channel_id}>
                          <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: channel.channel_id })}>
                            {channel.label} ({channel.channel_id})
                          </Link>
                          {" · "}{fallbackRankLabel(channel.fallback_rank)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="fg-muted">Scope reference: {detail.scope_reference ?? "No contact-bound override is persisted for this channel."}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Fallback sources</h4>
                  {detail.fallback_sources.length === 0 ? <p className="fg-muted">No other channel currently routes into this channel as a fallback target.</p> : (
                    <ul className="fg-list">
                      {detail.fallback_sources.map((channel) => (
                        <li key={channel.channel_id}>
                          <Link className="fg-nav-link" to={buildChannelPath({ instanceId, channelId: channel.channel_id })}>
                            {channel.label} ({channel.channel_id})
                          </Link>
                          {" · "}{channel.scope_label}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Test send</h4>
                <div className="fg-actions">
                  <span className="fg-pill" data-tone={detail.test_delivery_supported ? "success" : "warning"}>{detail.test_delivery_state}</span>
                </div>
                <p className="fg-muted">{detail.test_delivery_reason}</p>
                <p className="fg-muted">ForgeFrame does not render a placebo `Send test` button until the backend exposes a real test-delivery path.</p>
              </article>

              <article className="fg-subcard">
                <h4>Recent notifications</h4>
                {detail.recent_notifications.length === 0 ? <p className="fg-muted">No recent notifications target this channel.</p> : (
                  <ul className="fg-list">
                    {detail.recent_notifications.map((notification) => (
                      <li key={notification.notification_id}>
                        <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: notification.notification_id })}>
                          {notification.title}
                        </Link>
                        {" · "}{notification.delivery_status}
                        {" · "}{notification.last_error ?? "no active error"}
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
            <section className="fg-subcard">
              <h4>Identity and status</h4>
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
            </section>

            <section className="fg-subcard">
              <h4>{createKindConfig.title}</h4>
              <p className="fg-muted">{createKindConfig.hint}</p>
              <label>
                Target
                <input value={createForm.target} onChange={(event) => setCreateForm((current) => ({ ...current, target: event.target.value }))} placeholder={createKindConfig.placeholder} />
              </label>
              <label>
                Fallback channel ID
                <input value={createForm.fallbackChannelId} onChange={(event) => setCreateForm((current) => ({ ...current, fallbackChannelId: event.target.value }))} placeholder="channel_ops_slack" />
              </label>
            </section>

            <section className="fg-subcard">
              <h4>Advanced</h4>
              <details>
                <summary>Advanced metadata</summary>
                <p className="fg-muted">Use this only for non-secret routing metadata. Secret-bearing values are redacted in the UI and should move to references or a bridge.</p>
                <label>
                  Metadata JSON
                  <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
              </details>
            </section>

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
              <p className="fg-muted">Keep fallback posture, scope, and destination truth coherent for the selected channel.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.channel_id : "Select a channel"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <section className="fg-subcard">
                <h4>Identity and status</h4>
                <label>
                  Label
                  <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
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
              </section>

              <section className="fg-subcard">
                <h4>{editKindConfig.title}</h4>
                <p className="fg-muted">{editKindConfig.hint}</p>
                {detail.credential_posture.target_masked ? (
                  <p className="fg-muted">The stored target is masked. Leave the field empty to keep it unchanged, or enter a new destination to rotate it.</p>
                ) : null}
                <label>
                  Target
                  <input
                    value={editForm.target}
                    onChange={(event) => {
                      setEditForm((current) => ({ ...current, target: event.target.value }));
                      setEditTargetDirty(true);
                    }}
                    placeholder={detail.credential_posture.target_masked ? editKindConfig.placeholder : undefined}
                  />
                </label>
              </section>

              <section className="fg-subcard">
                <h4>Advanced</h4>
                <details>
                  <summary>Advanced metadata</summary>
                  <p className="fg-muted">This JSON is sanitized on read. Secret-bearing values stay hidden and remain unchanged unless you explicitly replace the metadata payload.</p>
                  <label>
                    Metadata JSON
                    <textarea
                      rows={6}
                      value={editForm.metadataJson}
                      onChange={(event) => {
                        setEditForm((current) => ({ ...current, metadataJson: event.target.value }));
                        setEditMetadataDirty(true);
                      }}
                    />
                  </label>
                </details>
              </section>

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
