/**
 * Knowledge source management API functions and types.
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

import type { ContactSummary } from "./contacts";
import type { MemorySummary } from "./memory";

// ---------------------------------------------------------------------------
// Knowledge source types
// ---------------------------------------------------------------------------

/** Knowledge source kind. */
export type KnowledgeSourceKind = "mail" | "calendar" | "contacts" | "drive" | "knowledge_base";
/** Knowledge source status. */
export type KnowledgeSourceStatus = "active" | "paused" | "error";

/** Knowledge source sync posture. */
export type KnowledgeSourceSyncPosture = {
  state: string;
  next_step: string;
  action_available: boolean;
  action_state: string;
  action_reason: string;
};

/** Knowledge source config field. */
export type KnowledgeSourceConfigField = {
  key: string;
  label: string;
  value: string;
  note?: string | null;
  redacted: boolean;
};

/** Knowledge source index counts. */
export type KnowledgeSourceIndexCounts = {
  contacts: number;
  durable_memory: number;
  linked_conversations: number;
  linked_skills: number;
};

/** Knowledge source summary. */
export type KnowledgeSourceSummary = {
  source_id: string;
  instance_id: string;
  company_id: string;
  source_kind: KnowledgeSourceKind;
  label: string;
  description: string;
  connection_target: string;
  status: KnowledgeSourceStatus;
  visibility_scope: VisibilityScope;
  scope_label: string;
  last_synced_at?: string | null;
  last_error?: string | null;
  sync: KnowledgeSourceSyncPosture;
  metadata: Record<string, unknown>;
  contact_count: number;
  memory_count: number;
  indexed_objects: KnowledgeSourceIndexCounts;
  created_at: string;
  updated_at: string;
};

/** Knowledge source detail. */
export type KnowledgeSourceDetail = KnowledgeSourceSummary & {
  contacts: ContactSummary[];
  memory_entries: MemorySummary[];
  connector_fields: KnowledgeSourceConfigField[];
  linked_conversations: RecordLink[];
  linked_skills: RecordLink[];
  recall_vs_memory_note: string;
};

// ---------------------------------------------------------------------------
// Knowledge source API functions
// ---------------------------------------------------------------------------

/**
 * Fetch knowledge sources for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (sourceKind, status, limit).
 * @returns Response with knowledge sources list.
 */
export function fetchKnowledgeSources(
  instanceId?: string | null,
  filters: {
    sourceKind?: KnowledgeSourceKind | "all";
    status?: KnowledgeSourceStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; sources: KnowledgeSourceSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/knowledge-sources", undefined, instanceId), {
      sourceKind: filters.sourceKind && filters.sourceKind !== "all" ? filters.sourceKind : null,
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch knowledge source detail by ID.
 * @param sourceId - The knowledge source ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with knowledge source detail.
 */
export function fetchKnowledgeSourceDetail(sourceId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope(`/admin/knowledge-sources/${encodeURIComponent(sourceId)}`, undefined, instanceId),
  );
}

/**
 * Create a new knowledge source.
 * @param instanceId - The instance ID or null.
 * @param payload - Knowledge source creation parameters.
 * @returns Response with the created source.
 */
export function createKnowledgeSource(
  instanceId: string | null | undefined,
  payload: {
    source_id?: string | null;
    source_kind: KnowledgeSourceKind;
    label: string;
    description?: string;
    connection_target: string;
    status?: KnowledgeSourceStatus;
    visibility_scope?: VisibilityScope;
    last_synced_at?: string | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope("/admin/knowledge-sources", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing knowledge source.
 * @param instanceId - The instance ID or null.
 * @param sourceId - The knowledge source ID.
 * @param payload - Fields to update.
 * @returns Response with the updated source.
 */
export function updateKnowledgeSource(
  instanceId: string | null | undefined,
  sourceId: string,
  payload: {
    label?: string;
    description?: string;
    connection_target?: string;
    status?: KnowledgeSourceStatus;
    visibility_scope?: VisibilityScope;
    last_synced_at?: string | null;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; source: KnowledgeSourceDetail }>(
    appendTenantScope(`/admin/knowledge-sources/${encodeURIComponent(sourceId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
