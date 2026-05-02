/**
 * Knowledge Sources feature module types — form types, constants, label maps, and default values.
 *
 * @packageDocumentation
 */

import type {
  KnowledgeSourceKind,
  KnowledgeSourceStatus,
  VisibilityScope,
} from "../../api/domain";

// ─── Form types ──────────────────────────────────────────────────────────────

/**
 * Create knowledge source form — guided creation flow values.
 */
export interface CreateKnowledgeSourceForm {
  /** Optional custom source ID (e.g. "source_mail_primary"). */
  sourceId: string;
  /** Source type (mail, calendar, contacts, drive, knowledge_base). */
  sourceKind: KnowledgeSourceKind;
  /** Human-readable display label. */
  label: string;
  /** One-line description of the source. */
  description: string;
  /** Connector target (e.g. imap://..., drive://...). */
  connectionTarget: string;
  /** Lifecycle status. */
  status: KnowledgeSourceStatus;
  /** Visibility scope for the source. */
  visibilityScope: VisibilityScope;
  /** Connector account identity. */
  connectorAccount: string;
  /** Connector collection / folder / namespace. */
  connectorCollection: string;
  /** What should be indexed. */
  indexMode: string;
  /** How this source is used in recall. */
  recallClass: string;
  /** Scope note describing the knowledge boundary. */
  scopeNote: string;
  /** Suggested repair action. */
  errorNextStep: string;
  /** Last sync timestamp (operator-supplied for initial state). */
  lastSyncedAt: string;
  /** Last error message (operator-supplied). */
  lastError: string;
  /** Advanced metadata JSON (collapsed by default). */
  advancedMetadataJson: string;
}

/**
 * Edit knowledge source form values (mirrors create without sourceId).
 */
export interface EditKnowledgeSourceForm {
  sourceKind: KnowledgeSourceKind;
  label: string;
  description: string;
  connectionTarget: string;
  status: KnowledgeSourceStatus;
  visibilityScope: VisibilityScope;
  connectorAccount: string;
  connectorCollection: string;
  indexMode: string;
  recallClass: string;
  scopeNote: string;
  errorNextStep: string;
  lastSyncedAt: string;
  lastError: string;
  advancedMetadataJson: string;
}

// ─── Summary counts ──────────────────────────────────────────────────────────

/**
 * Derived summary counts from the knowledge source list.
 */
export interface KnowledgeSourceSummaryCounts {
  /** Total number of sources. */
  total: number;
  /** Number of active sources. */
  active: number;
  /** Number of paused sources. */
  paused: number;
  /** Number of sources with sync errors. */
  error: number;
  /** Total indexed objects across all sources. */
  indexedObjects: number;
  /** Number of sources requiring attention. */
  attention: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Source kind filter options including "all". */
export const SOURCE_KIND_OPTIONS: readonly (KnowledgeSourceKind | "all")[] = [
  "all", "mail", "calendar", "contacts", "drive", "knowledge_base",
] as const;

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (KnowledgeSourceStatus | "all")[] = [
  "all", "active", "paused", "error",
] as const;

/** Visibility scope options. */
export const VISIBILITY_OPTIONS: readonly VisibilityScope[] = [
  "instance", "team", "personal", "restricted",
] as const;

/** Create flow step labels. */
export const CREATE_STEP_LABELS: Record<number, string> = {
  1: "Source type",
  2: "Connector details",
  3: "Visibility and scope",
  4: "Indexing behavior",
  5: "Recall usage",
  6: "Review and create",
  7: "Advanced metadata",
};

// ─── Human-readable labels ───────────────────────────────────────────────────

/** Human-readable labels for source kind values. */
export const SOURCE_KIND_LABELS: Record<KnowledgeSourceKind | "all", string> = {
  all: "All source types",
  mail: "Mail",
  calendar: "Calendar",
  contacts: "Contacts",
  drive: "Drive / files",
  knowledge_base: "Knowledge base",
};

/** Human-readable labels for status values. */
export const STATUS_LABELS: Record<KnowledgeSourceStatus | "all", string> = {
  all: "All statuses",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

/** Human-readable labels for visibility scope values. */
export const VISIBILITY_LABELS: Record<VisibilityScope, string> = {
  instance: "Instance scope",
  team: "Team scope",
  personal: "Personal",
  restricted: "Restricted",
};

// ─── Source kind config (connector-specific field labels and hints) ──────────

/**
 * Connector-specific field configuration per source type.
 */
export interface SourceKindConfig {
  /** Label for the connection target field. */
  targetLabel: string;
  /** Hint text explaining the connection target. */
  targetHint: string;
  /** Placeholder for the connection target field. */
  targetPlaceholder: string;
  /** Label for the connector account field. */
  accountLabel: string;
  /** Placeholder for the connector account field. */
  accountPlaceholder: string;
  /** Label for the collection / folder field. */
  collectionLabel: string;
  /** Placeholder for the collection field. */
  collectionPlaceholder: string;
}

/** Connector-specific field config indexed by source kind. */
export const SOURCE_KIND_CONFIG: Record<KnowledgeSourceKind, SourceKindConfig> = {
  mail: {
    targetLabel: "Mailbox or inbox path",
    targetHint: "Point this source at the real mailbox or ingest alias that powers recall. Sync still happens outside this page.",
    targetPlaceholder: "imap://mail.example.com/inbox",
    accountLabel: "Mailbox account",
    accountPlaceholder: "ops@example.com",
    collectionLabel: "Folder / label",
    collectionPlaceholder: "INBOX/Customers",
  },
  calendar: {
    targetLabel: "Calendar target",
    targetHint: "Use the concrete calendar feed or room calendar this source reflects.",
    targetPlaceholder: "calendar://team-primary",
    accountLabel: "Calendar account",
    accountPlaceholder: "calendar@example.com",
    collectionLabel: "Calendar / window",
    collectionPlaceholder: "Primary calendar",
  },
  contacts: {
    targetLabel: "Directory target",
    targetHint: "This should name the upstream contact directory or CRM projection behind source recall.",
    targetPlaceholder: "contacts://crm/global",
    accountLabel: "Directory account",
    accountPlaceholder: "crm-service-account",
    collectionLabel: "List / segment",
    collectionPlaceholder: "Enterprise customers",
  },
  drive: {
    targetLabel: "Library target",
    targetHint: "Point at the file corpus or library this source indexes for recall.",
    targetPlaceholder: "drive://shared/pricing",
    accountLabel: "Drive account",
    accountPlaceholder: "drive-sync@example.com",
    collectionLabel: "Root folder",
    collectionPlaceholder: "/pricing",
  },
  knowledge_base: {
    targetLabel: "Knowledge target",
    targetHint: "Use the concrete corpus, collection, or namespace that powers durable recall.",
    targetPlaceholder: "kb://pricing-playbook",
    accountLabel: "Connector identity",
    accountPlaceholder: "kb-sync-service",
    collectionLabel: "Collection / namespace",
    collectionPlaceholder: "pricing-playbook",
  },
};

// ─── Default form values ─────────────────────────────────────────────────────

/** Default structured metadata fields used in both create and edit forms. */
export const DEFAULT_STRUCTURED_FIELDS = {
  label: "",
  description: "",
  connectionTarget: "",
  status: "active" as KnowledgeSourceStatus,
  visibilityScope: "team" as VisibilityScope,
  lastSyncedAt: "",
  lastError: "",
  connectorAccount: "",
  connectorCollection: "",
  indexMode: "",
  recallClass: "",
  scopeNote: "",
  errorNextStep: "",
  advancedMetadataJson: "{}",
};

/** Default create form values. */
export const DEFAULT_CREATE_FORM: CreateKnowledgeSourceForm = {
  sourceId: "",
  sourceKind: "mail" as KnowledgeSourceKind,
  ...DEFAULT_STRUCTURED_FIELDS,
};

/** Default edit form values. */
export const DEFAULT_EDIT_FORM: EditKnowledgeSourceForm = {
  sourceKind: "mail" as KnowledgeSourceKind,
  ...DEFAULT_STRUCTURED_FIELDS,
};
