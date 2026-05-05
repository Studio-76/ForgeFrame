/**
 * Types for the UX Review Mode overlay system.
 *
 * UX Review Mode is a dev-only tool that lets reviewers inspect live pages,
 * select UI elements that have `data-ux-*` attributes, and annotate them
 * with issues, severity, and expected changes.
 *
 * **Production safety:** All review tooling is gated behind
 * `import.meta.env.DEV && import.meta.env.VITE_ENABLE_UX_REVIEW === "true"`.
 * In production builds, the overlay and panel are tree-shaken and never execute.
 */

// ── Issue Types ─────────────────────────────────────────

/**
 * Predefined UX issue categories a reviewer can assign to an annotation.
 */
export type UxIssueType =
  | "too-large"
  | "too-prominent"
  | "wrong-action-hierarchy"
  | "navigation-looks-like-mutation"
  | "empty-looking-section"
  | "duplicate-information"
  | "raw-data-too-visible"
  | "diagnostics-too-prominent"
  | "needs-compact-representation"
  | "label-unclear"
  | "other";

/**
 * Human-readable labels for each issue type.
 */
export const UX_ISSUE_LABELS: Record<UxIssueType, string> = {
  "too-large": "Too large",
  "too-prominent": "Too prominent",
  "wrong-action-hierarchy": "Wrong action hierarchy",
  "navigation-looks-like-mutation": "Navigation looks like mutation",
  "empty-looking-section": "Empty-looking section",
  "duplicate-information": "Duplicate information",
  "raw-data-too-visible": "Raw data too visible",
  "diagnostics-too-prominent": "Diagnostics too prominent",
  "needs-compact-representation": "Needs compact representation",
  "label-unclear": "Label unclear",
  "other": "Other",
};

// ── Severity ────────────────────────────────────────────

/**
 * Severity level for a UX annotation.
 */
export type UxAnnotationSeverity = "critical" | "major" | "minor" | "suggestion";

export const UX_SEVERITY_LABELS: Record<UxAnnotationSeverity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  suggestion: "Suggestion",
};

// ── Element Data ────────────────────────────────────────

/**
 * Data extracted from a DOM element's `data-ux-*` attributes.
 */
export interface UxElementData {
  /** Stable, human-readable identifier from data-ux-id. */
  uxId: string;
  /** Component type label (e.g. "PageHeader", "DataTable", "Button"). */
  uxComponent?: string;
  /** Semantic role within the page layout. */
  uxRole?: string;
  /** Page or feature identifier. */
  uxPage?: string;
  /** Attention level for review prioritisation. */
  uxAttention?: string;
  /** Action category for this element. */
  uxActionKind?: string;
  /** Display density hint. */
  uxDensity?: string;
  /** Source file or area reference. */
  uxSource?: string;
}

/**
 * Full captured data for a selected DOM element, including
 * runtime metadata not available from attributes alone.
 */
export interface CapturedElement {
  /** Extracted UX metadata from data attributes. */
  elementData: UxElementData;
  /** Truncated text content of the element (first 200 chars). */
  textContent: string;
  /** CSS selector that uniquely identifies this element. */
  domSelector: string;
  /** Approximate bounding box at time of selection. */
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

// ── Annotation ──────────────────────────────────────────

/**
 * A single reviewer annotation attached to a UI element.
 */
export interface UxAnnotation {
  /** Unique identifier for this annotation. */
  id: string;
  /** The element this annotation refers to. */
  element: CapturedElement;
  /** Category of the UX issue. */
  issueType: UxIssueType;
  /** Severity of the issue. */
  severity: UxAnnotationSeverity;
  /** Free-text reviewer comment. */
  comment: string;
  /** Description of the expected change. */
  expectedChange?: string;
  /** Optional note about screenshot or visual reference. */
  screenshotNote?: string;
  /** ISO-8601 timestamp when the annotation was created. */
  timestamp: string;
  /** Viewport dimensions at annotation time. */
  viewportSize: { width: number; height: number };
  /** Current page route at annotation time. */
  route: string;
  /**
   * Page title / document title at annotation time.
   * Note: Ensure no PII or sensitive data is present in document.title
   * before a review session, as this value is captured in exported annotations.
   */
  pageTitle: string;
}

// ── Context ─────────────────────────────────────────────

/**
 * Shape of the UX Review context available to the entire app.
 */
export interface UxReviewContextValue {
  /** Whether UX Review Mode is active (dev env + VITE flag + ?uxReview=1). */
  isEnabled: boolean;
  /** The currently selected/highlighted element, or null. */
  selectedElement: CapturedElement | null;
  /** The element currently hovered by the overlay, or null. */
  hoveredElement: CapturedElement | null;
  /** All annotations created in this session. */
  annotations: UxAnnotation[];
  /** Select an element for annotation. */
  selectElement: (element: CapturedElement | null) => void;
  /** Set the hovered element for tooltip display. */
  setHoveredElement: (element: CapturedElement | null) => void;
  /** Add a new annotation for the currently selected element (individual params). */
  addAnnotation: (
    issueType: UxIssueType,
    severity: UxAnnotationSeverity,
    comment: string,
    expectedChange?: string,
    screenshotNote?: string,
  ) => void;
  /** Remove an annotation by ID. */
  removeAnnotation: (id: string) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Export all annotations as a JSON blob. */
  exportAnnotations: () => string;
  /** Total count of annotations. */
  annotationCount: number;
}

// ── DOM Helpers ─────────────────────────────────────────

/**
 * Extracts UX metadata from a DOM element with data-ux-* attributes.
 * @param el - The DOM element to inspect.
 * @returns UxElementData if a data-ux-id attribute is present, otherwise null.
 */
export function extractUxElementData(el: Element): UxElementData | null {
  const uxId = el.getAttribute("data-ux-id");
  if (!uxId) return null;
  return {
    uxId,
    uxComponent: el.getAttribute("data-ux-component") ?? undefined,
    uxRole: el.getAttribute("data-ux-role") ?? undefined,
    uxPage: el.getAttribute("data-ux-page") ?? undefined,
    uxAttention: el.getAttribute("data-ux-attention") ?? undefined,
    uxActionKind: el.getAttribute("data-ux-action-kind") ?? undefined,
    uxDensity: el.getAttribute("data-ux-density") ?? undefined,
    uxSource: el.getAttribute("data-ux-source") ?? undefined,
  };
}

/**
 * Builds a CSS selector that uniquely identifies a given element.
 * Falls back to a tag-name + nth-of-type selector.
 * @param el - The DOM element.
 * @returns A CSS selector string.
 */
export function buildDomSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.getAttribute("data-ux-id")) {
    return `[data-ux-id="${CSS.escape(el.getAttribute("data-ux-id")!)}"]`;
  }
  // Build a minimal path using tag name and nth-of-type
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
    const index = siblings.indexOf(el) + 1;
    if (index > 0) return `${tag}:nth-of-type(${index})`;
  }
  return tag;
}

/**
 * Creates a CapturedElement from a live DOM element.
 * @param el - The source DOM element.
 * @returns CapturedElement snapshot.
 */
export function captureElement(el: Element): CapturedElement | null {
  const elementData = extractUxElementData(el);
  if (!elementData) return null;
  const rect = el.getBoundingClientRect();
  return {
    elementData,
    textContent: (el.textContent ?? "").trim().slice(0, 200),
    domSelector: buildDomSelector(el),
    boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}
