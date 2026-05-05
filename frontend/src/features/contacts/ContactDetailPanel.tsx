/**
 * Contact detail panel — shows route truth, consent posture, source provenance,
 * linked work records, and inline edit controls.
 *
 * The detail panel is hidden until a contact is selected. Edit controls are
 * hidden until the operator clicks "Edit contact".
 *
 * @packageDocumentation
 */

import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { ContactDetail } from "../../api/domain";
import { buildConversationPath, buildKnowledgeSourcePath, buildMemoryPath, buildNotificationPath, buildTaskPath } from "../../app/workInteractionRoutes";
import { DEFAULT_EDIT_FORM, VISIBILITY_OPTIONS, type EditContactForm } from "./types";
import { consentTone, formatTimestamp, routeStatusTone, statusTone } from "./utils";

/** Props for ContactDetailPanel. */
export interface ContactDetailPanelProps {
  /** The selected contact detail, or null if none selected. */
  detail: ContactDetail | null;
  /** Detail loading state. */
  detailState: string;
  /** Current instance ID. */
  instanceId: string;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Current edit form values. */
  editForm: EditContactForm;
  /** Edit form setter. */
  setEditForm: React.Dispatch<React.SetStateAction<EditContactForm>>;
  /** Whether a save operation is in progress. */
  savingUpdate: boolean;
  /** Save handler. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Disable contact handler (placeholder for future API). */
  onDisableContact?: () => void;
}

/**
 * Contact detail panel — route truth, consent, provenance, linked work, and edit.
 */
export function ContactDetailPanel({
  detail,
  detailState,
  instanceId,
  canMutate,
  editForm,
  setEditForm,
  savingUpdate,
  handleUpdate,
  onDisableContact,
}: ContactDetailPanelProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);

  if (detailState === "idle") {
    return (
      <article className="fg-card ff-contacts-detail-panel">
        <div className="ff-contacts-detail-placeholder">
          <p className="ff-contacts-detail-placeholder-text">Select a contact to inspect channel routes, provenance, and linked work truth.</p>
        </div>
      </article>
    );
  }

  if (detailState === "loading") {
    return (
      <article className="fg-card ff-contacts-detail-panel">
        <div className="ff-contacts-detail-placeholder">
          <p className="ff-contacts-detail-placeholder-text">Loading contact detail\u2026</p>
        </div>
      </article>
    );
  }

  if (!detail) {
    return (
      <article className="fg-card ff-contacts-detail-panel">
        <div className="ff-contacts-detail-placeholder">
          <p className="ff-contacts-detail-placeholder-text">Contact not found.</p>
        </div>
      </article>
    );
  }

  const consentToneValue = consentTone(detail.consent.status);

  return (
    <article className="fg-card ff-contacts-detail-panel ff-contacts-tron-frame">
      {/* ── Header ── */}
      <div className="ff-contacts-detail-header">
        <div>
          <h3>{detail.display_name}</h3>
          <div className="ff-contacts-detail-status-row">
            <span className="ff-contacts-pill" data-tone={statusTone(detail.status)}>{detail.status}</span>
            <span className="ff-contacts-pill ff-contacts-pill-id">{detail.contact_id}</span>
            <span className="ff-contacts-pill" data-tone={consentToneValue}>
              {detail.consent.status === "explicit_opt_in" ? "Consent given" : detail.consent.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Next action ── */}
      <div className="ff-contacts-detail-next-action">
        {detail.route_warnings.length > 0
          ? `Route warning: ${detail.route_warnings[0]}`
          : detail.consent.status === "unknown" || detail.consent.status === "not_collected"
            ? "Consent posture unknown — review required"
            : "Contact routes are reachable and consent is recorded"}
      </div>

      {/* ── Route warnings ── */}
      {detail.route_warnings.length > 0 && (
        <div className="ff-contacts-detail-route-warnings">
          {detail.route_warnings.map((warning) => (
            <p key={warning} className="ff-contacts-route-warning">{warning}</p>
          ))}
        </div>
      )}

      <div className="ff-contacts-detail-body">
        {/* ── Channel routes ── */}
        <details className="ff-contacts-detail-details" open={detail.channels.length > 0}>
          <summary>Channel routes ({detail.channels.length})</summary>
          {detail.channels.length === 0 ? (
            <p className="ff-contacts-detail-placeholder-text">No channel addresses are recorded for this contact.</p>
          ) : (
            <ul className="ff-contacts-detail-list">
              {detail.channels.map((channel, index) => (
                <li key={`${channel.kind}:${channel.address}:${index}`}>
                  <span className="ff-contacts-pill" data-tone={routeStatusTone(channel.route_status)}>
                    {channel.route_status}
                  </span>
                  {" "}
                  <strong>{channel.label}</strong>
                  {" \u00b7 "}
                  {channel.kind}
                  {" \u00b7 "}
                  {channel.address}
                  {channel.is_primary ? " \u00b7 primary" : ""}
                  {channel.source ? ` \u00b7 ${channel.source}` : ""}
                  {channel.warning ? ` \u00b7 ${channel.warning}` : ""}
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* ── Contact summary ── */}
        <details className="ff-contacts-detail-details" open>
          <summary>Contact info</summary>
          <ul className="ff-contacts-detail-list">
            <li>Contact path: {detail.contact_ref}</li>
            <li>Organization: {detail.organization ?? "Not recorded"}</li>
            <li>Title: {detail.title ?? "Not recorded"}</li>
            <li>Primary email: {detail.primary_email ?? "Not recorded"}</li>
            <li>Primary phone: {detail.primary_phone ?? "Not recorded"}</li>
            <li>Visibility: {detail.visibility_scope}</li>
            <li>Last contact: {formatTimestamp(detail.last_contact_at, "No contact recorded")}</li>
          </ul>
        </details>

        {/* ── Consent and visibility ── */}
        <details className="ff-contacts-detail-details">
          <summary>Consent and visibility</summary>
          <ul className="ff-contacts-detail-list">
            <li>Consent status: {detail.consent.status}</li>
            <li>Consent date: {formatTimestamp(detail.consent.captured_at, "Not recorded")}</li>
            <li>Consent note: {detail.consent.note ?? "Not recorded"}</li>
            <li>Visibility scope: {detail.visibility_scope}</li>
            <li>Visibility note: {detail.visibility_note ?? "Not recorded"}</li>
          </ul>
        </details>

        {/* ── Source and provenance ── */}
        <details className="ff-contacts-detail-details">
          <summary>Source and provenance</summary>
          <ul className="ff-contacts-detail-list">
            <li>Source: {detail.source?.label ?? detail.source_label ?? "Unlinked"}</li>
            <li>Source kind: {detail.source?.source_kind ?? detail.source_kind ?? "Not recorded"}</li>
            <li>Provider: {detail.provenance.provider ?? "Not recorded"}</li>
            <li>Import ID: {detail.provenance.import_reference ?? "Not recorded"}</li>
            <li>Imported at: {formatTimestamp(detail.provenance.imported_at, "Not recorded")}</li>
            <li>Last verified: {formatTimestamp(detail.provenance.last_verified_at, "Not recorded")}</li>
            <li>Provenance note: {detail.provenance.note ?? "Not recorded"}</li>
          </ul>
        </details>

        {/* ── Linked work records ── */}
        <details className="ff-contacts-detail-details">
          <summary>Linked work records</summary>
          <div className="ff-contacts-detail-links-grid">
            <div className="ff-contacts-detail-link-section">
              <h4>Conversations</h4>
              {detail.recent_conversations.length === 0 ? (
                <p className="ff-contacts-detail-placeholder-text">No linked conversations.</p>
              ) : (
                <ul className="ff-contacts-detail-list">
                  {detail.recent_conversations.map((conv) => (
                    <li key={conv.record_id}>
                      <Link to={buildConversationPath({ instanceId, conversationId: conv.record_id })} className="ff-contacts-nav-link">
                        {conv.label}
                      </Link>
                      {conv.status ? ` \u00b7 ${conv.status}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ff-contacts-detail-link-section">
              <h4>Tasks</h4>
              {detail.recent_tasks.length === 0 ? (
                <p className="ff-contacts-detail-placeholder-text">No linked tasks.</p>
              ) : (
                <ul className="ff-contacts-detail-list">
                  {detail.recent_tasks.map((task) => (
                    <li key={task.record_id}>
                      <Link to={buildTaskPath({ instanceId, taskId: task.record_id })} className="ff-contacts-nav-link">
                        {task.label}
                      </Link>
                      {task.status ? ` \u00b7 ${task.status}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ff-contacts-detail-link-section">
              <h4>Notifications</h4>
              {detail.recent_notifications.length === 0 ? (
                <p className="ff-contacts-detail-placeholder-text">No linked notifications.</p>
              ) : (
                <ul className="ff-contacts-detail-list">
                  {detail.recent_notifications.map((notif) => (
                    <li key={notif.record_id}>
                      <Link to={buildNotificationPath({ instanceId, notificationId: notif.record_id })} className="ff-contacts-nav-link">
                        {notif.label}
                      </Link>
                      {notif.status ? ` \u00b7 ${notif.status}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ff-contacts-detail-link-section">
              <h4>Memory</h4>
              {detail.recent_memory.length === 0 ? (
                <p className="ff-contacts-detail-placeholder-text">No linked memory entries.</p>
              ) : (
                <ul className="ff-contacts-detail-list">
                  {detail.recent_memory.map((mem) => (
                    <li key={mem.memory_id}>
                      <Link to={buildMemoryPath({ instanceId, memoryId: mem.memory_id })} className="ff-contacts-nav-link">
                        {mem.title}
                      </Link>
                      {" \u00b7 "}{mem.memory_kind}{" \u00b7 "}{mem.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>

        {/* ── Lifecycle actions ── */}
        <div className="ff-contacts-lifecycle-actions">
          <div className="ff-contacts-lifecycle-buttons">
            {canMutate && (
              <>
                <button
                  type="button"
                  className="ff-contacts-lifecycle-btn ff-contacts-lifecycle-btn-primary"
                  onClick={() => setShowEdit(!showEdit)}
                >
                  {showEdit ? "Cancel edit" : "Edit contact"}
                </button>
                {detail.source ? (
                  <Link
                    className="ff-contacts-lifecycle-btn"
                    to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}
                  >
                    Open source
                  </Link>
                ) : null}
                <Link
                  className="ff-contacts-lifecycle-btn"
                  to={buildConversationPath({ instanceId })}
                >
                  View conversations
                </Link>
              </>
            )}
            {onDisableContact && canMutate && (
              <>
                {!showConfirmDisable ? (
                  <button
                    type="button"
                    className="ff-contacts-lifecycle-btn ff-contacts-lifecycle-btn-danger"
                    onClick={() => setShowConfirmDisable(true)}
                  >
                    Disable contact
                  </button>
                ) : (
                  <span className="ff-contacts-confirm-group">
                    <span className="ff-contacts-confirm-text">Disable this contact?</span>
                    <button
                      type="button"
                      className="ff-contacts-lifecycle-btn ff-contacts-lifecycle-btn-danger"
                      onClick={() => {
                        onDisableContact();
                        setShowConfirmDisable(false);
                      }}
                    >
                      Confirm disable
                    </button>
                    <button
                      type="button"
                      className="ff-contacts-lifecycle-btn"
                      onClick={() => setShowConfirmDisable(false)}
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Edit form ── */}
        {showEdit && (
          <form className="ff-contacts-edit-form" onSubmit={handleUpdate}>
            <h4>Edit contact</h4>
            <div className="ff-contacts-edit-grid">
              <label className="ff-contacts-field ff-contacts-field-required">
                Display name
                <input
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Contact path
                <input
                  value={editForm.contactRef}
                  onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Source
                <input
                  value={editForm.sourceId}
                  onChange={(event) => setEditForm((current) => ({ ...current, sourceId: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Organization
                <input
                  value={editForm.organization}
                  onChange={(event) => setEditForm((current) => ({ ...current, organization: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Title
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Status
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as EditContactForm["status"] }))}
                >
                  <option value="active">Active</option>
                  <option value="snoozed">Snoozed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="ff-contacts-field">
                Primary email
                <input
                  value={editForm.primaryEmail}
                  onChange={(event) => setEditForm((current) => ({ ...current, primaryEmail: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Primary phone
                <input
                  value={editForm.primaryPhone}
                  onChange={(event) => setEditForm((current) => ({ ...current, primaryPhone: event.target.value }))}
                />
              </label>
              <label className="ff-contacts-field">
                Visibility scope
                <select
                  value={editForm.visibilityScope}
                  onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as EditContactForm["visibilityScope"] }))}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <details className="ff-contacts-edit-details">
              <summary>Consent and provenance</summary>
              <div className="ff-contacts-edit-grid">
                <label className="ff-contacts-field">
                  Consent status
                  <input
                    value={editForm.consentStatus}
                    onChange={(event) => setEditForm((current) => ({ ...current, consentStatus: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Consent date
                  <input
                    value={editForm.consentCapturedAt}
                    onChange={(event) => setEditForm((current) => ({ ...current, consentCapturedAt: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Consent note
                  <input
                    value={editForm.consentNote}
                    onChange={(event) => setEditForm((current) => ({ ...current, consentNote: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Source provider
                  <input
                    value={editForm.provenanceProvider}
                    onChange={(event) => setEditForm((current) => ({ ...current, provenanceProvider: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Import ID
                  <input
                    value={editForm.provenanceImportReference}
                    onChange={(event) => setEditForm((current) => ({ ...current, provenanceImportReference: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Imported at
                  <input
                    value={editForm.provenanceImportedAt}
                    onChange={(event) => setEditForm((current) => ({ ...current, provenanceImportedAt: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Last verified
                  <input
                    value={editForm.provenanceLastVerifiedAt}
                    onChange={(event) => setEditForm((current) => ({ ...current, provenanceLastVerifiedAt: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Provenance note
                  <input
                    value={editForm.provenanceNote}
                    onChange={(event) => setEditForm((current) => ({ ...current, provenanceNote: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Visibility note
                  <input
                    value={editForm.visibilityNote}
                    onChange={(event) => setEditForm((current) => ({ ...current, visibilityNote: event.target.value }))}
                  />
                </label>
              </div>
            </details>
            <details className="ff-contacts-edit-details">
              <summary>Secondary routes</summary>
              <div className="ff-contacts-edit-grid">
                <label className="ff-contacts-field">
                  Secondary email
                  <input
                    value={editForm.secondaryEmail}
                    onChange={(event) => setEditForm((current) => ({ ...current, secondaryEmail: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Secondary phone
                  <input
                    value={editForm.secondaryPhone}
                    onChange={(event) => setEditForm((current) => ({ ...current, secondaryPhone: event.target.value }))}
                  />
                </label>
                <label className="ff-contacts-field">
                  Slack handle
                  <input
                    value={editForm.slackHandle}
                    onChange={(event) => setEditForm((current) => ({ ...current, slackHandle: event.target.value }))}
                  />
                </label>
              </div>
            </details>
            <details className="ff-contacts-edit-details">
              <summary>Advanced metadata</summary>
              <textarea
                className="ff-contacts-json-field"
                rows={6}
                value={editForm.advancedMetadataJson}
                onChange={(event) => setEditForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))}
              />
            </details>
            <div className="ff-contacts-edit-actions">
              <button
                type="submit"
                className="ff-contacts-lifecycle-btn ff-contacts-lifecycle-btn-primary"
                disabled={!canMutate || savingUpdate || !editForm.displayName.trim()}
              >
                {savingUpdate ? "Saving contact\u2026" : "Save contact"}
              </button>
              <button
                type="button"
                className="ff-contacts-lifecycle-btn"
                onClick={() => {
                  setShowEdit(false);
                  setEditForm(DEFAULT_EDIT_FORM);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
