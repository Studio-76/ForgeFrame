/**
 * Conversation and inbox management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type ConversationStatus,
  type InboxStatus,
  type TriageStatus,
  type WorkItemPriority,
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { ConversationStatus, InboxStatus, TriageStatus, WorkItemPriority };

// ---------------------------------------------------------------------------
// Conversation types
// ---------------------------------------------------------------------------

/** Conversation thread status. */
export type ConversationThreadStatus = "open" | "closed" | "archived";

/** Conversation session kind. */
export type ConversationSessionKind = "runtime" | "operator" | "assistant" | "external";

/** Conversation message role. */
export type ConversationMessageRole = "user" | "assistant" | "system" | "operator" | "tool";

/** Conversation thread summary. */
export type ConversationThreadSummary = {
  thread_id: string;
  conversation_id: string;
  title: string;
  status: ConversationThreadStatus;
  latest_message_at?: string | null;
  message_count: number;
  session_count: number;
  created_at: string;
  updated_at: string;
};

/** Conversation session record. */
export type ConversationSessionRecord = {
  session_id: string;
  conversation_id: string;
  thread_id: string;
  session_kind: ConversationSessionKind;
  continuity_key?: string | null;
  started_by_type: string;
  started_by_id?: string | null;
  message_count: number;
  metadata: Record<string, unknown>;
  started_at: string;
  ended_at?: string | null;
};

/** Conversation message record. */
export type ConversationMessageRecord = {
  message_id: string;
  conversation_id: string;
  thread_id: string;
  session_id?: string | null;
  message_role: ConversationMessageRole;
  author_type: string;
  author_id?: string | null;
  body: string;
  structured_payload: Record<string, unknown>;
  created_at: string;
};

/** Conversation participant kind. */
export type ConversationParticipantKind = "agent" | "user" | "contact" | "system";

/** Conversation participant status. */
export type ConversationParticipantStatus =
  | "active"
  | "mentioned"
  | "roundtable"
  | "handoff_pending"
  | "review_requested"
  | "blocked"
  | "archived";

/** Conversation mention status. */
export type ConversationMentionStatus = "active" | "acknowledged" | "resolved";

/** Conversation event type. */
export type ConversationEventType =
  | "mention_event"
  | "handoff_event"
  | "review_request_event"
  | "blocker_event"
  | "roundtable_event";

/** Conversation participant record. */
export type ConversationParticipantRecord = {
  participant_id: string;
  conversation_id: string;
  thread_id?: string | null;
  participant_kind: ConversationParticipantKind;
  participant_status: ConversationParticipantStatus;
  agent_id?: string | null;
  participant_ref?: string | null;
  display_label: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Conversation mention record. */
export type ConversationMentionRecord = {
  mention_id: string;
  conversation_id: string;
  thread_id: string;
  message_id: string;
  agent_id: string;
  token: string;
  agent_display_name: string;
  status: ConversationMentionStatus;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Conversation event record. */
export type ConversationEventRecord = {
  event_id: string;
  conversation_id: string;
  thread_id: string;
  source_message_id?: string | null;
  event_type: ConversationEventType;
  source_agent_id?: string | null;
  target_agent_id?: string | null;
  related_object_type?: string | null;
  related_object_id?: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Inbox summary item. */
export type InboxSummary = {
  inbox_id: string;
  instance_id: string;
  company_id: string;
  conversation_id?: string | null;
  thread_id?: string | null;
  workspace_id?: string | null;
  title: string;
  summary: string;
  triage_status: TriageStatus;
  priority: WorkItemPriority;
  status: InboxStatus;
  contact_ref?: string | null;
  run_id?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  decision_id?: string | null;
  metadata: Record<string, unknown>;
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Conversation summary. */
export type ConversationSummary = {
  conversation_id: string;
  instance_id: string;
  company_id: string;
  workspace_id?: string | null;
  subject: string;
  summary: string;
  status: ConversationStatus;
  triage_status: TriageStatus;
  priority: WorkItemPriority;
  contact_ref?: string | null;
  run_id?: string | null;
  artifact_id?: string | null;
  approval_id?: string | null;
  decision_id?: string | null;
  metadata: Record<string, unknown>;
  active_thread_id?: string | null;
  thread_count: number;
  session_count: number;
  message_count: number;
  inbox_count: number;
  participant_count: number;
  mention_count: number;
  event_count: number;
  participant_agent_ids: string[];
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Conversation detail (full expansion). */
export type ConversationDetail = ConversationSummary & {
  threads: ConversationThreadSummary[];
  sessions: ConversationSessionRecord[];
  messages: ConversationMessageRecord[];
  inbox_items: InboxSummary[];
  participants: ConversationParticipantRecord[];
  mentions: ConversationMentionRecord[];
  events: ConversationEventRecord[];
};

/** Inbox detail with optional conversation reference. */
export type InboxDetail = InboxSummary & {
  conversation?: ConversationSummary | null;
};

// ---------------------------------------------------------------------------
// Conversation API functions
// ---------------------------------------------------------------------------

/**
 * Fetch conversations for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters for status, triage, agent, limit.
 * @returns Response with conversations list.
 */
export function fetchConversations(
  instanceId?: string | null,
  filters: {
    status?: ConversationStatus | "all";
    triageStatus?: TriageStatus | "all";
    agentId?: string | null;
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; conversations: ConversationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/conversations", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      triageStatus: filters.triageStatus && filters.triageStatus !== "all" ? filters.triageStatus : null,
      agentId: filters.agentId?.trim() ? filters.agentId.trim() : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch a single conversation with full detail.
 * @param conversationId - The conversation ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the conversation detail.
 */
export function fetchConversationDetail(conversationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}`, undefined, instanceId),
  );
}

/**
 * Create a new conversation.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param payload - Conversation creation parameters.
 * @returns Response with the created conversation.
 */
export function createConversation(
  instanceId: string | null | undefined,
  payload: {
    conversation_id?: string | null;
    workspace_id?: string | null;
    subject: string;
    summary?: string;
    status?: ConversationStatus;
    triage_status?: TriageStatus;
    priority?: WorkItemPriority;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
    initial_thread_title?: string;
    initial_session_kind?: ConversationSessionKind;
    initial_continuity_key?: string | null;
    initial_message_role?: ConversationMessageRole;
    initial_message_body: string;
    participant_agent_ids?: string[];
    initial_mention_agent_ids?: string[];
    create_inbox_entry?: boolean;
    inbox_title?: string | null;
    inbox_summary?: string | null;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope("/admin/conversations", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing conversation.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param conversationId - The conversation ID.
 * @param payload - Fields to update.
 * @returns Response with the updated conversation.
 */
export function updateConversation(
  instanceId: string | null | undefined,
  conversationId: string,
  payload: {
    subject?: string;
    summary?: string;
    workspace_id?: string | null;
    status?: ConversationStatus | null;
    triage_status?: TriageStatus | null;
    priority?: WorkItemPriority | null;
    contact_ref?: string | null;
    run_id?: string | null;
    artifact_id?: string | null;
    approval_id?: string | null;
    decision_id?: string | null;
    metadata?: Record<string, unknown>;
    active_thread_id?: string | null;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Append a message to a conversation.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param conversationId - The conversation ID.
 * @param payload - Message and threading parameters.
 * @returns Response with the updated conversation.
 */
export function appendConversationMessage(
  instanceId: string | null | undefined,
  conversationId: string,
  payload: {
    thread_id?: string | null;
    session_id?: string | null;
    thread_title?: string | null;
    start_new_session?: boolean;
    session_kind?: ConversationSessionKind;
    continuity_key?: string | null;
    message_role?: ConversationMessageRole;
    body: string;
    mention_agent_ids?: string[];
    handoff_to_agent_id?: string | null;
    review_request_agent_id?: string | null;
    blocker_agent_id?: string | null;
    roundtable_agent_ids?: string[];
    structured_payload?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; conversation: ConversationDetail }>(
    appendTenantScope(`/admin/conversations/${encodeURIComponent(conversationId)}/messages`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// ---------------------------------------------------------------------------
// Inbox API functions
// ---------------------------------------------------------------------------

/**
 * Fetch inbox items for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters for triage, status, priority, limit.
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
 * Fetch a single inbox item with full detail.
 * @param inboxId - The inbox item ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the inbox item detail.
 */
export function fetchInboxItemDetail(inboxId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; item: InboxDetail }>(
    appendTenantScope(`/admin/inbox/${encodeURIComponent(inboxId)}`, undefined, instanceId),
  );
}

/**
 * Create a new inbox item.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param payload - Inbox item creation parameters.
 * @returns Response with the created inbox item.
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
 * @param instanceId - Instance ID for scoping (may be null).
 * @param inboxId - The inbox item ID.
 * @param payload - Fields to update.
 * @returns Response with the updated inbox item.
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
