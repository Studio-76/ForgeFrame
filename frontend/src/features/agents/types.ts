/**
 * Agents feature — shared types, form interfaces, and constants.
 *
 * @packageDocumentation
 */

import type {
  AgentParticipationMode,
  AgentRoleKind,
  AgentStatus,
} from "../../api/domain/agents";

// ── Drawer mode ───────────────────────────────────────────

/** Agent drawer mode. */
export type DrawerMode = "closed" | "create" | "edit";

// ─── Create form ──────────────────────────────────────────

/** Create-agent form values. */
export interface AgentCreateForm {
  agentId: string;
  displayName: string;
  defaultName: string;
  roleKind: AgentRoleKind;
  status: AgentStatus;
  participationMode: AgentParticipationMode;
  assistantProfileId: string;
  allowedTargets: string;
  isDefaultOperator: "yes" | "no";
  metadataJson: string;
}

// ─── Edit form ────────────────────────────────────────────

/** Edit-agent form values. */
export interface AgentEditForm {
  displayName: string;
  defaultName: string;
  roleKind: AgentRoleKind;
  status: AgentStatus;
  participationMode: AgentParticipationMode;
  assistantProfileId: string;
  allowedTargets: string;
  isDefaultOperator: "yes" | "no";
  metadataJson: string;
}

// ─── Constants ────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (AgentStatus | "all")[] = [
  "all",
  "active",
  "paused",
  "archived",
] as const;

/** Available role kind options. */
export const ROLE_OPTIONS: readonly AgentRoleKind[] = [
  "operator",
  "specialist",
  "reviewer",
  "worker",
  "observer",
] as const;

/** Participation mode options with labels and descriptions. */
export const PARTICIPATION_OPTIONS: readonly {
  value: AgentParticipationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "direct",
    label: "assigned/owner",
    description: "Active participant and owner-capable conversation agent.",
  },
  {
    value: "mentioned_only",
    label: "mentioned-only",
    description: "Mention target only; not offered for ownership or handoff controls.",
  },
  {
    value: "roundtable",
    label: "broadcast participant",
    description: "Eligible for roundtable/broadcast participation and mentions.",
  },
  {
    value: "handoff_only",
    label: "handoff-only",
    description: "Only offered for handoff or blocker-owner routing.",
  },
] as const;

/** Participation modes not supported by the current backend. */
export const UNSUPPORTED_PARTICIPATION_MODES: readonly string[] = ["silent", "subscribed"];

/** HTML form ID for the agent drawer form. */
export const DRAWER_FORM_ID = "agents-drawer-form";

/** Default empty create-agent form. */
export const DEFAULT_CREATE_FORM: AgentCreateForm = {
  agentId: "",
  displayName: "",
  defaultName: "",
  roleKind: "specialist",
  status: "active",
  participationMode: "direct",
  assistantProfileId: "",
  allowedTargets: "",
  isDefaultOperator: "no",
  metadataJson: "{}",
};

/** Default empty edit-agent form. */
export const DEFAULT_EDIT_FORM: AgentEditForm = {
  displayName: "",
  defaultName: "",
  roleKind: "specialist",
  status: "active",
  participationMode: "direct",
  assistantProfileId: "",
  allowedTargets: "",
  isDefaultOperator: "no",
  metadataJson: "{}",
};
