/**
 * ChannelDetail — channel detail panel with credential posture,
 * fallback chain, recent notifications, and an inline edit form.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";

import type { ChannelDetail } from "../../../api/domain/channels";
import { Button } from "../../../components/ui/Button";
import type { LoadState } from "../../../pages/workInteractionPageSupport";

import type { EditChannelForm } from "../types";
import { STATUS_OPTIONS, CHANNEL_KIND_CONFIG } from "../types";
import { channelStatusTone, fallbackRankLabel, formatTimestamp } from "../helpers";

/**
 * Props for ChannelDetail.
 */
export type ChannelDetailProps = {
  /** The channel detail to display. */
  detail: ChannelDetail | null;
  /** Detail load state. */
  detailState: LoadState;
  /** Current edit form values. */
  editForm: EditChannelForm;
  /** Called to update edit form fields. */
  setEditForm: (updater: EditChannelForm | ((prev: EditChannelForm) => EditChannelForm)) => void;
  /** Whether the target field has been touched. */
  editTargetDirty: boolean;
  /** Called when the target field is touched. */
  setEditTargetDirty: (value: boolean) => void;
  /** Whether the metadata field has been touched. */
  editMetadataDirty: boolean;
  /** Called when the metadata field is touched. */
  setEditMetadataDirty: (value: boolean) => void;
  /** Whether the update is being saved. */
  savingUpdate: boolean;
  /** Whether the session can mutate. */
  canMutate: boolean;
  /** Current instance ID. */
  instanceId: string;
  /** Callback to navigate to a fallback channel. */
  onNavigateChannel: (channelId: string) => void;
  /** Callback to navigate to a notification. */
  onNavigateNotification: (notificationId: string) => void;
  /** Called when the edit form is submitted. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Channel detail panel — shows credential posture, fallback chain,
 * test delivery state, recent notifications, and an inline edit form.
 */
export function ChannelDetail({
  detail,
  detailState,
  editForm,
  setEditForm,
  editTargetDirty,
  setEditTargetDirty,
  editMetadataDirty,
  setEditMetadataDirty,
  savingUpdate,
  canMutate,
  instanceId,
  onNavigateChannel,
  onNavigateNotification,
  handleUpdate,
}: ChannelDetailProps) {
  return (
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
                      <Button variant="navigation" onPress={() => onNavigateChannel(channel.channel_id)}>
                        {channel.label} ({channel.channel_id})
                      </Button>
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
                      <Button variant="navigation" onPress={() => onNavigateChannel(channel.channel_id)}>
                        {channel.label} ({channel.channel_id})
                      </Button>
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
                    <Button variant="navigation" onPress={() => onNavigateNotification(notification.notification_id)}>
                      {notification.title}
                    </Button>
                    {" · "}{notification.delivery_status}
                    {" · "}{notification.last_error ?? "no active error"}
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* ── Edit form ── */}
          <form className="fg-stack" onSubmit={handleUpdate}>
            <section className="fg-subcard">
              <h4>Edit channel</h4>
              <label>
                Label
                <input value={editForm.label} onChange={(event) => setEditForm((prev) => ({ ...prev, label: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as EditChannelForm["status"] }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Fallback channel ID
                  <input value={editForm.fallbackChannelId} onChange={(event) => setEditForm((prev) => ({ ...prev, fallbackChannelId: event.target.value }))} />
                </label>
              </div>
            </section>

            {detail ? (() => {
              const editKindConfig = CHANNEL_KIND_CONFIG[detail.channel_kind];
              return (
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
                        setEditForm((prev) => ({ ...prev, target: event.target.value }));
                        setEditTargetDirty(true);
                      }}
                      placeholder={detail.credential_posture.target_masked ? editKindConfig.placeholder : undefined}
                    />
                  </label>
                </section>
              );
            })() : null}

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
                      setEditForm((prev) => ({ ...prev, metadataJson: event.target.value }));
                      setEditMetadataDirty(true);
                    }}
                  />
                </label>
              </details>
            </section>

            <div className="fg-actions">
              <Button variant="primary" type="submit" isDisabled={!canMutate || savingUpdate || !editForm.label.trim()}>
                {savingUpdate ? "Saving channel" : "Save channel"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}
