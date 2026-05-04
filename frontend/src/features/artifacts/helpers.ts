/**
 * Helper functions for the Artifacts feature module.
 *
 * Pure utility functions for formatting, parsing, and building
 * artifact metadata and attachment payloads.
 *
 * @packageDocumentation
 */

import type { ArtifactAttachmentRecord, ArtifactAttachmentTargetKind, ArtifactRecord } from "../../api/domain/artifacts";
import { buildWorkspacePath } from "../../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { ArtifactAccessSummary, ArtifactEditorForm, LinkedArtifactObject } from "./types";

/**
 * Normalizes an optional text value: trims and returns null if empty.
 * @param value - Raw string value.
 * @returns Trimmed value, or null if empty.
 */
export function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

/**
 * Parses a JSON object string. Throws if the value is not a valid JSON object.
 * @param rawValue - Raw JSON string.
 * @param fieldLabel - Label for error messages.
 * @returns Parsed record.
 */
export function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Parses a size string in bytes. Returns null for empty input.
 * @param rawValue - Raw byte count string.
 * @returns Parsed number or null.
 */
export function parseSizeBytes(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Size bytes must be a non-negative number.");
  }
  return parsed;
}

/**
 * Formats an ISO timestamp to a human-readable date string.
 * @param value - ISO timestamp string, null, or undefined.
 * @param fallback - Fallback text when value is missing. Default "Not recorded".
 * @returns Formatted date or fallback.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * Formats a byte count to a human-readable size string.
 * @param value - Byte count or null.
 * @returns Formatted size string.
 */
export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Truncates a SHA-256 checksum for display.
 * @param value - Full checksum string or null.
 * @returns Truncated checksum or fallback.
 */
export function formatChecksum(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

/**
 * Validates and returns an HTTP(S) URL string from raw input.
 * @param value - Raw URL string.
 * @returns Validated URL or null.
 */
export function externalHttpUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Deep-clones an artifact metadata record.
 * @param metadata - Source metadata.
 * @returns A new, deeply cloned record.
 */
export function cloneArtifactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

/**
 * Strips structured metadata fields from the raw metadata record,
 * leaving only the "advanced" subset.
 * @param metadata - Full metadata record.
 * @returns Metadata without structured fields.
 */
export function stripStructuredMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const advanced = cloneArtifactMetadata(metadata);
  delete advanced.version;
  delete advanced.version_label;
  delete advanced.artifact_version;
  delete advanced.checksum_sha256;
  delete advanced.sha256;
  delete advanced.checksum;
  delete advanced.archive_reason;
  delete advanced.retention_policy;
  delete advanced.retained_until;

  const retention = advanced.retention;
  if (retention && typeof retention === "object" && !Array.isArray(retention)) {
    const nextRetention = { ...(retention as Record<string, unknown>) };
    delete nextRetention.policy;
    delete nextRetention.classification;
    delete nextRetention.retained_until;
    if (Object.keys(nextRetention).length === 0) {
      delete advanced.retention;
    } else {
      advanced.retention = nextRetention;
    }
  }

  return advanced;
}

/**
 * Describes an attachment link for navigation.
 * @param instanceId - Current instance ID.
 * @param attachment - Attachment record.
 * @returns Link info or null.
 */
export function describeAttachmentLink(
  instanceId: string,
  attachment: ArtifactAttachmentRecord,
): { href: string; label: string } | null {
  if (attachment.target_kind === "workspace") {
    return {
      href: buildWorkspacePath({ instanceId, workspaceId: attachment.target_id }),
      label: "Open workspace",
    };
  }
  if (attachment.target_kind === "run") {
    return {
      href: `${CONTROL_PLANE_ROUTES.execution}?${new URLSearchParams({ instanceId, runId: attachment.target_id }).toString()}`,
      label: "Open execution review",
    };
  }
  if (attachment.target_kind === "approval") {
    return {
      href: `${CONTROL_PLANE_ROUTES.approvals}?${new URLSearchParams({ instanceId, approvalId: attachment.target_id, status: "all" }).toString()}`,
      label: "Open approval review",
    };
  }
  return null;
}

/**
 * Builds a surface-level access summary for an artifact.
 * Evaluates URI and preview availability to determine whether
 * preview, download, or metadata-only posture applies.
 * @param artifact - The artifact record.
 * @returns Access summary.
 */
export function describeArtifactAccess(artifact: ArtifactRecord): ArtifactAccessSummary {
  const previewUrl = externalHttpUrl(artifact.preview_url)
    ?? (artifact.artifact_type === "preview_link" ? externalHttpUrl(artifact.uri) : null);
  const downloadUrl = externalHttpUrl(artifact.uri);
  const inlinePreviewUrl = previewUrl && (
    artifact.media_type?.startsWith("image/")
    || artifact.media_type === "application/pdf"
    || artifact.media_type === "text/html"
    || artifact.artifact_type === "preview_link"
  )
    ? previewUrl
    : null;

  if (previewUrl && downloadUrl) {
    return {
      previewUrl,
      downloadUrl,
      inlinePreviewUrl,
      previewState: "available",
      downloadState: "available",
      surfaceState: "preview-ready",
      note: "Preview and download both resolve through browser-reachable URLs.",
    };
  }
  if (previewUrl) {
    return {
      previewUrl,
      downloadUrl: null,
      inlinePreviewUrl,
      previewState: "available",
      downloadState: "bridge-only",
      surfaceState: "preview-ready",
      note: "Preview is available, but download still depends on a bridge or external blob store.",
    };
  }
  if (downloadUrl) {
    return {
      previewUrl: null,
      downloadUrl,
      inlinePreviewUrl: null,
      previewState: "bridge-only",
      downloadState: "available",
      surfaceState: "download-ready",
      note: "Download is browser-reachable, but no dedicated preview URL was recorded.",
    };
  }
  return {
    previewUrl: null,
    downloadUrl: null,
    inlinePreviewUrl: null,
    previewState: "bridge-only",
    downloadState: "bridge-only",
    surfaceState: "metadata-only",
    note: "ForgeFrame does not expose blob delivery for this URI on the current admin surface. The artifact remains metadata-only here.",
  };
}

/**
 * Builds a sorted list of linked objects from artifact data.
 * @param instanceId - Current instance ID.
 * @param artifact - The artifact record.
 * @returns Sorted linked object list.
 */
export function buildLinkedObjects(instanceId: string, artifact: ArtifactRecord): LinkedArtifactObject[] {
  const objects: LinkedArtifactObject[] = [];
  const seen = new Set<string>();
  const priority: Record<LinkedArtifactObject["kind"], number> = {
    workspace: 0,
    run: 1,
    approval: 2,
    instance: 3,
    decision: 4,
  };

  if (artifact.workspace_id) {
    const key = `workspace:${artifact.workspace_id}`;
    seen.add(key);
    objects.push({
      key,
      kind: "workspace",
      label: "Workspace",
      identifier: artifact.workspace_id,
      role: artifact.workspace_role ?? "artifact",
      href: buildWorkspacePath({ instanceId, workspaceId: artifact.workspace_id }),
    });
  }

  artifact.attachments.forEach((attachment) => {
    const key = `${attachment.target_kind}:${attachment.target_id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const link = describeAttachmentLink(instanceId, attachment);
    objects.push({
      key,
      kind: attachment.target_kind,
      label: attachment.target_kind === "run"
        ? "Run"
        : attachment.target_kind === "approval"
          ? "Approval"
          : attachment.target_kind === "instance"
            ? "Instance"
            : attachment.target_kind === "decision"
              ? "Decision"
              : "Workspace",
      identifier: attachment.target_id,
      role: attachment.role,
      href: link?.href ?? null,
    });
  });

  return objects.sort((left, right) => (
    priority[left.kind] - priority[right.kind]
    || left.identifier.localeCompare(right.identifier)
    || (left.role ?? "").localeCompare(right.role ?? "")
  ));
}

/**
 * Builds a metadata payload from an editor form.
 * @param form - The artifact editor form.
 * @returns Parsed metadata record.
 */
export function buildArtifactMetadata(form: ArtifactEditorForm): Record<string, unknown> {
  return parseJsonObject(form.advancedMetadataJson, "Artifact advanced metadata");
}

/**
 * Builds attachment payloads from an editor form.
 * Falls back to instance-scoped attachment when no links are supplied.
 * @param form - The artifact editor form.
 * @param instanceId - Current instance ID for fallback scope.
 * @returns Array of attachment descriptors.
 */
export function buildCreateAttachments(
  form: ArtifactEditorForm,
  instanceId: string,
): Array<{
  target_kind: ArtifactAttachmentTargetKind;
  target_id: string;
  role?: string;
}> {
  const attachments: Array<{
    target_kind: ArtifactAttachmentTargetKind;
    target_id: string;
    role?: string;
  }> = [];
  const runId = normalizeOptionalText(form.linkedRunId);
  const approvalId = normalizeOptionalText(form.linkedApprovalId);
  const decisionId = normalizeOptionalText(form.linkedDecisionId);

  if (runId) {
    attachments.push({ target_kind: "run", target_id: runId, role: "run_output" });
  }
  if (approvalId) {
    attachments.push({ target_kind: "approval", target_id: approvalId, role: "approval_evidence" });
  }
  if (decisionId) {
    attachments.push({ target_kind: "decision", target_id: decisionId, role: "decision_context" });
  }

  if (!normalizeOptionalText(form.workspaceId) && attachments.length === 0) {
    attachments.push({ target_kind: "instance", target_id: instanceId, role: "instance_scope" });
  }

  return attachments;
}
