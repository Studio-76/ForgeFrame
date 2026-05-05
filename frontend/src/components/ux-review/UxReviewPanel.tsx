/**
 * Annotation side panel for UX Review Mode.
 *
 * When a reviewer clicks an element with UX metadata, this panel slides in
 * from the right side of the viewport showing:
 * - Captured element metadata (uxId, component, role, action, attention, density)
 * - A form to add an annotation (issue type, severity, comment, expected change)
 * - A list of all session annotations with delete capability
 * - Export and clear-all controls
 *
 * The panel is positioned fixed to avoid interfering with page layout.
 * Panel elements do NOT carry data-ux-* attributes to avoid circular
 * metadata on the review tooling itself.
 */

import { useCallback, useId, useState } from "react";
import type { UxAnnotationSeverity, UxIssueType, UxReviewContextValue } from "./types";
import { UX_ISSUE_LABELS, UX_SEVERITY_LABELS } from "./types";

/** Width of the side panel in pixels. */
const PANEL_WIDTH = 380;

/**
 * Props for the UxReviewPanel component.
 */
export type UxReviewPanelProps = {
  /** The current UX Review context. */
  context: UxReviewContextValue;
};

/**
 * Form state for a new annotation being composed.
 */
interface AnnotationForm {
  issueType: UxIssueType;
  severity: UxAnnotationSeverity;
  comment: string;
  expectedChange: string;
  screenshotNote: string;
}

const INITIAL_FORM: AnnotationForm = {
  issueType: "other",
  severity: "minor",
  comment: "",
  expectedChange: "",
  screenshotNote: "",
};

// ── Inline panel component (no React Aria, plain HTML for review tool) ──
//
// We deliberately use plain semantic HTML for the panel instead of the
// ForgeFrame UI primitives to:
// 1. Avoid the panel accidentally devouring its own UX metadata
// 2. Keep the review tooling self-contained and easily removable
// 3. Avoid circular dependencies (the review tool reviews itself)

/**
 * Side panel for inspecting and annotating UX elements.
 */
export function UxReviewPanel({ context }: UxReviewPanelProps) {
  const {
    selectedElement,
    annotations,
    annotationCount,
    addAnnotation,
    removeAnnotation,
    clearSelection,
    exportAnnotations,
  } = context;
  const [form, setForm] = useState<AnnotationForm>(INITIAL_FORM);
  const [panelTab, setPanelTab] = useState<"form" | "list">("form");
  const [copied, setCopied] = useState(false);
  const formId = useId();

  const handleAdd = useCallback(() => {
    if (!form.comment.trim()) return;
    addAnnotation(form.issueType, form.severity, form.comment.trim(), form.expectedChange.trim() || undefined, form.screenshotNote.trim() || undefined);
    setForm(INITIAL_FORM);
  }, [form, addAnnotation]);

  const handleExport = useCallback(() => {
    const json = exportAnnotations();
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: create a blob and trigger download
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ux-review-annotations-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [exportAnnotations]);

  if (!selectedElement || !context.isEnabled) return null;

  const { elementData, textContent, domSelector } = selectedElement;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={clearSelection}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99996,
          background: "rgba(0,0,0,0.3)",
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="UX Review Annotation Panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: PANEL_WIDTH,
          height: "100vh",
          zIndex: 99997,
          background: "#0f172a",
          borderLeft: "1px solid #1e293b",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "13px",
          color: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e293b",
            background: "#0b101b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#06b6d4",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              UX Review
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
              {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={clearSelection}
            aria-label="Close panel"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Selected Element Info ── */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e293b",
            flexShrink: 0,
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <tbody>
              {renderRow("ID", elementData.uxId)}
              {elementData.uxComponent ? renderRow("Component", elementData.uxComponent) : null}
              {elementData.uxRole ? renderRow("Role", elementData.uxRole) : null}
              {elementData.uxPage ? renderRow("Page", elementData.uxPage) : null}
              {elementData.uxActionKind ? renderRow("Action", elementData.uxActionKind) : null}
              {elementData.uxAttention ? renderRow("Attention", elementData.uxAttention) : null}
              {elementData.uxDensity ? renderRow("Density", elementData.uxDensity) : null}
              {renderRow("Selector", domSelector, true)}
              {textContent ? renderRow("Text", textContent.slice(0, 120), true) : null}
            </tbody>
          </table>
        </div>

        {/* ── Tab Bar ── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #1e293b",
            flexShrink: 0,
          }}
        >
          <TabButton active={panelTab === "form"} onClick={() => setPanelTab("form")}>
            Annotate
          </TabButton>
          <TabButton active={panelTab === "list"} onClick={() => setPanelTab("list")}>
            History ({annotationCount})
          </TabButton>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {panelTab === "form" ? (
            <AnnotationFormSection form={form} onChange={setForm} onAdd={handleAdd} formId={formId} />
          ) : (
            <AnnotationListSection
              annotations={annotations}
              onRemove={removeAnnotation}
            />
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            gap: "8px",
            flexShrink: 0,
            background: "#0b101b",
          }}
        >
          <ActionButton onClick={handleExport} variant="primary">
            {copied ? "Copied!" : "Export JSON"}
          </ActionButton>
          {annotationCount > 0 ? (
            <ActionButton onClick={() => { if (window.confirm("Clear all annotations for this session?")) annotations.forEach((a) => removeAnnotation(a.id)); }} variant="danger">
              Clear All
            </ActionButton>
          ) : null}
        </div>
      </aside>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────

/** Single metadata row in the element info table. */
function renderRow(label: string, value: string, mono?: boolean): React.ReactNode {
  return (
    <tr>
      <td style={{ padding: "2px 8px 2px 0", color: "#64748b", whiteSpace: "nowrap", verticalAlign: "top", width: "72px" }}>
        {label}
      </td>
      <td style={{ padding: "2px 0", color: "#e2e8f0", wordBreak: "break-all", fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : undefined, fontSize: mono ? "11px" : "12px" }}>
        {value}
      </td>
    </tr>
  );
}

/** Tab button for switching between form and history views. */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: active ? "rgba(6, 182, 212, 0.1)" : "transparent",
        border: "none",
        borderBottom: active ? "2px solid #06b6d4" : "2px solid transparent",
        color: active ? "#06b6d4" : "#64748b",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

/** Styled action button for the panel footer. */
function ActionButton({ onClick, variant, children }: { onClick: () => void; variant: "primary" | "danger"; children: React.ReactNode }) {
  const bg = variant === "danger" ? "rgba(239, 68, 68, 0.15)" : "rgba(6, 182, 212, 0.15)";
  const color = variant === "danger" ? "#ef4444" : "#06b6d4";
  const hoverBg = variant === "danger" ? "rgba(239, 68, 68, 0.25)" : "rgba(6, 182, 212, 0.25)";
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: "6px",
        color,
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = bg; }}
    >
      {children}
    </button>
  );
}

/** Annotation form section inside the panel. */
function AnnotationFormSection({
  form,
  onChange,
  onAdd,
  formId,
}: {
  form: AnnotationForm;
  onChange: (f: AnnotationForm) => void;
  onAdd: () => void;
  formId: string;
}) {
  const issueTypeId = `${formId}-issue-type`;
  const severityId = `${formId}-severity`;
  const commentId = `${formId}-comment`;
  const expectedId = `${formId}-expected`;
  const screenshotId = `${formId}-screenshot`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Issue type */}
      <Field label="Issue type" htmlFor={issueTypeId}>
        <select
          id={issueTypeId}
          value={form.issueType}
          onChange={(e) => onChange({ ...form, issueType: e.target.value as UxIssueType })}
          style={inputStyle}
        >
          {(Object.keys(UX_ISSUE_LABELS) as UxIssueType[]).map((type) => (
            <option key={type} value={type}>{UX_ISSUE_LABELS[type]}</option>
          ))}
        </select>
      </Field>

      {/* Severity */}
      <Field label="Severity" htmlFor={severityId}>
        <select
          id={severityId}
          value={form.severity}
          onChange={(e) => onChange({ ...form, severity: e.target.value as UxAnnotationSeverity })}
          style={inputStyle}
        >
          {(Object.keys(UX_SEVERITY_LABELS) as UxAnnotationSeverity[]).map((sev) => (
            <option key={sev} value={sev}>{UX_SEVERITY_LABELS[sev]}</option>
          ))}
        </select>
      </Field>

      {/* Comment */}
      <Field label="Comment" htmlFor={commentId}>
        <textarea
          id={commentId}
          value={form.comment}
          onChange={(e) => onChange({ ...form, comment: e.target.value })}
          placeholder="Describe the UX issue..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
        />
      </Field>

      {/* Expected change */}
      <Field label="Expected change (optional)" htmlFor={expectedId}>
        <textarea
          id={expectedId}
          value={form.expectedChange}
          onChange={(e) => onChange({ ...form, expectedChange: e.target.value })}
          placeholder="What should change?"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", minHeight: "40px" }}
        />
      </Field>

      {/* Screenshot note */}
      <Field label="Screenshot note (optional)" htmlFor={screenshotId}>
        <input
          id={screenshotId}
          type="text"
          value={form.screenshotNote}
          onChange={(e) => onChange({ ...form, screenshotNote: e.target.value })}
          placeholder="e.g. screenshot-001.png"
          style={inputStyle}
        />
      </Field>

      {/* Submit */}
      <button
        onClick={onAdd}
        disabled={!form.comment.trim()}
        style={{
          padding: "8px 16px",
          background: form.comment.trim() ? "#06b6d4" : "#1e293b",
          border: "none",
          borderRadius: "6px",
          color: form.comment.trim() ? "#0b101b" : "#475569",
          cursor: form.comment.trim() ? "pointer" : "default",
          fontSize: "13px",
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
          transition: "background 0.15s ease",
          marginTop: 4,
        }}
      >
        Add Annotation
      </button>
    </div>
  );
}

/** Label + input wrapper. */
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label htmlFor={htmlFor} style={{ fontSize: "11px", fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Shared input/select/textarea style. */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  background: "#0b101b",
  border: "1px solid #1e293b",
  borderRadius: "4px",
  color: "#e2e8f0",
  fontSize: "13px",
  fontFamily: "'Inter', system-ui, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

/** Annotation list with delete support. */
function AnnotationListSection({
  annotations,
  onRemove,
}: {
  annotations: UxReviewContextValue["annotations"];
  onRemove: (id: string) => void;
}) {
  if (annotations.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0", color: "#64748b", fontSize: "13px" }}>
        No annotations yet. Select a UX element and add a comment.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {annotations.map((ann) => (
        <div
          key={ann.id}
          style={{
            background: "#0b101b",
            border: "1px solid #1e293b",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <SeverityBadge severity={ann.severity} />
              <span style={{ color: "#06b6d4", fontWeight: 500, fontSize: "11px" }}>
                {UX_ISSUE_LABELS[ann.issueType]}
              </span>
            </div>
            <button
              onClick={() => onRemove(ann.id)}
              aria-label="Delete annotation"
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                fontSize: "14px",
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "0 0 4px", color: "#e2e8f0", lineHeight: 1.4 }}>{ann.comment}</p>
          {ann.expectedChange ? (
            <p style={{ margin: "0 0 4px", color: "#94a3b8", fontStyle: "italic" }}>
              Expected: {ann.expectedChange}
            </p>
          ) : null}
          <div style={{ color: "#475569", fontSize: "10px", display: "flex", gap: "12px" }}>
            <span>{ann.element.elementData.uxId}</span>
            <span>{new Date(ann.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small colored badge for severity. */
function SeverityBadge({ severity }: { severity: UxAnnotationSeverity }) {
  const colorMap: Record<UxAnnotationSeverity, string> = {
    critical: "#ef4444",
    major: "#f59e0b",
    minor: "#06b6d4",
    suggestion: "#22c55e",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: colorMap[severity],
        flexShrink: 0,
      }}
    />
  );
}
