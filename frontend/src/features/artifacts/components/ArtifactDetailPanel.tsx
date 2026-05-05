/**
 * ArtifactDetailPanel — detail view for a selected artifact.
 *
 * Shows access posture (preview/download), summary metadata,
 * version/retention info, linked runtime objects, and advanced
 * metadata in a collapsed section.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { ArtifactRecord } from "../../../api/domain/artifacts";
import { buildWorkspacePath, buildArtifactsPath } from "../../../app/workInteractionRoutes";
import { formatBytes, formatTimestamp, stripStructuredMetadata } from "../helpers";
import type { ArtifactAccessSummary, LinkedArtifactObject } from "../types";

/**
 * Props for ArtifactDetailPanel.
 */
export type ArtifactDetailPanelProps = {
  /** The full artifact record to display. */
  detail: ArtifactRecord | null;
  /** Loading state for detail fetch. */
  detailState: "idle" | "loading" | "success" | "error";
  /** Current instance ID. */
  instanceId: string;
  /** Pre-computed linked objects. */
  linkedObjects: LinkedArtifactObject[];
  /** Pre-computed access summary. */
  accessSummary: ArtifactAccessSummary | null;
};

/**
 * Detail panel for a selected artifact.
 *
 * Displays five sections:
 * 1. Preview and download access summary
 * 2. Basic summary (ID, scope, workspace, timestamps)
 * 3. Version and retention details
 * 4. Linked runtime objects
 * 5. Advanced metadata (collapsible)
 */
export function ArtifactDetailPanel({
  detail,
  detailState,
  instanceId,
  linkedObjects,
  accessSummary,
}: ArtifactDetailPanelProps) {
  if (!detail || !accessSummary) {
    if (detailState === "loading") {
      return <p className="text-meta text-muted py-4">Loading artifact detail.</p>;
    }
    return (
      <p className="text-meta text-muted py-4">
        Select an artifact to inspect access posture and linked runtime truth.
      </p>
    );
  }

  return (
    <section className="fg-stack">
      <div className="fg-card-grid">
        {/* ── Preview and download ── */}
        <article className="fg-subcard">
          <div className="fg-panel-heading">
            <div>
              <h4>Preview and download</h4>
              <p className="text-meta text-muted">
                The surface only exposes real browser-reachable links. File
                and opaque storage URIs stay clearly blocked instead of
                faking download buttons.
              </p>
            </div>
            <span
              className="ff-status-badge"
              data-tone={accessSummary.surfaceState === "metadata-only" ? "warning" : "success"}
            >
              {accessSummary.surfaceState}
            </span>
          </div>
          <ul className="fg-list">
            <li>Preview: {accessSummary.previewUrl ? "available" : "bridge-only"}</li>
            <li>Download: {accessSummary.downloadUrl ? "available" : "bridge-only"}</li>
            <li>URI: <span className="font-mono">{detail.uri}</span></li>
            <li>
              Preview URL:{" "}
              {detail.preview_url
                ? <span className="font-mono">{detail.preview_url}</span>
                : "Not recorded"}
            </li>
          </ul>
          <p
            className={accessSummary.surfaceState === "metadata-only" ? "text-danger" : "text-meta text-muted"}
          >
            {accessSummary.note}
          </p>
          <div className="ff-action-bar-actions flex items-center gap-2 mt-2">
            {accessSummary.previewUrl
              ? (
                <a
                  className="ff-link"
                  href={accessSummary.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open preview
                </a>
              )
              : null}
            {accessSummary.downloadUrl
              ? (
                <a
                  className="ff-link"
                  href={accessSummary.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download artifact
                </a>
              )
              : null}
          </div>
          {accessSummary.inlinePreviewUrl
            ? (
              detail.media_type?.startsWith("image/")
                ? (
                  <img
                    src={accessSummary.inlinePreviewUrl}
                    alt={detail.label}
                    className="w-full rounded-lg mt-2"
                  />
                )
                : (
                  <iframe
                    title={`Preview ${detail.label}`}
                    src={accessSummary.inlinePreviewUrl}
                    className="w-full min-h-[320px] border border-border rounded-lg mt-2"
                  />
                )
            )
            : null}
        </article>

        {/* ── Summary ── */}
        <article className="fg-subcard">
          <h4>Summary</h4>
          <ul className="fg-list">
            <li>Artifact ID: <span className="font-mono">{detail.artifact_id}</span></li>
            <li>
              Scope: {detail.scope_label ?? (detail.workspace_id ? "Workspace" : "Instance")}
            </li>
            <li>Workspace: {detail.workspace_id ?? "Instance-scoped only"}</li>
            <li>Workspace role: {detail.workspace_role ?? "Not recorded"}</li>
            <li>
              Created by: {detail.created_by_type} · {detail.created_by_id ?? "system"}
            </li>
            <li>Created at: {formatTimestamp(detail.created_at)}</li>
            <li>Updated at: {formatTimestamp(detail.updated_at)}</li>
          </ul>
          <div className="ff-action-bar-actions flex items-center gap-2 mt-2">
            {detail.workspace_id
              ? (
                <Link
                  className="ff-link"
                  to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}
                >
                  Open workspace
                </Link>
              )
              : null}
            <Link
              className="ff-link"
              to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}
            >
              Direct artifact link
            </Link>
          </div>
        </article>

        {/* ── Version and retention ── */}
        <article className="fg-subcard">
          <h4>Version and retention</h4>
          <ul className="fg-list">
            <li>Version: {detail.version ?? "Not recorded"}</li>
            <li>
              Checksum (SHA-256):{" "}
              {detail.checksum_sha256
                ? <span className="font-mono">{detail.checksum_sha256}</span>
                : "Not recorded"}
            </li>
            <li>Size: {formatBytes(detail.size_bytes)}</li>
            <li>Retention policy: {detail.retention_policy ?? "Not recorded"}</li>
            <li>Retained until: {formatTimestamp(detail.retained_until, "Not recorded")}</li>
            <li>Archive reason: {detail.archive_reason ?? "Not recorded"}</li>
            <li>Status: {detail.status}</li>
          </ul>
        </article>
      </div>

      {/* ── Linked objects ── */}
      <article className="fg-subcard">
        <h4>Linked objects</h4>
        {linkedObjects.length === 0
          ? (
            <p className="text-meta text-muted">
              No workspace, run, approval, instance, or decision links were recorded for this artifact.
            </p>
          )
          : (
            <ul className="fg-list">
              {linkedObjects.map((item) => (
                <li key={item.key}>
                  <span className="ff-status-badge" data-tone="neutral">{item.label}</span>{" "}
                  {item.href
                    ? <Link className="ff-link" to={item.href}>{item.identifier}</Link>
                    : <span className="font-mono">{item.identifier}</span>
                  }
                  {item.role ? <span className="text-meta text-muted"> · role {item.role}</span> : null}
                </li>
              ))}
            </ul>
          )}
      </article>

      {/* ── Advanced metadata ── */}
      <article className="fg-subcard">
        <h4>Advanced metadata</h4>
        <details>
          <summary className="cursor-pointer text-meta text-muted font-medium">
            Structured fields are primary. Raw metadata stays advanced.
          </summary>
          <pre className="ff-diagnostic-code mt-2">
            {JSON.stringify(stripStructuredMetadata(detail.metadata ?? {}), null, 2)}
          </pre>
        </details>
      </article>
    </section>
  );
}
