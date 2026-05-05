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
  createdAt: string;
  /** Whether this annotation has been resolved. */
  isResolved?: boolean;
  /** ISO-8601 timestamp when the annotation was resolved. */
  resolvedAt?: string;
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

// ── Export Format ───────────────────────────────────────

/**
 * Schema version for the annotation export format.
 * Increment when the export structure changes.
 */
export const ANNOTATION_EXPORT_SCHEMA_VERSION = "1.0";

/**
 * Flat annotation record used in exports.
 * Fields are flattened from the nested UxAnnotation for agent-friendly consumption.
 *
 * The `status` field encodes the annotation lifecycle. It maps as follows:
 * - `isResolved: false` and no `resolvedAt` → "open"
 * - `isResolved: false` with agent-acknowledged → "in_progress"
 * - `isResolved: true` with `resolvedAt` set → "fixed" or "wont_fix" (see fixNote)
 * - `isResolved: false` awaiting human input → "needs_design_decision"
 */
export interface AnnotationRecord {
  id: string;
  route: string;
  pageTitle: string;
  uxId: string;
  uxComponent?: string;
  uxRole?: string;
  uxActionKind?: string;
  uxAttention?: string;
  issueType: UxIssueType;
  severity: UxAnnotationSeverity;
  comment: string;
  expectedChange?: string;
  selectorFallback: string;
  textSnapshot: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  createdAt: string;
  isResolved?: boolean;
  resolvedAt?: string;
  /** Lifecycle status — agents update this as they work through annotations. */
  status?: "open" | "in_progress" | "fixed" | "wont_fix" | "needs_design_decision";
  /** Human-readable summary of what was changed (set when status is "fixed"). */
  fixSummary?: string;
  /** List of files modified to fix this annotation. */
  filesChanged?: string[];
  /** Any remaining notes or caveats about the fix. */
  remainingNotes?: string;
  /** How the fix was verified (e.g., "manual: dev server at 1440×900"). */
  verificationStatus?: string;
}

/**
 * Full JSON export envelope for UX annotations.
 * Designed to be consumed by coding agents to locate and fix UI issues.
 */
export interface AnnotationExport {
  /** Schema version for forwards-compatibility. */
  schemaVersion: string;
  /** ISO-8601 timestamp of when the export was generated. */
  generatedAt: string;
  /** The page route these annotations belong to (or empty for all-session). */
  route: string;
  /** Page title at time of export. */
  pageTitle: string;
  /** Viewport dimensions at time of export. */
  viewport: { width: number; height: number };
  /** Flat annotation records. */
  annotations: AnnotationRecord[];
  /**
   * Instructions for the agent consuming this export.
   * These are fixed guidelines that accompany every export.
   */
  _instructions: string;
}

// ── Partial update type ─────────────────────────────────

/**
 * Fields on an annotation that can be updated after creation.
 */
export type AnnotationUpdate = Partial<Pick<UxAnnotation,
  "issueType" | "severity" | "comment" | "expectedChange" | "screenshotNote" | "isResolved" | "resolvedAt"
>>;

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
  /** Annotations filtered to the current page route. */
  pageAnnotations: UxAnnotation[];
  /** Total count of annotations across all pages. */
  annotationCount: number;
  /** Count of annotations on the current page route. */
  pageAnnotationCount: number;
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
  /** Partially update an existing annotation by ID. */
  updateAnnotation: (id: string, updates: AnnotationUpdate) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Clear all annotations (optionally filtered to a route). */
  clearAnnotations: (route?: string) => void;
  /** Export all annotations as a legacy JSON blob (simple stringify). */
  exportAnnotations: () => string;
  /** Export annotations as structured JSON (optionally filtered to route). */
  exportJson: (route?: string) => string;
  /** Export annotations as Markdown (optionally filtered to route). */
  exportMarkdown: (route?: string) => string;
}

// ── Export Instructions ─────────────────────────────────

/**
 * Fixed instructions embedded in every export to guide downstream agents.
 * These are intentionally written as a directive — not as metadata.
 */
export const EXPORT_INSTRUCTIONS =
  "Only change presentation, hierarchy, grouping, labeling, density, or default visibility. " +
  "Do not remove data or settings. " +
  "Keep full detail accessible through details, expansion, audit history, or AdvancedDiagnostics.";

// ── Conversion helpers ──────────────────────────────────

/**
 * Converts an internal UxAnnotation to a flat AnnotationRecord for export.
 * Derives the `status` field from `isResolved` and `resolvedAt`.
 */
export function annotationToRecord(ann: UxAnnotation): AnnotationRecord {
  const status: AnnotationRecord["status"] = ann.isResolved
    ? "fixed"
    : ann.resolvedAt
      ? "needs_design_decision"
      : "open";

  return {
    id: ann.id,
    route: ann.route,
    pageTitle: ann.pageTitle,
    uxId: ann.element.elementData.uxId,
    uxComponent: ann.element.elementData.uxComponent,
    uxRole: ann.element.elementData.uxRole,
    uxActionKind: ann.element.elementData.uxActionKind,
    uxAttention: ann.element.elementData.uxAttention,
    issueType: ann.issueType,
    severity: ann.severity,
    comment: ann.comment,
    expectedChange: ann.expectedChange,
    selectorFallback: ann.element.domSelector,
    textSnapshot: ann.element.textContent,
    boundingBox: ann.element.boundingBox,
    createdAt: ann.createdAt,
    isResolved: ann.isResolved,
    resolvedAt: ann.resolvedAt,
    status,
  };
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
