/**
 * Inbox management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type TriageStatus,
  type WorkItemPriority,
  type InboxStatus,
  type InboxSummary,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { ConversationSummary } from "../admin";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { TriageStatus, WorkItemPriority, InboxStatus, InboxSummary };

// ---------------------------------------------------------------------------
// Inbox types
// ---------------------------------------------------------------------------

/** Detailed inbox item. */
export type InboxDetail = InboxSummary & {
  conversation?: ConversationSummary | null;
};

// ---------------------------------------------------------------------------
// Inbox API functions
// ---------------------------------------------------------------------------

/**
 * Fetch inbox items for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (triageStatus, status, priority, limit).
 * @returns Response with inbox items.
 */
export function fetchInboxItems(
  instanceId?: string | null,
  filters: {
    triageStatus?: TriageStatus | "all";
    status?: InboxStatus | "all";
    priority?: WorkItemPriority | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; items: InboxSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/inbox", undefined, instanceId), {
      triageStatus: filters.triageStatus && filters.triageStatus !== "all" ? filters.triageStatus : null,
      status: filters.status && filters.status !== "all" ? filters.status : null,
      priority: filters.priority && filters.priority !== "all" ? filters.priority : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch inbox item detail by ID.
 * @param inboxId - The inbox item ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with inbox item detail.
 */
export function fetchInboxItemDetail(inboxId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope(`/admin/inbox/${encodeURIComponent(inboxId)}`, undefined, instanceId),
  );
}

/**
 * Create a new inbox item.
 * @param instanceId - The instance ID or null.
 * @param payload - Inbox item creation parameters.
 * @returns Response with the created item.
 */
export function createInboxItem(
  instanceId: string | null | undefined,
  payload: {
    inbox_id?: string | null;
    conversation_id?: string | null;
    thread_id?: string | null;
    workspace_id?: string | null;
    title: string;
    summary?: string;
    triage_status?: TriageStatus;
    priority?: WorkItemPriority;
    status?: InboxStatus;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope("/admin/inbox", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing inbox item.
 * @param instanceId - The instance ID or null.
 * @param inboxId - The inbox item ID.
 * @param payload - Fields to update.
 * @returns Response with the updated item.
 */
export function updateInboxItem(
  instanceId: string | null | undefined,
  inboxId: string,
  payload: {
    conversation_id?: string | null;
    thread_id?: string | null;
    workspace_id?: string | null;
    title?: string;
    summary?: string;
    triage_status?: TriageStatus | null;
    priority?: WorkItemPriority | null;
    status?: InboxStatus | null;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope(`/admin/inbox/${encodeURIComponent(inboxId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
