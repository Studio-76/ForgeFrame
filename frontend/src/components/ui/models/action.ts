/**
 * Shared Action model for ForgeFrame.
 *
 * Standardises how pages define and render operator actions across
 * the control plane. Enforces cardinality rules (one primary per
 * page, one primary per table row, overflow for secondary) and
 * intent-based labelling to avoid generic "Open ..." labels.
 *
 * @module
 */

import type { ReactNode } from "react";

// ── Kinds ──────────────────────────────────────────────────────────────

/**
 * Visual kind of an action.
 *
 * - **primary**: Accent-filled CTA. At most one per page summary, at most
 *   one visible primary row action per table.
 * - **secondary**: Supporting actions placed in overflow menus or detail panels.
 * - **tertiary**: Ghost / least emphasis.
 * - **navigation**: Link-style for navigational (non-mutation) use.
 * - **destructive**: Red-toned for irreversible operations (delete, revoke).
 */
export type ActionKind = "primary" | "secondary" | "tertiary" | "navigation" | "destructive";

// ── Intents ────────────────────────────────────────────────────────────

/**
 * Semantic intent of an action.
 *
 * Used to derive labels and placement rules, keeping button text
 * task-specific rather than generic "Open …".
 */
export type ActionIntent = "fix" | "configure" | "review" | "run" | "diagnose" | "navigate";

// ── Action shape ───────────────────────────────────────────────────────

/**
 * A single, fully-described action on a ForgeFrame page.
 *
 * Every page should describe its actions using this model so that
 * shared rendering components can enforce consistent placement,
 * visibility, and styling.
 */
export type Action = {
  /** Human-readable label (task-specific, never generic "Open …"). */
  label: string;

  /**
   * Short explanation of what this action does and why.
   * Shown as tooltip or aria-description.
   */
  description?: string;

  /** Visual kind. Defaults to "secondary". */
  kind?: ActionKind;

  /** Semantic intent driving label and placement defaults. */
  intent?: ActionIntent;

  /** Navigate to this path (client-side route). */
  href?: string;

  /** Callback when the action is triggered. */
  onClick?: () => void;

  /** Disable the action. */
  disabled?: boolean;

  /** Show a loading spinner instead of the label. */
  loading?: boolean;

  /** Optional icon rendered before the label. */
  icon?: ReactNode;

  /** Data-testid for testing. */
  testId?: string;
};

// ── Action group ───────────────────────────────────────────────────────

/**
 * A named group of actions, typically rendered as an overflow menu section.
 */
export type ActionGroup = {
  /** Group label rendered as a menu section header. */
  label?: string;
  /** Actions in this group. */
  actions: Action[];
};

// ── Validation ─────────────────────────────────────────────────────────

/**
 * Result of action-rule validation.
 */
export type ActionValidation = {
  valid: boolean;
  violations: ActionViolation[];
};

/**
 * A single rule violation.
 */
export type ActionViolation = {
  rule: string;
  message: string;
  actionLabel: string;
};

/**
 * Validates action cardinality rules for a set of actions.
 *
 * Rules enforced:
 * - At most one primary action in the page summary.
 * - At most one visible primary row action per table.
 * - Diagnostic actions must not be primary.
 * - Action labels must not match generic "Open …" patterns.
 * - Navigation actions must use navigation kind.
 *
 * @param actions - The actions to validate.
 * @param context - Where these actions appear ("summary" | "table" | "detail").
 * @returns Validation result with any violations.
 */
export function validateActions(
  actions: Action[],
  context: "summary" | "table" | "detail" | "overflow",
): ActionValidation {
  const violations: ActionViolation[] = [];

  const primaryActions = actions.filter((a) => a.kind === "primary");
  if (context === "summary" && primaryActions.length > 1) {
    violations.push({
      rule: "max-one-primary-per-page",
      message: "At most one primary action is allowed in the page summary.",
      actionLabel: primaryActions.map((a) => a.label).join(", "),
    });
  }

  if (context === "table" && primaryActions.length > 1) {
    violations.push({
      rule: "max-one-primary-per-table-row",
      message: "At most one visible primary row action is allowed per table.",
      actionLabel: primaryActions.map((a) => a.label).join(", "),
    });
  }

  for (const action of actions) {
    if (action.intent === "diagnose" && action.kind === "primary") {
      violations.push({
        rule: "diagnostic-not-primary",
        message: "Diagnostic actions must not use the primary kind.",
        actionLabel: action.label,
      });
    }

    if (/^open\s/i.test(action.label)) {
      violations.push({
        rule: "no-generic-open-label",
        message: `Action label "${action.label}" is too generic. Use a task-specific label instead of "Open …".`,
        actionLabel: action.label,
      });
    }

    if (action.intent === "navigate" && action.kind !== "navigation" && action.kind !== "tertiary") {
      violations.push({
        rule: "navigation-uses-nav-kind",
        message: `Navigation action "${action.label}" should use kind "navigation" or "tertiary".`,
        actionLabel: action.label,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Maps an ActionIntent to a recommended default ActionKind.
 *
 * @param intent - The semantic intent.
 * @returns The default kind for that intent.
 */
export function defaultKindForIntent(intent: ActionIntent): ActionKind {
  switch (intent) {
    case "fix":
      return "primary";
    case "configure":
      return "primary";
    case "review":
      return "secondary";
    case "run":
      return "primary";
    case "diagnose":
      return "secondary";
    case "navigate":
      return "navigation";
  }
}

/**
 * Returns a descriptive label hint for an ActionIntent to encourage
 * task-specific labels over generic ones.
 *
 * @example
 * ```ts
 * labelHintForIntent("fix"); // "e.g. \"Renew certificate\", \"Rotate key\""
 * ```
 *
 * @param intent - The semantic intent.
 * @returns A string hinting at good label patterns.
 */
export function labelHintForIntent(intent: ActionIntent): string {
  switch (intent) {
    case "fix":
      return 'e.g. "Renew certificate", "Rotate key", "Restart service"';
    case "configure":
      return 'e.g. "Add target", "Edit profile", "Set threshold"';
    case "review":
      return 'e.g. "Review changes", "Inspect execution", "View diff"';
    case "run":
      return 'e.g. "Run probe", "Execute check", "Trigger sync"';
    case "diagnose":
      return 'e.g. "Check connectivity", "Run diagnostics"';
    case "navigate":
      return 'e.g. "View details", "Go to settings", "Open in logs"';
  }
}

/** Props suitable for spreading onto a Button component. */
export type ActionButtonProps = {
  variant: ActionKind;
  isDisabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
  onPress?: () => void;
};

/**
 * Converts an Action to Button component props.
 *
 * Merges action fields with optional overrides. Override values that
 * are explicitly `undefined` are filtered out so they don't clobber
 * the action-derived defaults.
 *
 * @param action - The action model.
 * @param overrides - Optional overrides for specific props.
 * @returns Props spreadable onto a Button element.
 */
export function actionToButtonProps(
  action: Action,
  overrides?: Partial<ActionButtonProps>,
): ActionButtonProps {
  const defaults: ActionButtonProps = {
    variant: action.kind ?? defaultKindForIntent(action.intent ?? "navigate"),
    isDisabled: action.disabled,
    "aria-label": action.description,
    "data-testid": action.testId,
    onPress: action.onClick,
  };

  if (!overrides) {
    return defaults;
  }

  // Filter out undefined overrides to avoid clobbering defaults
  const clean = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  ) as Partial<ActionButtonProps>;

  return { ...defaults, ...clean };
}
