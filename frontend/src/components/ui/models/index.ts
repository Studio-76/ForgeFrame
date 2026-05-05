/**
 * ForgeFrame shared data models for actions, status, and attention.
 *
 * These models standardise how pages define operator actions, health
 * states, blockers, and raw/debug information.
 *
 * ## Usage
 *
 * ```tsx
 * import type { Action } from "../components/ui/models/action";
 * import { validateActions } from "../components/ui/models/action";
 * import type { SystemStatus } from "../components/ui/models/status";
 * import { normalizeSystemStatus, SYSTEM_STATUS_TONE } from "../components/ui/models/status";
 * import type { AttentionPayload } from "../components/ui/models/attention";
 * import { visibleItems, advancedItems } from "../components/ui/models/attention";
 * ```
 *
 * @module
 */

// ── Action model ───────────────────────────────────────────────────────
export type {
  Action,
  ActionKind,
  ActionIntent,
  ActionGroup,
  ActionValidation,
  ActionViolation,
} from "./action";
export {
  validateActions,
  defaultKindForIntent,
  labelHintForIntent,
  actionToButtonProps,
} from "./action";

// ── Status model ───────────────────────────────────────────────────────
export type { SystemStatus } from "./status";
export {
  SYSTEM_STATUS_TONE,
  statusLabel,
  statusDescription,
  normalizeSystemStatus,
} from "./status";

// ── Attention model ────────────────────────────────────────────────────
export type {
  AttentionLevel,
  AttentionPayload,
  AttentionVisibility,
  AttentionValidation,
  AttentionViolation,
  AttentionGrouping,
} from "./attention";
export {
  visibilityForLevel,
  toneForLevel,
  attentionLabel,
  validateAttention,
  heroItems,
  visibleItems,
  collapsedItems,
  advancedItems,
  groupAttentionItems,
} from "./attention";
