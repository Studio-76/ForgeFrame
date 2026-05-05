/**
 * ChannelCreateForm — guided delivery channel creation form.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";

import type { DeliveryChannelKind, DeliveryChannelStatus } from "../../../api/domain/channels";
import { Button } from "../../../components/ui/Button";

import type { CreateChannelForm } from "../types";
import { KIND_OPTIONS, STATUS_OPTIONS, CHANNEL_KIND_CONFIG } from "../types";

/**
 * Props for ChannelCreateForm.
 */
export type ChannelCreateFormProps = {
  /** Current create form values. */
  createForm: CreateChannelForm;
  /** Called to update create form fields. */
  setCreateForm: (updater: CreateChannelForm | ((prev: CreateChannelForm) => CreateChannelForm)) => void;
  /** Whether a create is in progress. */
  savingCreate: boolean;
  /** Whether the session can mutate. */
  canMutate: boolean;
  /** Whether an instance is selected. */
  hasInstance: boolean;
  /** Called when the create form is submitted. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Create channel form — create a persisted delivery target with identity,
 * kind-specific destination, and optional advanced metadata.
 */
export function ChannelCreateForm({
  createForm,
  setCreateForm,
  savingCreate,
  canMutate,
  hasInstance,
  handleCreate,
}: ChannelCreateFormProps) {
  const createKindConfig = CHANNEL_KIND_CONFIG[createForm.channelKind];

  return (
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
              <input value={createForm.channelId} onChange={(event) => setCreateForm((prev) => ({ ...prev, channelId: event.target.value }))} placeholder="channel_ops_email" />
            </label>
            <label>
              Channel kind
              <select value={createForm.channelKind} onChange={(event) => setCreateForm((prev) => ({ ...prev, channelKind: event.target.value as DeliveryChannelKind }))}>
                {KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={createForm.status} onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as DeliveryChannelStatus }))}>
                {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label>
            Label
            <input value={createForm.label} onChange={(event) => setCreateForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Ops email" />
          </label>
        </section>

        <section className="fg-subcard">
          <h4>{createKindConfig.title}</h4>
          <p className="fg-muted">{createKindConfig.hint}</p>
          <label>
            Target
            <input value={createForm.target} onChange={(event) => setCreateForm((prev) => ({ ...prev, target: event.target.value }))} placeholder={createKindConfig.placeholder} />
          </label>
          <label>
            Fallback channel ID
            <input value={createForm.fallbackChannelId} onChange={(event) => setCreateForm((prev) => ({ ...prev, fallbackChannelId: event.target.value }))} placeholder="channel_ops_slack" />
          </label>
        </section>

        <section className="fg-subcard">
          <h4>Advanced</h4>
          <details>
            <summary>Advanced metadata</summary>
            <p className="fg-muted">Use this only for non-secret routing metadata. Secret-bearing values are redacted in the UI and should move to references or a bridge.</p>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((prev) => ({ ...prev, metadataJson: event.target.value }))} />
            </label>
          </details>
        </section>

        <div className="fg-actions">
          <Button variant="primary" type="submit" isDisabled={!canMutate || savingCreate || !hasInstance || !createForm.label.trim() || !createForm.target.trim()}>
            {savingCreate ? "Creating channel" : "Create channel"}
          </Button>
        </div>
      </form>
    </article>
  );
}
