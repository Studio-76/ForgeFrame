/**
 * Knowledge source detail panel — shows status, sync state, indexed objects,
 * linked entities, recall usage, and edit controls.
 *
 * The panel leads with source status and next action, then progressively
 * reveals connector configuration, recall information, and linked entities.
 * Edit controls are hidden behind an "Edit source" action.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { KnowledgeSourceDetail } from "../../api/domain";
import type { LoadState } from "../../pages/workInteractionPageSupport";
import {
  SOURCE_KIND_CONFIG,
  type EditKnowledgeSourceForm,
  type SourceKindConfig,
} from "./types";
import {
  buildContactPath,
  buildConversationPath,
  buildInventoryPath,
  buildMemoryPath,
  buildSkillPath,
  formatTimestamp,
  normalizeText,
  statusTone,
  syncTone,
} from "./utils";

/** Props for KnowledgeSourceDetailPanel. */
export interface KnowledgeSourceDetailPanelProps {
  /** The currently selected source detail, or null. */
  detail: KnowledgeSourceDetail | null;
  /** Detail load state. */
  detailState: LoadState;
  /** Current instance ID for building links. */
  instanceId: string;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Edit form values. */
  editForm: EditKnowledgeSourceForm;
  /** Edit form setter. */
  setEditForm: React.Dispatch<React.SetStateAction<EditKnowledgeSourceForm>>;
  /** Whether the edit form is visible. */
  showEditForm: boolean;
  /** Toggle edit form visibility. */
  setShowEditForm: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether an update is in progress. */
  savingUpdate: boolean;
  /** Update submit handler. */
  handleUpdate: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Detail panel for a selected knowledge source.
 *
 * Shows three sections when a source is selected:
 * 1. Status header (state, sync, next action)
 * 2. Body (connector config, recall, linked entities)
 * 3. Edit form (collapsed by default)
 */
export function KnowledgeSourceDetailPanel({
  detail,
  detailState,
  instanceId,
  canMutate,
  editForm,
  setEditForm,
  showEditForm,
  setShowEditForm,
  savingUpdate,
  handleUpdate,
}: KnowledgeSourceDetailPanelProps) {
  if (detailState === "idle") {
    return (
      <article className="fg-card ff-sources-detail-panel ff-sources-tron-frame">
        <div className="ff-sources-detail-header">
          <h3>Knowledge-source detail</h3>
        </div>
        <div className="ff-sources-detail-placeholder">
          <p className="ff-sources-detail-placeholder-text">
            Select a knowledge source to inspect scope, connector configuration, and linked recall truth.
          </p>
        </div>
      </article>
    );
  }

  if (detailState === "loading") {
    return (
      <article className="fg-card ff-sources-detail-panel ff-sources-tron-frame">
        <div className="ff-sources-detail-header">
          <h3>Knowledge-source detail</h3>
        </div>
        <p className="ff-sources-table-status">Loading knowledge-source detail\u2026</p>
      </article>
    );
  }

  if (!detail) {
    return (
      <article className="fg-card ff-sources-detail-panel ff-sources-tron-frame">
        <div className="ff-sources-detail-header">
          <h3>Knowledge-source detail</h3>
        </div>
        <p className="ff-sources-detail-placeholder-text">Source detail is not available.</p>
      </article>
    );
  }

  const config = SOURCE_KIND_CONFIG[detail.source_kind];
  const syncInfo = detail.sync;

  return (
    <article className="fg-card ff-sources-detail-panel ff-sources-tron-frame">
      {/* ── Header ── */}
      <div className="ff-sources-detail-header">
        <div>
          <h3>{detail.label}</h3>
          <p className="ff-sources-table-meta">{detail.source_id}</p>
        </div>
        <span className="ff-sources-pill" data-tone={statusTone(detail.status)}>
          {detail.status}
        </span>
      </div>

      {/* ── Sync state / next action ── */}
      <div className="ff-sources-detail-next-action">
        <span>Sync: {syncInfo.state}</span>
        {syncInfo.next_step ? <span> &middot; {syncInfo.next_step}</span> : null}
      </div>

      {/* ── Status row ── */}
      <div className="ff-sources-detail-status-row">
        <span className="ff-sources-pill" data-tone={syncTone(syncInfo.state)}>
          {syncInfo.state}
        </span>
        <span className="ff-sources-pill">{detail.source_kind}</span>
        <span className="ff-sources-pill">{detail.visibility_scope}</span>
        <span className="ff-sources-pill">{detail.scope_label}</span>
      </div>

      {/* ── Summary ── */}
      <div className="ff-sources-detail-body">
        {detail.description ? (
          <p className="ff-sources-detail-summary">{detail.description}</p>
        ) : null}

        {/* Telemetry strip */}
        <div className="ff-sources-detail-telemetry-strip">
          <div>
            <strong>{formatTimestamp(detail.last_synced_at, "Never")}</strong>
            <span className="ff-sources-stat-label">Last sync</span>
          </div>
          <div>
            <strong>{detail.last_error ?? "No errors"}</strong>
            <span className="ff-sources-stat-label">Last error</span>
          </div>
          <div>
            <strong>{syncInfo.action_state || "No action pending"}</strong>
            <span className="ff-sources-stat-label">Action state</span>
          </div>
        </div>

        {/* Indexed objects strip */}
        <div className="ff-sources-detail-telemetry-strip">
          <div>
            <strong>{detail.indexed_objects.contacts}</strong>
            <span className="ff-sources-stat-label">Contacts</span>
          </div>
          <div>
            <strong>{detail.indexed_objects.durable_memory}</strong>
            <span className="ff-sources-stat-label">Memory entries</span>
          </div>
          <div>
            <strong>{detail.indexed_objects.linked_conversations}</strong>
            <span className="ff-sources-stat-label">Conversations</span>
          </div>
          <div>
            <strong>{detail.indexed_objects.linked_skills}</strong>
            <span className="ff-sources-stat-label">Skills</span>
          </div>
        </div>

        {/* Connector configuration */}
        <details className="ff-sources-detail-details">
          <summary>Connector configuration</summary>
          <p className="ff-sources-table-meta">{config.targetHint}</p>
          <ul className="ff-sources-detail-list">
            {detail.connector_fields.map((field) => (
              <li key={field.key}>
                {field.label}: <strong>{field.value}</strong>
                {field.note ? <span className="ff-sources-table-meta"> &middot; {field.note}</span> : null}
                {field.redacted ? <span className="ff-sources-table-meta"> &middot; redacted</span> : null}
              </li>
            ))}
          </ul>
        </details>

        {/* Recall vs durable memory */}
        <details className="ff-sources-detail-details">
          <summary>Knowledge recall vs durable memory</summary>
          <p className="ff-sources-table-meta">{detail.recall_vs_memory_note}</p>
          <div className="ff-sources-detail-links">
            <Link className="ff-sources-nav-link" to={buildInventoryPath("/memory", instanceId)}>
              Open durable memory
            </Link>
          </div>
        </details>

        {/* Linked entities */}
        <div className="ff-sources-detail-entities">
          {/* Contacts */}
          <div className="ff-sources-entity-group">
            <h4>Linked contacts</h4>
            {detail.contacts.length === 0 ? (
              <p className="ff-sources-table-muted">No contacts linked to this source.</p>
            ) : (
              <ul className="ff-sources-detail-list">
                {detail.contacts.map((contact) => (
                  <li key={contact.contact_id}>
                    <Link to={buildContactPath({ instanceId, contactId: contact.contact_id })}>
                      {contact.display_name}
                    </Link>
                    {contact.status ? <span className="ff-sources-table-meta"> &middot; {contact.status}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Memory */}
          <div className="ff-sources-entity-group">
            <h4>Linked durable memory</h4>
            {detail.memory_entries.length === 0 ? (
              <p className="ff-sources-table-muted">No memory entries linked to this source.</p>
            ) : (
              <ul className="ff-sources-detail-list">
                {detail.memory_entries.map((memory) => (
                  <li key={memory.memory_id}>
                    <Link to={buildMemoryPath({ instanceId, memoryId: memory.memory_id })}>
                      {memory.title}
                    </Link>
                    <span className="ff-sources-table-meta">
                      {" "}&middot; {memory.memory_kind} &middot; {memory.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Conversations */}
          <div className="ff-sources-entity-group">
            <h4>Linked conversations</h4>
            {detail.linked_conversations.length === 0 ? (
              <p className="ff-sources-table-muted">No conversations linked to this source.</p>
            ) : (
              <ul className="ff-sources-detail-list">
                {detail.linked_conversations.map((conv) => (
                  <li key={conv.record_id}>
                    <Link to={buildConversationPath({ instanceId, conversationId: conv.record_id })}>
                      {conv.label}
                    </Link>
                    {conv.status ? <span className="ff-sources-table-meta"> &middot; {conv.status}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Skills */}
          <div className="ff-sources-entity-group">
            <h4>Linked skills</h4>
            {detail.linked_skills.length === 0 ? (
              <p className="ff-sources-table-muted">No skills point back to this source.</p>
            ) : (
              <ul className="ff-sources-detail-list">
                {detail.linked_skills.map((skill) => (
                  <li key={skill.record_id}>
                    <Link to={buildSkillPath(instanceId, skill.record_id)}>
                      {skill.label}
                    </Link>
                    {skill.status ? <span className="ff-sources-table-meta"> &middot; {skill.status}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Lifecycle actions ── */}
        {canMutate && (
          <div className="ff-sources-lifecycle-actions">
            <div className="ff-sources-lifecycle-buttons">
              {!showEditForm ? (
                <button
                  type="button"
                  className="ff-sources-lifecycle-btn ff-sources-lifecycle-btn-primary"
                  onClick={() => setShowEditForm(true)}
                >
                  Edit source
                </button>
              ) : null}
            </div>

            {/* Edit form */}
            {showEditForm && (
              <details className="ff-sources-detail-details" open>
                <summary>Edit knowledge source</summary>
                <form className="ff-sources-detail-form" onSubmit={handleUpdate}>
                  <div className="ff-sources-create-grid">
                    <label className="ff-sources-field">
                      Source type
                      <input value={editForm.sourceKind} readOnly />
                    </label>
                    <label className="ff-sources-field">
                      Label
                      <input
                        value={editForm.label}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      Status
                      <select
                        value={editForm.status}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          status: event.target.value as import("../../api/domain").KnowledgeSourceStatus,
                        }))}
                      >
                        {(["active", "paused", "error"] as const).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ff-sources-field">
                      Visibility scope
                      <select
                        value={editForm.visibilityScope}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          visibilityScope: event.target.value as import("../../api/domain").VisibilityScope,
                        }))}
                      >
                        {(["instance", "team", "personal", "restricted"] as const).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="ff-sources-field">
                    {config.targetLabel}
                    <input
                      value={editForm.connectionTarget}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        connectionTarget: event.target.value,
                      }))}
                    />
                  </label>

                  <div className="ff-sources-create-grid">
                    <label className="ff-sources-field">
                      {config.accountLabel}
                      <input
                        value={editForm.connectorAccount}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          connectorAccount: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      {config.collectionLabel}
                      <input
                        value={editForm.connectorCollection}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          connectorCollection: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      What should be indexed
                      <input
                        value={editForm.indexMode}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          indexMode: event.target.value,
                        }))}
                      />
                    </label>
                  </div>

                  <div className="ff-sources-create-grid">
                    <label className="ff-sources-field">
                      How this source is used in recall
                      <input
                        value={editForm.recallClass}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          recallClass: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      Scope note
                      <input
                        value={editForm.scopeNote}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          scopeNote: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      Suggested repair action
                      <input
                        value={editForm.errorNextStep}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          errorNextStep: event.target.value,
                        }))}
                      />
                    </label>
                  </div>

                  <label className="ff-sources-field">
                    Description
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))}
                    />
                  </label>

                  <div className="ff-sources-create-grid">
                    <label className="ff-sources-field">
                      Last synced at
                      <input
                        value={editForm.lastSyncedAt}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          lastSyncedAt: event.target.value,
                        }))}
                      />
                    </label>
                    <label className="ff-sources-field">
                      Last error
                      <input
                        value={editForm.lastError}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          lastError: event.target.value,
                        }))}
                      />
                    </label>
                  </div>

                  <details className="ff-sources-create-details">
                    <summary>Advanced metadata JSON</summary>
                    <label className="ff-sources-field">
                      Advanced metadata JSON
                      <textarea
                        className="ff-sources-json-field"
                        rows={6}
                        value={editForm.advancedMetadataJson}
                        onChange={(event) => setEditForm((current) => ({
                          ...current,
                          advancedMetadataJson: event.target.value,
                        }))}
                      />
                    </label>
                  </details>

                  <div className="ff-sources-create-actions">
                    <button
                      type="submit"
                      className="ff-sources-primary-action"
                      disabled={!canMutate || savingUpdate || !normalizeText(editForm.label) || !normalizeText(editForm.connectionTarget)}
                    >
                      {savingUpdate ? "Saving knowledge source\u2026" : "Save knowledge source"}
                    </button>
                    <button
                      type="button"
                      className="ff-sources-lifecycle-btn"
                      onClick={() => setShowEditForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </details>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
