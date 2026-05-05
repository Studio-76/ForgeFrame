/**
 * ArtifactEditForm — guided edit form for artifact metadata.
 *
 * Groups fields into three sections matching the create form:
 * - Basic info: label, URI
 * - Technical details (collapsible): media type, preview URL, size, version, checksum, status
 * - Advanced (collapsible): retention policy, retained until, archive reason, raw metadata JSON
 *
 * The raw JSON metadata editor is accessible via a collapsible toggle
 * inside the Advanced section — NOT moved to AdvancedDiagnostics.
 *
 * Linked objects stay read-only — attachment edits require the originating surface.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { ArtifactRecord } from "../../../api/domain/artifacts";
import { Button } from "../../../components/ui/Button";
import type { ArtifactEditorForm } from "../types";
import { ARTIFACT_STATUS_OPTIONS } from "../types";

/**
 * Props for ArtifactEditForm.
 */
export type ArtifactEditFormProps = {
  /** The currently selected artifact (for context). */
  detail: ArtifactRecord | null;
  /** Current edit form state. */
  form: ArtifactEditorForm;
  /** Called to update form state. */
  setForm: (updater: (current: ArtifactEditorForm) => ArtifactEditorForm) => void;
  /** Whether the user has mutation permission. */
  canMutate: boolean;
  /** Whether an update request is in flight. */
  saving: boolean;
  /** Called when the form is submitted. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Edit artifact form with grouped fields.
 *
 * Only renders when an artifact is selected. Shows the same field
 * groups as the create form but without linkage fields (workspace,
 * run, approval, decision — these require the originating surface).
 */
export function ArtifactEditForm({
  detail,
  form,
  setForm,
  canMutate,
  saving,
  onSubmit,
}: ArtifactEditFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Edit artifact</h3>
          <p className="text-meta text-muted">
            Update metadata, access URLs, versioning, retention, and archive posture
            without pretending this route can relink runtime objects.
          </p>
        </div>
        <span className="ff-status-badge" data-tone={detail ? "neutral" : "warning"}>
          {detail ? detail.artifact_id : "Select an artifact"}
        </span>
      </div>
      {detail
        ? (
          <form className="fg-stack" onSubmit={onSubmit}>
            {/* ── Basic info ── */}
            <fieldset>
              <legend className="font-semibold text-primary mb-2">Basic info</legend>
              <label>
                Label
                <input
                  value={form.label}
                  onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
                />
              </label>
              <label>
                URI
                <input
                  value={form.uri}
                  onChange={(e) => setForm((c) => ({ ...c, uri: e.target.value }))}
                />
              </label>
            </fieldset>

            {/* ── Technical details (collapsible) ── */}
            <details>
              <summary className="cursor-pointer font-semibold text-primary mt-3 mb-1">
                Technical details
              </summary>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Media type
                  <input
                    value={form.mediaType}
                    onChange={(e) => setForm((c) => ({ ...c, mediaType: e.target.value }))}
                  />
                </label>
                <label>
                  Preview URL
                  <input
                    value={form.previewUrl}
                    onChange={(e) => setForm((c) => ({ ...c, previewUrl: e.target.value }))}
                  />
                </label>
                <label>
                  Size bytes
                  <input
                    value={form.sizeBytes}
                    onChange={(e) => setForm((c) => ({ ...c, sizeBytes: e.target.value }))}
                  />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Version
                  <input
                    value={form.version}
                    onChange={(e) => setForm((c) => ({ ...c, version: e.target.value }))}
                  />
                </label>
                <label>
                  Checksum (SHA-256)
                  <input
                    value={form.checksumSha256}
                    onChange={(e) => setForm((c) => ({ ...c, checksumSha256: e.target.value }))}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as ArtifactEditorForm["status"] }))}
                  >
                    {ARTIFACT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            {/* ── Advanced (collapsible) ── */}
            <details>
              <summary className="cursor-pointer font-semibold text-primary mt-3 mb-1">
                Advanced
              </summary>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Retention policy
                  <input
                    value={form.retentionPolicy}
                    onChange={(e) => setForm((c) => ({ ...c, retentionPolicy: e.target.value }))}
                  />
                </label>
                <label>
                  Retained until
                  <input
                    value={form.retainedUntil}
                    onChange={(e) => setForm((c) => ({ ...c, retainedUntil: e.target.value }))}
                  />
                </label>
                <label>
                  Archive reason
                  <input
                    value={form.archiveReason}
                    onChange={(e) => setForm((c) => ({ ...c, archiveReason: e.target.value }))}
                  />
                </label>
              </div>
              <label className="mt-2 block">
                Advanced metadata JSON
                <textarea
                  rows={6}
                  value={form.advancedMetadataJson}
                  onChange={(e) => setForm((c) => ({ ...c, advancedMetadataJson: e.target.value }))}
                  className="w-full mt-1 font-mono text-sm"
                />
              </label>
            </details>

            <p className="text-meta text-muted">
              Linked objects stay read-only in this form because the current patch endpoint
              only updates artifact metadata. Change workspace, run, or approval linkage from
              the originating surface instead of faking attachment edits here.
            </p>
            <div className="ff-action-bar-actions flex items-center gap-2">
              <Button
                variant="primary"
                type="submit"
                isDisabled={!canMutate || saving || !form.label.trim() || !form.uri.trim()}
              >
                {saving ? "Saving artifact..." : "Save artifact"}
              </Button>
            </div>
          </form>
        )
        : (
          <p className="text-meta text-muted py-4">
            Select an artifact before attempting a metadata mutation.
          </p>
        )}
    </article>
  );
}
