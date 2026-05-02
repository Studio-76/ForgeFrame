/**
 * Automation management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { TaskSummary } from "./tasks";
import type { DeliveryChannelSummary } from "./channels";

// ---------------------------------------------------------------------------
// Automation types
// ---------------------------------------------------------------------------

/** Automation lifecycle status. */
export type AutomationStatus = "active" | "paused" | "archived";

/** Automation action kind. */
export type AutomationActionKind = "create_follow_up" | "create_reminder" | "create_notification";

/** Automation summary. */
export type AutomationSummary = {
  automation_id: string;
  instance_id: string;
  company_id: string;
  title: string;
  summary: string;
  status: AutomationStatus;
  action_kind: AutomationActionKind;
  cadence_minutes: number;
  next_run_at: string;
  last_run_at?: string | null;
  target_task_id?: string | null;
  target_conversation_id?: string | null;
  target_inbox_id?: string | null;
  target_workspace_id?: string | null;
  channel_id?: string | null;
  fallback_channel_id?: string | null;
  preview_required: boolean;
  last_task_id?: string | null;
  last_reminder_id?: string | null;
  last_notification_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Automation detail. */
export type AutomationDetail = AutomationSummary & {
  task?: TaskSummary | null;
  channel?: DeliveryChannelSummary | null;
};

// ---------------------------------------------------------------------------
// Automation API functions
// ---------------------------------------------------------------------------

/**
 * Fetch automations for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit).
 * @returns Response with automations list.
 */
export function fetchAutomations(
  instanceId?: string | null,
  filters: {
    status?: AutomationStatus | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; automations: AutomationSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/automations", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch automation detail by ID.
 * @param automationId - The automation ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with automation detail.
 */
export function fetchAutomationDetail(automationId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}`, undefined, instanceId),
  );
}

/**
 * Create a new automation.
 * @param instanceId - The instance ID or null.
 * @param payload - Automation creation parameters.
 * @returns Response with the created automation.
 */
export function createAutomation(
  instanceId: string | null | undefined,
  payload: {
    automation_id?: string | null;
    title: string;
    summary?: string;
    action_kind: AutomationActionKind;
    cadence_minutes: number;
    next_run_at: string;
    target_task_id?: string | null;
    target_conversation_id?: string | null;
    target_inbox_id?: string | null;
    target_workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    preview_required?: boolean;
    task_template_title?: string | null;
    task_template_summary?: string | null;
    notification_title?: string | null;
    notification_body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope("/admin/automations", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing automation.
 * @param instanceId - The instance ID or null.
 * @param automationId - The automation ID.
 * @param payload - Fields to update.
 * @returns Response with the updated automation.
 */
export function updateAutomation(
  instanceId: string | null | undefined,
  automationId: string,
  payload: {
    title?: string;
    summary?: string;
    status?: AutomationStatus | null;
    cadence_minutes?: number | null;
    next_run_at?: string | null;
    target_task_id?: string | null;
    target_conversation_id?: string | null;
    target_inbox_id?: string | null;
    target_workspace_id?: string | null;
    channel_id?: string | null;
    fallback_channel_id?: string | null;
    preview_required?: boolean | null;
    task_template_title?: string | null;
    task_template_summary?: string | null;
    notification_title?: string | null;
    notification_body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Trigger an automation immediately.
 * @param instanceId - The instance ID or null.
 * @param automationId - The automation ID.
 * @returns Response with the triggered automation.
 */
export function triggerAutomation(instanceId: string | null | undefined, automationId: string) {
  return fetchJson<{ status: string; automation: AutomationDetail }>(
    appendTenantScope(`/admin/automations/${encodeURIComponent(automationId)}/trigger`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}
