/**
 * Utility functions for the Memory feature module.
 *
 * @packageDocumentation
 */

import type {
  MemoryDetail,
  MemoryLayer,
  MemorySensitivity,
  MemorySourceTrustClass,
  MemorySummary,
} from "../../api/domain/memory";
import type { VisibilityScope } from "../../api/domain/contacts";
import { parseJsonObject } from "../../pages/workInteractionPageSupport";
import type { MemoryCategoryKey } from "./types";

/**
 * Format a timestamp value with a fallback.
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
 * Normalize an optional string value.
 * @param value - The value to normalize.
 * @returns The trimmed value or null.
 */
export function normalizeOptional(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }
  return value.trim();
}

/**
 * Check if a memory entry is retired (corrected, deleted, revoked, superseded).
 * @param memory - The memory summary.
 * @returns Whether the memory is retired.
 */
export function isRetiredMemory(memory: MemorySummary): boolean {
  return (
    memory.status === "corrected" ||
    memory.status === "deleted" ||
    memory.truth_state === "revoked" ||
    memory.truth_state === "superseded" ||
    memory.truth_state === "deleted"
  );
}

/**
 * Classify a memory entry into a category.
 * @param memory - The memory summary.
 * @returns The category key.
 */
export function classifyMemory(memory: MemorySummary): MemoryCategoryKey {
  if (isRetiredMemory(memory)) {
    return "revoked";
  }
  if (memory.memory_layer === "boot") {
    return "boot";
  }
  if (memory.memory_layer === "working") {
    return "working";
  }
  return "durable";
}

/**
 * Get the usage summary string for a memory entry.
 * @param memory - The memory summary.
 * @returns Human-readable usage summary.
 */
export function usageSummary(memory: MemorySummary): string {
  return `${memory.usage.runs} run${memory.usage.runs === 1 ? "" : "s"} · ${memory.usage.conversations} conversation${memory.usage.conversations === 1 ? "" : "s"} · ${memory.usage.skills} skill${memory.usage.skills === 1 ? "" : "s"}`;
}

/**
 * Cast a value to a record.
 * @param value - The value to cast.
 * @returns The value as a record or null.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Read a string value from an unknown source.
 * @param value - The value.
 * @returns The string value or empty string.
 */
function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Clone a metadata record.
 * @param metadata - The metadata to clone.
 * @returns A deep clone.
 */
function cloneMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

/**
 * Clean up null/undefined/empty values from a section.
 * @param section - The section to clean.
 * @param keys - Keys to check.
 */
function cleanupSection(
  section: Record<string, unknown>,
  keys: string[],
): void {
  keys.forEach((key) => {
    const value = section[key];
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      delete section[key];
    }
  });
}

/**
 * Split memory metadata into structured fields and advanced JSON.
 * @param detail - The memory detail.
 * @returns Parsed metadata components.
 */
export function splitMemoryMetadata(detail: MemoryDetail): {
  memoryLayer: MemoryLayer;
  reviewAt: string;
  reviewNote: string;
  advancedMetadataJson: string;
} {
  const advanced = cloneMetadata(detail.metadata);
  const review = asRecord(advanced.review) ?? {};
  const memoryBlock = asRecord(advanced.memory) ?? {};

  const memoryLayer = (
    readString(
      advanced.memory_tier ||
        memoryBlock.tier ||
        advanced.memory_layer,
    ).trim() as MemoryLayer
  ) || detail.memory_layer;
  const reviewAt = readString(
    review.review_at || review.at || advanced.review_at,
  ).trim();
  const reviewNote = readString(
    review.note || advanced.review_note,
  ).trim();

  delete review.review_at;
  delete review.at;
  delete review.note;
  cleanupSection(review, Object.keys(review));
  if (Object.keys(review).length === 0) {
    delete advanced.review;
  } else {
    advanced.review = review;
  }
  delete advanced.review_at;
  delete advanced.review_note;

  delete advanced.memory_tier;
  delete advanced.memory_layer;
  delete memoryBlock.tier;
  cleanupSection(memoryBlock, Object.keys(memoryBlock));
  if (Object.keys(memoryBlock).length === 0) {
    delete advanced.memory;
  } else {
    advanced.memory = memoryBlock;
  }

  return {
    memoryLayer,
    reviewAt,
    reviewNote,
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

/**
 * Build memory metadata from form fields.
 * @param form - The form with metadata fields.
 * @returns Metadata record.
 */
export function buildMemoryMetadata(form: {
  memoryLayer: MemoryLayer;
  reviewAt: string;
  reviewNote: string;
  advancedMetadataJson: string;
}): Record<string, unknown> {
  const metadata = parseJsonObject(
    form.advancedMetadataJson,
    "Memory advanced metadata",
  );
  metadata.memory_tier = form.memoryLayer;

  const review = { ...(asRecord(metadata.review) ?? {}) };
  if (normalizeOptional(form.reviewAt)) {
    review.review_at = form.reviewAt.trim();
  }
  if (normalizeOptional(form.reviewNote)) {
    review.note = form.reviewNote.trim();
  }
  cleanupSection(review, Object.keys(review));
  if (Object.keys(review).length > 0) {
    metadata.review = review;
  } else {
    delete metadata.review;
  }

  return metadata;
}

/**
 * Validate memory governance form fields.
 * @param form - The form fields.
 * @returns Error message or null if valid.
 */
export function validateMemoryGovernance(form: {
  title: string;
  body: string;
  memoryLayer: MemoryLayer;
  sourceTrustClass: MemorySourceTrustClass;
  visibilityScope: VisibilityScope;
  sensitivity: MemorySensitivity;
  reviewAt: string;
  learnedFromEventId?: string;
  conversationId?: string;
  taskId?: string;
  notificationId?: string;
  workspaceId?: string;
}): string | null {
  if (!form.title.trim()) {
    return "Memory title cannot be empty.";
  }
  if (!form.body.trim()) {
    return "Memory body cannot be empty.";
  }
  if (form.visibilityScope === "restricted" && form.sensitivity === "normal") {
    return "Restricted memory must use sensitive or restricted sensitivity.";
  }
  if (
    form.memoryLayer === "working" &&
    !normalizeOptional(form.conversationId ?? "") &&
    !normalizeOptional(form.taskId ?? "") &&
    !normalizeOptional(form.notificationId ?? "") &&
    !normalizeOptional(form.workspaceId ?? "")
  ) {
    return "Working-context memory must stay linked to a conversation, task, notification, or workspace.";
  }
  if (
    form.memoryLayer === "boot" &&
    !normalizeOptional(form.learnedFromEventId ?? "")
  ) {
    return "Boot memory candidates must stay linked to a learning event.";
  }
  if (
    form.memoryLayer === "durable" &&
    (form.sourceTrustClass === "runtime_inferred" ||
      form.sourceTrustClass === "external_unverified") &&
    !normalizeOptional(form.reviewAt)
  ) {
    return "Durable memory with runtime-inferred or external-unverified trust requires a scheduled review date.";
  }
  return null;
}

/**
 * Review state tone helper.
 * @param state - The review state.
 * @returns Tone for pill styling.
 */
export function reviewTone(
  state: string,
): "success" | "warning" | "danger" {
  if (state === "scheduled" || state === "not_required") {
    return "success";
  }
  if (state === "required") {
    return "warning";
  }
  return "danger";
}

/**
 * Lifecycle tone for a memory entry.
 * @param memory - The memory summary.
 * @returns Tone for pill styling.
 */
export function lifecycleTone(
  memory: MemorySummary,
): "success" | "warning" | "danger" {
  if (
    memory.status === "deleted" ||
    memory.truth_state === "revoked" ||
    memory.truth_state === "deleted"
  ) {
    return "danger";
  }
  if (
    memory.truth_state === "superseded" ||
    memory.status === "corrected" ||
    memory.review.state === "required" ||
    memory.review.state === "overdue"
  ) {
    return "warning";
  }
  return "success";
}

/**
 * Build a path with instanceId for inventory navigation.
 * @param path - The base path.
 * @param instanceId - The instance ID.
 * @returns Path with instanceId query param.
 */
export function buildInventoryPath(
  path: string,
  instanceId: string,
): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

/**
 * Build a skill path with instance ID and skill ID.
 * @param instanceId - The instance ID.
 * @param skillId - The skill ID.
 * @returns Full skill path.
 */
export function buildSkillPath(
  instanceId: string,
  skillId: string,
): string {
  const search = new URLSearchParams();
  if (instanceId.trim()) {
    search.set("instanceId", instanceId.trim());
  }
  search.set("skillId", skillId);
  return `/skills?${search.toString()}`;
}
