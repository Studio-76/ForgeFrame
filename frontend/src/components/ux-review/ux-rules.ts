/**
 * Automated UX rule definitions, configuration, and DOM scanner.
 *
 * These rules detect common ForgeFrame UX presentation anti-patterns
 * by scanning the live DOM for violations. They are **dev-only** and
 * only execute when UX Review Mode is active.
 *
 * ## Architecture
 *
 * Each rule is a pure function that receives a root DOM element (usually
 * `document`) and the current config, then returns an array of
 * `UxRuleWarning` objects. The `scanPageForUxWarnings()` orchestrator
 * runs all enabled rules and merges their results.
 *
 * ## Production safety
 *
 * The scanner is only imported and invoked when UX Review Mode is active.
 * In production builds, the entire module is tree-shaken because its
 * only consumer (`UxReviewContext.tsx`) is guarded by the compile-time
 * constant `UX_REVIEW_AVAILABLE`.
 */

// ── Rule IDs ─────────────────────────────────────────────

/**
 * Identifiers for every automated UX rule.
 */
export type UxRuleId =
  | "multiple-primary-actions"
  | "nav-as-primary"
  | "diagnostics-visible-default"
  | "advanced-diagnostics-expanded"
  | "repeated-open-labels"
  | "large-related-nav-block"
  | "raw-ids-visible"
  | "raw-timestamps-visible"
  | "empty-section-high-visual-weight"
  | "healthy-zero-count-too-prominent";

// ── Warning Types ────────────────────────────────────────

/**
 * Severity level for an automated UX rule warning.
 * Mirrors UxAnnotationSeverity for consistent UX in the panel.
 */
export type UxRuleWarningSeverity = "critical" | "major" | "minor" | "suggestion";

/**
 * A single automated UX warning produced by a rule scan.
 */
export interface UxRuleWarning {
  /** Unique identifier for this warning instance (ruleId + hash). */
  id: string;
  /** The rule that generated this warning. */
  ruleId: UxRuleId;
  /** Severity of the detected issue. */
  severity: UxRuleWarningSeverity;
  /** Human-readable message describing the issue. */
  message: string;
  /** Suggested fix the reviewer or agent should apply. */
  suggestedFix: string;
  /** Information about the DOM element(s) that triggered the warning. */
  affectedElement: {
    /** The data-ux-id of the primary element, if available. */
    uxId?: string;
    /** The data-ux-component of the element, if available. */
    uxComponent?: string;
    /** The data-ux-role of the element, if available. */
    uxRole?: string;
    /** CSS selector for the primary element. */
    selector?: string;
    /** Truncated text content of the primary element. */
    textContent?: string;
  };
  /** Whether the reviewer has dismissed this warning. */
  isDismissed: boolean;
  /** ISO-8601 timestamp when the warning was dismissed. */
  dismissedAt?: string;
  /** Optional reason for dismissal. */
  dismissedReason?: string;
  /** Number of elements affected (for aggregate warnings like "3 elements found"). */
  count?: number;
}

// ── Rule Configuration ───────────────────────────────────

/**
 * Per-rule configuration for enabling/disabling and tuning sensitivity.
 */
export interface UxRuleConfig {
  /** Whether this rule is enabled. */
  enabled: boolean;
  /**
   * Custom threshold for this rule.
   * Interpretation depends on the rule (e.g., minimum count before warning).
   */
  threshold?: number;
  /**
   * List of data-ux-id values to exclude from this rule.
   * When a rule flags an element whose uxId is in this list, the warning
   * is suppressed. Useful for suppressing known false positives.
   */
  ignoreUxIds?: string[];
}

/**
 * Complete set of rule configurations, keyed by rule ID.
 */
export type UxRulesConfig = Record<UxRuleId, UxRuleConfig>;

// ── Rule Metadata ────────────────────────────────────────

/**
 * Static metadata about a rule — name, description, default severity.
 */
export interface UxRuleDefinition {
  id: UxRuleId;
  /** Human-readable rule name for the panel UI. */
  name: string;
  /** Concise description of what this rule detects. */
  description: string;
  /** Default severity assigned to warnings from this rule. */
  defaultSeverity: UxRuleWarningSeverity;
  /** Default threshold value (0 means use rule-specific default). */
  defaultThreshold: number;
}

/**
 * Human-readable labels for each rule ID.
 */
export const UX_RULE_LABELS: Record<UxRuleId, string> = {
  "multiple-primary-actions": "Multiple primary actions",
  "nav-as-primary": "Navigation styled as primary",
  "diagnostics-visible-default": "Diagnostics visible by default",
  "advanced-diagnostics-expanded": "Advanced diagnostics expanded by default",
  "repeated-open-labels": "Repeated generic labels",
  "large-related-nav-block": "Large related-page navigation block",
  "raw-ids-visible": "Raw IDs visible in default view",
  "raw-timestamps-visible": "Raw timestamps visible in default view",
  "empty-section-high-visual-weight": "Empty section with high visual weight",
  "healthy-zero-count-too-prominent": "Healthy/zero state too prominent",
};

/**
 * Complete rule definitions with names, descriptions, and defaults.
 */
export const RULE_DEFINITIONS: UxRuleDefinition[] = [
  {
    id: "multiple-primary-actions",
    name: "Multiple primary actions",
    description: "More than one primary action button visible on the same page.",
    defaultSeverity: "major",
    defaultThreshold: 1,
  },
  {
    id: "nav-as-primary",
    name: "Navigation styled as primary",
    description: "A navigation or link element is styled as a primary action.",
    defaultSeverity: "major",
    defaultThreshold: 0,
  },
  {
    id: "diagnostics-visible-default",
    name: "Diagnostics visible by default",
    description: "A diagnostics section is visible without user action.",
    defaultSeverity: "minor",
    defaultThreshold: 0,
  },
  {
    id: "advanced-diagnostics-expanded",
    name: "Advanced diagnostics expanded",
    description: "AdvancedDiagnostics section is expanded by default.",
    defaultSeverity: "minor",
    defaultThreshold: 0,
  },
  {
    id: "repeated-open-labels",
    name: "Repeated generic labels",
    description: "Multiple elements with 'Open …' labels should use specific action labels.",
    defaultSeverity: "minor",
    defaultThreshold: 2,
  },
  {
    id: "large-related-nav-block",
    name: "Large related-page navigation block",
    description: "A related-page navigation block has many links on a non-hub page.",
    defaultSeverity: "minor",
    defaultThreshold: 5,
  },
  {
    id: "raw-ids-visible",
    name: "Raw IDs visible",
    description: "Raw database IDs or UUIDs visible in the default page view.",
    defaultSeverity: "major",
    defaultThreshold: 0,
  },
  {
    id: "raw-timestamps-visible",
    name: "Raw timestamps visible",
    description: "Raw ISO-8601 timestamps visible in the default page view.",
    defaultSeverity: "minor",
    defaultThreshold: 0,
  },
  {
    id: "empty-section-high-visual-weight",
    name: "Empty section with high visual weight",
    description: "A section with little content occupies significant visual space.",
    defaultSeverity: "minor",
    defaultThreshold: 100,
  },
  {
    id: "healthy-zero-count-too-prominent",
    name: "Healthy/zero state too prominent",
    description: "A healthy or zero-count status is shown with more visual weight than warnings or errors.",
    defaultSeverity: "suggestion",
    defaultThreshold: 0,
  },
];

// ── Default Configuration ────────────────────────────────

/**
 * Returns a default UxRulesConfig with all rules enabled and default thresholds.
 */
export function getDefaultRulesConfig(): UxRulesConfig {
  const config = {} as UxRulesConfig;
  for (const def of RULE_DEFINITIONS) {
    config[def.id] = {
      enabled: true,
      threshold: def.defaultThreshold,
      ignoreUxIds: [],
    };
  }
  return config;
}

/**
 * Deep-merges a partial rules config over the defaults.
 * Only keys present in `override` are changed — all others keep defaults.
 */
export function mergeRulesConfig(
  override: Partial<UxRulesConfig>,
): UxRulesConfig {
  const defaults = getDefaultRulesConfig();
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      const ruleId = key as UxRuleId;
      defaults[ruleId] = {
        ...defaults[ruleId],
        ...value,
        ignoreUxIds: [
          ...(defaults[ruleId]?.ignoreUxIds ?? []),
          ...((value as UxRuleConfig).ignoreUxIds ?? []),
        ],
      };
    }
  }
  return defaults;
}

// ── Warning Helpers ──────────────────────────────────────

/**
 * Simple string hash for generating stable anonymous IDs.
 * @returns A hex string of the hash.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Generates a stable warning ID for deduplication.
 * For elements with a data-ux-id, uses that ID directly.
 * For anonymous elements, produces a deterministic hash from
 * the rule context so the same element gets the same ID across scans.
 */
function generateWarningId(
  ruleId: UxRuleId,
  uxId?: string,
  elementContext?: string,
): string {
  const suffix = uxId ?? (elementContext ? `anon-${simpleHash(elementContext)}` : `anon-0`);
  return `ux-warn-${ruleId}-${suffix}`;
}

// ── DOM Scanning Helpers ─────────────────────────────────

/**
 * Safely gets the trimmed text content of an element.
 */
function getText(el: Element): string {
  return (el.textContent ?? "").trim();
}

/**
 * Checks whether an element is actually visible to the user.
 * Checks semantic hiding (hidden, aria-hidden, details), plus CSS hiding
 * (display:none, visibility:hidden, zero dimensions) via checkVisibility().
 */
function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.hidden) return false;
  if (el.closest("[hidden]")) return false;
  // Check if inside a collapsed <details> element
  const detailsParent = el.closest("details");
  if (detailsParent && !detailsParent.open) return false;
  // Check aria-hidden
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest("[aria-hidden='true']")) return false;
  // Catch CSS hiding (display:none, visibility:hidden, zero dimensions)
  if (!el.checkVisibility()) return false;
  return true;
}

/**
 * Returns the data-ux-id attribute of an element, or undefined.
 */
function getUxId(el: Element): string | undefined {
  return el.getAttribute("data-ux-id") ?? undefined;
}

// ── Individual Rule Scanners ─────────────────────────────

/**
 * Rule: Multiple primary actions (> threshold count).
 */
function scanMultiplePrimaryActions(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const threshold = config.threshold ?? 1;
  const elements = Array.from(
    rootEl.querySelectorAll<HTMLElement>("[data-ux-action-kind='primary']"),
  ).filter(isElementVisible);

  if (elements.length <= threshold) return [];

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const flagged = elements.filter((el) => {
    const id = getUxId(el);
    return !id || !ignoreSet.has(id);
  });

  if (flagged.length <= threshold) return [];

  const first = flagged[0];
  const uxId = getUxId(first);
  const text = getText(first).slice(0, 80);

  return [
    {
      id: generateWarningId("multiple-primary-actions", uxId),
      ruleId: "multiple-primary-actions",
      severity: "major",
      message: `${flagged.length} primary actions visible on this page. Only one should be primary.`,
      suggestedFix:
        "Promote one primary action; demote others to secondary or tertiary using ff-btn-secondary.",
      affectedElement: {
        uxId,
        uxComponent: first.getAttribute("data-ux-component") ?? undefined,
        uxRole: "primary-action",
        selector: `[data-ux-action-kind="primary"]`,
        textContent: text,
      },
      isDismissed: false,
      count: flagged.length,
    },
  ];
}

/**
 * Rule: Navigation elements styled as primary actions.
 */
function scanNavAsPrimary(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const elements = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "[data-ux-role='navigation'][data-ux-action-kind='primary'], " +
        "[data-ux-role~='nav'][data-ux-action-kind='primary'], " +
        "[data-ux-component='NavLink'][data-ux-action-kind='primary']",
    ),
  ).filter(isElementVisible);

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const warnings: UxRuleWarning[] = [];

  for (const el of elements) {
    const uxId = getUxId(el);
    if (uxId && ignoreSet.has(uxId)) continue;

    warnings.push({
      id: generateWarningId("nav-as-primary", uxId),
      ruleId: "nav-as-primary",
      severity: "major",
      message: "Navigation action is styled as a primary action button.",
      suggestedFix:
        "Change to secondary or tertiary styling. Navigation should not look like a mutating action.",
      affectedElement: {
        uxId,
        uxComponent: el.getAttribute("data-ux-component") ?? undefined,
        uxRole: el.getAttribute("data-ux-role") ?? undefined,
        selector: buildSelector(el),
        textContent: getText(el).slice(0, 80),
      },
      isDismissed: false,
    });
  }

  return warnings;
}

/**
 * Rule: Diagnostics section visible by default (no hidden or collapsed state).
 */
function scanDiagnosticsVisibleDefault(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const elements = Array.from(
    rootEl.querySelectorAll<HTMLElement>("[data-ux-role='diagnostics']"),
  ).filter(isElementVisible);

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const warnings: UxRuleWarning[] = [];

  for (const el of elements) {
    const uxId = getUxId(el);
    if (uxId && ignoreSet.has(uxId)) continue;

    // Check if this element is normally hidden/collapsed
    if (el.classList.contains("ff-diag-collapsed")) continue;
    if (el.getAttribute("aria-expanded") === "false") continue;
    if (el.closest("[open]") === null && el.closest("details")) continue;

    warnings.push({
      id: generateWarningId("diagnostics-visible-default", uxId),
      ruleId: "diagnostics-visible-default",
      severity: "minor",
      message: "Diagnostics section is visible by default.",
      suggestedFix:
        "Move diagnostics behind a toggle or collapse section. It should not be visible on initial page load.",
      affectedElement: {
        uxId,
        uxComponent: el.getAttribute("data-ux-component") ?? undefined,
        uxRole: "diagnostics",
        selector: buildSelector(el),
        textContent: getText(el).slice(0, 80),
      },
      isDismissed: false,
    });
  }

  return warnings;
}

/**
 * Rule: AdvancedDiagnostics component expanded by default.
 */
function scanAdvancedDiagnosticsExpanded(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const elements = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "[data-ux-component='AdvancedDiagnostics']",
    ),
  ).filter(isElementVisible);

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const warnings: UxRuleWarning[] = [];

  for (const el of elements) {
    const uxId = getUxId(el);
    if (uxId && ignoreSet.has(uxId)) continue;

    // Check if it's expanded/visible on load vs collapsed
    const collapsed = el.getAttribute("data-ux-density") === "collapsed";
    const details = el.closest("details");
    const isExpanded =
      (details && details.open) || (!collapsed && el.checkVisibility());

    if (!isExpanded) continue;

    warnings.push({
      id: generateWarningId("advanced-diagnostics-expanded", uxId),
      ruleId: "advanced-diagnostics-expanded",
      severity: "minor",
      message: "AdvancedDiagnostics section is expanded by default.",
      suggestedFix:
        "Start AdvancedDiagnostics in collapsed state. Expand only on user interaction or when relevant.",
      affectedElement: {
        uxId,
        uxComponent: "AdvancedDiagnostics",
        selector: buildSelector(el),
        textContent: getText(el).slice(0, 80),
      },
      isDismissed: false,
    });
  }

  return warnings;
}

/**
 * Rule: Repeated 'Open ...' labels across the page.
 */
function scanRepeatedOpenLabels(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const threshold = config.threshold ?? 2;

  const allElements = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "a, button, [role='button'], [tabindex]",
    ),
  ).filter(isElementVisible);

  const openLabels = allElements.filter((el) => {
    const text = getText(el);
    return /^Open\s+/i.test(text) && text.length < 30;
  });

  if (openLabels.length <= threshold) return [];

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const flagged = openLabels.filter((el) => {
    const id = getUxId(el);
    return !id || !ignoreSet.has(id);
  });

  if (flagged.length <= threshold) return [];

  const examples = flagged
    .slice(0, 3)
    .map((el) => `"${getText(el).slice(0, 40)}"`)
    .join(", ");
  const first = flagged[0];
  const uxId = getUxId(first);

  return [
    {
      id: generateWarningId("repeated-open-labels", uxId),
      ruleId: "repeated-open-labels",
      severity: "minor",
      message: `${flagged.length} elements use "Open …" labels (${examples}${flagged.length > 3 ? ", …" : ""}). Use task-specific labels instead.`,
      suggestedFix:
        'Replace generic "Open …" labels with specific action labels like "View details", "Edit configuration", or "Manage targets".',
      affectedElement: {
        uxId,
        selector: "[data-ux-action-kind]",
        textContent: getText(flagged[0]).slice(0, 80),
      },
      isDismissed: false,
      count: flagged.length,
    },
  ];
}

/**
 * Rule: Large related-page navigation block on a non-hub page.
 */
function scanLargeRelatedNavBlock(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const threshold = config.threshold ?? 5;

  const navBlocks = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "[data-ux-role='related-pages'], " +
        "[data-ux-component='ContextNavStrip'], " +
        "[data-ux-role='page-navigation']",
    ),
  ).filter(isElementVisible);

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const warnings: UxRuleWarning[] = [];

  for (const block of navBlocks) {
    const uxId = getUxId(block);
    if (uxId && ignoreSet.has(uxId)) continue;

    const links = block.querySelectorAll("a, [role='link'], button");
    if (links.length <= threshold) continue;

    warnings.push({
      id: generateWarningId("large-related-nav-block", uxId),
      ruleId: "large-related-nav-block",
      severity: "minor",
      message: `Related-page navigation block contains ${links.length} links. Large nav blocks on detail pages bury primary content.`,
      suggestedFix:
        "Reduce to essential navigation links (threshold ≤ 5). Move less-common links to page diagnostics or collapse behind a menu.",
      affectedElement: {
        uxId,
        uxComponent:
          block.getAttribute("data-ux-component") ?? undefined,
        uxRole: block.getAttribute("data-ux-role") ?? undefined,
        selector: buildSelector(block),
        textContent: getText(block).slice(0, 80),
      },
      isDismissed: false,
      count: links.length,
    });
  }

  return warnings;
}

/**
 * Rule: Raw IDs visible in default view.
 * Detects UUIDs and numeric IDs in text content.
 * UUID matches are flagged as major; numeric-only matches as minor
 * (since years, version numbers, etc. produce false positives).
 */
function scanRawIdsVisible(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const ignoreSet = new Set(config.ignoreUxIds ?? []);

  // UUID pattern: 8-4-4-4-12 hex digits
  const uuidPattern =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  // Numeric ID pattern — exclude years (1900-2099), percentages, and short counts
  const numericIdPattern = /(?<!\d)(?!19\d\d|20\d\d)\d{6,12}(?!\d)(?!%)/;

  const candidates = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "td, span, div, p, li, label, [data-ux-role]",
    ),
  ).filter(isElementVisible);

  const found: Array<{ el: HTMLElement; id?: string; hasUuid: boolean }> = [];

  for (const el of candidates) {
    const text = getText(el);
    if (!text || text.length > 100) continue;
    const hasUuid = uuidPattern.test(text);
    const hasNumericId = hasUuid || numericIdPattern.test(text);
    if (!hasUuid && !hasNumericId) continue;
    const uxId = getUxId(el);
    if (uxId && ignoreSet.has(uxId)) continue;
    found.push({ el, id: uxId, hasUuid });
  }

  if (found.length === 0) return [];

  const hasAnyUuid = found.some((f) => f.hasUuid);
  const first = found[0];
  return [
    {
      id: generateWarningId("raw-ids-visible", first.id),
      ruleId: "raw-ids-visible",
      severity: hasAnyUuid ? "major" : "minor",
      message: `${found.length} element(s) display raw IDs in visible text${hasAnyUuid ? " (UUIDs detected)" : ""}. Raw data should not be in the default view.`,
      suggestedFix:
        "Replace raw IDs with human-readable labels (names, descriptions, or truncated identifiers). " +
        "If IDs must be visible, move them to a tooltip or AdvancedDiagnostics.",
      affectedElement: {
        uxId: first.id,
        selector: buildSelector(first.el),
        textContent: getText(first.el).slice(0, 80),
      },
      isDismissed: false,
      count: found.length,
    },
  ];
}

/**
 * Rule: Raw timestamps visible in default view.
 * Detects ISO-8601 dates and full timestamps in visible text.
 */
function scanRawTimestampsVisible(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const ignoreSet = new Set(config.ignoreUxIds ?? []);

  // ISO-8601 timestamp with timezone (e.g., "2026-05-05T14:30:00.000Z")
  const tzPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
  // ISO-8601 date/time without timezone (e.g., "2026-05-05T14:30:00")
  const isoPattern =
    /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;

  const candidates = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "td, span, div, p, li, [data-ux-role]",
    ),
  ).filter(isElementVisible);

  const found: Array<{ el: HTMLElement; id?: string }> = [];

  for (const el of candidates) {
    const text = getText(el);
    if (!text || text.length > 100) continue;
    // Only flag raw ISO timestamps (with T separator or timezone), not formatted dates
    if (tzPattern.test(text) || isoPattern.test(text)) {
      const uxId = getUxId(el);
      if (uxId && ignoreSet.has(uxId)) continue;
      found.push({ el, id: uxId });
    }
  }

  if (found.length === 0) return [];

  const first = found[0];
  return [
    {
      id: generateWarningId("raw-timestamps-visible", first.id),
      ruleId: "raw-timestamps-visible",
      severity: "minor",
      message: `${found.length} element(s) display raw ISO-8601 timestamps in visible text.`,
      suggestedFix:
        "Format timestamps using relative labels (e.g., '2 hours ago') or locale-formatted dates. " +
        "Raw timestamps belong in tooltips or diagnostics views.",
      affectedElement: {
        uxId: first.id,
        selector: buildSelector(first.el),
        textContent: getText(first.el).slice(0, 80),
      },
      isDismissed: false,
      count: found.length,
    },
  ];
}

/**
 * Rule: Empty-looking section that still occupies significant visual space.
 */
function scanEmptySectionHighVisualWeight(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const minArea = config.threshold ?? 100; // minimum pixels before flagging

  const sections = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "[data-ux-role='section'], " +
        "[data-ux-component='Section'], " +
        ".fg-card, " +
        "[data-ux-role='card']",
    ),
  ).filter(isElementVisible);

  const ignoreSet = new Set(config.ignoreUxIds ?? []);
  const warnings: UxRuleWarning[] = [];

  for (const section of sections) {
    const uxId = getUxId(section);
    if (uxId && ignoreSet.has(uxId)) continue;

    const text = getText(section);
    const rect = section.getBoundingClientRect();
    const area = rect.width * rect.height;

    // Flag if large area but minimal content
    if (area > minArea && text.length < 50) {
      warnings.push({
        id: generateWarningId("empty-section-high-visual-weight", uxId, section.tagName + text.slice(0, 30) + section.className),
        ruleId: "empty-section-high-visual-weight",
        severity: "minor",
        message: `Section "${uxId ?? (text.slice(0, 30) || "unnamed")}" occupies ${Math.round(area)}px² but has only ${text.length} characters of content.`,
        suggestedFix:
          "Use a compact empty state or collapse the section when empty. " +
          "Reduce padding/height or use an inline status message instead.",
        affectedElement: {
          uxId,
          uxComponent:
            section.getAttribute("data-ux-component") ?? undefined,
          uxRole: section.getAttribute("data-ux-role") ?? undefined,
          selector: buildSelector(section),
          textContent: text.slice(0, 80),
        },
        isDismissed: false,
      });
    }
  }

  return warnings;
}

/**
 * Rule: Healthy/ready/zero-count states shown too prominently.
 * Detects elements with "0", "healthy", "ready" text that carry high visual weight.
 */
function scanHealthyZeroCountTooProminent(
  rootEl: Document | Element,
  config: UxRuleConfig,
): UxRuleWarning[] {
  if (!config.enabled) return [];
  const ignoreSet = new Set(config.ignoreUxIds ?? []);

  // Find elements with zero counts or healthy status text
  const zeroElements = Array.from(
    rootEl.querySelectorAll<HTMLElement>(
      "[data-ux-role='summary'], " +
        "[data-ux-role='kpi'], " +
        ".fg-kpi, " +
        "[data-ux-component='StatusBadge'], " +
        "[data-ux-attention]",
    ),
  ).filter(isElementVisible);

  const warnings: UxRuleWarning[] = [];

  for (const el of zeroElements) {
    const uxId = getUxId(el);
    if (uxId && ignoreSet.has(uxId)) continue;

    const text = getText(el);
    if (!text) continue;

    // Check for zero count pattern (e.g., "0 items", "0 errors", "0%")
    const hasZeroCount = /\b0\b/.test(text);
    // Check for healthy/success text
    const hasHealthyText =
      /\b(healthy|ready|all clear|no issues|no errors|passed)\b/i.test(text);

    if (!hasZeroCount && !hasHealthyText) continue;

    // Determine if it has high visual weight (primary action, large size, high attention)
    const actionKind = el.getAttribute("data-ux-action-kind");
    const attention = el.getAttribute("data-ux-attention");
    const isHighWeight =
      actionKind === "primary" ||
      attention === "high" ||
      el.classList.contains("ff-btn-primary") ||
      el.matches("h1, h2, .text-lg, .text-xl, .text-2xl");

    if (!isHighWeight) continue;

    warnings.push({
      id: generateWarningId("healthy-zero-count-too-prominent", uxId),
      ruleId: "healthy-zero-count-too-prominent",
      severity: "suggestion",
      message: `"${text.slice(0, 50)}" reflects a healthy/zero state but is shown with high visual weight.`,
      suggestedFix:
        "Reduce prominence of zero-count or healthy indicators. " +
        "Use neutral or compact display for non-actionable positive states. " +
        "Reserve primary/high attention for warnings, errors, or actionable items.",
      affectedElement: {
        uxId,
        uxComponent: el.getAttribute("data-ux-component") ?? undefined,
        uxRole: el.getAttribute("data-ux-role") ?? undefined,
        selector: buildSelector(el),
        textContent: text.slice(0, 80),
      },
      isDismissed: false,
    });
  }

  return warnings;
}

// ── Selector Helper ──────────────────────────────────────

/**
 * Builds a CSS selector for the given element, preferring data-ux-id.
 */
function buildSelector(el: Element): string {
  const uxId = el.getAttribute("data-ux-id");
  if (uxId) return `[data-ux-id="${CSS.escape(uxId)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName,
    );
    const index = siblings.indexOf(el) + 1;
    if (index > 0) return `${tag}:nth-of-type(${index})`;
  }
  return tag;
}

// ── Main Scanner ─────────────────────────────────────────

/**
 * Configuration options for the scanner.
 */
export interface ScanOptions {
  /** The root element to scan. Defaults to `document`. */
  rootEl?: Document | Element;
  /** The rules configuration to use. Defaults to all rules enabled. */
  config?: UxRulesConfig;
  /**
   * Set of already-dismissed warning IDs to exclude from the result.
   * These are typically maintained by the calling context.
   */
  dismissedIds?: Set<string>;
}

/**
 * Scans the page for UX rule violations and returns all warnings.
 *
 * @param options - Scan configuration.
 * @returns Array of detected warnings (filtered by enabled rules and exclusions).
 */
export function scanPageForUxWarnings(
  options: ScanOptions = {},
): UxRuleWarning[] {
  const rootEl = options.rootEl ?? document;
  const config = options.config ?? getDefaultRulesConfig();
  const dismissedIds = options.dismissedIds ?? new Set<string>();

  const allWarnings: UxRuleWarning[] = [
    ...scanMultiplePrimaryActions(rootEl, config["multiple-primary-actions"]),
    ...scanNavAsPrimary(rootEl, config["nav-as-primary"]),
    ...scanDiagnosticsVisibleDefault(
      rootEl,
      config["diagnostics-visible-default"],
    ),
    ...scanAdvancedDiagnosticsExpanded(
      rootEl,
      config["advanced-diagnostics-expanded"],
    ),
    ...scanRepeatedOpenLabels(rootEl, config["repeated-open-labels"]),
    ...scanLargeRelatedNavBlock(rootEl, config["large-related-nav-block"]),
    ...scanRawIdsVisible(rootEl, config["raw-ids-visible"]),
    ...scanRawTimestampsVisible(rootEl, config["raw-timestamps-visible"]),
    ...scanEmptySectionHighVisualWeight(
      rootEl,
      config["empty-section-high-visual-weight"],
    ),
    ...scanHealthyZeroCountTooProminent(
      rootEl,
      config["healthy-zero-count-too-prominent"],
    ),
  ];

  // Filter out dismissed warnings
  return allWarnings.filter((w) => !dismissedIds.has(w.id));
}
