/**
 * ArtifactCreateForm — guided create form for artifact metadata.
 *
 * Groups fields into three sections:
 * - Basic info: workspace, role, type, label, URI, linked objects
 * - Technical details (collapsible): media type, preview URL, size, version, checksum, status
 * - Advanced (collapsible): retention policy, retained until, archive reason, raw metadata JSON
 *
 * The raw JSON metadata editor is accessible via a collapsible toggle
 * inside the Advanced section — NOT moved to AdvancedDiagnostics.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { ArtifactAttachmentTargetKind, ArtifactType, ArtifactWorkspaceRole } from "../../../api/domain/artifacts";
import { Button } from "../../../components/ui/Button";
import type { ArtifactEditorForm } from "../types";
import {
  ARTIFACT_TYPE_OPTIONS,
  ARTIFACT_STATUS_OPTIONS,
  WORKSPACE_ROLE_OPTIONS,
} from "../types";

/**
 * Props for ArtifactCreateForm.
 */
export type ArtifactCreateFormProps = {
  /** Current create form state. */
  form: ArtifactEditorForm;
  /** Called to update form state. */
  setForm: (updater: (current: ArtifactEditorForm) => ArtifactEditorForm) => void;
  /** Whether the user has mutation permission. */
  canMutate: boolean;
  /** Whether a create request is in flight. */
  saving: boolean;
  /** Current instance ID. */
  instanceId: string;
  /** Called when the form is submitted. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Create artifact form with grouped fields.
 *
 * Renders three field groups:
 * 1. Basic info (always visible)
 * 2. Technical details (collapsible)
 * 3. Advanced settings (collapsible, includes JSON metadata editor)
 */
export function ArtifactCreateForm({
  form,
  setForm,
  canMutate,
  saving,
  instanceId,
  onSubmit,
}: ArtifactCreateFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Create artifact</h3>
          <p className="text-meta text-muted">
            Create artifact metadata with explicit scope, linked runtime objects,
            version, checksum, and retention. Upload remains unsupported on this surface.
          </p>
        </div>
        <span className="ff-status-badge" data-tone={canMutate ? "success" : "warning"}>
          {canMutate ? "Writable" : "Admin only"}
        </span>
      </div>
      <form className="fg-stack" onSubmit={onSubmit}>
        {/* ── Basic info ── */}
        <fieldset>
          <legend className="font-semibold text-primary mb-2">Basic info</legend>
          <div className="fg-grid fg-grid-compact">
            <label>
              Workspace ID
              <input
                value={form.workspaceId}
                onChange={(e) => setForm((c) => ({ ...c, workspaceId: e.target.value }))}
                placeholder="ws_customer_pricing"
              />
            </label>
            <label>
              Workspace role
              <select
                value={form.workspaceRole}
                onChange={(e) => setForm((c) => ({ ...c, workspaceRole: e.target.value as ArtifactWorkspaceRole | "" }))}
              >
                {WORKSPACE_ROLE_OPTIONS.map((option) => (
                  <option key={option || "none"} value={option}>{option || "none"}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={form.artifactType}
                onChange={(e) => setForm((c) => ({ ...c, artifactType: e.target.value as ArtifactType }))}
              >
                {ARTIFACT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Linked run ID
              <input
                value={form.linkedRunId}
                onChange={(e) => setForm((c) => ({ ...c, linkedRunId: e.target.value }))}
                placeholder="run_alpha"
              />
            </label>
            <label>
              Linked approval ID
              <input
                value={form.linkedApprovalId}
                onChange={(e) => setForm((c) => ({ ...c, linkedApprovalId: e.target.value }))}
                placeholder="run:instance_alpha:company_alpha:approval-1"
              />
            </label>
            <label>
              Linked decision ID
              <input
                value={form.linkedDecisionId}
                onChange={(e) => setForm((c) => ({ ...c, linkedDecisionId: e.target.value }))}
                placeholder="decision_alpha"
              />
            </label>
          </div>
          <label>
            Label
            <input
              value={form.label}
              onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
              placeholder="Preview package"
            />
          </label>
          <label>
            URI
            <input
              value={form.uri}
              onChange={(e) => setForm((c) => ({ ...c, uri: e.target.value }))}
              placeholder="https://forgeframe.local/previews/ws_customer_pricing"
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
                placeholder="application/pdf"
              />
            </label>
            <label>
              Preview URL
              <input
                value={form.previewUrl}
                onChange={(e) => setForm((c) => ({ ...c, previewUrl: e.target.value }))}
                placeholder="https://forgeframe.local/previews/ws_customer_pricing"
              />
            </label>
            <label>
              Size bytes
              <input
                value={form.sizeBytes}
                onChange={(e) => setForm((c) => ({ ...c, sizeBytes: e.target.value }))}
                placeholder="4096"
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Version
              <input
                value={form.version}
                onChange={(e) => setForm((c) => ({ ...c, version: e.target.value }))}
                placeholder="2026.04.29-1"
              />
            </label>
            <label>
              Checksum (SHA-256)
              <input
                value={form.checksumSha256}
                onChange={(e) => setForm((c) => ({ ...c, checksumSha256: e.target.value }))}
                placeholder="ab12cd34..."
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
                placeholder="workspace_review_30d"
              />
            </label>
            <label>
              Retained until
              <input
                value={form.retainedUntil}
                onChange={(e) => setForm((c) => ({ ...c, retainedUntil: e.target.value }))}
                placeholder="2026-05-30T12:00:00Z"
              />
            </label>
            <label>
              Archive reason
              <input
                value={form.archiveReason}
                onChange={(e) => setForm((c) => ({ ...c, archiveReason: e.target.value }))}
                placeholder="Awaiting release sign-off"
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
          If no workspace, run, approval, or decision link is supplied, ForgeFrame records
          this artifact as instance-scoped so it does not float without ownership.
        </p>
        <div className="ff-action-bar-actions flex items-center gap-2">
          <Button
            variant="primary"
            type="submit"
            isDisabled={!canMutate || saving || !instanceId || !form.label.trim() || !form.uri.trim()}
          >
            {saving ? "Creating artifact..." : "Create artifact"}
          </Button>
        </div>
      </form>
    </article>
  );
}
