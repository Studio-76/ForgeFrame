/**
 * Automations feature — helper functions for schedule calculation,
 * status tones, payload building, and display labels.
 *
 * @packageDocumentation
 */

import type { AutomationActionKind, AutomationStatus, AutomationSummary } from "../../api/domain/automations";
import { normalizeOptional, parseInteger, parseJsonObject } from "../../pages/workInteractionPageSupport";
import type { AutomationCreateForm, AutomationEditForm, ScheduleUnit } from "./types";

// ─── Schedule helpers ─────────────────────────────────────

/**
 * Convert cadence minutes to structured schedule { every, unit }.
 * @param cadenceMinutes - Raw cadence in minutes.
 * @returns Structured schedule representation.
 */
export function cadenceToStructured(cadenceMinutes: string | number): { every: string; unit: ScheduleUnit } {
  const minutes = typeof cadenceMinutes === "number"
    ? cadenceMinutes
    : parseInteger(String(cadenceMinutes), 60);
  if (minutes % 1440 === 0) {
    return { every: String(Math.max(1, minutes / 1440)), unit: "days" };
  }
  if (minutes % 60 === 0) {
    return { every: String(Math.max(1, minutes / 60)), unit: "hours" };
  }
  return { every: String(Math.max(1, minutes)), unit: "minutes" };
}

/**
 * Convert structured schedule { every, unit } back to cadence minutes.
 * @param every - The interval count.
 * @param unit - The time unit.
 * @returns Cadence in minutes.
 */
export function structuredToCadence(every: string, unit: ScheduleUnit): string {
  const normalized = Math.max(1, parseInteger(every, 1));
  if (unit === "days") {
    return String(normalized * 1440);
  }
  if (unit === "hours") {
    return String(normalized * 60);
  }
  return String(normalized);
}

// ─── Status / tone helpers ────────────────────────────────

/**
 * Map automation status to a display tone.
 * @param status - The automation status.
 * @returns Status tone name.
 */
export function automationStatusTone(status: AutomationStatus): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "danger";
}

// ─── Display label helpers ────────────────────────────────

/**
 * Build a human-readable target label from an automation summary.
 * @param automation - Automation summary fields.
 * @returns Target label string.
 */
export function automationTargetLabel(
  automation: Pick<AutomationSummary, "target_task_id" | "target_conversation_id" | "target_inbox_id" | "target_workspace_id">,
): string {
  const parts = [
    automation.target_task_id ? `task ${automation.target_task_id}` : null,
    automation.target_conversation_id ? `conversation ${automation.target_conversation_id}` : null,
    automation.target_inbox_id ? `inbox ${automation.target_inbox_id}` : null,
    automation.target_workspace_id ? `workspace ${automation.target_workspace_id}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "no target";
}

/**
 * Build a human-readable outcome label from an automation summary.
 * @param automation - Automation summary fields.
 * @returns Outcome label string.
 */
export function automationOutcomeLabel(
  automation: Pick<AutomationSummary, "last_notification_id" | "last_reminder_id" | "last_task_id">,
): string {
  if (automation.last_notification_id) {
    return `notification ${automation.last_notification_id}`;
  }
  if (automation.last_reminder_id) {
    return `reminder ${automation.last_reminder_id}`;
  }
  if (automation.last_task_id) {
    return `task ${automation.last_task_id}`;
  }
  return "none yet";
}

/**
 * Check whether an automation has potential external delivery effect.
 * @param automation - Automation summary fields.
 * @returns True if an external effect is possible.
 */
export function automationHasExternalEffect(
  automation: Pick<AutomationSummary, "action_kind" | "channel_id" | "fallback_channel_id" | "preview_required">,
): boolean {
  return automation.action_kind === "create_notification"
    || Boolean(automation.channel_id || automation.fallback_channel_id || automation.preview_required === false);
}

// ─── Payload builder ──────────────────────────────────────

/**
 * Build an API-compatible automation payload from either create or edit form.
 * @param form - The form values (create or edit).
 * @returns API payload object.
 */
export function buildAutomationPayload(
  form: AutomationCreateForm | AutomationEditForm,
): Record<string, unknown> {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    cadence_minutes: parseInteger(form.cadenceMinutes, 60),
    next_run_at: form.nextRunAt.trim(),
    target_task_id: normalizeOptional(form.targetTaskId),
    target_conversation_id: normalizeOptional(form.targetConversationId),
    target_inbox_id: normalizeOptional(form.targetInboxId),
    target_workspace_id: normalizeOptional(form.targetWorkspaceId),
    channel_id: normalizeOptional(form.channelId),
    fallback_channel_id: normalizeOptional(form.fallbackChannelId),
    preview_required: form.previewRequired === "yes",
    task_template_title: normalizeOptional(form.taskTemplateTitle),
    task_template_summary: normalizeOptional(form.taskTemplateSummary),
    notification_title: normalizeOptional(form.notificationTitle),
    notification_body: normalizeOptional(form.notificationBody),
    metadata: parseJsonObject(form.metadataJson, "Automation metadata"),
  };
}
