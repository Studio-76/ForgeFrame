import type {
  AgentSummary,
  SkillActivationRecord,
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
  SkillUsageOutcome,
} from "../../api/admin";
import { buildExecutionReviewPath } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { normalizeOptional, parseJsonObject } from "../../pages/workInteractionPageSupport";

/**
 * Format a timestamp string for display, with a fallback value when null/missing.
 */
export function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Normalize a text value by trimming whitespace.
 */
export function normalizeText(value: string): string {
  return value.trim();
}

/**
 * Build an inventory page path with an instanceId query parameter.
 */
export function buildInventoryPath(path: string, instanceId: string): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

/**
 * Build a skill detail path with instanceId and skillId query parameters.
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
 */
export function buildRunPath(instanceId: string, runId: string): string {
  return buildExecutionReviewPath({ instanceId, runId });
}

/**
 * Determine the tone color for a skill status pill.
 */
export function statusTone(status: SkillStatus): "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }
  if (status === "archived") {
    return "danger";
  }
  return "warning";
}

/**
 * Determine the tone color for a usage outcome pill.
 */
export function outcomeTone(
  outcome: SkillUsageOutcome | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  if (outcome === "success") {
    return "success";
  }
  if (outcome === "blocked") {
    return "warning";
  }
  if (outcome === "error") {
    return "danger";
  }
  return "neutral";
}

/**
 * Determine the tone color for a provenance kind pill.
 */
export function provenanceTone(
  kind: SkillProvenanceKind,
): "success" | "warning" | "danger" | "neutral" {
  if (kind === "operator" || kind === "learning" || kind === "memory" || kind === "knowledge_source") {
    return "success";
  }
  if (kind === "plugin") {
    return "warning";
  }
  return "neutral";
}

/**
 * Whether an agent-scoped skill requires a scope agent ID.
 */
export function scopeNeedsAgent(scope: SkillScope): boolean {
  return scope === "agent";
}

/**
 * Look up an agent's display name by ID from the agents list.
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
 */
export function activationLabel(activation: SkillActivationRecord): string {
  return `${activation.scope_label} · ${activation.status}`;
}

/**
 * Render a label for a usage outcome.
 */
export function outcomeLabel(outcome: SkillUsageOutcome | null | undefined): string {
  return outcome ?? "none";
}

/**
 * Split a record into handled keys and extra (remaining) keys.
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
 * Returns an error message or null.
 */
export function validateScopedAgent(scope: SkillScope, scopeAgentId: string): string | null {
  if (scopeNeedsAgent(scope) && !normalizeText(scopeAgentId)) {
    return "Agent-scoped skills require a scope agent.";
  }
  return null;
}
