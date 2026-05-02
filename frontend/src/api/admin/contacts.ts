/**
 * Contact management API functions and types.
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

import type { KnowledgeSourceSummary } from "./knowledge-sources";
import type { MemorySummary } from "./memory";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { VisibilityScope };

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------

/** Contact lifecycle status. */
export type ContactStatus = "active" | "snoozed" | "archived";
/** Contact channel kind. */
export type ContactChannelKind = "email" | "phone" | "slack" | "other";
/** Contact route status. */
export type ContactRouteStatus = "reachable" | "warning" | "blocked";

/** Contact channel record. */
export type ContactChannel = {
  kind: ContactChannelKind;
  label: string;
  address: string;
  is_primary: boolean;
  source?: string | null;
  route_status: ContactRouteStatus;
  warning?: string | null;
};

/** Contact provenance. */
export type ContactProvenance = {
  provider?: string | null;
  import_reference?: string | null;
  imported_at?: string | null;
  last_verified_at?: string | null;
  note?: string | null;
};

/** Contact consent. */
export type ContactConsent = {
  status: string;
  captured_at?: string | null;
  note?: string | null;
};

/** Contact summary. */
export type ContactSummary = {
  contact_id: string;
  instance_id: string;
  company_id: string;
  contact_ref: string;
  source_id?: string | null;
  source_label?: string | null;
  source_kind?: import("./knowledge-sources").KnowledgeSourceKind | null;
  display_name: string;
  primary_email?: string | null;
  primary_phone?: string | null;
  organization?: string | null;
  title?: string | null;
  status: ContactStatus;
  visibility_scope: VisibilityScope;
  metadata: Record<string, unknown>;
  channels: ContactChannel[];
  reachable_channel_count: number;
  route_warnings: string[];
  conversation_count: number;
  memory_count: number;
  last_contact_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Contact detail. */
export type ContactDetail = ContactSummary & {
  source?: KnowledgeSourceSummary | null;
  provenance: ContactProvenance;
  consent: ContactConsent;
  visibility_note?: string | null;
  recent_conversations: RecordLink[];
  recent_tasks: RecordLink[];
  recent_notifications: RecordLink[];
  recent_memory: MemorySummary[];
};

// ---------------------------------------------------------------------------
// Contact API functions
// ---------------------------------------------------------------------------

/**
 * Fetch contacts for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit).
 * @returns Response with contacts list.
 */
export function fetchContacts(
  instanceId?: string | null,
  filters: {
    status?: ContactStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; contacts: ContactSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/contacts", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch contact detail by ID.
 * @param contactId - The contact ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with contact detail.
 */
export function fetchContactDetail(contactId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope(`/admin/contacts/${encodeURIComponent(contactId)}`, undefined, instanceId),
  );
}

/**
 * Create a new contact.
 * @param instanceId - The instance ID or null.
 * @param payload - Contact creation parameters.
 * @returns Response with the created contact.
 */
export function createContact(
  instanceId: string | null | undefined,
  payload: {
    contact_id?: string | null;
    contact_ref?: string | null;
    source_id?: string | null;
    display_name: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    organization?: string | null;
    title?: string | null;
    status?: ContactStatus;
    visibility_scope?: VisibilityScope;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope("/admin/contacts", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing contact.
 * @param instanceId - The instance ID or null.
 * @param contactId - The contact ID.
 * @param payload - Fields to update.
 * @returns Response with the updated contact.
 */
export function updateContact(
  instanceId: string | null | undefined,
  contactId: string,
  payload: {
    contact_ref?: string | null;
    source_id?: string | null;
    display_name?: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    organization?: string | null;
    title?: string | null;
    status?: ContactStatus;
    visibility_scope?: VisibilityScope;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; contact: ContactDetail }>(
    appendTenantScope(`/admin/contacts/${encodeURIComponent(contactId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
