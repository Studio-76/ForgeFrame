import type {
  AgentSummary,
  SkillActivationRecord,
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
  SkillUsageOutcome,
} from "../../api/domain";
import { buildExecutionReviewPath } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { normalizeOptional, parseJsonObject } from "../../pages/workInteractionPageSupport";
import {
  APPROVAL_LABELS,
  OUTCOME_LABELS,
  PREVIEW_LABELS,
  PROVENANCE_LABELS,
  SCOPE_LABELS,
  STATUS_LABELS,
} from "./types";

/**
 * Format a timestamp string for display, with a fallback value when null/missing.
 * @param value - The timestamp string.
 * @param fallback - Fallback text when value is missing.
 * @returns Formatted timestamp or fallback.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Normalize a text value by trimming whitespace.
 * @param value - The text to normalize.
 * @returns Trimmed text.
 */
export function normalizeText(value: string): string {
  return value.trim();
}

/**
 * Build an inventory page path with an instanceId query parameter.
 * @param path - Base page path.
 * @param instanceId - Instance ID to include.
 * @returns Full URL path.
 */
export function buildInventoryPath(path: string, instanceId: string): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

/**
 * Build a skill detail path with instanceId and skillId query parameters.
 * @param instanceId - The instance ID.
 * @param skillId - The skill ID.
 * @returns Full URL path for the skill.
 */
export function buildSkillPath(instanceId: string, skillId: string): string {
  const search = new URLSearchParams();
  if (instanceId.trim()) {
    search.set("instanceId", instanceId.trim());
  }
  search.set("skillId", skillId);
  return `${CONTROL_PLANE_ROUTES.skills}?${search.toString()}`;
}

/**
 * Build an execution review path for a run within an instance.
 * @param instanceId - The instance ID.
 * @param runId - The run ID.
 * @returns Full execution review URL path.
 */
export function buildRunPath(instanceId: string, runId: string): string {
  return buildExecutionReviewPath({ instanceId, runId });
}

// ─── Human-readable label functions ───────────────────────────────────────

/**
 * Return a human-readable label for a skill status value.
 * @param status - Raw status value.
 * @returns Human-readable label.
 */
export function statusLabel(status: SkillStatus | "all"): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Return a human-readable label for a skill scope value.
 * @param scope - Raw scope value.
 * @returns Human-readable label.
 */
export function scopeLabel(scope: SkillScope | "all"): string {
  return SCOPE_LABELS[scope] ?? scope;
}

/**
 * Return a human-readable label for a provenance kind.
 * @param kind - Raw provenance kind value.
 * @returns Human-readable label.
 */
export function provenanceKindLabel(kind: SkillProvenanceKind): string {
  return PROVENANCE_LABELS[kind] ?? kind;
}

/**
 * Return a human-readable label for a usage outcome.
 * @param outcome - Raw outcome value.
 * @returns Human-readable label.
 */
export function outcomeLabel(outcome: SkillUsageOutcome | null | undefined): string {
  if (!outcome) return "None";
  return OUTCOME_LABELS[outcome] ?? outcome;
}

/**
 * Return a human-readable label for the preview required setting.
 * @param previewRequired - Whether preview is required.
 * @returns Human-readable label.
 */
export function previewLabel(previewRequired: boolean): string {
  return PREVIEW_LABELS[String(previewRequired)] ?? "Unknown";
}

/**
 * Return a human-readable label for an approval posture.
 * @param posture - The approval posture value.
 * @returns Human-readable label.
 */
export function approvalLabel(posture: string): string {
  return APPROVAL_LABELS[posture] ?? posture;
}

// ─── Tone color functions ─────────────────────────────────────────────────

/**
 * Determine the tone color for a skill status pill.
 * @param status - The skill status.
 * @returns Tone color name.
 */
export function statusTone(status: SkillStatus): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "archived") return "danger";
  return "warning";
}

/**
 * Determine the tone color for a usage outcome pill.
 * @param outcome - The usage outcome.
 * @returns Tone color name.
 */
export function outcomeTone(
  outcome: SkillUsageOutcome | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  if (outcome === "success") return "success";
  if (outcome === "blocked") return "warning";
  if (outcome === "error") return "danger";
  return "neutral";
}

/**
 * Determine the tone color for a provenance kind pill.
 * @param kind - The provenance kind.
 * @returns Tone color name.
 */
export function provenanceTone(kind: SkillProvenanceKind): "success" | "warning" | "danger" | "neutral" {
  if (kind === "operator" || kind === "learning" || kind === "memory" || kind === "knowledge_source") {
    return "success";
  }
  if (kind === "plugin") return "warning";
  return "neutral";
}

// ─── Agent / scope helpers ────────────────────────────────────────────────

/**
 * Whether an agent-scoped skill requires a scope agent ID.
 * @param scope - The skill scope.
 * @returns True if scope is "agent".
 */
export function scopeNeedsAgent(scope: SkillScope): boolean {
  return scope === "agent";
}

/**
 * Look up an agent's display name by ID from the agents list.
 * @param agents - List of available agents.
 * @param agentId - The agent ID to look up.
 * @returns Display name or null.
 */
export function getLabeledAgent(
  agents: AgentSummary[],
  agentId: string | null | undefined,
): string | null {
  const match = agents.find((agent) => agent.agent_id === agentId);
  return match?.display_name ?? null;
}

/**
 * Render a label for a skill activation record in a select option.
 * @param activation - The activation record.
 * @returns Label string.
 */
export function activationLabel(activation: SkillActivationRecord): string {
  return `${activation.scope_label} \u00b7 ${activation.status}`;
}

// ─── JSON / form helpers ──────────────────────────────────────────────────

/**
 * Split a record into handled keys and extra (remaining) keys.
 * @param value - The source record.
 * @param handledKeys - Keys already handled.
 * @returns Record with remaining keys only.
 */
export function splitObject(
  value: Record<string, unknown>,
  handledKeys: string[],
): Record<string, unknown> {
  const extra: Record<string, unknown> = { ...value };
  for (const key of handledKeys) {
    delete extra[key];
  }
  return extra;
}

/**
 * Split raw provenance data into a form-compatible provenance object.
 * @param provenance - Raw provenance record.
 * @returns Provenance form values.
 */
export function splitProvenanceForm(provenance: Record<string, unknown>) {
  const learningEventId = typeof provenance.learning_event_id === "string" ? provenance.learning_event_id : "";
  const memoryId = typeof provenance.memory_id === "string" ? provenance.memory_id : "";
  const sourceId = typeof provenance.source_id === "string" ? provenance.source_id : "";
  const pluginName = typeof provenance.plugin_name === "string"
    ? provenance.plugin_name
    : typeof provenance.plugin_id === "string"
      ? provenance.plugin_id
      : "";
  const note = typeof provenance.note === "string" ? provenance.note : "";
  const source = typeof provenance.source === "string" ? provenance.source : "";

  let originKind: SkillProvenanceKind = "unknown";
  if (learningEventId) {
    originKind = "learning";
  } else if (memoryId) {
    originKind = "memory";
  } else if (sourceId) {
    originKind = "knowledge_source";
  } else if (pluginName) {
    originKind = "plugin";
  } else if (source === "operator") {
    originKind = "operator";
  }

  return {
    originKind,
    learningEventId,
    memoryId,
    sourceId,
    pluginName,
    note,
    extraJson: JSON.stringify(
      splitObject(provenance, [
        "learning_event_id",
        "memory_id",
        "source_id",
        "plugin_name",
        "plugin_id",
        "note",
        "source",
      ]),
      null,
      2,
    ),
  };
}

/**
 * Build a provenance payload from a provenance form for API submission.
 * @param form - Provenance form values.
 * @returns Payload record for the API.
 */
export function buildProvenancePayload(
  form: {
    originKind: SkillProvenanceKind;
    learningEventId: string;
    memoryId: string;
    sourceId: string;
    pluginName: string;
    note: string;
    extraJson: string;
  },
): Record<string, unknown> {
  const extra = parseJsonObject(form.extraJson, "Skill provenance extras");
  const payload: Record<string, unknown> = { ...extra };
  const note = normalizeOptional(form.note);
  if (note) {
    payload.note = note;
  }
  if (form.originKind === "operator") {
    payload.source = "operator";
  }
  if (form.originKind === "learning" && normalizeText(form.learningEventId)) {
    payload.learning_event_id = normalizeText(form.learningEventId);
  }
  if (form.originKind === "memory" && normalizeText(form.memoryId)) {
    payload.memory_id = normalizeText(form.memoryId);
  }
  if (form.originKind === "knowledge_source" && normalizeText(form.sourceId)) {
    payload.source_id = normalizeText(form.sourceId);
  }
  if (form.originKind === "plugin" && normalizeText(form.pluginName)) {
    payload.plugin_name = normalizeText(form.pluginName);
  }
  return payload;
}

/**
 * Split raw activation conditions into a form-compatible activation settings object.
 * @param conditions - Raw activation conditions record.
 * @returns Activation settings form values.
 */
export function splitActivationSettings(conditions: Record<string, unknown>) {
  return {
    previewRequired: conditions.preview_required === true,
    channelHint: typeof conditions.channel === "string" ? conditions.channel : "",
    note: typeof conditions.note === "string" ? conditions.note : "",
    extraJson: JSON.stringify(
      splitObject(conditions, ["preview_required", "channel", "note"]),
      null,
      2,
    ),
  };
}

/**
 * Build activation conditions from a settings form for API submission.
 * @param settings - Activation settings form values.
 * @returns Payload record for the API.
 */
export function buildActivationConditions(
  settings: {
    previewRequired: boolean;
    channelHint: string;
    note: string;
    extraJson: string;
  },
): Record<string, unknown> {
  const extra = parseJsonObject(settings.extraJson, "Skill activation extras");
  const payload: Record<string, unknown> = { ...extra };
  if (settings.previewRequired) {
    payload.preview_required = true;
  }
  if (normalizeText(settings.channelHint)) {
    payload.channel = normalizeText(settings.channelHint);
  }
  if (normalizeText(settings.note)) {
    payload.note = normalizeText(settings.note);
  }
  return payload;
}

/**
 * Build usage details from a usage form for API submission.
 * @param form - Usage form values.
 * @returns Payload record for the API.
 */
export function buildUsageDetails(
  form: {
    decision: string;
    note: string;
    detailsJson: string;
  },
): Record<string, unknown> {
  const extra = parseJsonObject(form.detailsJson, "Skill usage details");
  const payload: Record<string, unknown> = { ...extra };
  if (normalizeText(form.decision)) {
    payload.decision = normalizeText(form.decision);
  }
  if (normalizeText(form.note)) {
    payload.note = normalizeText(form.note);
  }
  return payload;
}

/**
 * Validate that agent-scoped skills have a scope agent selected.
 * @param scope - The skill scope.
 * @param scopeAgentId - The selected scope agent ID.
 * @returns Error message or null if valid.
 */
export function validateScopedAgent(scope: SkillScope, scopeAgentId: string): string | null {
  if (scopeNeedsAgent(scope) && !normalizeText(scopeAgentId)) {
    return "Agent-scoped skills require a scope agent.";
  }
  return null;
}
