/**
 * Guided contact creation panel — progressive disclosure with 6 steps.
 *
 * The form is hidden until the operator explicitly clicks "Create contact".
 * Required fields are visually separated from optional and advanced metadata.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { ContactStatus, VisibilityScope } from "../../api/domain";
import { CREATE_STATUS_OPTIONS, CREATE_STEP_LABELS, VISIBILITY_OPTIONS, type CreateContactForm } from "./types";

/** Props for CreateContactPanel. */
export interface CreateContactPanelProps {
  /** Current create form values. */
  createForm: CreateContactForm;
  /** Create form setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<CreateContactForm>>;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether a save operation is in progress. */
  savingCreate: boolean;
  /** Create handler. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Cancel handler to close the panel. */
  onCancel: () => void;
}

/**
 * Guided creation panel with progressive disclosure in 6 steps.
 * Step 1: Basic identity. Step 2: Reachable routes. Step 3: Consent and visibility.
 * Step 4: Source and provenance. Step 5: Review and create. Step 6: Advanced metadata.
 */
export function CreateContactPanel({
  createForm,
  setCreateForm,
  canMutate,
  savingCreate,
  handleCreate,
  onCancel,
}: CreateContactPanelProps) {
  return (
    <article className="fg-card ff-contacts-create-panel ff-contacts-tron-frame">
      <div className="ff-contacts-create-header">
        <div>
          <h3>Create contact</h3>
          <p className="ff-contacts-create-note">
            Define a governed contact with reachable routes, consent posture,
            and source provenance. Required fields are marked with an asterisk.
          </p>
        </div>
      </div>

      <form className="ff-contacts-create-form" onSubmit={handleCreate}>
        {/* Step 1: Basic identity */}
        <section className="ff-contacts-create-section">
          <h4>{CREATE_STEP_LABELS[1]}</h4>
          <div className="ff-contacts-create-grid">
            <label className="ff-contacts-field ff-contacts-field-required">
              Contact ID
              <input
                value={createForm.contactId}
                onChange={(event) => setCreateForm((current) => ({ ...current, contactId: event.target.value }))}
                placeholder="contact_acme_ops"
              />
            </label>
            <label className="ff-contacts-field ff-contacts-field-required">
              Display name
              <input
                value={createForm.displayName}
                onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Pat Morgan"
              />
            </label>
            <label className="ff-contacts-field">
              Organization
              <input
                value={createForm.organization}
                onChange={(event) => setCreateForm((current) => ({ ...current, organization: event.target.value }))}
                placeholder="Acme GmbH"
              />
            </label>
            <label className="ff-contacts-field">
              Title
              <input
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Operations Lead"
              />
            </label>
          </div>
        </section>

        {/* Step 2: Reachable routes */}
        <section className="ff-contacts-create-section">
          <h4>{CREATE_STEP_LABELS[2]}</h4>
          <div className="ff-contacts-create-grid">
            <label className="ff-contacts-field ff-contacts-field-required">
              Primary email
              <input
                value={createForm.primaryEmail}
                onChange={(event) => setCreateForm((current) => ({ ...current, primaryEmail: event.target.value }))}
                placeholder="pat@example.com"
              />
            </label>
            <label className="ff-contacts-field">
              Primary phone
              <input
                value={createForm.primaryPhone}
                onChange={(event) => setCreateForm((current) => ({ ...current, primaryPhone: event.target.value }))}
                placeholder="+49-30-555-100"
              />
            </label>
          </div>
          <details className="ff-contacts-create-details">
            <summary>Secondary routes</summary>
            <div className="ff-contacts-create-grid" style={{ marginTop: "0.5rem" }}>
              <label className="ff-contacts-field">
                Secondary email
                <input
                  value={createForm.secondaryEmail}
                  onChange={(event) => setCreateForm((current) => ({ ...current, secondaryEmail: event.target.value }))}
                  placeholder="ops@example.com"
                />
              </label>
              <label className="ff-contacts-field">
                Secondary phone
                <input
                  value={createForm.secondaryPhone}
                  onChange={(event) => setCreateForm((current) => ({ ...current, secondaryPhone: event.target.value }))}
                  placeholder="+49-30-555-200"
                />
              </label>
              <label className="ff-contacts-field">
                Slack handle
                <input
                  value={createForm.slackHandle}
                  onChange={(event) => setCreateForm((current) => ({ ...current, slackHandle: event.target.value }))}
                  placeholder="@pat-morgan"
                />
              </label>
            </div>
          </details>
        </section>

        {/* Step 3: Consent and visibility */}
        <section className="ff-contacts-create-section">
          <h4>{CREATE_STEP_LABELS[3]}</h4>
          <div className="ff-contacts-create-grid">
            <label className="ff-contacts-field ff-contacts-field-required">
              Consent status
              <input
                value={createForm.consentStatus}
                onChange={(event) => setCreateForm((current) => ({ ...current, consentStatus: event.target.value }))}
                placeholder="explicit_opt_in"
              />
            </label>
            <label className="ff-contacts-field ff-contacts-field-required">
              Visibility scope
              <select
                value={createForm.visibilityScope}
                onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="ff-contacts-field">
              Consent date
              <input
                value={createForm.consentCapturedAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, consentCapturedAt: event.target.value }))}
                placeholder="2026-04-23T10:00:00Z"
              />
            </label>
            <label className="ff-contacts-field">
              Consent note
              <input
                value={createForm.consentNote}
                onChange={(event) => setCreateForm((current) => ({ ...current, consentNote: event.target.value }))}
                placeholder="Approved for pricing follow-up"
              />
            </label>
            <label className="ff-contacts-field">
              Visibility note
              <input
                value={createForm.visibilityNote}
                onChange={(event) => setCreateForm((current) => ({ ...current, visibilityNote: event.target.value }))}
                placeholder="Shared with the sales response team"
              />
            </label>
            <label className="ff-contacts-field">
              Status
              <select
                value={createForm.status}
                onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ContactStatus }))}
              >
                {CREATE_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Step 4: Source and provenance */}
        <section className="ff-contacts-create-section">
          <h4>{CREATE_STEP_LABELS[4]}</h4>
          <div className="ff-contacts-create-grid">
            <label className="ff-contacts-field">
              Contact path
              <input
                value={createForm.contactRef}
                onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))}
                placeholder="contact://acme/ops"
              />
            </label>
            <label className="ff-contacts-field">
              Source
              <input
                value={createForm.sourceId}
                onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))}
                placeholder="source_mail_primary"
              />
            </label>
            <label className="ff-contacts-field">
              Source provider
              <input
                value={createForm.provenanceProvider}
                onChange={(event) => setCreateForm((current) => ({ ...current, provenanceProvider: event.target.value }))}
                placeholder="gmail"
              />
            </label>
            <label className="ff-contacts-field">
              Import ID
              <input
                value={createForm.provenanceImportReference}
                onChange={(event) => setCreateForm((current) => ({ ...current, provenanceImportReference: event.target.value }))}
                placeholder="crm-4471"
              />
            </label>
            <label className="ff-contacts-field">
              Imported at
              <input
                value={createForm.provenanceImportedAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, provenanceImportedAt: event.target.value }))}
                placeholder="2026-04-23T09:30:00Z"
              />
            </label>
            <label className="ff-contacts-field">
              Last verified
              <input
                value={createForm.provenanceLastVerifiedAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, provenanceLastVerifiedAt: event.target.value }))}
                placeholder="2026-04-23T10:15:00Z"
              />
            </label>
            <label className="ff-contacts-field">
              Provenance note
              <input
                value={createForm.provenanceNote}
                onChange={(event) => setCreateForm((current) => ({ ...current, provenanceNote: event.target.value }))}
                placeholder="Imported from the mailbox owner directory"
              />
            </label>
          </div>
        </section>

        {/* Step 5: Review and create + Step 6: Advanced metadata */}
        <section className="ff-contacts-create-section">
          <h4>{CREATE_STEP_LABELS[5]}</h4>
          <p className="ff-contacts-create-note">
            Review the contact details above. All required fields must be filled. You can also add
            advanced metadata below before creating.
          </p>
          <details className="ff-contacts-create-details">
            <summary>{CREATE_STEP_LABELS[6]}</summary>
            <textarea
              className="ff-contacts-json-field"
              rows={6}
              value={createForm.advancedMetadataJson}
              onChange={(event) => setCreateForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))}
            />
          </details>
        </section>

        <div className="ff-contacts-create-actions">
          <button
            type="submit"
            className="ff-contacts-primary-action"
            disabled={!canMutate || savingCreate || !createForm.displayName.trim()}
          >
            {savingCreate ? "Creating contact\u2026" : "Create contact"}
          </button>
          <button
            type="button"
            className="ff-contacts-secondary-action"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
