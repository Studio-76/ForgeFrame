/**
 * Guided knowledge source creation panel — organized into visible sections
 * with progressive disclosure. Required fields are grouped first, connector-
 * specific fields adapt to source type, and advanced metadata is collapsed
 * by default.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { KnowledgeSourceKind, KnowledgeSourceStatus, VisibilityScope } from "../../api/domain";
import {
  SOURCE_KIND_CONFIG,
  SOURCE_KIND_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  type CreateKnowledgeSourceForm,
} from "./types";

/** Props for CreateKnowledgeSourcePanel. */
export interface CreateKnowledgeSourcePanelProps {
  /** Current form values. */
  createForm: CreateKnowledgeSourceForm;
  /** Form state setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<CreateKnowledgeSourceForm>>;
  /** Whether the user can mutate data. */
  canMutate: boolean;
  /** Whether a create operation is in progress. */
  savingCreate: boolean;
  /** Submit handler for the form. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Cancel handler to close the panel. */
  onCancel: () => void;
}

/**
 * Guided creation panel with organized sections and progressive disclosure.
 */
export function CreateKnowledgeSourcePanel({
  createForm,
  setCreateForm,
  canMutate,
  savingCreate,
  handleCreate,
  onCancel,
}: CreateKnowledgeSourcePanelProps) {
  const sourceKindConfig = SOURCE_KIND_CONFIG[createForm.sourceKind];

  return (
    <article className="fg-card ff-sources-create-panel ff-sources-tron-frame">
      <div className="ff-sources-create-header">
        <div>
          <p className="ff-sources-kicker">Create knowledge source</p>
          <h3>Define a new knowledge source</h3>
        </div>
        <button type="button" className="ff-sources-lifecycle-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="ff-sources-create-note">
        This page stores the knowledge source record. Connector sync is run by
        the connector service. Required fields are marked with <strong>*</strong>.
      </p>

      <form className="ff-sources-create-form" onSubmit={handleCreate}>
        {/* Section 1: Source type */}
        <div className="ff-sources-create-section">
          <h4>1. Source type</h4>
          <p className="ff-sources-field-hint">Choose the type of knowledge source to create.</p>
          <div className="ff-sources-create-grid">
            <label className="ff-sources-field ff-sources-field-required">
              Source type
              <select
                value={createForm.sourceKind}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  sourceKind: event.target.value as KnowledgeSourceKind,
                }))}
              >
                {SOURCE_KIND_OPTIONS.filter((option) => option !== "all").map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Section 2: Connector details */}
        <div className="ff-sources-create-section">
          <h4>2. Connector details</h4>
          <p className="ff-sources-field-hint">{sourceKindConfig.targetHint}</p>
          <div className="ff-sources-create-grid">
            <label className="ff-sources-field ff-sources-field-required">
              {sourceKindConfig.targetLabel}
              <input
                value={createForm.connectionTarget}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  connectionTarget: event.target.value,
                }))}
                placeholder={sourceKindConfig.targetPlaceholder}
              />
            </label>
            <label className="ff-sources-field">
              {sourceKindConfig.accountLabel}
              <input
                value={createForm.connectorAccount}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  connectorAccount: event.target.value,
                }))}
                placeholder={sourceKindConfig.accountPlaceholder}
              />
            </label>
            <label className="ff-sources-field">
              {sourceKindConfig.collectionLabel}
              <input
                value={createForm.connectorCollection}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  connectorCollection: event.target.value,
                }))}
                placeholder={sourceKindConfig.collectionPlaceholder}
              />
            </label>
          </div>
        </div>

        {/* Section 3: Visibility and scope */}
        <div className="ff-sources-create-section">
          <h4>3. Visibility and scope</h4>
          <p className="ff-sources-field-hint">Set the visibility scope and lifecycle state.</p>
          <div className="ff-sources-create-grid">
            <label className="ff-sources-field ff-sources-field-required">
              Visibility scope
              <select
                value={createForm.visibilityScope}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  visibilityScope: event.target.value as VisibilityScope,
                }))}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="ff-sources-field">
              Status
              <select
                value={createForm.status}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  status: event.target.value as KnowledgeSourceStatus,
                }))}
              >
                {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="ff-sources-field">
              Source ID (optional)
              <input
                value={createForm.sourceId}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  sourceId: event.target.value,
                }))}
                placeholder="source_mail_primary"
              />
            </label>
          </div>
        </div>

        {/* Section 4: Indexing behavior */}
        <div className="ff-sources-create-section">
          <h4>4. Indexing behavior</h4>
          <p className="ff-sources-field-hint">Control what content gets indexed from this source.</p>
          <div className="ff-sources-create-grid">
            <label className="ff-sources-field">
              What should be indexed
              <input
                value={createForm.indexMode}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  indexMode: event.target.value,
                }))}
                placeholder="full, metadata-only, subject+body"
              />
            </label>
            <label className="ff-sources-field ff-sources-field-required">
              Label
              <input
                value={createForm.label}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))}
                placeholder="Primary mail connector"
              />
            </label>
          </div>
        </div>

        {/* Section 5: Recall usage */}
        <div className="ff-sources-create-section">
          <h4>5. Recall usage</h4>
          <p className="ff-sources-field-hint">Define how this source is used in recall and knowledge boundaries.</p>
          <div className="ff-sources-create-grid">
            <label className="ff-sources-field">
              How this source is used in recall
              <input
                value={createForm.recallClass}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  recallClass: event.target.value,
                }))}
                placeholder="operator recall, customer recall, reference recall"
              />
            </label>
            <label className="ff-sources-field">
              Scope note
              <input
                value={createForm.scopeNote}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  scopeNote: event.target.value,
                }))}
                placeholder="Tenant-shared sales knowledge"
              />
            </label>
          </div>
        </div>

        {/* Section 6: Description (review-like) */}
        <div className="ff-sources-create-section">
          <h4>6. Description</h4>
          <p className="ff-sources-field-hint">Optional description of the knowledge source.</p>
          <label className="ff-sources-field">
            Description
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                description: event.target.value,
              }))}
            />
          </label>
        </div>

        {/* Section 7: Advanced metadata (collapsed) */}
        <details className="ff-sources-create-details">
          <summary>7. Advanced metadata</summary>
          <div className="ff-sources-create-grid" style={{ marginTop: "0.75rem" }}>
            <label className="ff-sources-field">
              Suggested repair action
              <input
                value={createForm.errorNextStep}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  errorNextStep: event.target.value,
                }))}
                placeholder="Refresh connector credentials and re-run bridge sync"
              />
            </label>
            <label className="ff-sources-field">
              Last synced at
              <input
                value={createForm.lastSyncedAt}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  lastSyncedAt: event.target.value,
                }))}
                placeholder="2026-04-23T10:00:00Z"
              />
            </label>
            <label className="ff-sources-field">
              Last error
              <input
                value={createForm.lastError}
                onChange={(event) => setCreateForm((current) => ({
                  ...current,
                  lastError: event.target.value,
                }))}
                placeholder="Optional sync error"
              />
            </label>
          </div>
          <label className="ff-sources-field">
            Advanced metadata JSON
            <textarea
              className="ff-sources-json-field"
              rows={6}
              value={createForm.advancedMetadataJson}
              onChange={(event) => setCreateForm((current) => ({
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
            disabled={!canMutate || savingCreate || !createForm.label.trim() || !createForm.connectionTarget.trim()}
          >
            {savingCreate ? "Creating knowledge source\u2026" : "Create knowledge source"}
          </button>
        </div>
      </form>
    </article>
  );
}
