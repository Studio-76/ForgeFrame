/**
 * Shared Attention model for ForgeFrame.
 *
 * Defines attention levels that encode how urgently a user needs to
 * see a piece of information, and enforces visibility rules so that
 * critical items are always shown while healthy / informational items
 * stay collapsed or relegated to detail panels.
 *
 * @module
 */

import type { StatusTone } from "../types";
import type { Action } from "./action";

// ── Attention levels ───────────────────────────────────────────────────

/**
 * How urgently the user needs to see a piece of information.
 *
 * - **primary_blocker**: Hard blocker. Always visible at the top of the
 *   content area. Rendered with danger tone and a clear resolution action.
 * - **needs_action**: User must do something. Visible, secondary placement.
 * - **warning**: Attention recommended. Visible but visually secondary.
 * - **informational**: Nice to know. Collapsed by default, placed in
 *   detail panels or tooltips.
 * - **healthy**: Everything is fine. Collapsed by default. Shown only
 *   when the user explicitly expands a summary or diagnostics area.
 * - **diagnostic**: Raw debug / internal data. Only visible inside
 *   AdvancedDiagnostics blocks.
 */
export type AttentionLevel =
  | "primary_blocker"
  | "needs_action"
  | "warning"
  | "informational"
  | "healthy"
  | "diagnostic";

// ── Attention payload ──────────────────────────────────────────────────

/**
 * A piece of information tagged with its attention level.
 *
 * Use this to describe status items, alerts, system checks, and any
 * other surface that communicates urgency or health to the operator.
 */
export type AttentionPayload = {
  /** Unique key for deduplication. */
  key: string;
  /** The attention level. */
  level: AttentionLevel;
  /** Short title (shown in alerts, callouts, summary items). */
  title: string;
  /** Longer explanation of the situation. */
  description?: string;
  /** Optional action to resolve or respond. */
  action?: Action;
  /** Optional StatusTone override (derived from level by default). */
  tone?: StatusTone;
  /** Optional metadata for diagnostics. */
  meta?: Record<string, unknown>;
};

// ── Visibility rules ───────────────────────────────────────────────────

/**
 * Where an attention level is rendered on the page.
 *
 * - **hero**: Top-of-page attention area.
 * - **visible**: Rendered in normal page flow.
 * - **collapsed**: Hidden behind a toggle or in a detail panel.
 * - **advanced**: Only visible in AdvancedDiagnostics.
 */
export type AttentionVisibility = "hero" | "visible" | "collapsed" | "advanced";

/**
 * Looks up the rendering visibility for an AttentionLevel.
 *
 * @param level - The attention level.
 * @returns Where the item should be rendered.
 */
export function visibilityForLevel(level: AttentionLevel): AttentionVisibility {
  switch (level) {
    case "primary_blocker":
      return "hero";
    case "needs_action":
      return "visible";
    case "warning":
      return "visible";
    case "informational":
      return "collapsed";
    case "healthy":
      return "collapsed";
    case "diagnostic":
      return "advanced";
  }
}

/**
 * Looks up the default StatusTone for an AttentionLevel.
 *
 * @param level - The attention level.
 * @returns The default display tone.
 */
export function toneForLevel(level: AttentionLevel): StatusTone {
  switch (level) {
    case "primary_blocker":
      return "danger";
    case "needs_action":
      return "warning";
    case "warning":
      return "warning";
    case "informational":
      return "info";
    case "healthy":
      return "success";
    case "diagnostic":
      return "neutral";
  }
}

/**
 * Returns a human-readable label for the attention level.
 *
 * @param level - The attention level.
 * @returns A short display label.
 */
export function attentionLabel(level: AttentionLevel): string {
  switch (level) {
    case "primary_blocker":
      return "Blocker";
    case "needs_action":
      return "Needs action";
    case "warning":
      return "Warning";
    case "informational":
      return "Info";
    case "healthy":
      return "Healthy";
    case "diagnostic":
      return "Diagnostic";
  }
}

// ── Validation ─────────────────────────────────────────────────────────

/**
 * Result of attention-rule validation.
 */
export type AttentionValidation = {
  valid: boolean;
  violations: AttentionViolation[];
};

/**
 * A single attention-rule violation.
 */
export type AttentionViolation = {
  rule: string;
  message: string;
  itemTitle: string;
};

/**
 * Validates attention visibility rules for a set of attention payloads.
 *
 * Rules enforced:
 * - At most one primary_blocker is shown at a time.
 * - informational items are not displayed in hero/primary areas.
 * - healthy items are collapsed by default.
 * - diagnostic items only appear in AdvancedDiagnostics.
 *
 * @param items - The attention-tagged items to validate.
 * @returns Validation result with any violations.
 */
export function validateAttention(items: AttentionPayload[]): AttentionValidation {
  const violations: AttentionViolation[] = [];

  const blockers = items.filter((i) => i.level === "primary_blocker");
  if (blockers.length > 1) {
    violations.push({
      rule: "max-one-blocker",
      message: "At most one primary_blocker should be shown at a time.",
      itemTitle: blockers.map((b) => b.title).join(", "),
    });
  }

  for (const item of items) {
    if (item.level === "informational") {
      const vis = visibilityForLevel(item.level);
      if (vis === "visible" || vis === "hero") {
        violations.push({
          rule: "informational-not-hero",
          message: `Informational item "${item.title}" should be collapsed or in a detail panel, not in a hero area.`,
          itemTitle: item.title,
        });
      }
    }

    if (item.level === "diagnostic" && visibilityForLevel(item.level) !== "advanced") {
      violations.push({
        rule: "diagnostic-only-advanced",
        message: `Diagnostic item "${item.title}" must only appear in AdvancedDiagnostics.`,
        itemTitle: item.title,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── Filter helpers ─────────────────────────────────────────────────────

/**
 * Returns items that should be shown at the top of the page (blockers).
 *
 * @param items - All attention-tagged items.
 * @returns Items with hero-level visibility.
 */
export function heroItems(items: AttentionPayload[]): AttentionPayload[] {
  return items.filter((i) => visibilityForLevel(i.level) === "hero");
}

/**
 * Returns items that should be visible in the normal page flow
 * (needs_action and warning).
 *
 * @param items - All attention-tagged items.
 * @returns Items with standard visibility.
 */
export function visibleItems(items: AttentionPayload[]): AttentionPayload[] {
  return items.filter((i) => visibilityForLevel(i.level) === "visible");
}

/**
 * Returns items that should be collapsed (informational and healthy).
 *
 * @param items - All attention-tagged items.
 * @returns Items with collapsed visibility.
 */
export function collapsedItems(items: AttentionPayload[]): AttentionPayload[] {
  return items.filter((i) => visibilityForLevel(i.level) === "collapsed");
}

/**
 * Returns items that belong in AdvancedDiagnostics.
 *
 * @param items - All attention-tagged items.
 * @returns Items with advanced visibility.
 */
export function advancedItems(items: AttentionPayload[]): AttentionPayload[] {
  return items.filter((i) => visibilityForLevel(i.level) === "advanced");
}

// ── Grouping helper ────────────────────────────────────────────────────

/**
 * Grouped attention items by visibility bucket.
 */
export type AttentionGrouping = {
  /** Items with hero-level visibility (primary_blocker). */
  blockers: AttentionPayload[];
  /** Items with standard flow visibility (needs_action, warning). */
  visible: AttentionPayload[];
  /** Items with collapsed visibility (informational, healthy). */
  collapsed: AttentionPayload[];
  /** Items with advanced visibility (diagnostic). */
  advanced: AttentionPayload[];
};

/**
 * Groups attention items by their visibility bucket.
 *
 * Centralises the four filter calls that every page template was
 * repeating, reducing duplication and ensuring consistent ordering.
 *
 * @param items - Optional attention-tagged items.
 * @returns A grouped result with four arrays.
 */
export function groupAttentionItems(items?: AttentionPayload[]): AttentionGrouping {
  if (!items) {
    return { blockers: [], visible: [], collapsed: [], advanced: [] };
  }
  return {
    blockers: heroItems(items),
    visible: visibleItems(items),
    collapsed: collapsedItems(items),
    advanced: advancedItems(items),
  };
}
