/**
 * Annotation side panel for UX Review Mode.
 *
 * When a reviewer clicks an element with UX metadata, this panel slides in
 * from the right side of the viewport showing:
 * - Captured element metadata (uxId, component, role, action, attention, density)
 * - A form to add an annotation (issue type, severity, comment, expected change)
 * - A list of all session annotations with edit, resolve, and delete capabilities
 * - Export controls (JSON per-page, JSON all, Markdown per-page, clipboard, download)
 * - Clear controls (current page or all pages)
 *
 * The panel is positioned fixed to avoid interfering with page layout.
 * Panel elements do NOT carry data-ux-* attributes to avoid circular
 * metadata on the review tooling itself.
 */

import { useCallback, useId, useRef, useState } from "react";
import type {
  AnnotationUpdate,
  UxAnnotation,
  UxAnnotationSeverity,
  UxIssueType,
  UxReviewContextValue,
} from "./types";
import { UX_ISSUE_LABELS, UX_SEVERITY_LABELS } from "./types";
import type { UxRuleId, UxRuleWarning } from "./ux-rules";
import { RULE_DEFINITIONS, UX_RULE_LABELS } from "./ux-rules";
import { copyToClipboard, downloadAsFile } from "./export-utils";

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
    isEnabled,
    selectedElement,
    pageAnnotations,
    annotationCount,
    pageAnnotationCount,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearSelection,
    clearAnnotations,
    exportJson,
    pageRuleWarnings,
    pageRuleWarningCount,
    rulesConfig,
    dismissWarning,
    restoreWarning,
    convertWarningToAnnotation,
    updateRulesConfig,
    reRunRules,
  } = context;
  const [form, setForm] = useState<AnnotationForm>(INITIAL_FORM);
  const [panelTab, setPanelTab] = useState<"annotate" | "history" | "warnings" | "rules-settings">("annotate");
  const [copied, setCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [clearMenuOpen, setClearMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formId = useId();
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const clearMenuRef = useRef<HTMLDivElement>(null);

  const handleAdd = useCallback(() => {
    if (!form.comment.trim()) return;
    addAnnotation(
      form.issueType,
      form.severity,
      form.comment.trim(),
      form.expectedChange.trim() || undefined,
      form.screenshotNote.trim() || undefined,
    );
    setForm(INITIAL_FORM);
  }, [form, addAnnotation]);

  // ── Export handlers ─────────────────────────────────────

  const handleCopyJsonPage = useCallback(async () => {
    const json = exportJson(window.location.pathname);
    await copyToClipboard(json);
    setCopied(true);
    setExportMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [exportJson]);

  const handleCopyJsonAll = useCallback(async () => {
    const json = exportJson();
    await copyToClipboard(json);
    setCopied(true);
    setExportMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [exportJson]);

  const handleCopyMarkdownPage = useCallback(async () => {
    const { exportMarkdown } = context;
    const md = exportMarkdown(window.location.pathname);
    await copyToClipboard(md);
    setCopied(true);
    setExportMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [context]);

  const handleDownloadJsonPage = useCallback(() => {
    const json = exportJson(window.location.pathname);
    downloadAsFile(json, `ux-review-${window.location.pathname.replace(/\//g, "-") || "root"}.json`);
    setExportMenuOpen(false);
  }, [exportJson]);

  const handleDownloadJsonAll = useCallback(() => {
    const json = exportJson();
    downloadAsFile(json, `ux-review-all-${Date.now()}.json`);
    setExportMenuOpen(false);
  }, [exportJson]);

  // ── Clear handlers ────────────────────────────────────

  const handleClearPage = useCallback(() => {
    clearAnnotations(window.location.pathname);
    setClearMenuOpen(false);
  }, [clearAnnotations]);

  const handleClearAll = useCallback(() => {
    if (window.confirm("Clear all annotations across all pages? This cannot be undone.")) {
      clearAnnotations();
    }
    setClearMenuOpen(false);
  }, [clearAnnotations]);

  // ── Close menus on outside click (mounted once) ───────

  const handleBackdropClick = useCallback(() => {
    setExportMenuOpen(false);
    setClearMenuOpen(false);
    if (!editingId) {
      clearSelection();
    }
  }, [clearSelection, editingId]);

  if (!selectedElement || !isEnabled) return null;

  const { elementData, textContent, domSelector } = selectedElement;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
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
              {pageAnnotationCount} on this page &middot; {annotationCount} total
            </p>
          </div>
          <button
            onClick={() => { clearSelection(); setEditingId(null); }}
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
          <TabButton active={panelTab === "annotate"} onClick={() => { setPanelTab("annotate"); setEditingId(null); }}>
            Annotate
          </TabButton>
          <TabButton active={panelTab === "history"} onClick={() => setPanelTab("history")}>
            History ({pageAnnotationCount})
          </TabButton>
          <TabButton
            active={panelTab === "warnings" || panelTab === "rules-settings"}
            onClick={() => setPanelTab("warnings")}
            style={{ position: "relative" }}
          >
            Warnings
            {pageRuleWarningCount > 0 && (
              <span
                style={{
                  marginLeft: "4px",
                  background: "#f59e0b",
                  color: "#0b101b",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  padding: "1px 6px",
                  lineHeight: "14px",
                }}
              >
                {pageRuleWarningCount}
              </span>
            )}
          </TabButton>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {panelTab === "annotate" ? (
            <AnnotationFormSection form={form} onChange={setForm} onAdd={handleAdd} formId={formId} />
          ) : panelTab === "history" ? (
            <AnnotationListSection
              annotations={pageAnnotations}
              onRemove={removeAnnotation}
              onUpdate={updateAnnotation}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ) : panelTab === "warnings" ? (
            <WarningsSection
              warnings={pageRuleWarnings}
              rulesConfig={rulesConfig}
              onDismiss={dismissWarning}
              onRestore={restoreWarning}
              onConvertToAnnotation={convertWarningToAnnotation}
              onRescan={reRunRules}
              onOpenSettings={() => setPanelTab("rules-settings")}
            />
          ) : panelTab === "rules-settings" ? (
            <RulesSettingsSection
              rulesConfig={rulesConfig}
              onUpdateConfig={updateRulesConfig}
              onBack={() => setPanelTab("warnings")}
            />
          ) : null}
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
            position: "relative",
          }}
        >
          {/* Export button + dropdown */}
          <div ref={exportMenuRef} style={{ flex: 1, position: "relative" }}>
            <ActionButton
              onClick={() => { setExportMenuOpen((o) => !o); setClearMenuOpen(false); }}
              variant="primary"
            >
              {copied ? "Copied!" : `Export \u25BE`}
            </ActionButton>
            {exportMenuOpen && (
              <ExportDropdown
                onCopyJsonPage={handleCopyJsonPage}
                onCopyJsonAll={handleCopyJsonAll}
                onCopyMarkdownPage={handleCopyMarkdownPage}
                onDownloadJsonPage={handleDownloadJsonPage}
                onDownloadJsonAll={handleDownloadJsonAll}
              />
            )}
          </div>

          {/* Clear button + dropdown */}
          <div ref={clearMenuRef} style={{ flex: 1, position: "relative" }}>
            <ActionButton
              onClick={() => { setClearMenuOpen((o) => !o); setExportMenuOpen(false); }}
              variant="danger"
              disabled={annotationCount === 0}
            >
              Clear \u25BE
            </ActionButton>
            {clearMenuOpen && (
              <ClearDropdown
                pageAnnotationCount={pageAnnotationCount}
                onClearPage={handleClearPage}
                onClearAll={handleClearAll}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Export Dropdown ─────────────────────────────────────

type ExportDropdownItem =
  | { kind: "action"; label: string; action: () => void }
  | { kind: "divider" };

function ExportDropdown({
  onCopyJsonPage,
  onCopyJsonAll,
  onCopyMarkdownPage,
  onDownloadJsonPage,
  onDownloadJsonAll,
}: {
  onCopyJsonPage: () => void;
  onCopyJsonAll: () => void;
  onCopyMarkdownPage: () => void;
  onDownloadJsonPage: () => void;
  onDownloadJsonAll: () => void;
}) {
  const items: ExportDropdownItem[] = [
    { kind: "action", label: "Copy JSON (current page)", action: onCopyJsonPage },
    { kind: "action", label: "Copy JSON (all pages)", action: onCopyJsonAll },
    { kind: "action", label: "Copy Markdown (current page)", action: onCopyMarkdownPage },
    { kind: "divider" },
    { kind: "action", label: "Download JSON (current page)", action: onDownloadJsonPage },
    { kind: "action", label: "Download JSON (all pages)", action: onDownloadJsonAll },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: 4,
        background: "#0b101b",
        border: "1px solid #1e293b",
        borderRadius: "6px",
        overflow: "hidden",
        zIndex: 10,
      }}
    >
      {items.map((item, i) =>
        item.kind === "divider" ? (
          <div
            key={`div-${i}`}
            style={{ height: "1px", background: "#1e293b", margin: "4px 0" }}
          />
        ) : (
          <button
            key={item.label}
            onClick={item.action}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 12px",
              background: "none",
              border: "none",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "12px",
              textAlign: "left",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

// ── Clear Dropdown ──────────────────────────────────────

function ClearDropdown({
  pageAnnotationCount,
  onClearPage,
  onClearAll,
}: {
  pageAnnotationCount: number;
  onClearPage: () => void;
  onClearAll: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: 4,
        background: "#0b101b",
        border: "1px solid #1e293b",
        borderRadius: "6px",
        overflow: "hidden",
        zIndex: 10,
      }}
    >
      <button
        onClick={onClearPage}
        disabled={pageAnnotationCount === 0}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          background: "none",
          border: "none",
          color: pageAnnotationCount === 0 ? "#475569" : "#e2e8f0",
          cursor: pageAnnotationCount === 0 ? "default" : "pointer",
          fontSize: "12px",
          textAlign: "left",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        onMouseEnter={(e) => {
          if (pageAnnotationCount > 0) e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        Clear this page ({pageAnnotationCount})
      </button>
      <div style={{ height: "1px", background: "#1e293b" }} />
      <button
        onClick={onClearAll}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          background: "none",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: "12px",
          textAlign: "left",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        Clear all pages
      </button>
    </div>
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

/** Tab button for switching between panel views. */
function TabButton({ active, onClick, style, children }: { active: boolean; onClick: () => void; style?: React.CSSProperties; children: React.ReactNode }) {
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
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Styled action button for the panel footer. */
function ActionButton({ onClick, variant, disabled, children }: { onClick: () => void; variant: "primary" | "danger"; disabled?: boolean; children: React.ReactNode }) {
  const bg = variant === "danger" ? "rgba(239, 68, 68, 0.15)" : "rgba(6, 182, 212, 0.15)";
  const color = variant === "danger" ? "#ef4444" : "#06b6d4";
  const hoverBg = variant === "danger" ? "rgba(239, 68, 68, 0.25)" : "rgba(6, 182, 212, 0.25)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "8px 12px",
        background: disabled ? "#1e293b" : bg,
        border: `1px solid ${disabled ? "#1e293b" : `${color}33`}`,
        borderRadius: "6px",
        color: disabled ? "#475569" : color,
        cursor: disabled ? "default" : "pointer",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = bg;
      }}
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

/** Annotation list with edit, resolve, and delete support. */
function AnnotationListSection({
  annotations,
  onRemove,
  onUpdate,
  editingId,
  setEditingId,
}: {
  annotations: UxReviewContextValue["pageAnnotations"];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: AnnotationUpdate) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
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
      {annotations.map((ann) =>
        editingId === ann.id ? (
          <EditAnnotationCard
            key={ann.id}
            annotation={ann}
            onSave={(updates) => {
              onUpdate(ann.id, updates);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <AnnotationCard
            key={ann.id}
            annotation={ann}
            onRemove={onRemove}
            onEdit={() => setEditingId(ann.id)}
            onToggleResolve={() => {
              onUpdate(ann.id, {
                isResolved: !ann.isResolved,
                resolvedAt: ann.isResolved ? undefined : new Date().toISOString(),
              });
            }}
          />
        ),
      )}
    </div>
  );
}

/** Single annotation display card. */
function AnnotationCard({
  annotation: ann,
  onRemove,
  onEdit,
  onToggleResolve,
}: {
  annotation: UxAnnotation;
  onRemove: (id: string) => void;
  onEdit: () => void;
  onToggleResolve: () => void;
}) {
  return (
    <div
      style={{
        background: ann.isResolved ? "rgba(34, 197, 94, 0.05)" : "#0b101b",
        border: `1px solid ${ann.isResolved ? "rgba(34, 197, 94, 0.2)" : "#1e293b"}`,
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "12px",
        opacity: ann.isResolved ? 0.7 : 1,
      }}
    >
      {/* Header row: severity badge, issue type, actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <SeverityBadge severity={ann.severity} />
          <span style={{ color: "#06b6d4", fontWeight: 500, fontSize: "11px" }}>
            {UX_ISSUE_LABELS[ann.issueType]}
          </span>
          {ann.isResolved ? (
            <span style={{ color: "#22c55e", fontSize: "10px", fontWeight: 500 }}>
              Resolved
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {/* Resolve toggle */}
          <button
            onClick={onToggleResolve}
            aria-label={ann.isResolved ? "Mark unresolved" : "Mark resolved"}
            title={ann.isResolved ? "Mark unresolved" : "Mark resolved"}
            style={{
              background: "none",
              border: `1px solid ${ann.isResolved ? "#22c55e" : "#475569"}`,
              borderRadius: "3px",
              color: ann.isResolved ? "#22c55e" : "#475569",
              cursor: "pointer",
              fontSize: "10px",
              padding: "1px 4px",
              lineHeight: 1.2,
            }}
          >
            {ann.isResolved ? "\u2713" : "\u25CB"}
          </button>
          {/* Edit button */}
          <button
            onClick={onEdit}
            aria-label="Edit annotation"
            title="Edit"
            style={{
              background: "none",
              border: "1px solid #475569",
              borderRadius: "3px",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "10px",
              padding: "1px 4px",
              lineHeight: 1.2,
            }}
          >
            Edit
          </button>
          {/* Delete button */}
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
      </div>
      <p style={{ margin: "0 0 4px", color: "#e2e8f0", lineHeight: 1.4 }}>{ann.comment}</p>
      {ann.expectedChange ? (
        <p style={{ margin: "0 0 4px", color: "#94a3b8", fontStyle: "italic" }}>
          Expected: {ann.expectedChange}
        </p>
      ) : null}
      <div style={{ color: "#475569", fontSize: "10px", display: "flex", gap: "12px" }}>
        <span>{ann.element.elementData.uxId}</span>
        <span>{new Date(ann.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

/** Inline edit form for an existing annotation. */
function EditAnnotationCard({
  annotation: ann,
  onSave,
  onCancel,
}: {
  annotation: UxAnnotation;
  onSave: (updates: AnnotationUpdate) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const [issueType, setIssueType] = useState<UxIssueType>(ann.issueType);
  const [severity, setSeverity] = useState<UxAnnotationSeverity>(ann.severity);
  const [comment, setComment] = useState(ann.comment);
  const [expectedChange, setExpectedChange] = useState(ann.expectedChange ?? "");

  const handleSave = useCallback(() => {
    if (!comment.trim()) return;
    onSave({
      issueType,
      severity,
      comment: comment.trim(),
      expectedChange: expectedChange.trim() || undefined,
    });
  }, [issueType, severity, comment, expectedChange, onSave]);

  return (
    <div
      style={{
        background: "rgba(6, 182, 212, 0.05)",
        border: "1px solid rgba(6, 182, 212, 0.3)",
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Issue
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as UxIssueType)}
              style={{ ...inputStyle, fontSize: "11px", padding: "4px 6px" }}
            >
              {(Object.keys(UX_ISSUE_LABELS) as UxIssueType[]).map((t) => (
                <option key={t} value={t}>{UX_ISSUE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as UxAnnotationSeverity)}
              style={{ ...inputStyle, fontSize: "11px", padding: "4px 6px" }}
            >
              {(Object.keys(UX_SEVERITY_LABELS) as UxAnnotationSeverity[]).map((s) => (
                <option key={s} value={s}>{UX_SEVERITY_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            style={{ ...inputStyle, fontSize: "11px", padding: "4px 6px", resize: "vertical", minHeight: "40px" }}
          />
        </div>
        <div>
          <label style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Expected change
          </label>
          <textarea
            value={expectedChange}
            onChange={(e) => setExpectedChange(e.target.value)}
            rows={1}
            style={{ ...inputStyle, fontSize: "11px", padding: "4px 6px", resize: "vertical", minHeight: "24px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid #475569",
              borderRadius: "4px",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!comment.trim()}
            style={{
              padding: "4px 10px",
              background: comment.trim() ? "#06b6d4" : "#1e293b",
              border: "none",
              borderRadius: "4px",
              color: comment.trim() ? "#0b101b" : "#475569",
              cursor: comment.trim() ? "pointer" : "default",
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Save
          </button>
        </div>
      </div>
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

// ── Warnings Section ──────────────────────────────────

/**
 * Props for WarningsSection component.
 */
interface WarningsSectionProps {
  warnings: UxRuleWarning[];
  rulesConfig: import("./ux-rules").UxRulesConfig;
  onDismiss: (warningId: string) => void;
  onRestore: (warningId: string) => void;
  onConvertToAnnotation: (warning: UxRuleWarning) => void;
  onRescan: () => void;
  onOpenSettings: () => void;
}

/**
 * Displays automated UX rule warnings with dismiss and convert-to-annotation actions.
 */
function WarningsSection({
  warnings,
  onDismiss,
  onRestore,
  onConvertToAnnotation,
  onRescan,
  onOpenSettings,
}: WarningsSectionProps) {
  const [showDismissed, setShowDismissed] = useState(false);

  // ── Toolbar ──
  const toolbar = (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginBottom: "10px",
        flexWrap: "wrap",
      }}
    >
      <MiniButton onClick={onRescan} title="Re-scan the page for UX rule violations">
        Rescan
      </MiniButton>
      <MiniButton onClick={onOpenSettings} title="Configure which rules are active">
        Settings
      </MiniButton>
      <MiniButton
        onClick={() => setShowDismissed((s) => !s)}
        variant={showDismissed ? "primary" : "default"}
        title={showDismissed ? "Hide dismissed warnings" : "Show dismissed warnings"}
      >
        {showDismissed ? "Hide dismissed" : "Show dismissed"}
      </MiniButton>
    </div>
  );

  // ── Empty state ──
  if (warnings.length === 0 && !showDismissed) {
    return (
      <div>
        {toolbar}
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          No UX rule violations detected.
        </div>
      </div>
    );
  }

  // ── Warning cards ──
  const displayWarnings = showDismissed
    ? warnings
    : warnings.filter((w) => !w.isDismissed);

  if (displayWarnings.length === 0) {
    return (
      <div>
        {toolbar}
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          All warnings dismissed. Click "Show dismissed" to review or restore them.
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {displayWarnings.map((w) => (
          <WarningCard
            key={w.id}
            warning={w}
            onDismiss={onDismiss}
            onRestore={onRestore}
            onConvertToAnnotation={onConvertToAnnotation}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Single warning card showing rule name, severity, message, fix, and action buttons.
 */
function WarningCard({
  warning: w,
  onDismiss,
  onRestore,
  onConvertToAnnotation,
}: {
  warning: UxRuleWarning;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onConvertToAnnotation: (w: UxRuleWarning) => void;
}) {
  const severityColorMap: Record<string, string> = {
    critical: "#ef4444",
    major: "#f59e0b",
    minor: "#06b6d4",
    suggestion: "#22c55e",
  };
  const color = severityColorMap[w.severity] ?? "#64748b";
  const isDismissed = w.isDismissed;

  return (
    <div
      style={{
        background: isDismissed ? "rgba(71, 85, 105, 0.1)" : "#0b101b",
        border: `1px solid ${isDismissed ? "#334155" : `${color}33`}`,
        borderLeft: `3px solid ${isDismissed ? "#475569" : color}`,
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "12px",
        opacity: isDismissed ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flex: 1 }}>
          <SeverityBadge severity={w.severity} />
          <span style={{ color: "#06b6d4", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {UX_RULE_LABELS[w.ruleId] ?? w.ruleId}
          </span>
          {w.count !== undefined && w.count > 1 && (
            <span style={{ color: "#64748b", fontSize: "10px" }}>
              ({w.count} el.)
            </span>
          )}
          {isDismissed && (
            <span style={{ color: "#64748b", fontSize: "10px", fontStyle: "italic" }}>
              Dismissed
            </span>
          )}
        </div>
      </div>

      <p style={{ margin: "0 0 6px", color: isDismissed ? "#64748b" : "#e2e8f0", lineHeight: 1.4, fontSize: "12px" }}>
        {w.message}
      </p>
      <p style={{ margin: "0 0 6px", color: "#94a3b8", fontStyle: "italic", fontSize: "11px", lineHeight: 1.4 }}>
        Fix: {w.suggestedFix}
      </p>
      {w.affectedElement.uxId && (
        <div style={{ color: "#64748b", fontSize: "10px", marginBottom: 6 }}>
          Element: {w.affectedElement.uxId}
          {w.affectedElement.uxComponent ? ` (${w.affectedElement.uxComponent})` : ""}
          {w.affectedElement.uxRole ? ` [${w.affectedElement.uxRole}]` : ""}
        </div>
      )}
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", borderTop: "1px solid #1e293b", paddingTop: "6px" }}>
        {isDismissed ? (
          <MiniButton
            onClick={() => onRestore(w.id)}
            title="Restore this warning"
            variant="primary"
          >
            Restore
          </MiniButton>
        ) : (
          <>
            <MiniButton
              onClick={() => onConvertToAnnotation(w)}
              title="Save this warning as an annotation"
              variant="primary"
            >
              + Annotation
            </MiniButton>
            <MiniButton
              onClick={() => onDismiss(w.id)}
              title="Dismiss this warning"
              variant="danger"
            >
              Dismiss
            </MiniButton>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Small compact button for the warnings section toolbar.
 */
function MiniButton({
  onClick,
  variant,
  title,
  children,
}: {
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const colors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    default: { bg: "#1e293b", color: "#94a3b8", hoverBg: "#334155" },
    primary: { bg: "rgba(6, 182, 212, 0.15)", color: "#06b6d4", hoverBg: "rgba(6, 182, 212, 0.25)" },
    danger: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", hoverBg: "rgba(239, 68, 68, 0.25)" },
  };
  const c = colors[variant ?? "default"];

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "4px 10px",
        background: c.bg,
        border: "none",
        borderRadius: "4px",
        color: c.color,
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 500,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "background 0.15s ease",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = c.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = c.bg; }}
    >
      {children}
    </button>
  );
}

// ── Rules Settings Section ──────────────────────────────

/**
 * Props for RulesSettingsSection component.
 */
interface RulesSettingsSectionProps {
  rulesConfig: import("./ux-rules").UxRulesConfig;
  onUpdateConfig: (config: Partial<import("./ux-rules").UxRulesConfig>) => void;
  onBack: () => void;
}

/**
 * Sub-panel for configuring rule enable/disable, thresholds, and ignore lists.
 */
function RulesSettingsSection({
  rulesConfig,
  onUpdateConfig,
  onBack,
}: RulesSettingsSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <button
          onClick={onBack}
          aria-label="Back to warnings"
          style={{
            background: "none",
            border: "none",
            color: "#06b6d4",
            cursor: "pointer",
            fontSize: "16px",
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          &larr;
        </button>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
          Rules Settings
        </h3>
      </div>

      <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
        Enable or disable individual rules, adjust thresholds, and suppress specific elements.
      </p>

      {/* Rule list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {RULE_DEFINITIONS.map((def) => {
          const cfg = rulesConfig[def.id];
          if (!cfg) return null;
          return (
            <RuleSettingsCard
              key={def.id}
              ruleId={def.id}
              definition={def}
              config={cfg}
              onUpdate={(partial) =>
                onUpdateConfig({ [def.id]: { ...cfg, ...partial } })
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single rule configuration card inside the settings panel.
 */
function RuleSettingsCard({
  ruleId,
  definition: def,
  config,
  onUpdate,
}: {
  ruleId: UxRuleId;
  definition: import("./ux-rules").UxRuleDefinition;
  config: import("./ux-rules").UxRuleConfig;
  onUpdate: (partial: Partial<import("./ux-rules").UxRuleConfig>) => void;
}) {
  const [ignoreInput, setIgnoreInput] = useState<string>(
    (config.ignoreUxIds ?? []).join(", "),
  );

  const handleIgnoreBlur = useCallback(() => {
    const ids = ignoreInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate({ ignoreUxIds: ids });
  }, [ignoreInput, onUpdate]);

  return (
    <div
      style={{
        background: "#0b101b",
        border: "1px solid #1e293b",
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "12px",
      }}
    >
      {/* Header row: toggle + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        {/* Toggle */}
        <label
          style={{
            position: "relative",
            display: "inline-block",
            width: "32px",
            height: "18px",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: config.enabled ? "#06b6d4" : "#334155",
              borderRadius: "18px",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "2px",
                left: config.enabled ? "16px" : "2px",
                width: "14px",
                height: "14px",
                background: "#e2e8f0",
                borderRadius: "50%",
                transition: "left 0.2s",
              }}
            />
          </span>
        </label>

        <div style={{ flex: 1 }}>
          <div style={{ color: "#06b6d4", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {def.name}
          </div>
          <div style={{ color: "#64748b", fontSize: "10px", marginTop: "1px" }}>
            {def.description}
          </div>
        </div>
      </div>

      {/* Threshold */}
      {def.defaultThreshold > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <label
            style={{
              fontSize: "10px",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              flexShrink: 0,
              width: "72px",
            }}
          >
            Threshold
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={config.threshold ?? def.defaultThreshold}
            onChange={(e) =>
              onUpdate({ threshold: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            style={{
              width: "60px",
              padding: "3px 6px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "4px",
              color: "#e2e8f0",
              fontSize: "11px",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          />
        </div>
      )}

      {/* Ignore UX IDs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label
          style={{
            fontSize: "10px",
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
            width: "72px",
          }}
        >
          Ignore IDs
        </label>
        <input
          type="text"
          value={ignoreInput}
          onChange={(e) => setIgnoreInput(e.target.value)}
          onBlur={handleIgnoreBlur}
          placeholder="ux-id-1, ux-id-2"
          style={{
            flex: 1,
            padding: "3px 6px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "4px",
            color: "#e2e8f0",
            fontSize: "11px",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        />
      </div>
    </div>
  );
}
