/**
 * Shared types and constants for the Artifacts feature module.
 *
 * Provides form state types, access summary types, option arrays,
 * and default form values for the artifact CRUD surface.
 *
 * @packageDocumentation
 */

import type {
  ArtifactAttachmentTargetKind,
  ArtifactStatus,
  ArtifactType,
  ArtifactWorkspaceRole,
} from "../../api/domain/artifacts";

// ── Load state ──────────────────────────────────────────────────────────

/** Standard data-fetching lifecycle state. */
export type LoadState = "idle" | "loading" | "success" | "error";

// ── Form state ──────────────────────────────────────────────────────────

/** Complete form state for creating or editing an artifact. */
export type ArtifactEditorForm = {
  workspaceId: string;
  workspaceRole: ArtifactWorkspaceRole | "";
  linkedRunId: string;
  linkedApprovalId: string;
  linkedDecisionId: string;
  artifactType: ArtifactType;
  label: string;
  uri: string;
  mediaType: string;
  previewUrl: string;
  sizeBytes: string;
  version: string;
  checksumSha256: string;
  retentionPolicy: string;
  retainedUntil: string;
  archiveReason: string;
  status: ArtifactStatus;
  advancedMetadataJson: string;
};

// ── Linked objects ──────────────────────────────────────────────────────

/** A resolved linked object attached to an artifact. */
export type LinkedArtifactObject = {
  key: string;
  kind: ArtifactAttachmentTargetKind | "workspace";
  label: string;
  identifier: string;
  role: string | null;
  href: string | null;
};

// ── Access summary ──────────────────────────────────────────────────────

/** Surface-level access summary for an artifact's preview/download state. */
export type ArtifactAccessSummary = {
  previewUrl: string | null;
  downloadUrl: string | null;
  inlinePreviewUrl: string | null;
  previewState: "available" | "bridge-only";
  downloadState: "available" | "bridge-only";
  surfaceState: "preview-ready" | "download-ready" | "metadata-only";
  note: string;
};

// ── Constants ───────────────────────────────────────────────────────────

/** All available artifact type values. */
export const ARTIFACT_TYPE_OPTIONS: ArtifactType[] = [
  "file",
  "download",
  "preview_link",
  "log",
  "pr_link",
  "json",
  "csv",
  "pdf",
  "handoff_note",
  "external_action_preview",
];

/** All available artifact status values. */
export const ARTIFACT_STATUS_OPTIONS: ArtifactStatus[] = ["active", "superseded", "archived"];

/** All available target kind filter options (with empty "all" option). */
export const TARGET_KIND_OPTIONS: Array<ArtifactAttachmentTargetKind | ""> = [
  "", "workspace", "run", "approval", "instance", "decision",
];

/** All available workspace role options (with empty "none" option). */
export const WORKSPACE_ROLE_OPTIONS: Array<ArtifactWorkspaceRole | ""> = [
  "", "artifact", "preview", "handoff",
];

// ── Default form values ────────────────────────────────────────────────

/** Default values for the create artifact form. */
export const DEFAULT_CREATE_FORM: ArtifactEditorForm = {
  workspaceId: "",
  workspaceRole: "",
  linkedRunId: "",
  linkedApprovalId: "",
  linkedDecisionId: "",
  artifactType: "file",
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  version: "",
  checksumSha256: "",
  retentionPolicy: "",
  retainedUntil: "",
  archiveReason: "",
  status: "active",
  advancedMetadataJson: "{}",
};

/** Default values for the edit artifact form. */
export const DEFAULT_EDIT_FORM: ArtifactEditorForm = {
  workspaceId: "",
  workspaceRole: "",
  linkedRunId: "",
  linkedApprovalId: "",
  linkedDecisionId: "",
  artifactType: "file",
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  version: "",
  checksumSha256: "",
  retentionPolicy: "",
  retainedUntil: "",
  archiveReason: "",
  status: "active",
  advancedMetadataJson: "{}",
};
