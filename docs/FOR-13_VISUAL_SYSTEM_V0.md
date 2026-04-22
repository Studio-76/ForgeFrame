# FOR-13 ForgeGate Visual System v0

## Objective and Operator Problem

ForgeGate operators need to scan health, compare records, and edit risky configuration without feeling like they are navigating a collection of one-off engineering screens. The current frontend already has a dark-default palette, card treatment, and basic pills, but hierarchy, density, and state behavior still drift by page. This v0 visual-system baseline defines the first reusable rules for trust, clarity, and operator confidence so new control-plane surfaces stop inventing their own layout, status, and feedback patterns.

This matters now because ForgeGate is adding dashboard, provider, usage, audit, onboarding, and settings surfaces in parallel. If the system choices are not explicit before the next implementation pass, frontend work will keep expanding through ad hoc lists, spacing, and action placement that increase cognitive load and make high-risk operator decisions harder to scan.

## Prioritized Workflows and State Coverage

### Workflow 1: Scan control-plane health and decide where attention is needed

- Trigger or entry point: operator lands on Dashboard, Providers, Logs, or Usage after login.
- Happy path: operator sees a stable page header, a concise page purpose line, summary tiles for the current slice, then the highest-risk attention blocks before lower-priority detail.
- Key decision points: Is the platform healthy? Is the data current? What needs action first? Can this page be trusted without opening every card?
- Required states:
  - Loading: page header and section frames render immediately; summary tiles use skeleton values; lists or tables keep their shape to reduce layout shift.
  - Empty: "no alerts" and "no flagged providers" render as calm neutral states, not green success celebrations.
  - Error: page-level error banner sits above the first content section, names the failed data source, preserves navigation, and offers retry.
  - Permission: page title still renders; restricted modules show locked explanatory state instead of disappearing silently.
  - Confirmation and success: explicit actions like refresh, rerun, import, or save use inline success feedback near the action source.
  - Audit and history: each summary area exposes freshness through "last updated", "last synced", or equivalent evidence.
- Operator success criteria: within five seconds the operator can identify the top risk and the next click without reading dense prose.
- Trust, accessibility, or feedback signals: severity order is explicit; headings chunk information into short scan units; color never carries severity meaning alone.

### Workflow 2: Filter and compare operational records

- Trigger or entry point: operator narrows provider inventory, harness runs, logs, clients, or cost records.
- Happy path: operator applies one to three visible filters, confirms the active filter state, scans rows quickly, then opens one record for detail.
- Key decision points: Are the right records in view? What changed between records? Which row needs action now? Can filters be reset safely?
- Required states:
  - Loading: filter controls remain visible; only dependent controls disable; the results region uses skeleton rows instead of collapsing to blank space.
  - Empty: the no-results state repeats the active filter context and offers a clear "reset filters" action.
  - Error: the results region shows an inline error panel with scope, time window, and retry; filter values stay intact.
  - Permission: hidden actions become disabled controls or explanatory text so operators understand that capability exists but is restricted.
  - Confirmation and success: the UI shows active-filter count, result count, and current time window so the operator knows the query actually changed.
  - Audit and history: tables and list views show freshness, last sync, or event time in a dedicated time column or metadata line.
- Operator success criteria: the operator can compare records without parsing paragraph-style blobs and can reset back to a broader view in one action.
- Trust, accessibility, or feedback signals: filter labels stay visible above controls; table headers are persistent; timestamps use consistent formatting; row affordances remain keyboard reachable.

### Workflow 3: Inspect a record and make a safe edit

- Trigger or entry point: operator opens provider details, harness profile details, mutable settings, account data, or API key management.
- Happy path: operator opens a detail pane or focused card, sees the current status first, reviews relevant evidence, edits the form, and gets a clear saved or failed result.
- Key decision points: Is the current configuration safe? What changed most recently? Is this action reversible? Does this require confirmation?
- Required states:
  - Loading: detail summary loads before secondary history; save actions stay disabled until required fields are ready.
  - Empty: the pane explains whether data has never existed, has been redacted, or is unavailable for the selected scope.
  - Error: form-level error summary appears above fields and field-level validation stays next to the offending control.
  - Permission: read-only mode is explicit and still shows current values plus why editing is blocked.
  - Confirmation and success: save success is inline near the action bar; destructive actions require confirmation text and a danger treatment.
  - Audit and history: the pane shows last updated time, last run, or latest audit event close to the editable summary.
- Operator success criteria: the operator can tell what will happen before saving and can recover quickly from validation or backend errors.
- Trust, accessibility, or feedback signals: labels stay above fields, helper text is persistent, and destructive actions are visually separated from routine actions.

## Token / Component Implications

### Visual direction

ForgeGate v0 should feel like calm operational software, not consumer branding and not a generic browser form set. The visual system stays dark-default, uses warm metallic accenting for primary action, keeps status colors semantic, and favors strong grouping over decorative flourish. The goal is to reduce cognitive load and improve information scent across dense operator surfaces.

### Foundation tokens

#### Color tokens

| Token | Dark value | Light value | Usage |
| --- | --- | --- | --- |
| `color.canvas` | `#0E1617` | `#F4EFE3` | App background only. |
| `color.surface.default` | `rgba(24, 38, 40, 0.86)` | `rgba(255, 251, 244, 0.95)` | Primary cards, filter bars, tables, detail panes. |
| `color.surface.strong` | `rgba(17, 26, 28, 0.92)` | `rgba(255, 247, 236, 0.98)` | Elevated panels, modal surfaces, sticky headers. |
| `color.surface.subtle` | `rgba(255, 255, 255, 0.03)` | `rgba(31, 43, 45, 0.04)` | Nested cards, table zebra or hover fills, disabled containers. |
| `color.text.primary` | `#F6F3EA` | `#1F2B2D` | Titles, key values, primary body copy. |
| `color.text.secondary` | `#B8C5C2` | `#5A6865` | Metadata, helper copy, timestamps, secondary labels. |
| `color.border.default` | `rgba(122, 157, 149, 0.32)` | `rgba(108, 132, 128, 0.28)` | Card borders, input borders, dividers. |
| `color.action.primary` | `#D8A840` | `#9A5A00` | Primary actions, active navigation, emphasis lines. |
| `color.action.primarySoft` | `rgba(216, 168, 64, 0.18)` | `rgba(154, 90, 0, 0.12)` | Active backgrounds, hover fills, focus-adjacent surfaces. |
| `color.status.success` | `#86D1A7` | `#17724C` | Healthy, ready, active success. |
| `color.status.warning` | `#F0C66A` | `#8C5C00` | Needs attention, degraded, pending risk. |
| `color.status.danger` | `#FF8272` | `#C33E2F` | Failed, blocked, destructive actions, critical errors. |
| `color.status.info` | `#7EB2D9` | `#1F5F87` | Informational system state, non-blocking notices. |
| `color.focus.ring` | `#F0C66A` | `#9A5A00` | Focus outlines and keyboard emphasis. |

Color rules:

- Status colors are semantic only; the action accent does not stand in for warning or success.
- Neutral empty states use surface and text tokens, not success green.
- Any status badge or banner must pass contrast in both themes and remain legible in grayscale.
- Existing `frontend/src/styles/theme.css` variables should be renamed or aliased to semantic tokens instead of multiplying raw hex values.

#### Type tokens

| Token | Value | Usage |
| --- | --- | --- |
| `type.family.sans` | `"Segoe UI Variable Text", "Aptos", "Trebuchet MS", sans-serif` | Default product text until a brand-specific family exists. |
| `type.family.mono` | `ui-monospace, "SFMono-Regular", "Consolas", monospace` | IDs, tokens, event codes, API payload snippets. |
| `type.pageTitle` | `32/40 600` | Top page title only. |
| `type.sectionTitle` | `24/32 600` | Section and panel headings. |
| `type.cardTitle` | `18/24 600` | Tile, subcard, and detail-pane headings. |
| `type.body` | `15/24 400` | Default operational copy. |
| `type.bodyStrong` | `15/24 600` | Metric labels, key inline values. |
| `type.meta` | `13/18 400` | Secondary metadata, timestamps, helper copy. |
| `type.kpi` | `28/32 600` | Summary tile values. |

Type rules:

- Page titles appear once per route and should not be repeated inside the first card.
- Use sentence case for labels and helper text.
- Long IDs, timestamps, and log fragments switch to mono only when precision matters.

#### Spacing, radius, shadow, and motion tokens

| Token group | Guidance | Usage |
| --- | --- | --- |
| Spacing | `4, 8, 12, 16, 24, 32, 40` px | Standard gap scale for all layout and component spacing. |
| Radius | `10, 14, 18, 999` px | Inputs and badges use `14`; cards and panes use `18`; small nested elements use `10`; pills use `999`. |
| Shadow | `panel: 0 18px 40px rgba(0, 0, 0, 0.28)` dark, `0 20px 45px rgba(81, 58, 18, 0.12)` light | Elevated surfaces only; avoid stacking multiple heavy shadows. |
| Motion duration | `120ms`, `180ms`, `240ms` | Hover, focus, reveal, and drawer transitions. |
| Motion easing | `ease-out` for enter, `ease-in-out` for state changes | Keep movement short and calm; no bounce. |

Motion rules:

- Prefer opacity and 4px vertical movement for reveal transitions.
- Loading shimmer or skeleton animation must disable under `prefers-reduced-motion`.
- State changes should feel fast and deliberate; nothing should animate for ornament alone.

### Density and hierarchy rules

- Page structure is `page header -> summary band -> task or attention section -> detailed data section`.
- Keep the first visible screen to three hierarchy levels: page title, section title, record title.
- Default page gutter is 24px on desktop and 16px on mobile.
- Standard card padding is 16px; nested subcards use 12px; summary bands may use 24px when they carry KPI content.
- Use cards for summary, explanation, or small grouped actions. Use tables for comparison work once a list exceeds five rows or more than three shared fields.
- Default interactive height is 44px. Compact rows may drop to 40px for tables, but never smaller.
- Primary action appears once per section. Secondary and destructive actions are visually separated, not mixed into one undifferentiated row.

### Priority components

| Component | v0 behavior | Reuse rationale | Accessibility and state notes |
| --- | --- | --- | --- |
| Summary tile | Label, large value, one supporting note, optional status badge. Tiles align in a grid and never contain more than one primary action. | Used on Dashboard, Providers, Usage, Logs, and bootstrap readiness summaries. | Preserve reading order on wrap; title and value must stay associated for screen readers. |
| Data table | Sticky or visually anchored header, typed columns for status, time, metric, and free text, row hover, row focus, optional row action affordance, empty row state. | Needed for provider inventory, run history, usage aggregations, audit events, and client views. | Header cells remain visible, sortable controls are keyboard reachable, row status does not rely on color only. |
| Filter bar | Horizontal surface above tables with visible primary filters, result count, active-filter chips, and clear/reset control. Advanced filters collapse below the primary row. | Keeps operational narrowing consistent across Usage, Logs, Providers, and future run history pages. | Filter labels stay visible, chips are dismissible by keyboard, no placeholder-only labels. |
| Detail pane | Right-side pane on desktop and full-screen sheet on mobile. Top area shows record name, status, key metadata, and primary actions. Lower sections hold configuration, history, and danger zone. | Lets operators inspect or edit without losing table context. | Trap focus when modal, restore focus to launching row on close, keep close action persistent. |
| Form layout | Labels above controls, helper text below, validation inline, 1-column on mobile and 2-column max on wide screens, grouped sections with short headings. | Applies to harness onboarding, provider edit, settings, accounts, and key management. | Required markers are text plus visual cue, error text is adjacent to the field, success does not clear the entered value prematurely. |
| Status badge | Small semantic badge for `ready`, `enabled`, `disabled`, `needs attention`, `degraded`, `failed`, `draft`, and `info`. | Replaces ad hoc pills and gives the same semantics across pages. | Minimum 24px height, text label always present, warning and danger colors stay distinct from the action accent. |
| State block | Reusable loading, empty, error, permission, and success modules with optional icon, short title, explanation, and next action. | Prevents every page from improvising a different fallback state. | Supports reduced motion, clear heading structure, and explicit actions like retry or request access. |

Component rules:

- Tables replace prose-heavy operational lists when the job is comparison, sorting, or scanning many records.
- Cards remain the right choice for summary, setup guidance, or grouped action clusters.
- Detail panes are for focused inspection or short edits; long multi-step setup stays on a full page.
- Badges communicate state, not action. Buttons communicate action, not state.

## Implementation Handoff

Affected surfaces for the first implementation pass:

- `frontend/src/styles/theme.css`
- `frontend/src/app/App.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/features/providers/ProvidersSections.tsx`
- `frontend/src/pages/UsagePage.tsx`
- `frontend/src/pages/LogsPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/OnboardingPage.tsx`

Implementation notes:

- Convert the existing theme variables into semantic token names first. Do not expand page-specific CSS variables per screen.
- Add shared primitives for page header, summary tile, filter bar, data table, detail pane, form field group, status badge, and state block before styling additional pages.
- Keep dark mode as default and preserve light-mode parity. Light mode should not become a lower-fidelity afterthought.
- Use summary tiles for KPI bands and top-level health views. Move comparison-heavy lists to a table primitive instead of adding more freeform bullet lists.
- Preserve current backend truth semantics. The visual refresh must not blur the distinction between live runtime truth, onboarding targets, and historical evidence.

Concrete acceptance criteria for engineering and QA:

- Initial semantic tokens exist for color, type, spacing, radius, shadow, and motion in the shared theme layer.
- Page headers, summary tiles, badges, forms, and state blocks follow the same spacing and type scale across Dashboard, Providers, Usage, Logs, Settings, and Onboarding.
- At least one reusable data-table pattern and one reusable filter-bar pattern replace prose-style list rendering on comparison-heavy surfaces.
- Detail inspection uses a consistent pane or card pattern with summary, metadata, actions, and history grouping.
- Loading, empty, error, permission, confirmation, and audit-history states are explicitly implemented on the first-pass surfaces.
- Focus states are visible in both themes, controls remain keyboard operable, and reduced-motion behavior is honored.

Copy and interaction rules that should not be improvised:

- Use `Needs attention` as the standard warning label for non-fatal operational risk.
- Use `Last updated`, `Last synced`, or `Latest audit event` for freshness evidence instead of inconsistent timestamp phrasing.
- Empty results after filtering should say `No results for the current filters.` and offer a reset action.
- Permission states should say what is blocked and why, for example `You do not have permission to edit this setting.`
- Destructive actions should use explicit verbs such as `Delete profile`, `Deactivate provider`, or `Reset setting`.

## Residual UX Risks

- ForgeGate does not yet have a chart or data-visualization system, so dashboard depth will still rely on tiles, tables, and state blocks in v0.
- The current frontend uses many list-based views, so the first implementation pass will need careful prioritization to avoid half-migrated pages.
- Brand identity is intentionally minimal, which is acceptable for v0, but a future brand pass may revisit typography nuance, illustration, and accent range without changing the trust-first structure.
- Detail pane versus full-page edit thresholds should be validated after the first provider and settings implementation pass; some flows may prove too dense for a pane.
- Contrast and overflow behavior still need browser verification once the components exist in code, especially for long provider keys, audit details, and smaller laptop widths.

## Next Action

Owner: Frontend engineering with CTO prioritization support.

Expected artifact or decision: implement semantic tokens and shared control-plane primitives on Dashboard, Providers, and Usage first, then roll the same primitives through Logs, Settings, and Onboarding without introducing page-specific variants.
