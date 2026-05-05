# Agent UX Annotation Fixing Workflow

A repeatable process for coding agents to consume exported UX Review annotations,
locate the affected elements, apply presentation fixes, and report results.

---

## Table of Contents

- [Overview](#overview)
- [File Naming Convention](#file-naming-convention)
- [Annotation Status Lifecycle](#annotation-status-lifecycle)
- [How Reviewers Export Annotations](#how-reviewers-export-annotations)
- [Where Exported Files Should Be Placed](#where-exported-files-should-be-placed)
- [How Agents Process Annotation Files](#how-agents-process-annotation-files)
- [Agent Fixing Rules](#agent-fixing-rules)
- [Resolved Annotation Report Format](#resolved-annotation-report-format)
- [Validation Script](#validation-script)
- [JSON Schema Reference](#json-schema-reference)

---

## Overview

```
Reviewer (browser)
  │  annotates UI elements via UX Review Mode panel
  │  exports JSON or Markdown
  ▼
Export file (.json / .md)
  │  placed in docs/ux-review/
  ▼
Coding agent
  │  reads export → locates elements → applies fixes
  │  updates annotation status → writes resolved report
  ▼
Verification (human or automated)
  │  review fixed page → close or reopen annotation
  ▼
Done
```

---

## File Naming Convention

Every exported annotation file MUST follow one of these naming patterns:

### JSON export
```
ux-review-YYYY-MM-DD-route-name.json
```

### Markdown export
```
ux-review-YYYY-MM-DD-route-name.md
```

### Examples

| File | Content |
|------|---------|
| `ux-review-2026-05-05-skills.json` | Annotations for `/skills` page |
| `ux-review-2026-05-05-conversations.md` | Annotations for `/conversations` page |
| `ux-review-2026-05-05-all-sessions.json` | Annotations across all pages in one session |

### Rules

- **Date** MUST be in `YYYY-MM-DD` format.
- **Route name** MUST be the kebab-case page identifier (`skills`, `conversations`, `settings`, etc.).
- Use `all-sessions` when the export covers multiple pages.
- The `.json` file is the **canonical** format for agent consumption. Markdown is for human review.
- File names MUST NOT contain spaces — use hyphens.

---

## Annotation Status Lifecycle

Every annotation in an export carries a status that tracks its progress from
identification to resolution. Status is stored in the `isResolved` field of the
JSON export, and agents update it as they work.

### Status Values

| Status             | Meaning | Export `isResolved` | Agent Action |
|--------------------|---------|---------------------|--------------|
| `open`             | Identified, not yet touched | `false` | Prioritise and assign |
| `in_progress`      | Agent is actively working on it | `false` | Begin fixing |
| `fixed`            | Presentation fix applied | `true`, `resolvedAt` set | Move to verification |
| `wont_fix`         | Valid annotation but fixing is out of scope | `true`, `resolvedAt` set | Document reason in resolved report |
| `needs_design_decision` | Requires human design input | `false` | Escalate with evidence |

### Updating Status

Agents update status by modifying the `isResolved` and `resolvedAt` fields
in the exported JSON file (or the resolved report). The file remains in
`docs/ux-review/` as an audit trail.

---

## How Reviewers Export Annotations

Reviewers use the UX Review Mode panel (auto-activates in dev mode when
`VITE_ENABLE_UX_REVIEW=true` is set). The Export dropdown in the panel
footer offers:

| Option | Format | Scope |
|--------|--------|-------|
| Copy JSON (current page) | JSON | Current page only |
| Copy JSON (all pages) | JSON | All annotations |
| Copy Markdown (current page) | Markdown | Current page only |
| Download JSON (current page) | JSON | Current page only |
| Download JSON (all pages) | JSON | All annotations |

### Recommended Export Workflow

1. Review one page at a time.
2. For each page, use **Download JSON (current page)**.
3. Save the file with the correct naming convention (see above).
4. For cross-cutting issues, export all pages and note dependencies.

---

## Where Exported Files Should Be Placed

All exported annotation files live in `docs/ux-review/` at the project root.

### Directory structure

```
docs/
├── ux-review/
│   ├── ux-review-2026-05-05-skills.json       # Active annotations
│   ├── ux-review-2026-05-05-conversations.json
│   └── agent-workflow.md                      # This guide
└── frontend/
    └── ux-review-mode.md                      # UX Review Mode developer guide
```

### Git tracking

Annotation export files **SHOULD be committed** to the repository so that agents
running on the same branch can find them. This enables:

- Traceability of what was reviewed and when.
- Status tracking from review through fix to verification.
- Collaboration between reviewers and agents on the same branch.

To exclude sensitive or temporary annotation files, add individual file patterns
to `.gitignore` only if they contain temporary or draft data.

---

## How Agents Process Annotation Files

### Step 1: Find annotation files

Look in `docs/ux-review/` for `.json` files matching the naming convention.
Use the most recent file for the target page.

### Step 2: Parse the JSON export

Each export follows the `AnnotationExport` schema:

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
      "issueType": "too-large",
      "severity": "major",
      "comment": "Takes up too much vertical space",
      "expectedChange": "Reduce padding from 32px to 16px vertically",
      "selectorFallback": "[data-ux-id=\"skills-hero\"]",
      "textSnapshot": "Skills Overview · 12 active · 3 archived",
      "boundingBox": { "x": 0, "y": 0, "width": 1200, "height": 300 },
      "createdAt": "2026-05-05T17:03:12.456Z",
      "isResolved": false,
      "status": "open"
    }
  ],
  "_instructions": "Only change presentation, hierarchy, grouping, labeling, density, or default visibility. Do not remove data or settings. Keep full detail accessible through details, expansion, audit history, or AdvancedDiagnostics."
}
```

### Step 3: Prioritise annotations

Process annotations by severity:

1. **critical** — fix first (broken layout, missing interaction cues).
2. **major** — fix second (excessive whitespace, wrong hierarchy).
3. **minor** — fix after majors (cosmetic, spacing tweaks).
4. **suggestion** — fix last (nice-to-have improvements).

Within the same severity, process in file order.

### Step 4: Locate each element

For each annotation:

1. **Primary**: Search the codebase for `data-ux-id="<uxId>"`.
2. **Fallback 1**: Search by `uxComponent` name (e.g., `SummaryHero`).
3. **Fallback 2**: Navigate to the `route` and inspect components on that page.
4. **Last resort**: Use `selectorFallback` CSS selector to find the DOM element
   (useful for confirmation but not stable across refactors).

### Step 5: Apply the fix

Follow the [Agent Fixing Rules](#agent-fixing-rules). After applying changes:

1. Mark the annotation status as `fixed` by setting `isResolved: true` and
   `resolvedAt` in the JSON file (or in the resolved report).
2. If the fix cannot be applied, set status to `wont_fix` or
   `needs_design_decision` with a note explaining why.

### Step 6: Write the resolved report

Create or update the resolved report (see
[Resolved Annotation Report Format](#resolved-annotation-report-format)).

### Step 7: Verify

- Run the frontend dev server and visually confirm the fix.
- If screenshots were attached, compare before/after.
- Run typecheck and tests to ensure no regressions.

---

## Agent Fixing Rules

These rules are **mandatory**. Every fix MUST comply.

### Rule 1: Locate by data-ux-id first

```text
Search the codebase for `data-ux-id="<value>"`.
This is the fastest and most reliable way to find the exact component.
```

### Rule 2: Fall back to uxComponent and route

```text
If `data-ux-id` is not found in the codebase:
  1. Search for the uxComponent name (component class/function name).
  2. Look at the page route for context — the component may be a shared
     primitive used on multiple pages.
```

### Rule 3: Never remove underlying data, settings, logs, evidence, controls, or diagnostics

```text
Presentation fixes must not delete or hide functional content.
If data or controls are too visible, use compact representations, detail
drawers, or AdvancedDiagnostics — not removal.
```

### Rule 4: Fix presentation only

```text
Do not change:
  - Business logic or data flow
  - API calls or data fetching
  - Permission or access control
  - Route structure or navigation destinations
  - State management patterns

Only change:
  - Spacing, sizing, padding, margins
  - Typography (font size, weight, color)
  - Layout (grid columns, flex direction, alignment)
  - Visibility defaults (collapsed vs expanded)
  - Label clarity and wording
  - Action hierarchy (which buttons are primary/secondary)
  - Density (standard → compact)
```

### Rule 5: Prefer shared primitives over page-specific fixes

```text
Before writing a one-off CSS override for a single page, check whether the
component can be tuned via its props or a shared primitive update.

Good:  Update DataTable density prop from "default" to "compact"
Bad:   Write .my-page .data-table { padding: 4px; font-size: 12px; }
```

### Rule 6: Prefer compact navigation over large navigation tiles

```text
Navigation elements (links, tabs, breadcrumbs) should be compact.
Use text links, pills, or compact tab bars over large card-style navigation
tiles. This conserves vertical space on busy management pages.
```

### Rule 7: Prefer detail drawers or AdvancedDiagnostics for raw/internal data

```text
Raw data, internal IDs, timestamps, and evidence logs belong in:
  - Detail drawers (slide-out panels)
  - AdvancedDiagnostics collapsible sections
  - Tooltips on hover

They do NOT belong in:
  - Hero/summary cards at the top of the page
  - Table cell primary display
  - Inline in action bars
```

### Rule 8: Preserve all routes and navigation destinations

```text
Never remove or comment out route links, breadcrumb items, or navigation
entries. If navigation is too prominent, make it smaller or collapse
it — but keep it reachable.
```

### Rule 9: Update the annotation status

```text
After fixing an annotation, update its status in the source JSON file
or the resolved report. This creates an audit trail.
```

### Rule 10: Run verification

```text
After ALL fixes for a file are applied:
  1. Run `npm run typecheck` — must pass with zero errors.
  2. Run `npm test` — all existing tests must pass.
  3. Run `npm run build` — production build must succeed.
  4. Commit all changes with a descriptive message referencing
     the annotation file.
```

---

## Resolved Annotation Report Format

After fixing a set of annotations, agents produce a **resolved report**.
This can be either:

- An updated JSON file (same location, with `isResolved` and `resolvedAt`
  fields populated).
- A standalone `.md` report in `docs/ux-review/resolved-YYYY-MM-DD.md`.

### JSON-based report (preferred)

Update the original export file by setting `isResolved: true` and
`resolvedAt` on each fixed annotation:

```json
{
  "id": "ux-ann-1714832686123-a1b2c3d4",
  "isResolved": true,
  "resolvedAt": "2026-05-05T18:30:00.000Z"
}
```

### Markdown report format

```
docs/ux-review/resolved-2026-05-05-skills.md
```

```markdown
# UX Annotation Resolved Report

**Date:** 2026-05-05
**Export file:** ux-review-2026-05-05-skills.json
**Agent:** [agent-name]

## Fixed Annotations

### 1. ux-ann-1714832686123-a1b2c3d4
- **UX ID:** skills-hero
- **Severity:** major
- **Issue:** Too large
- **Fix summary:** Reduced vertical padding from 32px to 16px on SummaryHero
- **Files changed:**
  - `frontend/src/pages/SkillsPage.tsx` (padding classes on hero wrapper)
- **Remaining notes:** Hero title font was left at 24px — reviewer may want
  further reduction.
- **Screenshot/manual verification:** Verified via dev server at 1440×900.
  Element box height reduced from 300px to 200px.

### 2. ux-ann-1714832687234-b2c3d4e5
- **UX ID:** skills-filter-bar
- **Severity:** minor
- **Issue:** Needs compact representation
- **Fix summary:** Switched filter bar from `gap-4` to `gap-2`, reduced
  button padding from `px-4 py-2` to `px-3 py-1.5`.
- **Files changed:**
  - `frontend/src/features/skills/SkillFilters.tsx`
- **Remaining notes:** None
- **Screenshot/manual verification:** Verified. Filter bar now 40px shorter.

## Wont Fix / Needs Decision

### 3. ux-ann-1714832687345-c3d4e5f6
- **UX ID:** skills-table-header
- **Severity:** suggestion
- **Status:** wont_fix
- **Reason:** The table header compactness requires a DataTable primitive
  update that would affect 14 other pages. Punt to DataTable density
  refactor sprint.
```

### Per-annotation entry fields

| Field | Required | Description |
|-------|----------|-------------|
| Annotation ID | Yes | Matches the `id` from the export |
| UX ID | Yes | The `uxId` of the element |
| Severity | Yes | Original severity level |
| Issue | Yes | Original issue type |
| Fix summary | Yes | What was changed and why |
| Files changed | Yes | Every file modified (one per line) |
| Remaining notes | No | Caveats, follow-up items |
| Screenshot/manual verification | Yes | How the fix was verified |

---

## Validation Script

A validation script is provided at `scripts/validate-ux-annotation.mjs`
(requires **Node.js 14+**).
It checks exported annotation JSON files for structural correctness.

### Usage

```bash
# Validate a single file
node scripts/validate-ux-annotation.mjs docs/ux-review/ux-review-2026-05-05-skills.json

# Validate all files in the directory
node scripts/validate-ux-annotation.mjs docs/ux-review/*.json
```

### What it checks

- File is valid JSON.
- `schemaVersion` matches the expected value (`1.0`).
- All required fields are present in the envelope and each annotation record.
- No sensitive field names are present (secrets, tokens, PII patterns).
- No annotation has an unknown status or issue type.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All files valid |
| 1 | One or more files failed validation |

---

## JSON Schema Reference

The canonical schema for annotation exports is defined at
`docs/ux-review/annotation-schema.json`. It follows the JSON Schema
draft-07 specification and is used by the validation script.

### Envelope fields

| Field | Type | Required |
|-------|------|----------|
| `schemaVersion` | string | Yes |
| `generatedAt` | string (ISO-8601) | Yes |
| `route` | string | Yes |
| `pageTitle` | string | Yes |
| `viewport` | object `{width, height}` | Yes |
| `annotations` | array | Yes |
| `_instructions` | string | Yes |

### Annotation record fields

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `route` | string | Yes |
| `uxId` | string | Yes |
| `issueType` | string (enum) | Yes |
| `severity` | string (enum) | Yes |
| `comment` | string | Yes |
| `selectorFallback` | string | Yes |
| `createdAt` | string (ISO-8601) | Yes |
| `uxComponent` | string | No |
| `uxRole` | string | No |
| `expectedChange` | string | No |
| `textSnapshot` | string | No |
| `isResolved` | boolean | No |
| `resolvedAt` | string (ISO-8601) | No |

### Issue type enum

```
too-large | too-prominent | wrong-action-hierarchy |
navigation-looks-like-mutation | empty-looking-section |
duplicate-information | raw-data-too-visible |
diagnostics-too-prominent | needs-compact-representation |
label-unclear | other
```

### Severity enum

```
critical | major | minor | suggestion
```

---

## Quick Reference Card

```text
┌─────────────────────────────────────────────────────────────┐
│                    UX ANNOTATION FIXING                     │
├─────────────────────────────────────────────────────────────┤
│  1. Find export files in docs/ux-review/                    │
│  2. Parse JSON (prefer over Markdown)                       │
│  3. Sort by severity: critical → major → minor → suggestion │
│  4. For each annotation:                                    │
│     a. Locate by data-ux-id → fallback to component name    │
│     b. Update lifecycle status (open → in_progress)         │
│     c. Fix presentation only (no data/route removal)        │
│     d. Prefer shared primitives                             │
│     e. Use AdvancedDiagnostics for raw data                 │
│     f. Preserve all routes                                  │
│     g. Update status (→ fixed / wont_fix / needs_decision)  │
│  5. Write resolved report                                   │
│  6. Validate: typecheck + tests + build                     │
│  7. Commit with annotation file reference                   │
└─────────────────────────────────────────────────────────────┘
```
