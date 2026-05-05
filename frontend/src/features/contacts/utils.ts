/**
 * Contacts feature module utilities — metadata splitting, payload building,
 * tone helpers, path builders, and shared formatters.
 *
 * @packageDocumentation
 */

import type { ContactDetail, ContactRouteStatus, ContactStatus } from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { buildContactPath as buildContactPathCanonical } from "../../app/workInteractionRoutes";
import { normalizeOptional, parseJsonObject } from "../../pages/workInteractionPageSupport";
import type { ContactSummaryCounts, EditContactForm } from "./types";

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
 * Build a contact detail path with instanceId and contactId parameters.
 * Delegates to the canonical version in workInteractionRoutes.
 * @param instanceId - The instance ID.
 * @param contactId - The contact ID.
 * @returns Full URL path for the contact.
 */
export function buildContactPath(instanceId: string, contactId: string): string {
  return buildContactPathCanonical({ instanceId, contactId });
}

/**
 * Compute derived summary counts from the contacts list.
 * @param contacts - List of contact summaries.
 * @returns Computed summary counts.
 */
export function computeSummaryCounts(
  contacts: Array<{ status: ContactStatus; reachable_channel_count: number; channels: unknown[] }>,
): ContactSummaryCounts {
  let reachable = 0;
  let missingConsent = 0;
  let withRoutes = 0;
  let attention = 0;
  let active = 0;
  let snoozed = 0;
  let archived = 0;

  for (const contact of contacts) {
    if (contact.status === "active") active++;
    else if (contact.status === "snoozed") snoozed++;
    else if (contact.status === "archived") archived++;

    if (contact.reachable_channel_count > 0) reachable++;
    if (contact.channels.length > 0) withRoutes++;
    if (contact.status === "active" && contact.reachable_channel_count === 0) attention++;
    if (contact.status === "active" && contact.channels.length === 0) missingConsent++;
  }

  return {
    total: contacts.length,
    reachable,
    missingConsent,
    withRoutes,
    attention,
    active,
    snoozed,
    archived,
  };
}

// ─── Tone helpers ────────────────────────────────────────────────────────────

/**
 * Determine the tone color for a contact status pill.
 * @param status - The contact status.
 * @returns Tone color name.
 */
export function statusTone(status: ContactStatus): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "snoozed") return "warning";
  return "neutral";
}

/**
 * Determine the tone color for a route status pill.
 * @param status - The route status.
 * @returns Tone color name.
 */
export function routeStatusTone(status: ContactRouteStatus): "success" | "warning" | "danger" {
  if (status === "reachable") return "success";
  if (status === "blocked") return "danger";
  return "warning";
}

/**
 * Determine the tone for contact consent posture.
 * @param consentStatus - Raw consent status string.
 * @returns Tone color name.
 */
export function consentTone(consentStatus: string): "success" | "warning" | "danger" | "neutral" {
  const s = consentStatus.toLowerCase();
  if (s === "explicit_opt_in" || s === "implicit") return "success";
  if (s === "opted_out") return "danger";
  return "warning";
}

// ─── Channel inventory label ─────────────────────────────────────────────────

/**
 * Build a compact channel inventory label showing up to 2 routes.
 * @param channels - Array of channel records.
 * @returns Compact label string.
 */
export function channelInventoryLabel(channels: Array<{ kind: string; address: string }>): string {
  if (channels.length === 0) {
    return "No routes recorded";
  }
  const visibleRoutes = channels.slice(0, 2).map((channel) => `${channel.kind}: ${channel.address}`);
  const extraCount = channels.length - visibleRoutes.length;
  return `${visibleRoutes.join(" \u00b7 ")}${extraCount > 0 ? ` \u00b7 +${extraCount} more` : ""}`;
}

// ─── Metadata helpers ────────────────────────────────────────────────────────

/**
 * Safely cast a value to a record if it is a non-null, non-array object.
 * @param value - Value to cast.
 * @returns The value as a record, or null.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Read a string value from an unknown value.
 * @param value - Value to read.
 * @returns String value or empty string.
 */
function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Deep-clone a metadata record.
 * @param metadata - Source metadata.
 * @returns Deep-cloned copy.
 */
function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

/**
 * Normalize and compare email addresses.
 * @param value - Address value.
 * @returns Normalized lowercase string.
 */
function normalizedAddress(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Remove null/undefined/empty entries from a section.
 * @param section - Section to clean.
 * @param keys - Keys to check.
 */
function cleanupSection(section: Record<string, unknown>, keys: string[]) {
  keys.forEach((key) => {
    const value = section[key];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      delete section[key];
    }
  });
}

/**
 * Split a contact detail's metadata into structured form fields
 * and remaining advanced metadata.
 * @param detail - Raw contact detail from the API.
 * @returns Structured form fields with advanced metadata as JSON.
 */
export function splitContactMetadata(detail: ContactDetail): {
  secondaryEmail: string;
  secondaryPhone: string;
  slackHandle: string;
  consentStatus: string;
  consentCapturedAt: string;
  consentNote: string;
  provenanceProvider: string;
  provenanceImportReference: string;
  provenanceImportedAt: string;
  provenanceLastVerifiedAt: string;
  provenanceNote: string;
  visibilityNote: string;
  advancedMetadataJson: string;
} {
  const advanced = cloneMetadata(detail.metadata);
  let secondaryEmail = "";
  let secondaryPhone = "";
  let slackHandle = "";

  const advancedChannels = Array.isArray(advanced.channels) ? advanced.channels : [];
  const remainingChannels: unknown[] = [];

  advancedChannels.forEach((item) => {
    const channel = asRecord(item);
    const kind = readString(channel?.kind ?? channel?.type).trim().toLowerCase();
    const address = readString(channel?.address ?? channel?.value ?? channel?.target ?? channel?.handle).trim();
    if (!channel || !address) {
      remainingChannels.push(item);
      return;
    }
    if (kind === "email" && !secondaryEmail && normalizedAddress(address) !== normalizedAddress(detail.primary_email)) {
      secondaryEmail = address;
      return;
    }
    if (kind === "phone" && !secondaryPhone && normalizedAddress(address) !== normalizedAddress(detail.primary_phone)) {
      secondaryPhone = address;
      return;
    }
    if (kind === "slack" && !slackHandle) {
      slackHandle = address;
      return;
    }
    remainingChannels.push(item);
  });

  if (remainingChannels.length > 0) {
    advanced.channels = remainingChannels;
  } else {
    delete advanced.channels;
  }

  if (!secondaryEmail) {
    secondaryEmail = readString(advanced.secondary_email || advanced.alternate_email).trim();
    delete advanced.secondary_email;
    delete advanced.alternate_email;
  }

  if (!secondaryPhone) {
    secondaryPhone = readString(advanced.secondary_phone || advanced.alternate_phone).trim();
    delete advanced.secondary_phone;
    delete advanced.alternate_phone;
  }

  if (!slackHandle) {
    slackHandle = readString(advanced.slack_handle || advanced.slack_channel).trim();
    delete advanced.slack_handle;
    delete advanced.slack_channel;
  }

  const advancedConsent = asRecord(advanced.consent);
  if (advancedConsent) {
    delete advancedConsent.status;
    delete advancedConsent.state;
    delete advancedConsent.captured_at;
    delete advancedConsent.updated_at;
    delete advancedConsent.note;
    delete advancedConsent.policy_basis;
    cleanupSection(advancedConsent, Object.keys(advancedConsent));
    if (Object.keys(advancedConsent).length === 0) {
      delete advanced.consent;
    } else {
      advanced.consent = advancedConsent;
    }
  }
  delete advanced.consent_status;
  delete advanced.consent_captured_at;
  delete advanced.consent_note;

  const advancedProvenance = asRecord(advanced.provenance);
  if (advancedProvenance) {
    delete advancedProvenance.provider;
    delete advancedProvenance.system;
    delete advancedProvenance.import_reference;
    delete advancedProvenance.external_id;
    delete advancedProvenance.record_id;
    delete advancedProvenance.imported_at;
    delete advancedProvenance.last_verified_at;
    delete advancedProvenance.note;
    delete advancedProvenance.summary;
    cleanupSection(advancedProvenance, Object.keys(advancedProvenance));
    if (Object.keys(advancedProvenance).length === 0) {
      delete advanced.provenance;
    } else {
      advanced.provenance = advancedProvenance;
    }
  }
  delete advanced.source_provider;
  delete advanced.imported_at;
  delete advanced.last_verified_at;
  delete advanced.source_note;

  const advancedVisibility = asRecord(advanced.visibility);
  if (advancedVisibility) {
    delete advancedVisibility.note;
    delete advancedVisibility.summary;
    cleanupSection(advancedVisibility, Object.keys(advancedVisibility));
    if (Object.keys(advancedVisibility).length === 0) {
      delete advanced.visibility;
    } else {
      advanced.visibility = advancedVisibility;
    }
  }
  delete advanced.visibility_note;

  return {
    secondaryEmail,
    secondaryPhone,
    slackHandle,
    consentStatus: detail.consent.status,
    consentCapturedAt: detail.consent.captured_at ?? "",
    consentNote: detail.consent.note ?? "",
    provenanceProvider: detail.provenance.provider ?? "",
    provenanceImportReference: detail.provenance.import_reference ?? "",
    provenanceImportedAt: detail.provenance.imported_at ?? "",
    provenanceLastVerifiedAt: detail.provenance.last_verified_at ?? "",
    provenanceNote: detail.provenance.note ?? "",
    visibilityNote: detail.visibility_note ?? "",
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

/**
 * Build a metadata payload from form values for API submission.
 * @param form - Form values (create or edit).
 * @returns Metadata record for the API.
 */
export function buildContactMetadata(form: { advancedMetadataJson: string; secondaryEmail: string; secondaryPhone: string; slackHandle: string; consentStatus: string; consentCapturedAt: string; consentNote: string; provenanceProvider: string; provenanceImportReference: string; provenanceImportedAt: string; provenanceLastVerifiedAt: string; provenanceNote: string; visibilityNote: string }): Record<string, unknown> {
  const metadata = parseJsonObject(form.advancedMetadataJson, "Contact advanced metadata");
  const channels = Array.isArray(metadata.channels) ? [...metadata.channels] : [];
  delete metadata.channels;

  if (normalizeOptional(form.secondaryEmail)) {
    channels.push({
      kind: "email",
      label: "Secondary email",
      address: form.secondaryEmail.trim(),
      source: "operator",
    });
  }
  if (normalizeOptional(form.secondaryPhone)) {
    channels.push({
      kind: "phone",
      label: "Secondary phone",
      address: form.secondaryPhone.trim(),
      source: "operator",
    });
  }
  if (normalizeOptional(form.slackHandle)) {
    channels.push({
      kind: "slack",
      label: "Slack",
      address: form.slackHandle.trim(),
      source: "operator",
    });
  }
  if (channels.length > 0) {
    metadata.channels = channels;
  }

  const consent = { ...(asRecord(metadata.consent) ?? {}) };
  delete metadata.consent;
  if (normalizeOptional(form.consentStatus)) {
    consent.status = form.consentStatus.trim();
  }
  if (normalizeOptional(form.consentCapturedAt)) {
    consent.captured_at = form.consentCapturedAt.trim();
  }
  if (normalizeOptional(form.consentNote)) {
    consent.note = form.consentNote.trim();
  }
  cleanupSection(consent, Object.keys(consent));
  if (Object.keys(consent).length > 0) {
    metadata.consent = consent;
  }

  const provenance = { ...(asRecord(metadata.provenance) ?? {}) };
  delete metadata.provenance;
  if (normalizeOptional(form.provenanceProvider)) {
    provenance.provider = form.provenanceProvider.trim();
  }
  if (normalizeOptional(form.provenanceImportReference)) {
    provenance.import_reference = form.provenanceImportReference.trim();
  }
  if (normalizeOptional(form.provenanceImportedAt)) {
    provenance.imported_at = form.provenanceImportedAt.trim();
  }
  if (normalizeOptional(form.provenanceLastVerifiedAt)) {
    provenance.last_verified_at = form.provenanceLastVerifiedAt.trim();
  }
  if (normalizeOptional(form.provenanceNote)) {
    provenance.note = form.provenanceNote.trim();
  }
  cleanupSection(provenance, Object.keys(provenance));
  if (Object.keys(provenance).length > 0) {
    metadata.provenance = provenance;
  }

  const visibility = { ...(asRecord(metadata.visibility) ?? {}) };
  delete metadata.visibility;
  if (normalizeOptional(form.visibilityNote)) {
    visibility.note = form.visibilityNote.trim();
  }
  cleanupSection(visibility, Object.keys(visibility));
  if (Object.keys(visibility).length > 0) {
    metadata.visibility = visibility;
  }

  return metadata;
}
