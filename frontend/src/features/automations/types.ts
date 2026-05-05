/**
 * Automations feature — shared types, form interfaces, and constants.
 *
 * @packageDocumentation
 */

import type {
  AutomationActionKind,
  AutomationStatus,
} from "../../api/domain/automations";

// ── Schedule ──────────────────────────────────────────────

/** Schedule unit for the structured schedule editor. */
export type ScheduleUnit = "minutes" | "hours" | "days";

// ─── Create form ──────────────────────────────────────────

/** Create-automation form values. */
export interface AutomationCreateForm {
  automationId: string;
  title: string;
  summary: string;
  actionKind: AutomationActionKind;
  cadenceMinutes: string;
  nextRunAt: string;
  targetTaskId: string;
  targetConversationId: string;
  targetInboxId: string;
  targetWorkspaceId: string;
  channelId: string;
  fallbackChannelId: string;
  previewRequired: "yes" | "no";
  taskTemplateTitle: string;
  taskTemplateSummary: string;
  notificationTitle: string;
  notificationBody: string;
  metadataJson: string;
}

// ─── Edit form ────────────────────────────────────────────

/** Edit-automation form values. */
export interface AutomationEditForm {
  title: string;
  summary: string;
  status: AutomationStatus;
  cadenceMinutes: string;
  nextRunAt: string;
  targetTaskId: string;
  targetConversationId: string;
  targetInboxId: string;
  targetWorkspaceId: string;
  channelId: string;
  fallbackChannelId: string;
  previewRequired: "yes" | "no";
  taskTemplateTitle: string;
  taskTemplateSummary: string;
  notificationTitle: string;
  notificationBody: string;
  metadataJson: string;
}

// ─── Constants ────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (AutomationStatus | "all")[] = [
  "all",
  "active",
  "paused",
  "archived",
] as const;

/** Available action kind options for creation. */
export const ACTION_KIND_OPTIONS: readonly AutomationActionKind[] = [
  "create_follow_up",
  "create_reminder",
  "create_notification",
] as const;

/** Default empty create-automation form. */
export const DEFAULT_CREATE_FORM: AutomationCreateForm = {
  automationId: "",
  title: "",
  summary: "",
  actionKind: "create_follow_up",
  cadenceMinutes: "60",
  nextRunAt: "",
  targetTaskId: "",
  targetConversationId: "",
  targetInboxId: "",
  targetWorkspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  previewRequired: "yes",
  taskTemplateTitle: "",
  taskTemplateSummary: "",
  notificationTitle: "",
  notificationBody: "",
  metadataJson: "{}",
};

/** Default empty edit-automation form. */
export const DEFAULT_EDIT_FORM: AutomationEditForm = {
  title: "",
  summary: "",
  status: "active",
  cadenceMinutes: "60",
  nextRunAt: "",
  targetTaskId: "",
  targetConversationId: "",
  targetInboxId: "",
  targetWorkspaceId: "",
  channelId: "",
  fallbackChannelId: "",
  previewRequired: "yes",
  taskTemplateTitle: "",
  taskTemplateSummary: "",
  notificationTitle: "",
  notificationBody: "",
  metadataJson: "{}",
};
