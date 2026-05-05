# UX Review Mode

A dev-only inspection and annotation tool for reviewing UI element presentation. Reviewers can hover any UI element with `data-ux-*` attributes, annotate issues, and export structured JSON or Markdown for agent handoff.

---

## Table of Contents

- [Activation](#activation)
- [Quick Start](#quick-start)
- [Adding UX Metadata to Components](#adding-ux-metadata-to-components)
- [Annotation Workflow](#annotation-workflow)
- [Export Formats](#export-formats)
- [Export Format for Agent Handoff](#export-format-for-agent-handoff)
- [Programmatic API](#programmatic-api)
- [Production Safety](#production-safety)
- [Troubleshooting](#troubleshooting)

---

## Activation

UX Review Mode requires **all three** conditions to be true:

| Gate | Check | How to set |
|------|-------|------------|
| 1. Dev build | `import.meta.env.DEV` | Run `npm run dev` (not production build) |
| 2. Feature flag | `VITE_ENABLE_UX_REVIEW === "true"` | Set in `frontend/.env` |
| 3. URL parameter | `?uxReview=1` | Append to the URL in your browser |

### Configuration

The feature flag goes in `frontend/.env`:

```env
VITE_ENABLE_UX_REVIEW=true
```

This file is committed to the repo. It is safe because production builds compile with `import.meta.env.DEV === false`, which short-circuits the entire system regardless of the flag.

### Activation

1. Start the dev server: `npm run dev`
2. Navigate to any page (e.g., `http://localhost:5173/skills?uxReview=1`)
3. The browser console logs: `[UX Review] Mode activated.`
4. A side panel opens when you click any element with `data-ux-*` attributes.

### Keyboard Shortcut

Press **Ctrl+Shift+U** (or Cmd+Shift+U on macOS) to toggle UX Review Mode on and off without reloading the page.

---

## Quick Start

1. **Add UX metadata** to a component (see [below](#adding-ux-metadata-to-components))
2. **Hover** the component — a cyan highlight frame and tooltip appear
3. **Click** the component — the annotation side panel opens
4. **Fill in** the annotation form (issue type, severity, comment, expected change)
5. **Submit** — the annotation appears in the History tab
6. **Export** using the footer dropdown — JSON or Markdown, per page or all sessions

---

## Adding UX Metadata to Components

Every component that should be inspectable needs to spread `uxAttributes()` on its root DOM element.

### Step 1: Import

```tsx
import type { UxMetadata } from "../components/ui";
import { uxAttributes } from "../components/ui";
```

### Step 2: Add a `ux` prop

```tsx
interface MyComponentProps {
  ux?: UxMetadata;
  // ... other props
}
```

### Step 3: Spread attributes on the root element

```tsx
function MyComponent({ ux, ...rest }: MyComponentProps) {
  return (
    <div {...(ux ? uxAttributes(ux) : {})} {...rest}>
      {/* children */}
    </div>
  );
}
```

### Step 4: Pass metadata at call site

```tsx
<MyComponent
  ux={{
    uxId: "skills-hero",
    uxComponent: "SummaryHero",
    uxRole: "page-summary",
    uxPage: "skills",
    uxAttention: "medium",
    uxActionKind: "view",
    uxDensity: "compact",
  }}
/>
```

### Supported Fields

| Attribute | `UxMetadata` field | Purpose | Required |
|-----------|-------------------|---------|----------|
| `data-ux-id` | `uxId` | Stable, human-readable identifier | **Yes** (without it, the element is invisible to review mode) |
| `data-ux-component` | `uxComponent` | Component type label (e.g. `PageHeader`, `DataTable`) | No |
| `data-ux-role` | `uxRole` | Semantic role within the page layout | No |
| `data-ux-page` | `uxPage` | Page or feature identifier | No |
| `data-ux-attention` | `uxAttention` | Attention level for review prioritisation | No |
| `data-ux-action-kind` | `uxActionKind` | Action category (view, mutate, navigate, etc.) | No |
| `data-ux-density` | `uxDensity` | Display density hint (default, compact, etc.) | No |
| `data-ux-source` | `uxSource` | Source file or area reference | No |

### Safety Constraints

- `data-ux-*` attributes must **never** contain secrets, tokens, PII, raw payloads, logs, evidence blobs, or sensitive backend values.
- The `uxId` should be stable across page re-renders. Use a string constant, not an auto-generated ID.
- These attributes remain in production builds — they are inert but visible in the DOM. Ensure they carry no sensitive data.

> For a complete list of components that already support the `ux` prop, see the ForgeFrame UI primitive library at `frontend/src/components/ui/`.

---

## Annotation Workflow

### 1. Inspect

Move your cursor over any element with a `data-ux-id` attribute. A cyan border highlights the element, and a floating tooltip shows its metadata (ID, component, role, action, attention).

### 2. Select

Click the element. The side panel opens showing the full metadata table and the annotation form.

### 3. Annotate

Fill in the form:
- **Issue type** — one of: Too large, Too prominent, Wrong action hierarchy, Navigation looks like mutation, Empty-looking section, Duplicate information, Raw data too visible, Diagnostics too prominent, Needs compact representation, Label unclear, Other
- **Severity** — Critical, Major, Minor, Suggestion
- **Comment** — free-text description of the issue
- **Expected change** — optional description of what should change
- **Screenshot note** — optional reference to a screenshot file

Click **Add Annotation**.

### 4. Manage

Switch to the **History** tab to see all annotations for the current page.

Each annotation card has three controls:
- **Resolve** (`○` / `✓`) — toggle resolved state. Resolved annotations appear dimmed with a green border.
- **Edit** — opens an inline form to change the issue type, severity, comment, and expected change. Save or cancel.
- **Delete** (`✕`) — permanently removes the annotation.

Use the **Clear** dropdown in the footer to remove annotations for the current page or all pages.

### 5. Export

The **Export** dropdown in the footer offers six options:

| Option | Format | Scope | Action |
|--------|--------|-------|--------|
| Copy JSON (current page) | JSON | Current page only | Clipboard |
| Copy JSON (all pages) | JSON | All annotations | Clipboard |
| Copy Markdown (current page) | Markdown | Current page only | Clipboard |
| Download JSON (current page) | JSON | Current page only | File download |
| Download JSON (all pages) | JSON | All annotations | File download |

### Persistence

Annotations are automatically saved to `localStorage` under the key `forgeframe-ux-review-annotations`. They survive page navigation, tab closure, and browser restart within the same origin. Clearing browser storage or calling `clearAnnotations()` removes them.

---

## Export Formats

### JSON Export

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-05-05T17:04:46.123Z",
  "route": "/skills",
  "pageTitle": "Skills — ForgeFrame",
  "viewport": { "width": 1440, "height": 900 },
  "annotations": [
    {
      "id": "ux-ann-1714832686123-a1b2c3d4",
      "route": "/skills",
      "pageTitle": "Skills — ForgeFrame",
      "uxId": "skills-hero",
      "uxComponent": "SummaryHero",
      "uxRole": "page-summary",
      "uxActionKind": "view",
      "uxAttention": "medium",
      "issueType": "too-large",
      "severity": "major",
      "comment": "This hero takes up too much vertical space on a 1440px viewport",
      "expectedChange": "Reduce padding from 32px to 16px vertically, shrink title font from 24px to 18px",
      "selectorFallback": "[data-ux-id=\"skills-hero\"]",
      "textSnapshot": "Skills Overview · 12 active · 3 archived",
      "boundingBox": { "x": 0, "y": 0, "width": 1200, "height": 300 },
      "createdAt": "2026-05-05T17:03:12.456Z",
      "isResolved": false
    }
  ],
  "_instructions": "Only change presentation, hierarchy, grouping, labeling, density, or default visibility. Do not remove data or settings. Keep full detail accessible through details, expansion, audit history, or AdvancedDiagnostics."
}
```

### Markdown Export

```markdown
<!--
  UX REVIEW ANNOTATION EXPORT — AGENT INSTRUCTIONS
  Only change presentation, hierarchy, grouping, labeling, density, or default visibility. Do not remove data or settings. Keep full detail accessible through details, expansion, audit history, or AdvancedDiagnostics.
-->

# UX Review Annotations

**Page:** /skills
**Title:** Skills — ForgeFrame
**Generated:** 2026-05-05T17:04:46.123Z
**Annotation count:** 1

## Instructions

- Only change presentation, hierarchy, grouping, labeling, density, or default visibility.
- Do not remove data or settings.
- Keep full detail accessible through details, expansion, audit history, or AdvancedDiagnostics.

---

## Annotation 1

### Page
/skills

### Element
- **UX ID:** skills-hero
- **Component:** SummaryHero
- **Role:** page-summary
- **Selector:** `[data-ux-id="skills-hero"]`
- **Text:** Skills Overview · 12 active · 3 archived

### Issue
- **Type:** Too large
- **Severity:** Major
- **Comment:** This hero takes up too much vertical space on a 1440px viewport

### Expected Change
Reduce padding from 32px to 16px vertically, shrink title font from 24px to 18px

### Metadata
- **Route:** /skills
- **Created:** 2026-05-05T17:03:12.456Z
- **Viewport:** 1440×900

---
```

---

## Export Format for Agent Handoff

Exported annotations are designed to be consumed by coding or task-management agents. The key fields for agent consumption are:

| Field | Purpose for agent |
|-------|-------------------|
| `uxId` | Identifies the exact element in code (stable, searchable) |
| `selectorFallback` | CSS selector to locate the element in the DOM |
| `uxComponent` | Component type to narrow the search in the codebase |
| `route` | Page route where the issue was found |
| `issueType` / `severity` | Priority guidance for the agent |
| `comment` | Human-readable description of the problem |
| `expectedChange` | Specific actionable instruction for the fix |
| `textSnapshot` | Text content to confirm the element identity |
| `boundingBox` | Visual size and position reference |
| `_instructions` | Constraints on what the agent may change |

Agents receiving this export should:
1. Locate the component by `uxId` or `uxComponent` in the codebase
2. Navigate to the page indicated by `route`
3. Apply the `expectedChange` following the `_instructions` constraints
4. Preserve all data, settings, and full detail access (keep hidden detail expandable)
5. Only change presentation, hierarchy, grouping, labeling, density, or default visibility

---

## Programmatic API

### Hook

```tsx
import { useUxReview } from "../components/ui";

function MyComponent() {
  const { isEnabled, annotationCount } = useUxReview();
  // ...
}
```

The `useUxReview()` hook returns a `UxReviewContextValue` with:

| Property | Type | Description |
|----------|------|-------------|
| `isEnabled` | `boolean` | Whether review mode is active |
| `selectedElement` | `CapturedElement \| null` | Currently selected element |
| `hoveredElement` | `CapturedElement \| null` | Currently hovered element |
| `annotations` | `UxAnnotation[]` | All annotations across all pages |
| `pageAnnotations` | `UxAnnotation[]` | Annotations for current page only |
| `annotationCount` | `number` | Total count across all pages |
| `pageAnnotationCount` | `number` | Count for current page only |
| `addAnnotation(...)` | `function` | Add a new annotation |
| `removeAnnotation(id)` | `function` | Delete an annotation |
| `updateAnnotation(id, updates)` | `function` | Edit an existing annotation |
| `clearAnnotations(route?)` | `function` | Clear page or all annotations |
| `exportJson(route?)` | `function` | Export as JSON string |
| `exportMarkdown(route?)` | `function` | Export as Markdown string |

### Exports

```tsx
import {
  buildAnnotationExport,       // Build AnnotationExport object
  formatAnnotationsJson,       // Format annotations as JSON string
  formatAnnotationsMarkdown,   // Format annotations as Markdown string
  copyToClipboard,             // Copy text to clipboard
  downloadAsFile,              // Trigger file download
} from "../components/ux-review/export-utils";
```

All public types are re-exported from the UI barrel:

```tsx
import type {
  UxReviewContextValue,
  UxElementData,
  CapturedElement,
  UxAnnotation,
  AnnotationRecord,
  AnnotationExport,
  AnnotationUpdate,
  UxIssueType,
  UxAnnotationSeverity,
} from "../components/ui";
```

---

## Production Safety

UX Review Mode is **unavailable in production builds** by design:

1. **Compile-time elimination**: The constant `UX_REVIEW_AVAILABLE` is computed as `import.meta.env.DEV && import.meta.env.VITE_ENABLE_UX_REVIEW === "true"`. When `import.meta.env.DEV` is `false` (production build), Vite's tree-shaker eliminates all code conditioned on this being `true`, including the overlay, panel, event listeners, and localStorage access.

2. **No-op provider**: In production, the provider renders children through without mounting any review tooling. The `NULL_CONTEXT` object has no-op stubs for all functions.

3. **Runtime guard**: Even in development, the provider checks for `?uxReview=1` in the URL. Without it, the overlay and panel are not rendered.

4. **No routes registration**: No review-only routes (`/__design`, `/dev/design`) are registered. The pattern is development-only and URL-param activated.

5. **Data safety**: UX metadata attributes (`data-ux-*`) remain in the DOM in production, but they carry only structural/type information — never secrets, tokens, PII, raw payloads, or sensitive backend values.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `?uxReview=1` does nothing | Production build | Run `npm run dev` |
| Console shows no `[UX Review]` banner | `VITE_ENABLE_UX_REVIEW` not set | Add `VITE_ENABLE_UX_REVIEW=true` to `.env` |
| Overlay appears but no highlights | No elements with `data-ux-id` | Add UX metadata to the component |
| Panel opens but no metadata shown | Selected element lacks `data-ux-*` attributes | Add `uxId` and other fields |
| Annotations lost after browser close | Corrupted localStorage | Clear `forgeframe-ux-review-annotations` from localStorage dev tools |
| Export JSON is empty | No annotations for current page | Switch to the History tab to verify |
| "Copied!" toast but nothing on clipboard | Clipboard API blocked (HTTP vs HTTPS, permissions) | Use Download option instead |

---

## Related

- `frontend/src/components/ux-review/` — source code
- `frontend/src/components/ui/types.ts` — `UxMetadata` type and `uxAttributes()` helper
- `frontend/reference/residual-ux-anti-pattern-catalog.md` — common UI anti-patterns to annotate
- Generated TypeDoc: `npm run docs` then open `docs/index.html`
