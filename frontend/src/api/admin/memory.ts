/**
 * Memory management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type RecordLink,
  type VisibilityScope,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { KnowledgeSourceKind } from "./knowledge-sources";
import type { KnowledgeSourceSummary } from "./knowledge-sources";
import type { ContactSummary } from "./contacts";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { VisibilityScope };

// ---------------------------------------------------------------------------
// Memory types
// ---------------------------------------------------------------------------

/** Memory kind discriminator. */
export type MemoryKind = "fact" | "preference" | "constraint" | "summary";
/** Memory lifecycle status. */
export type MemoryStatus = "active" | "corrected" | "deleted";
/** Memory sensitivity. */
export type MemorySensitivity = "normal" | "sensitive" | "restricted";
/** Memory truth state. */
export type MemoryTruthState = "active" | "corrected" | "revoked" | "superseded" | "expired" | "deleted";
/** Memory source trust class. */
export type MemorySourceTrustClass = "human_verified" | "operator_verified" | "runtime_inferred" | "external_unverified";
/** Memory layer. */
export type MemoryLayer = "durable" | "boot" | "working";
/** Memory review state. */
export type MemoryReviewState = "not_required" | "scheduled" | "overdue" | "required";

/** Memory review posture. */
export type MemoryReviewPosture = {
  review_at?: string | null;
  state: MemoryReviewState;
  note?: string | null;
  rationale?: string | null;
};

/** Memory usage summary. */
export type MemoryUsageSummary = {
  runs: number;
  conversations: number;
  skills: number;
};

/** Memory revision record. */
export type MemoryRevisionRecord = {
  memory_id: string;
  title: string;
  status: MemoryStatus;
  truth_state: MemoryTruthState;
  source_trust_class: MemorySourceTrustClass;
  correction_note?: string | null;
  created_at: string;
  updated_at: string;
};

/** Memory summary. */
export type MemorySummary = {
  memory_id: string;
  instance_id: string;
  company_id: string;
  source_id?: string | null;
  source_label?: string | null;
  source_kind?: KnowledgeSourceKind | null;
  contact_id?: string | null;
  conversation_id?: string | null;
  task_id?: string | null;
  notification_id?: string | null;
  workspace_id?: string | null;
  memory_kind: MemoryKind;
  title: string;
  body: string;
  memory_layer: MemoryLayer;
  memory_layer_label: string;
  status: MemoryStatus;
  truth_state: MemoryTruthState;
  source_trust_class: MemorySourceTrustClass;
  visibility_scope: VisibilityScope;
  sensitivity: MemorySensitivity;
  review: MemoryReviewPosture;
  last_used_at?: string | null;
  usage: MemoryUsageSummary;
  correction_note?: string | null;
  supersedes_memory_id?: string | null;
  learned_from_event_id?: string | null;
  human_override: boolean;
  expires_at?: string | null;
  deleted_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Memory detail. */
export type MemoryDetail = MemorySummary & {
  source?: KnowledgeSourceSummary | null;
  contact?: ContactSummary | null;
  conversation?: RecordLink | null;
  task?: RecordLink | null;
  notification?: RecordLink | null;
  workspace?: RecordLink | null;
  revision_history: MemoryRevisionRecord[];
  usage_runs: RecordLink[];
  usage_conversations: RecordLink[];
  usage_skills: RecordLink[];
};

// ---------------------------------------------------------------------------
// Memory API functions
// ---------------------------------------------------------------------------

/**
 * Fetch memory entries for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, visibilityScope, limit).
 * @returns Response with memory entries.
 */
export function fetchMemoryEntries(
  instanceId?: string | null,
  filters: {
    status?: MemoryStatus | "all";
    visibilityScope?: VisibilityScope | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; memory: MemorySummary[] }>(
    appendQueryParams(appendTenantScope("/admin/memory", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      visibilityScope: filters.visibilityScope && filters.visibilityScope !== "all" ? filters.visibilityScope : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch memory entry detail by ID.
 * @param memoryId - The memory entry ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with memory detail.
 */
export function fetchMemoryDetail(memoryId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}`, undefined, instanceId),
  );
}

/**
 * Create a new memory entry.
 * @param instanceId - The instance ID or null.
 * @param payload - Memory creation parameters.
 * @returns Response with the created memory.
 */
export function createMemoryEntry(
  instanceId: string | null | undefined,
  payload: {
    memory_id?: string | null;
    source_id?: string | null;
    contact_id?: string | null;
    conversation_id?: string | null;
    task_id?: string | null;
    notification_id?: string | null;
    workspace_id?: string | null;
    memory_kind: MemoryKind;
    title: string;
    body: string;
    source_trust_class?: MemorySourceTrustClass;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    correction_note?: string | null;
    learned_from_event_id?: string | null;
    human_override?: boolean;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope("/admin/memory", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing memory entry.
 * @param instanceId - The instance ID or null.
 * @param memoryId - The memory entry ID.
 * @param payload - Fields to update.
 * @returns Response with the updated memory.
 */
export function updateMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: {
    source_id?: string | null;
    contact_id?: string | null;
    conversation_id?: string | null;
    task_id?: string | null;
    notification_id?: string | null;
    workspace_id?: string | null;
    memory_kind?: MemoryKind;
    title?: string;
    body?: string;
    source_trust_class?: MemorySourceTrustClass;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    correction_note?: string | null;
    learned_from_event_id?: string | null;
    human_override?: boolean;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Correct a memory entry (creates a corrected version).
 * @param instanceId - The instance ID or null.
 * @param memoryId - The memory entry ID.
 * @param payload - Correction parameters.
 * @returns Response with the corrected memory.
 */
export function correctMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: {
    title: string;
    body: string;
    correction_note: string;
    memory_kind?: MemoryKind;
    source_trust_class?: MemorySourceTrustClass;
    visibility_scope?: VisibilityScope;
    sensitivity?: MemorySensitivity;
    expires_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; action: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}/correct`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Soft-delete a memory entry.
 * @param instanceId - The instance ID or null.
 * @param memoryId - The memory entry ID.
 * @param payload - Optional deletion note.
 * @returns Response with the deleted memory.
 */
export function deleteMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: { deletion_note?: string | null } = {},
) {
  return fetchJson<{ status: string; action: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}/delete`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Revoke a memory entry (mark as revoked with a note).
 * @param instanceId - The instance ID or null.
 * @param memoryId - The memory entry ID.
 * @param payload - Revocation parameters.
 * @returns Response with the revoked memory.
 */
export function revokeMemoryEntry(
  instanceId: string | null | undefined,
  memoryId: string,
  payload: {
    revocation_note: string;
  },
) {
  return fetchJson<{ status: string; action: string; memory: MemoryDetail }>(
    appendTenantScope(`/admin/memory/${encodeURIComponent(memoryId)}/revoke`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
