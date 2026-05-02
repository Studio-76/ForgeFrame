/**
 * Artifact management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Artifact types
// ---------------------------------------------------------------------------

/** Artifact type discriminator. */
export type ArtifactType =
  | "file"
  | "download"
  | "preview_link"
  | "log"
  | "pr_link"
  | "json"
  | "csv"
  | "pdf"
  | "handoff_note"
  | "external_action_preview";

/** Artifact lifecycle status. */
export type ArtifactStatus = "active" | "superseded" | "archived";

/** Artifact attachment target kind. */
export type ArtifactAttachmentTargetKind = "workspace" | "run" | "approval" | "instance" | "decision";

/** Artifact workspace role. */
export type ArtifactWorkspaceRole = "artifact" | "preview" | "handoff";

/** Artifact attachment record. */
export type ArtifactAttachmentRecord = {
  attachment_id: string;
  artifact_id: string;
  target_kind: ArtifactAttachmentTargetKind;
  target_id: string;
  role: string;
  created_at: string;
};

/** Artifact record. */
export type ArtifactRecord = {
  artifact_id: string;
  instance_id: string;
  company_id: string;
  workspace_id?: string | null;
  scope?: "workspace" | "instance";
  scope_label?: string;
  workspace_role?: ArtifactWorkspaceRole | null;
  artifact_type: ArtifactType;
  label: string;
  uri: string;
  media_type?: string | null;
  preview_url?: string | null;
  size_bytes?: number | null;
  version?: string | null;
  checksum_sha256?: string | null;
  retention_policy?: string | null;
  retained_until?: string | null;
  archive_reason?: string | null;
  status: ArtifactStatus;
  created_by_type: string;
  created_by_id?: string | null;
  metadata: Record<string, unknown>;
  attachments: ArtifactAttachmentRecord[];
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Artifact API functions
// ---------------------------------------------------------------------------

/**
 * Fetch artifacts with optional filters.
 * @param options - Filter options.
 * @returns Response with artifacts list.
 */
export function fetchArtifacts(options: {
  instanceId?: string | null;
  workspaceId?: string | null;
  targetKind?: ArtifactAttachmentTargetKind | "" | null;
  targetId?: string | null;
  limit?: number;
}) {
  return fetchJson<{ status: string; instance?: InstanceRecord; artifacts: ArtifactRecord[] }>(
    appendQueryParams(appendTenantScope("/admin/artifacts", undefined, options.instanceId), {
      workspaceId: options.workspaceId,
      targetKind: options.targetKind,
      targetId: options.targetId,
      limit: options.limit ?? 100,
    }),
  );
}

/**
 * Fetch artifact detail by ID.
 * @param artifactId - The artifact ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with artifact detail.
 */
export function fetchArtifactDetail(artifactId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope(`/admin/artifacts/${encodeURIComponent(artifactId)}`, undefined, instanceId),
  );
}

/**
 * Create a new artifact.
 * @param instanceId - The instance ID or null.
 * @param payload - Artifact creation parameters.
 * @returns Response with the created artifact.
 */
export function createArtifact(
  instanceId: string | null | undefined,
  payload: {
    workspace_id?: string | null;
    workspace_role?: ArtifactWorkspaceRole | null;
    artifact_type: ArtifactType;
    label: string;
    uri: string;
    media_type?: string | null;
    preview_url?: string | null;
    size_bytes?: number | null;
    version?: string | null;
    checksum_sha256?: string | null;
    retention_policy?: string | null;
    retained_until?: string | null;
    archive_reason?: string | null;
    status?: ArtifactStatus;
    attachments?: Array<{
      target_kind: ArtifactAttachmentTargetKind;
      target_id: string;
      role?: string;
    }>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope("/admin/artifacts", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing artifact.
 * @param instanceId - The instance ID or null.
 * @param artifactId - The artifact ID.
 * @param payload - Fields to update.
 * @returns Response with the updated artifact.
 */
export function updateArtifact(
  instanceId: string | null | undefined,
  artifactId: string,
  payload: {
    label?: string;
    uri?: string;
    media_type?: string | null;
    preview_url?: string | null;
    size_bytes?: number | null;
    version?: string | null;
    checksum_sha256?: string | null;
    retention_policy?: string | null;
    retained_until?: string | null;
    archive_reason?: string | null;
    status?: ArtifactStatus;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; artifact: ArtifactRecord }>(
    appendTenantScope(`/admin/artifacts/${encodeURIComponent(artifactId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
