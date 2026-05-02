/**
 * Contacts feature module types — form types, constants, label maps, and default values.
 *
 * @packageDocumentation
 */

import type {
  ContactStatus,
  ContactRouteStatus,
  VisibilityScope,
} from "../../api/domain";

// ─── Form types ──────────────────────────────────────────────────────────────

/**
 * Create contact form values — guided creation flow values.
 */
export interface CreateContactForm {
  /** Optional custom contact ID (e.g. "contact_acme_ops"). */
  contactId: string;
  /** Human-readable display name. */
  displayName: string;
  /** Primary email address. */
  primaryEmail: string;
  /** Primary phone number. */
  primaryPhone: string;
  /** Organization name. */
  organization: string;
  /** Job title. */
  title: string;
  /** Contact lifecycle status. */
  status: ContactStatus;
  /** Visibility scope. */
  visibilityScope: VisibilityScope;
  /** Contact path (replaces "contact ref"). */
  contactRef: string;
  /** Source (replaces "source ID"). */
  sourceId: string;
  /** Consent status label. */
  consentStatus: string;
  /** Consent date (replaces "consent captured at"). */
  consentCapturedAt: string;
  /** Consent note. */
  consentNote: string;
  /** Source provider / provenance provider. */
  provenanceProvider: string;
  /** Import ID (replaces "import reference"). */
  provenanceImportReference: string;
  /** Provenance imported at. */
  provenanceImportedAt: string;
  /** Last verified (replaces "last verified at"). */
  provenanceLastVerifiedAt: string;
  /** Provenance note. */
  provenanceNote: string;
  /** Visibility note. */
  visibilityNote: string;
  /** Secondary email. */
  secondaryEmail: string;
  /** Secondary phone. */
  secondaryPhone: string;
  /** Slack handle. */
  slackHandle: string;
  /** Advanced metadata JSON (collapsed by default). */
  advancedMetadataJson: string;
}

/**
 * Edit contact form values (mirrors create without contactId).
 */
export interface EditContactForm {
  displayName: string;
  primaryEmail: string;
  primaryPhone: string;
  organization: string;
  title: string;
  status: ContactStatus;
  visibilityScope: VisibilityScope;
  contactRef: string;
  sourceId: string;
  consentStatus: string;
  consentCapturedAt: string;
  consentNote: string;
  provenanceProvider: string;
  provenanceImportReference: string;
  provenanceImportedAt: string;
  provenanceLastVerifiedAt: string;
  provenanceNote: string;
  visibilityNote: string;
  secondaryEmail: string;
  secondaryPhone: string;
  slackHandle: string;
  advancedMetadataJson: string;
}

// ─── Summary counts ──────────────────────────────────────────────────────────

/**
 * Derived summary counts from the contact list.
 */
export interface ContactSummaryCounts {
  /** Total number of contacts. */
  total: number;
  /** Number of reachable contacts. */
  reachable: number;
  /** Number of contacts missing consent. */
  missingConsent: number;
  /** Number of contacts with delivery routes. */
  withRoutes: number;
  /** Number of contacts requiring attention. */
  attention: number;
  /** Number of active contacts. */
  active: number;
  /** Number of snoozed contacts. */
  snoozed: number;
  /** Number of archived contacts. */
  archived: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (ContactStatus | "all")[] = [
  "all", "active", "snoozed", "archived",
] as const;

/** Status options available at contact creation time. */
export const CREATE_STATUS_OPTIONS: readonly ContactStatus[] = [
  "active", "snoozed",
] as const;

/** Visibility scope options. */
export const VISIBILITY_OPTIONS: readonly VisibilityScope[] = [
  "instance", "team", "personal", "restricted",
] as const;

/** Create flow step labels. */
export const CREATE_STEP_LABELS: Record<number, string> = {
  1: "Basic identity",
  2: "Reachable routes",
  3: "Consent and visibility",
  4: "Source and provenance",
  5: "Review and create",
  6: "Advanced metadata",
};

// ─── Human-readable labels ───────────────────────────────────────────────────

/** Human-readable labels for contact status values. */
export const STATUS_LABELS: Record<ContactStatus | "all", string> = {
  all: "All statuses",
  active: "Active",
  snoozed: "Snoozed",
  archived: "Archived",
};

/** Human-readable labels for visibility scope values. */
export const VISIBILITY_LABELS: Record<VisibilityScope, string> = {
  instance: "Instance scope",
  team: "Team scope",
  personal: "Personal",
  restricted: "Restricted",
};

/** Human-readable labels for route status values. */
export const ROUTE_STATUS_LABELS: Record<ContactRouteStatus, string> = {
  reachable: "Reachable",
  warning: "Unverified route",
  blocked: "Blocked",
};

/** Human-readable labels for consent status. */
export const CONSENT_LABELS: Record<string, string> = {
  unknown: "Unknown",
  explicit_opt_in: "Consent given",
  opted_out: "Opted out",
  implicit: "Implicit consent",
  not_collected: "Not collected",
};

// ─── Default form values ─────────────────────────────────────────────────────

/** Default structured fields used in both create and edit forms. */
export const DEFAULT_STRUCTURED_FIELDS = {
  displayName: "",
  primaryEmail: "",
  primaryPhone: "",
  organization: "",
  title: "",
  status: "active" as ContactStatus,
  visibilityScope: "team" as VisibilityScope,
  contactRef: "",
  sourceId: "",
  consentStatus: "unknown",
  consentCapturedAt: "",
  consentNote: "",
  provenanceProvider: "",
  provenanceImportReference: "",
  provenanceImportedAt: "",
  provenanceLastVerifiedAt: "",
  provenanceNote: "",
  visibilityNote: "",
  secondaryEmail: "",
  secondaryPhone: "",
  slackHandle: "",
  advancedMetadataJson: "{}",
};

/** Default create form values. */
export const DEFAULT_CREATE_FORM: CreateContactForm = {
  contactId: "",
  ...DEFAULT_STRUCTURED_FIELDS,
};

/** Default edit form values. */
export const DEFAULT_EDIT_FORM: EditContactForm = {
  ...DEFAULT_STRUCTURED_FIELDS,
};
