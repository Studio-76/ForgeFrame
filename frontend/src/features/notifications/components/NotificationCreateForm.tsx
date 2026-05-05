/**
 * NotificationCreateForm — create/edit notification drawer form.
 *
 * Supports both create and edit modes with shared form layout.
 *
 * @packageDocumentation
 */

import type { FormEvent } from "react";

import type { NotificationDeliveryStatus, WorkItemPriority } from "../../../api/domain/notifications";
import { DELIVERY_STATUS_OPTIONS, DRAWER_FORM_ID, PRIORITY_OPTIONS, type CreateForm, type DrawerMode, type EditForm } from "../types";

/** Props for the NotificationCreateForm component. */
export type NotificationCreateFormProps = {
  /** Current drawer mode. */
  drawerMode: DrawerMode;
  /** Create form values. */
  createForm: CreateForm;
  /** Edit form values. */
  editForm: EditForm;
  /** Whether a create is being saved. */
  savingCreate: boolean;
  /** Whether an update is being saved. */
  savingUpdate: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Current instance ID. */
  instanceId: string;
  /** Currently selected notification (for edit mode). */
  detailExists: boolean;
  /** Called when a create form field changes. */
  onCreateFormChange: (field: string, value: string) => void;
  /** Called when an edit form field changes. */
  onEditFormChange: (field: string, value: string) => void;
  /** Called when the form is submitted. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Called to close the drawer. */
  onClose: () => void;
};

/**
 * Renders the create/edit notification form.
 */
export function NotificationCreateForm({
  drawerMode,
  createForm,
  editForm,
  savingCreate,
  savingUpdate,
  canMutate,
  instanceId,
  detailExists,
  onCreateFormChange,
  onEditFormChange,
  onSubmit,
  onClose,
}: NotificationCreateFormProps) {
  if (drawerMode === "closed") {
    return null;
  }

  const isCreate = drawerMode === "create";
  const form = isCreate ? createForm : editForm;
  const handleFieldChange = isCreate ? onCreateFormChange : onEditFormChange;

  const drawerModeLabel = isCreate ? "Create notification" : "Edit notification";

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{drawerModeLabel}</h3>
          <p className="fg-muted">
            {isCreate
              ? "Create is still available, but it is intentionally secondary to the outbox control loop."
              : "Edit routing, content, retry budget, or administrative delivery overrides inside a focused drawer."}
          </p>
        </div>
        <div className="fg-actions">
          <span className="fg-pill" data-tone="neutral">{instanceId || "No instance selected"}</span>
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form={DRAWER_FORM_ID}
            disabled={!canMutate || (isCreate ? savingCreate || !instanceId || !createForm.title.trim() || !createForm.body.trim() : savingUpdate || !detailExists)}
          >
            {isCreate ? (savingCreate ? "Creating notification" : "Create notification") : (savingUpdate ? "Saving notification" : "Save notification")}
          </button>
        </div>
      </div>
      <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={onSubmit}>
        {/* ── Linkage section ── */}
        <section className="fg-subcard">
          <h4>Linkage</h4>
          <div className="fg-grid fg-grid-compact">
            {isCreate ? (
              <label>
                Notification ID
                <input
                  value={createForm.notificationId}
                  onChange={(event) => onCreateFormChange("notificationId", event.target.value)}
                  placeholder="notification_customer_pricing"
                />
              </label>
            ) : null}
            <label>
              Task ID
              <input
                value={isCreate ? createForm.taskId : ""}
                onChange={(event) => {
                  if (isCreate) {
                    onCreateFormChange("taskId", event.target.value);
                  }
                }}
                disabled={!isCreate}
              />
            </label>
            <label>
              Reminder ID
              <input
                value={isCreate ? createForm.reminderId : ""}
                onChange={(event) => {
                  if (isCreate) {
                    onCreateFormChange("reminderId", event.target.value);
                  }
                }}
                disabled={!isCreate}
              />
            </label>
          </div>
          {isCreate ? (
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => onCreateFormChange("conversationId", event.target.value)} />
              </label>
              <label>
                Inbox ID
                <input value={createForm.inboxId} onChange={(event) => onCreateFormChange("inboxId", event.target.value)} />
              </label>
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => onCreateFormChange("workspaceId", event.target.value)} />
              </label>
            </div>
          ) : (
            <p className="fg-muted">Task, reminder, conversation, inbox, and workspace linkage on existing notifications remains read-only from this page.</p>
          )}
        </section>

        {/* ── Routing and preview section ── */}
        <section className="fg-subcard">
          <h4>Routing and preview</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Channel ID
              <input
                value={isCreate ? createForm.channelId : editForm.channelId}
                onChange={(event) => handleFieldChange("channelId", event.target.value)}
              />
            </label>
            <label>
              Fallback channel ID
              <input
                value={isCreate ? createForm.fallbackChannelId : editForm.fallbackChannelId}
                onChange={(event) => handleFieldChange("fallbackChannelId", event.target.value)}
              />
            </label>
            <label>
              Preview required
              <select
                value={isCreate ? createForm.previewRequired : editForm.previewRequired}
                onChange={(event) => handleFieldChange("previewRequired", event.target.value)}
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
                value={isCreate ? createForm.priority : editForm.priority}
                onChange={(event) => handleFieldChange("priority", event.target.value)}
              >
                {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Max retries
              <input
                value={isCreate ? createForm.maxRetries : editForm.maxRetries}
                onChange={(event) => handleFieldChange("maxRetries", event.target.value)}
              />
            </label>
            {!isCreate ? (
              <label>
                Delivery status
                <select
                  value={(editForm as EditForm).deliveryStatus}
                  onChange={(event) => onEditFormChange("deliveryStatus", event.target.value)}
                >
                  {DELIVERY_STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </section>

        {/* ── Message content section ── */}
        <section className="fg-subcard">
          <h4>Message content</h4>
          <label>
            Title
            <input
              value={isCreate ? createForm.title : editForm.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              placeholder="Preview before send"
            />
          </label>
          <label>
            Body
            <textarea
              rows={6}
              value={isCreate ? createForm.body : editForm.body}
              onChange={(event) => handleFieldChange("body", event.target.value)}
            />
          </label>
        </section>

        {/* ── Administrative metadata section ── */}
        <section className="fg-subcard">
          <h4>Administrative metadata</h4>
          {!isCreate ? (
            <label>
              Last error
              <input
                value={(editForm as EditForm).lastError}
                onChange={(event) => onEditFormChange("lastError", event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Metadata JSON
            <textarea
              rows={6}
              value={isCreate ? createForm.metadataJson : editForm.metadataJson}
              onChange={(event) => handleFieldChange("metadataJson", event.target.value)}
            />
          </label>
        </section>
      </form>
    </article>
  );
}
