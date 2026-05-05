/**
 * Inbox feature types, constants, and default form values.
 *
 * @packageDocumentation
 */

import type { InboxStatus, TriageStatus, WorkItemPriority } from "../../api/domain/inbox";

// ─── Filter option constants ────────────────────────────────────────────

/** Triage filter options including "all". */
export const TRIAGE_OPTIONS: readonly (TriageStatus | "all")[] = [
  "all", "new", "relevant", "delegated", "blocked", "done",
] as const;

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (InboxStatus | "all")[] = [
  "all", "open", "snoozed", "closed", "archived",
] as const;

/** Priority filter options including "all". */
export const PRIORITY_OPTIONS: readonly (WorkItemPriority | "all")[] = [
  "all", "low", "normal", "high", "critical",
] as const;

/** Source filter options including "all". */
export const SOURCE_OPTIONS = ["all", "manual", "conversation", "workspace", "run", "approval", "artifact"] as const;

/** Inbox source filter derived from SOURCE_OPTIONS. */
export type InboxSourceFilter = (typeof SOURCE_OPTIONS)[number];

// ─── Default form values ───────────────────────────────────────────────

/** Default empty create form. */
export const DEFAULT_CREATE_FORM = {
  inboxId: "",
  conversationId: "",
  threadId: "",
  workspaceId: "",
  title: "",
  summary: "",
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  status: "open" as InboxStatus,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
};

/** Default empty edit form. */
export const DEFAULT_EDIT_FORM = {
  conversationId: "",
  threadId: "",
  workspaceId: "",
  title: "",
  summary: "",
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  status: "open" as InboxStatus,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
};

// ─── Create form type ──────────────────────────────────────────────────

/** Create inbox form values. */
export interface CreateForm {
  inboxId: string;
  conversationId: string;
  threadId: string;
  workspaceId: string;
  title: string;
  summary: string;
  triageStatus: TriageStatus;
  priority: WorkItemPriority;
  status: InboxStatus;
  contactRef: string;
  runId: string;
  artifactId: string;
  approvalId: string;
  decisionId: string;
  metadataJson: string;
}

/** Edit inbox form values. */
export interface EditForm {
  conversationId: string;
  threadId: string;
  workspaceId: string;
  title: string;
  summary: string;
  triageStatus: TriageStatus;
  priority: WorkItemPriority;
  status: InboxStatus;
  contactRef: string;
  runId: string;
  artifactId: string;
  approvalId: string;
  decisionId: string;
  metadataJson: string;
}
