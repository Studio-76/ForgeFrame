# ForgeFrame Compactness Rules

> Visual-weight budget and layout density rules for operational pages.
> Applied during the May 2026 compactness pass. Future pages must conform.

---

## 1. Visual-Weight Budget

Every page section has a maximum visual weight allocation. These are relative to
the default density — a "1" is the default weight of a standard card.

| Area | Weight Budget | Notes |
|------|--------------|-------|
| Header / hero | ≤ 2 | Eyebrow + title + 1-line description. No support text, no note paragraphs. |
| Summary strip | ≤ 1.5 | 3-5 compact KPI items. Use `SummaryStrip` component, not custom `fg-kpi` grids. |
| Alert / callout | ≤ 1.5 | `PrimaryBlockerCallout` or `TargetReadinessSummary`. Only shown when actionable. |
| Action bar | ≤ 1 | Title + 1-2 compact buttons. No descriptions. |
| Table / list | ≤ 3 | Rows at 0.5rem vertical padding. Detail panels open inline or as drawers. |
| Detail panel | ≤ 2.5 | Collapse technical details behind `<details>`. No verbose descriptions on every section. |
| Diagnostics | ≤ 0.5 | Collapsed by default inside `AdvancedDiagnostics`. Never open by default. |
| Related-page nav | ≤ 0.5 | `ContextNavStrip` with `compact` prop. Never inside PageHeader children. |

---

## 2. Global Rules

### 2.1 Page Header
- **Eyebrow + title + 1-line description only.** No support questions, no note paragraphs.
- `actions` and `children` slots: use `mt-2`, not `mt-3`.
- `ContextNavStrip` in children is allowed but keep it compact — no extra text around it.

### 2.2 Cards & Containers
- Default `fg-card` padding: `--fg-space-4`. Use `ff-card-compact` (`--fg-space-3`) for:
  - Filter cards
  - Detail section cards (approvals detail)
- Default `fg-page` gap between sections: `--fg-space-3` (not `--fg-space-4`).

### 2.3 Summary Displays
- Use `SummaryStrip` component with `mb-2` for KPI/metric displays.
- **Never** use custom `fg-card-grid` + `fg-kpi` grids for summary data.
- Max 5 summary items. Label + value only. No meta text.

### 2.4 Action Bars
- Title only. **No description text** (e.g., "Refresh live truth, run diagnostics...").
- Buttons use compact density where possible.
- Section descriptions belong in the table/card, not the action bar header.

### 2.5 Detail Panels
- Default: collapsed technical details behind `<details>`.
- Section descriptions: one line or none. **No verbose guidance text** (e.g., "This preview is the decision boundary...").
- Decision panels: compact layout with `rows={3}` textarea, not `rows={4}`.
- Remove redundant pills/indicators (e.g., "Irreversible" shown in both risk pill and separate pill).

### 2.6 Filters
- Use `fg-inline-form` with `fg-inline-form-compact` for dense filter layouts.
- Description text optional (aim for 0 lines). Label-only filter containers.
- Filter count text: "N items in current filter" (not "Reviewing N matching items in the current decision slice").
- Card filter containers use `ff-card-compact`.

### 2.7 Empty State
- Default vertical padding: `py-8` (not `py-12`).
- Compact variant: `py-6`.

### 2.8 Section Spacing
- Between independent sections: `var(--fg-space-3)` (global `fg-page` gap).
- Between related sections (e.g., summary + filter + table): `var(--fg-space-2)`.
- `fg-panel-heading` margin-bottom: `var(--fg-space-2)` (not `--fg-space-3`).

---

## 3. Page Input Budget

The first viewport must communicate:

1. **Current state** (one blocker callout or summary strip)
2. **What needs action** (attention items, visible)
3. **Next action** (primary button or navigation link)

Everything below this fold can expand progressively.

---

## 4. Anti-Patterns

| ❌ Bad | ✅ Good |
|--------|---------|
| PageHeader with 3-paragraph children | PageHeader with eyebrow + title + 1-line description |
| Support questions in header | Compact ContextNavStrip |
| Note paragraphs with border-left | Remove. Information moves to diagnostics. |
| Custom `fg-card-grid` + `fg-kpi` for summary | `SummaryStrip` component |
| Action bar with description text | Action bar with title only |
| "This preview is..." descriptions on every section | One-line or no description |
| Decision panel with `rows={4}` textarea + comment guidance | `rows={3}` textarea + short placeholder |
| 300px+ filter card with verbose descriptions | Compact filter row, no descriptions |
| Redundant pills (risk + irreversible shown twice) | Single pill |
| "Reviewing N matching items in the current decision slice" | "N items in current filter" |
| Expanded detail sections with full guidance text | Collapsed technical details behind `<details>` |

---

## 5. Migration Checklist

When migrating or creating a new page:

- [ ] PageHeader has no support text or note paragraphs in children
- [ ] Only `ContextNavStrip` (compact) in PageHeader children, if any
- [ ] Summary data uses `SummaryStrip`, not custom KPI grids
- [ ] Action bar has no description text
- [ ] Filter containers use `ff-card-compact` if card-based
- [ ] Detail sections have 0-1 line descriptions, not paragraphs
- [ ] Technical details are collapsed behind `<details>`
- [ ] Empty states use `py-8` default padding
- [ ] KPI/metric displays are compact inline rows, not card grids
- [ ] No redundant pills or duplicate status indicators
