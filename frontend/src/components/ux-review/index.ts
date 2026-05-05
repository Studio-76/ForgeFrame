/**
 * UX Review Mode — dev-only overlay for inspecting and annotating UI elements.
 *
 * ## Activation
 *
 * UX Review Mode requires ALL of:
 * 1. `import.meta.env.DEV` — dev build (tree-shaken in production)
 * 2. `import.meta.env.VITE_ENABLE_UX_REVIEW === "true"` — explicit opt-in
 * 3. `?uxReview=1` query parameter in the URL
 *
 * ## Usage
 *
 * The UxReviewProvider must wrap the application tree (inside main.tsx).
 * The overlay and panel are rendered automatically when UX Review Mode
 * is activated.
 *
 * ## Production safety
 *
 * In production builds, the provider renders children through a no-op,
 * the overlay and panel are never mounted, and all review code is
 * tree-shaken by Vite's minifier.
 *
 * @packageDocumentation
 */

export { UxReviewProvider } from "./UxReviewContext";
export { UxReviewOverlay } from "./UxReviewOverlay";
export { UxReviewPanel } from "./UxReviewPanel";
export { useUxReview } from "./useUxReview";
export type {
  UxReviewContextValue,
  UxElementData,
  CapturedElement,
  UxAnnotation,
  AnnotationRecord,
  AnnotationExport,
  AnnotationUpdate,
  UxIssueType,
  UxAnnotationSeverity,
} from "./types";
export {
  UX_ISSUE_LABELS,
  UX_SEVERITY_LABELS,
  ANNOTATION_EXPORT_SCHEMA_VERSION,
  EXPORT_INSTRUCTIONS,
  annotationToRecord,
  extractUxElementData,
  buildDomSelector,
  captureElement,
} from "./types";
export {
  buildAnnotationExport,
  formatAnnotationsJson,
  formatAnnotationsMarkdown,
  copyToClipboard,
  downloadAsFile,
} from "./export-utils";

// ── Automated UX Rule Warnings ──────────────────────────

export type {
  UxRuleId,
  UxRuleWarning,
  UxRuleWarningSeverity,
  UxRuleConfig,
  UxRulesConfig,
  UxRuleDefinition,
} from "./ux-rules";

export {
  UX_RULE_LABELS,
  RULE_DEFINITIONS,
  getDefaultRulesConfig,
  mergeRulesConfig,
  scanPageForUxWarnings,
} from "./ux-rules";
