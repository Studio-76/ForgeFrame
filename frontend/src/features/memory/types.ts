/**
 * Constants, labels, and shared types for the Memory feature module.
 *
 * @packageDocumentation
 */

import type {
  MemoryKind,
  MemoryLayer,
  MemorySensitivity,
  MemorySourceTrustClass,
  MemoryStatus,
} from "../../api/domain/memory";
import type { VisibilityScope } from "../../api/domain/contacts";

/** Data loading state. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Memory category key for segmented filter. */
export type MemoryCategoryKey = "durable" | "boot" | "working" | "revoked";

/** Memory category metadata. */
export interface MemoryCategory {
  key: MemoryCategoryKey;
  label: string;
  description: string;
}

/** Memory categories with human-readable labels. */
export const MEMORY_CATEGORIES: MemoryCategory[] = [
  {
    key: "durable",
    label: "Durable memory",
    description: "Long-term governed truth that survives context rotation.",
  },
  {
    key: "boot",
    label: "Boot candidates",
    description: "Learning-linked memory promoted into bootstrap context — requires review checkpoint.",
  },
  {
    key: "working",
    label: "Working context",
    description: "Temporary context linked to conversations, tasks, or workspaces — not durable truth.",
  },
  {
    key: "revoked",
    label: "Revoked / superseded",
    description: "Historical records that are no longer active truth — preserved as governance evidence.",
  },
];

/** Human-readable labels for memory layers. */
export const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  durable: "Durable memory",
  boot: "Boot candidate",
  working: "Working context",
};

/** Human-readable labels for memory kinds. */
export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  fact: "Fact",
  preference: "Preference",
  constraint: "Constraint",
  summary: "Summary",
};

/** Human-readable labels for visibility scopes. */
export const VISIBILITY_LABELS: Record<VisibilityScope, string> = {
  instance: "Visible to instance",
  team: "Visible to team",
  personal: "Personal",
  restricted: "Restricted access",
};

/** Human-readable labels for sensitivity. */
export const SENSITIVITY_LABELS: Record<MemorySensitivity, string> = {
  normal: "Normal sensitivity",
  sensitive: "Sensitive",
  restricted: "Restricted",
};

/** Human-readable labels for trust classes. */
export const TRUST_LABELS: Record<MemorySourceTrustClass, string> = {
  human_verified: "Human verified",
  operator_verified: "Operator verified",
  runtime_inferred: "Runtime inferred",
  external_unverified: "External unverified",
};

/** Status filter options. */
export const STATUS_OPTIONS: Array<MemoryStatus | "all"> = [
  "all",
  "active",
  "corrected",
  "deleted",
];

/** Visibility filter options. */
export const VISIBILITY_OPTIONS: Array<VisibilityScope | "all"> = [
  "all",
  "instance",
  "team",
  "personal",
  "restricted",
];

/** Memory kind options. */
export const MEMORY_KIND_OPTIONS: MemoryKind[] = [
  "fact",
  "preference",
  "constraint",
  "summary",
];

/** Sensitivity options. */
export const SENSITIVITY_OPTIONS: MemorySensitivity[] = [
  "normal",
  "sensitive",
  "restricted",
];

/** Memory layer options. */
export const MEMORY_LAYER_OPTIONS: MemoryLayer[] = [
  "durable",
  "boot",
  "working",
];

/** Source trust options. */
export const SOURCE_TRUST_OPTIONS: MemorySourceTrustClass[] = [
  "human_verified",
  "operator_verified",
  "runtime_inferred",
  "external_unverified",
];

/** Default structured fields for forms. */
export const DEFAULT_STRUCTURED_FIELDS = {
  sourceId: "",
  contactId: "",
  conversationId: "",
  taskId: "",
  notificationId: "",
  workspaceId: "",
  memoryKind: "fact" as MemoryKind,
  title: "",
  body: "",
  sourceTrustClass: "operator_verified" as MemorySourceTrustClass,
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  correctionNote: "",
  learnedFromEventId: "",
  humanOverride: false,
  expiresAt: "",
  memoryLayer: "durable" as MemoryLayer,
  reviewAt: "",
  reviewNote: "",
  advancedMetadataJson: "{}",
};

/** Default create form state. */
export const DEFAULT_CREATE_FORM = {
  memoryId: "",
  ...DEFAULT_STRUCTURED_FIELDS,
};

/** Default edit form state. */
export const DEFAULT_EDIT_FORM = {
  ...DEFAULT_STRUCTURED_FIELDS,
};

/** Default correction form state. */
export const DEFAULT_CORRECTION_FORM = {
  title: "",
  body: "",
  correctionNote: "",
  memoryKind: "fact" as MemoryKind,
  sourceTrustClass: "human_verified" as MemorySourceTrustClass,
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  expiresAt: "",
  memoryLayer: "durable" as MemoryLayer,
  reviewAt: "",
  reviewNote: "",
  advancedMetadataJson: "{}",
};

/** Default delete form state. */
export const DEFAULT_DELETE_FORM = {
  deletionNote: "",
};

/** Default revoke form state. */
export const DEFAULT_REVOKE_FORM = {
  revocationNote: "",
};
