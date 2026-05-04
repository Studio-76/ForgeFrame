/**
 * Knowledge Sources feature module utility functions.
 *
 * @packageDocumentation
 */

import type { KnowledgeSourceDetail, KnowledgeSourceKind } from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import {
  buildContactPath as buildContactPathCanonical,
  buildMemoryPath as buildMemoryPathCanonical,
  buildConversationPath as buildConversationPathCanonical,
} from "../../app/workInteractionRoutes";
import {
  normalizeOptional,
  parseJsonObject,
} from "../../pages/workInteractionPageSupport";

// ─── Format helpers ──────────────────────────────────────────────────────────

/**
 * Format a timestamp for display with a fallback when the value is missing.
 * @param value - Raw timestamp string.
 * @param fallback - Fallback text (default "Not recorded").
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

// ─── Path builders ───────────────────────────────────────────────────────────

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
 * @param instanceId - Instance ID.
 * @param skillId - Skill ID.
 * @returns Full skill detail URL.
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
 * Build a contacts path for a specific contact within an instance.
 * Delegates to the canonical version in workInteractionRoutes.
 * @param params - Object with instanceId and contactId.
 * @returns Full contact detail URL.
 */
export function buildContactPath(params: { instanceId: string; contactId: string }): string {
  return buildContactPathCanonical({ instanceId: params.instanceId, contactId: params.contactId });
}

/**
 * Build a memory path for a specific memory entry within an instance.
 * Delegates to the canonical version in workInteractionRoutes.
 * @param params - Object with instanceId and memoryId.
 * @returns Full memory detail URL.
 */
export function buildMemoryPath(params: { instanceId: string; memoryId: string }): string {
  return buildMemoryPathCanonical({ instanceId: params.instanceId, memoryId: params.memoryId });
}

/**
 * Build a conversation path for a specific conversation within an instance.
 * Delegates to the canonical version in workInteractionRoutes.
 * @param params - Object with instanceId and conversationId.
 * @returns Full conversation detail URL.
 */
export function buildConversationPath(params: { instanceId: string; conversationId: string }): string {
  return buildConversationPathCanonical({ instanceId: params.instanceId, conversationId: params.conversationId });
}

// ─── Tone / color helpers ─────────────────────────────────────────────────────

/**
 * Get the tone color for a knowledge source status.
 * @param status - The source status.
 * @returns Tone color name.
 */
export function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "danger";
}

/**
 * Get the tone color for a sync state.
 * @param state - The sync state.
 * @returns Tone color name.
 */
export function syncTone(state: string): "success" | "warning" | "danger" {
  if (state === "synced") return "success";
  if (state === "attention_required") return "danger";
  return "warning";
}

// ─── Metadata helpers ────────────────────────────────────────────────────────

/**
 * Check if a value is a plain record (object, not null, not array).
 * @param value - The value to check.
 * @returns The value cast to Record<string, unknown> or null.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Read a string value from unknown, returning empty string fallback.
 * @param value - The value to read.
 * @returns String value or empty string.
 */
function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Deep-clone a metadata record.
 * @param metadata - The metadata to clone.
 * @returns Cloned metadata.
 */
function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

/**
 * Remove empty values from a metadata section.
 * @param section - The metadata section to clean.
 * @param keys - Keys whose empty values should be removed.
 */
function cleanupSection(section: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    const value = section[key];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      delete section[key];
    }
  }
}

/**
 * Split a source detail's metadata into form-usable structured fields.
 * @param detail - The knowledge source detail.
 * @returns Structured field values extracted from metadata.
 */
export function splitSourceMetadata(detail: KnowledgeSourceDetail): {
  connectorAccount: string;
  connectorCollection: string;
  indexMode: string;
  recallClass: string;
  scopeNote: string;
  errorNextStep: string;
  advancedMetadataJson: string;
} {
  const advanced = cloneMetadata(detail.metadata);
  const connector = asRecord(advanced.connector) ?? {};
  const boundary = asRecord(advanced.knowledge_boundary) ?? {};
  const errorGuidance = asRecord(advanced.error_guidance) ?? {};

  const connectorAccount = readString(connector.account || advanced.connector_account).trim();
  const connectorCollection = readString(connector.collection || advanced.collection).trim();
  const indexMode = readString(connector.index_mode || advanced.index_mode).trim();
  const recallClass = readString(boundary.recall_class || advanced.recall_class).trim();
  const scopeNote = readString(boundary.scope_note || advanced.scope_note).trim();
  const errorNextStep = readString(errorGuidance.next_step || advanced.sync_next_step).trim();

  // Clean up connector
  delete connector.account;
  delete connector.collection;
  delete connector.index_mode;
  cleanupSection(connector, Object.keys(connector));
  if (Object.keys(connector).length === 0) {
    delete advanced.connector;
  } else {
    advanced.connector = connector;
  }
  delete advanced.connector_account;
  delete advanced.collection;
  delete advanced.index_mode;

  // Clean up knowledge_boundary
  delete boundary.recall_class;
  delete boundary.scope_note;
  cleanupSection(boundary, Object.keys(boundary));
  if (Object.keys(boundary).length === 0) {
    delete advanced.knowledge_boundary;
  } else {
    advanced.knowledge_boundary = boundary;
  }
  delete advanced.recall_class;
  delete advanced.scope_note;

  // Clean up error_guidance
  delete errorGuidance.next_step;
  cleanupSection(errorGuidance, Object.keys(errorGuidance));
  if (Object.keys(errorGuidance).length === 0) {
    delete advanced.error_guidance;
  } else {
    advanced.error_guidance = errorGuidance;
  }
  delete advanced.sync_next_step;

  return {
    connectorAccount,
    connectorCollection,
    indexMode,
    recallClass,
    scopeNote,
    errorNextStep,
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

/**
 * Build metadata payload from form values for API submission.
 * @param form - Form values with metadata fields.
 * @returns Metadata record for the API.
 */
export function buildSourceMetadata(
  form: {
    connectorAccount: string;
    connectorCollection: string;
    indexMode: string;
    recallClass: string;
    scopeNote: string;
    errorNextStep: string;
    advancedMetadataJson: string;
  },
): Record<string, unknown> {
  const metadata = parseJsonObject(form.advancedMetadataJson, "Knowledge-source advanced metadata");
  const connector = { ...(asRecord(metadata.connector) ?? {}) };
  const knowledgeBoundary = { ...(asRecord(metadata.knowledge_boundary) ?? {}) };
  const errorGuidance = { ...(asRecord(metadata.error_guidance) ?? {}) };
  delete metadata.connector;
  delete metadata.knowledge_boundary;
  delete metadata.error_guidance;

  if (normalizeOptional(form.connectorAccount)) {
    connector.account = form.connectorAccount.trim();
  }
  if (normalizeOptional(form.connectorCollection)) {
    connector.collection = form.connectorCollection.trim();
  }
  if (normalizeOptional(form.indexMode)) {
    connector.index_mode = form.indexMode.trim();
  }
  cleanupSection(connector, Object.keys(connector));
  if (Object.keys(connector).length > 0) {
    metadata.connector = connector;
  }

  if (normalizeOptional(form.recallClass)) {
    knowledgeBoundary.recall_class = form.recallClass.trim();
  }
  if (normalizeOptional(form.scopeNote)) {
    knowledgeBoundary.scope_note = form.scopeNote.trim();
  }
  cleanupSection(knowledgeBoundary, Object.keys(knowledgeBoundary));
  if (Object.keys(knowledgeBoundary).length > 0) {
    metadata.knowledge_boundary = knowledgeBoundary;
  }

  if (normalizeOptional(form.errorNextStep)) {
    errorGuidance.next_step = form.errorNextStep.trim();
  }
  cleanupSection(errorGuidance, Object.keys(errorGuidance));
  if (Object.keys(errorGuidance).length > 0) {
    metadata.error_guidance = errorGuidance;
  }

  return metadata;
}

// ─── Summary count computation ───────────────────────────────────────────────

import type { KnowledgeSourceSummary } from "../../api/domain";
import type { KnowledgeSourceSummaryCounts } from "./types";

/**
 * Compute summary counts from the knowledge sources list.
 * @param sources - List of source summaries.
 * @returns Derived summary counts.
 */
export function computeSummaryCounts(sources: KnowledgeSourceSummary[]): KnowledgeSourceSummaryCounts {
  let active = 0;
  let paused = 0;
  let error = 0;
  let indexedObjects = 0;
  let attention = 0;

  for (const source of sources) {
    if (source.status === "active") active++;
    else if (source.status === "paused") paused++;
    else if (source.status === "error") error++;

    indexedObjects += source.indexed_objects.contacts;
    indexedObjects += source.indexed_objects.durable_memory;
    indexedObjects += source.indexed_objects.linked_conversations;
    indexedObjects += source.indexed_objects.linked_skills;

    if (source.status === "error" || source.sync.state === "attention_required") {
      attention++;
    }
  }

  return {
    total: sources.length,
    active,
    paused,
    error,
    indexedObjects,
    attention,
  };
}
