/**
 * Workspaces feature — types, form states, and constants.
 *
 * @packageDocumentation
 */

import type {
  WorkspaceHandoffStatus,
  WorkspacePreviewStatus,
  WorkspaceReviewStatus,
  WorkspaceStatus,
} from "../../api/domain/workspaces";

// ─── Load / drawer state types ────────────────────────────────────────────

/** Standard data-fetching load state. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Drawer open/closed mode. */
export type DrawerMode = "closed" | "create" | "edit";

/** Workspace action state. */
export type WorkspaceActionState = "available" | "not_ready" | "waiting" | "done";

/** Workspace action key. */
export type WorkspaceActionKey =
  | "start_preview"
  | "request_review"
  | "prepare_handoff"
  | "review_in_progress"
  | "handoff_ready"
  | "handoff_delivered"
  | "archived";

/** Workspace action descriptor. */
export type WorkspaceAction = {
  key: WorkspaceActionKey;
  label: string;
  state: WorkspaceActionState;
  reason: string;
  payload?: Record<string, unknown>;
};

// ─── Form types ───────────────────────────────────────────────────────────

/** Create workspace form values. */
export type CreateWorkspaceForm = {
  workspaceId: string;
  issueId: string;
  title: string;
  summary: string;
  ownerId: string;
  activeRunId: string;
  latestApprovalId: string;
  prReference: string;
  handoffReference: string;
  previewStatus: WorkspacePreviewStatus;
  reviewStatus: WorkspaceReviewStatus;
  handoffStatus: WorkspaceHandoffStatus;
  metadataJson: string;
};

/** Edit workspace form values. */
export type EditWorkspaceForm = {
  title: string;
  summary: string;
  issueId: string;
  ownerId: string;
  activeRunId: string;
  latestApprovalId: string;
  prReference: string;
  handoffReference: string;
  previewStatus: WorkspacePreviewStatus;
  reviewStatus: WorkspaceReviewStatus;
  handoffStatus: WorkspaceHandoffStatus;
  metadataJson: string;
  eventNote: string;
};

// ─── Constants ────────────────────────────────────────────────────────────

/** Form ID for the workspace drawer. */
export const DRAWER_FORM_ID = "workspace-drawer-form";

/** Status filter options including "all". */
export const STATUS_OPTIONS: Array<WorkspaceStatus | "all"> = [
  "all",
  "draft",
  "previewing",
  "in_review",
  "handoff_ready",
  "handed_off",
  "archived",
];

/** Default create workspace form. */
export const DEFAULT_CREATE_FORM: CreateWorkspaceForm = {
  workspaceId: "",
  issueId: "",
  title: "",
  summary: "",
  ownerId: "",
  activeRunId: "",
  latestApprovalId: "",
  prReference: "",
  handoffReference: "",
  previewStatus: "draft",
  reviewStatus: "not_requested",
  handoffStatus: "not_ready",
  metadataJson: "{}",
};

/** Default edit workspace form. */
export const DEFAULT_EDIT_FORM: EditWorkspaceForm = {
  title: "",
  summary: "",
  issueId: "",
  ownerId: "",
  activeRunId: "",
  latestApprovalId: "",
  prReference: "",
  handoffReference: "",
  previewStatus: "draft",
  reviewStatus: "not_requested",
  handoffStatus: "not_ready",
  metadataJson: "{}",
  eventNote: "",
};
