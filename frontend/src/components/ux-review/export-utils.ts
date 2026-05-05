/**
 * Export utilities for UX Review annotations.
 *
 * Converts internal annotations to structured formats (JSON and Markdown)
 * that coding agents can consume to locate and fix UI issues.
 */

import type { UxAnnotation, AnnotationExport, AnnotationRecord } from "./types";
import {
  ANNOTATION_EXPORT_SCHEMA_VERSION,
  EXPORT_INSTRUCTIONS,
  UX_ISSUE_LABELS,
  UX_SEVERITY_LABELS,
  annotationToRecord,
} from "./types";

/**
 * Marker comment embedded at the top of every exported Markdown to instruct
 * downstream agents on the scope of changes they are permitted to make.
 */
const MARKDOWN_HEADER_COMMENT =
  "<!--\n" +
  "  UX REVIEW ANNOTATION EXPORT — AGENT INSTRUCTIONS\n" +
  "  " + EXPORT_INSTRUCTIONS + "\n" +
  "-->\n";

// ── JSON Export ─────────────────────────────────────────

/**
 * Builds an AnnotationExport envelope from a list of annotations.
 *
 * @param annotations - The annotations to include.
 * @param route - Page route filter (empty string means all pages).
 * @param pageTitle - Current page title.
 * @returns A fully populated AnnotationExport object ready for JSON.stringify.
 */
export function buildAnnotationExport(
  annotations: UxAnnotation[],
  route: string,
  pageTitle: string,
): AnnotationExport {
  const records: AnnotationRecord[] = annotations.map(annotationToRecord);

  return {
    schemaVersion: ANNOTATION_EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    route,
    pageTitle,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    annotations: records,
    _instructions: EXPORT_INSTRUCTIONS,
  };
}

/**
 * Formats annotations as a pretty-printed JSON string.
 *
 * @param annotations - Annotations to export.
 * @param route - Page route filter label.
 * @param pageTitle - Current page title.
 * @returns Formatted JSON string.
 */
export function formatAnnotationsJson(
  annotations: UxAnnotation[],
  route: string,
  pageTitle: string,
): string {
  const exportData = buildAnnotationExport(annotations, route, pageTitle);
  return JSON.stringify(exportData, null, 2);
}

// ── Markdown Export ─────────────────────────────────────

/**
 * Formats annotations as a Markdown document readable by task-manager agents.
 *
 * The output includes:
 * - Header with instructions for the agent
 * - Page-level summary
 * - Per-annotation sections with element, issue, expected change, and metadata
 *
 * @param annotations - Annotations to export.
 * @param route - Page route filter label.
 * @param pageTitle - Current page title.
 * @returns Formatted Markdown string.
 */
export function formatAnnotationsMarkdown(
  annotations: UxAnnotation[],
  route: string,
  pageTitle: string,
): string {
  if (annotations.length === 0) {
    return (
      MARKDOWN_HEADER_COMMENT +
      "\n# UX Review Annotations\n\n" +
      "**No annotations for this page.**\n"
    );
  }

  const lines: string[] = [];

  // Header
  lines.push(MARKDOWN_HEADER_COMMENT);
  lines.push("# UX Review Annotations");
  lines.push("");
  lines.push(`**Page:** ${route || "(all pages)"}`);
  lines.push(`**Title:** ${pageTitle}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Annotation count:** ${annotations.length}`);
  lines.push("");

  // Instructions section
  lines.push("## Instructions");
  lines.push("");
  lines.push(`- ${EXPORT_INSTRUCTIONS.replace(/\. /g, ".\n- ")}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Per-annotation sections
  annotations.forEach((ann, index) => {
    const record = annotationToRecord(ann);
    const severityLabel = UX_SEVERITY_LABELS[ann.severity];
    const issueLabel = UX_ISSUE_LABELS[ann.issueType];

    lines.push(`## Annotation ${index + 1}`);
    lines.push("");

    // Page
    lines.push("### Page");
    lines.push(ann.route || "(unknown)");
    lines.push("");

    // Element
    lines.push("### Element");
    lines.push(`- **UX ID:** ${record.uxId}`);
    if (record.uxComponent) lines.push(`- **Component:** ${record.uxComponent}`);
    if (record.uxRole) lines.push(`- **Role:** ${record.uxRole}`);
    lines.push(`- **Selector:** \`${record.selectorFallback}\``);
    if (record.textSnapshot) {
      lines.push(`- **Text:** ${record.textSnapshot.slice(0, 200)}`);
    }
    lines.push("");

    // Issue
    lines.push("### Issue");
    lines.push(`- **Type:** ${issueLabel}`);
    lines.push(`- **Severity:** ${severityLabel}`);
    lines.push(`- **Comment:** ${ann.comment}`);
    lines.push("");

    // Expected change
    lines.push("### Expected Change");
    if (ann.expectedChange) {
      lines.push(ann.expectedChange);
    } else {
      lines.push("*(not specified)*");
    }
    lines.push("");

    // Metadata
    lines.push("### Metadata");
    lines.push(`- **Route:** ${ann.route}`);
    lines.push(`- **Created:** ${ann.createdAt}`);
    lines.push(`- **Viewport:** ${ann.viewportSize.width}\u00d7${ann.viewportSize.height}`);
    if (ann.isResolved) {
      lines.push(`- **Resolved:** ${ann.resolvedAt ?? "yes"}`);
    }
    lines.push("");

    // Separator between annotations
    if (index < annotations.length - 1) {
      lines.push("---");
      lines.push("");
    }
  });

  return lines.join("\n");
}

// ── Clipboard helper ────────────────────────────────────

/**
 * Copies text to the system clipboard.
 * Falls back to the legacy `document.execCommand("copy")` approach
 * if the Clipboard API is unavailable.
 *
 * @param text - The text to copy.
 * @returns A promise that resolves when copying completes.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Legacy fallback — may fail in sandboxed contexts
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    if (!document.execCommand("copy")) {
      console.warn("[UX Review] Clipboard fallback failed — copy may not have worked.");
    }
    document.body.removeChild(textarea);
  }
}

/**
 * Triggers a file download in the browser.
 *
 * @param content - String content to write.
 * @param filename - Desired filename.
 * @param mimeType - MIME type for the blob (default: application/json).
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
