/**
 * Utility functions for the Learning feature module.
 *
 * @packageDocumentation
 */

import type {
  LearningDecision,
  LearningDecisionLane,
  LearningProposalSurface,
  LearningOutcomeSurface,
  LearningReviewBucket,
  LearningRiskLevel,
  LearningEventSummary,
} from "../../api/domain/learning";
import type { MemoryKind, MemorySourceTrustClass } from "../../api/domain/memory";
import type { VisibilityScope } from "../../api/domain/contacts";
import type { MemorySensitivity } from "../../api/domain/memory";
import type { SkillScope } from "../../api/domain/skills";

/**
 * Format a timestamp value with a fallback string.
 * @param value - The timestamp string.
 * @param fallback - Fallback text when value is empty.
 * @returns Formatted timestamp string.
 */
export function formatTimestamp(
  value: string | null | undefined,
  fallback = "Not recorded",
): string {
  return value && value.trim() ? value : fallback;
}

/**
 * Normalize a string by trimming whitespace.
 * @param value - The string to normalize.
 * @returns Trimmed string.
 */
export function normalizeText(value: string): string {
  return value.trim();
}

/**
 * Normalize an optional string; returns null for empty/missing values.
 * @param value - The string to normalize.
 * @returns Normalized value or null.
 */
export function normalizeOptional(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

/**
 * Check if a decision targets memory promotion.
 * @param decision - The learning decision.
 * @returns True if decision is memory-related.
 */
export function isMemoryDecision(
  decision: LearningDecision,
): decision is "boot_memory" | "durable_memory" {
  return decision === "boot_memory" || decision === "durable_memory";
}

/**
 * Check if a decision targets skill draft creation.
 * @param decision - The learning decision.
 * @returns True if decision is skill-related.
 */
export function isSkillDecision(
  decision: LearningDecision,
): decision is "skill_draft" {
  return decision === "skill_draft";
}

/**
 * Get the semantic tone for a review bucket.
 * @param bucket - The review bucket.
 * @returns Tone string for styling.
 */
export function bucketTone(
  bucket: LearningReviewBucket,
): "success" | "warning" | "danger" {
  if (bucket === "approved_promoted") {
    return "success";
  }
  if (bucket === "rejected") {
    return "danger";
  }
  return "warning";
}

/**
 * Get the semantic tone for a decision lane.
 * @param lane - The decision lane.
 * @returns Tone string for styling.
 */
export function laneTone(
  lane: LearningDecisionLane,
): "success" | "warning" | "danger" {
  if (lane === "auto_promote" || lane === "auto_draft") {
    return "success";
  }
  if (lane === "auto_reject") {
    return "danger";
  }
  return "warning";
}

/**
 * Get the semantic tone for a risk level.
 * @param level - The risk level.
 * @returns Tone string for styling.
 */
export function riskTone(
  level: LearningRiskLevel,
): "success" | "warning" | "danger" {
  if (level === "low") {
    return "success";
  }
  if (level === "medium") {
    return "warning";
  }
  return "danger";
}

/**
 * Extract a string value from a record by key.
 * @param record - The source record.
 * @param key - The key to look up.
 * @param fallback - Fallback value.
 * @returns The string value or fallback.
 */
export function textFromRecord(
  record: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

/**
 * Extract a nested string value from a record by path.
 * @param record - The source record.
 * @param path - The key path to traverse.
 * @param fallback - Fallback value.
 * @returns The string value or fallback.
 */
export function nestedTextFromRecord(
  record: Record<string, unknown>,
  path: string[],
  fallback = "",
): string {
  let current: unknown = record;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : fallback;
}

/**
 * Find the first non-empty string value from a list of keys in a record.
 * @param record - The source record.
 * @param keys - Keys to try in order.
 * @param fallback - Fallback value.
 * @returns The first non-empty string value.
 */
export function proposalText(
  record: Record<string, unknown>,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

/**
 * Describe the outcome of a learning event.
 * @param event - The learning event summary.
 * @returns Human-readable outcome description.
 */
export function describeOutcome(event: LearningEventSummary): string {
  if (event.outcome.surface === "pending") {
    return "Pending review";
  }
  return event.outcome.target_label;
}

/**
 * Build a memory proposal payload from form state.
 * @param form - Create or decide form state.
 * @param summary - Event summary text.
 * @param explanation - Event explanation text.
 * @returns Memory proposal object.
 */
export function createMemoryProposal(
  form: {
    memoryKind: MemoryKind;
    memoryTitle: string;
    memoryBody: string;
    memoryVisibility: VisibilityScope;
    memorySensitivity: MemorySensitivity;
    memoryTrust: MemorySourceTrustClass;
    memoryReviewAt: string;
    memoryReviewNote: string;
  },
  summary: string,
  explanation: string,
): Record<string, unknown> {
  const reviewAt = normalizeText(form.memoryReviewAt);
  const reviewNote = normalizeText(form.memoryReviewNote);
  const metadata: Record<string, unknown> = {};
  if (reviewAt || reviewNote) {
    metadata.review = {
      ...(reviewAt ? { review_at: reviewAt } : {}),
      ...(reviewNote ? { note: reviewNote } : {}),
    };
  }
  return {
    memory_kind: form.memoryKind,
    title: normalizeText(form.memoryTitle) || summary,
    body: normalizeText(form.memoryBody) || explanation || summary,
    visibility_scope: form.memoryVisibility,
    sensitivity: form.memorySensitivity,
    source_trust_class: form.memoryTrust,
    metadata,
  };
}

/**
 * Build a skill proposal payload from form state.
 * @param form - Create or decide form state.
 * @param summary - Event summary text.
 * @param explanation - Event explanation text.
 * @returns Skill proposal object.
 */
export function createSkillProposal(
  form: {
    skillDisplayName: string;
    skillSummary: string;
    skillScope: SkillScope;
    skillScopeAgentId: string;
    skillInstructionCore: string;
  },
  summary: string,
  explanation: string,
): Record<string, unknown> {
  return {
    display_name: normalizeText(form.skillDisplayName) || summary,
    summary: normalizeText(form.skillSummary) || explanation || summary,
    scope: form.skillScope,
    scope_agent_id: normalizeOptional(form.skillScopeAgentId),
    instruction_core:
      normalizeText(form.skillInstructionCore) || explanation || summary,
  };
}

/**
 * Convert evidence record to display entries.
 * @param evidence - Raw evidence record.
 * @returns Array of key-value display entries.
 */
export function evidenceEntries(
  evidence: Record<string, unknown>,
): Array<{ key: string; value: string }> {
  return Object.entries(evidence).map(([key, value]) => {
    if (value == null) {
      return { key, value: "not recorded" };
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return { key, value: String(value) };
    }
    return { key, value: JSON.stringify(value) };
  });
}

/**
 * Validate memory promotion constraints.
 * @param decision - The decision to validate.
 * @param visibility - Memory visibility scope.
 * @param sensitivity - Memory sensitivity level.
 * @param trust - Memory source trust class.
 * @param reviewAt - Optional review date.
 * @returns Error message string, or null if valid.
 */
export function validateMemoryPromotion(
  decision: LearningDecision,
  visibility: VisibilityScope,
  sensitivity: MemorySensitivity,
  trust: MemorySourceTrustClass,
  reviewAt: string,
): string | null {
  if (!isMemoryDecision(decision)) {
    return null;
  }
  if (visibility === "restricted" && sensitivity === "normal") {
    return "Restricted memory promotion requires sensitive or restricted sensitivity.";
  }
  if (
    decision === "durable_memory" &&
    trust !== "human_verified" &&
    !normalizeText(reviewAt)
  ) {
    return "Durable memory promoted from runtime-inferred or external-unverified trust requires a review date.";
  }
  return null;
}
