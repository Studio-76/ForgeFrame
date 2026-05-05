# ForgeFrame UI Presentation Triage Rules

**Status:** Final  
**Scope:** All ForgeFrame frontend pages (44+ routes, 26 feature modules)  
**Constraint:** No underlying data, settings, evidence, logs, controls, configuration, or diagnostic information may be removed. Information may be collapsed, moved, grouped, summarized, or visually de-emphasized but must remain accessible where appropriate.  
**Applies to:** All future page development, feature decomposition, and component consolidation work.

---

## 1. Global Decision Matrix

Every UI element answers one of three operator questions. The answer determines its visibility:

### Question 1: "What is the current state?"
**Keep visible** if the element tells the operator what condition the system is in.  
*Examples: runtime health, TLS status, routing readiness, backup coverage, approval status, skill lifecycle stage.*

### Question 2: "Is action required?"
**Keep visible** if the element signals that something needs attention.  
*Examples: open circuits, failing checks, pending approvals, expired certificates, blocked budgets, aging backups.*

### Question 3: "What should I do next?"
**Keep visible and make prominent** if the element tells the operator what specific action to take next.  
*Examples: "Approve this run", "Fix certificate expiry", "Create backup policy", "Review skill activation".*

### Scalar Visibility Rules

| If element... | Then... |
|---|---|
| Answers Q1 + Q2 or Q1 + Q3 | Keep visible, make prominent |
| Answers only Q1 (state is healthy/nominal) | Keep visible but visually de-emphasize (collapse, compact row, muted tone) |
| Only useful for debugging or forensics | Move to Advanced Diagnostics or raw evidence drawer |
| Repeats information already shown elsewhere | Merge or summarize |
| Contains health=ready / zero-count / n/a | Collapse or compact by default, expand on interaction |
| Contains raw IDs, timestamps, file paths, env vars, payloads | Keep accessible but hidden from default view (detail panel, diagnostic section) |
| Contains a button that only navigates | Style as navigation link, not primary action button |
| Contains a card with little content | Convert to compact state, row, badge, tooltip, or detail item |
| Has no available action | Do NOT present as action card or action callout |

---

## 2. Recurring Element Classification

### 2.1 Hero / Header Cards
| Classification | Reasoning |
|---|---|
| **Summarize in default view** | Current hero cards (ff-status-hero, ff-summary-strip, ff-skills-hero) are generally good but many contain both KPI strip AND status badge AND next-action text. The KPI strip is frequently zero-value or healthy-state noise. |
| **De-emphasize when healthy** | When all status lines are healthy/green, collapse the KPI strip into a single "All systems healthy" line. Show individual stats only when attention is needed or on hover/expand. |
| **Move detail to hero tooltip** | Individual stat numbers (e.g., "4 targets", "2 circuits open") are useful at a glance but don't each need their own visual weight. Group into a single block with muted styling. |

### 2.2 Status Badges / Pills
| Classification | Reasoning |
|---|---|
| **Merge** | Four parallel systems exist: `StatusBadge` (React + CSS), `StatusPill` (React + Tailwind), `fg-pill` (CSS-only), and page-specific LEDs (skills, learning). Merge into one `StatusBadge` component with optional `compact` prop and `dot` indicator. |
| **De-emphasize when repeated** | When a badge appears in the page header AND in the status hero AND in a table row for the same entity, show it in only two places max: the table row (for scanning) and optionally the page header (for context). Remove it from intermediate cards. |
| **Remove from page header** | Header badges repeat info found in heroes and tables. Move badge data from `PageIntro.badges` to the first relevant content card or hero. Header badges create visual clutter above the fold without answering Q2 or Q3. |

### 2.3 Summary Metric Cards / KPI Strip
| Classification | Reasoning |
|---|---|
| **Collapse by default when all healthy** | The `ff-summary-strip` and `fg-grid fg-grid-compact` KPI patterns show 4-6 metric cards. When every metric shows a nominal value (zero errors, 100% uptime, all green), collapse into a single "All metrics nominal" line. Expand only on click or when any metric is non-nominal. |
| **De-emphasize zero-value stats** | A stat showing "0 blocked" or "0 pending" provides no actionable info. Hide it from the default KPI strip and show only non-zero stats. Provide a "Show all" toggle if the operator needs the full zero-inclusive view. |
| **Convert to compact row** | Replace KPI cards (`fg-kpi` with big 28px numbers) with a compact single-line strip (`ff-summary-strip` or inline `flex gap-4`). Reserve the large-card treatment for the single most important metric. |

### 2.4 Navigation Buttons vs Action Buttons
| Classification | Reasoning |
|---|---|
| **Rename/reword navigation buttons** | Many pages use "Open ..." button labels that describe the UI action (navigate) rather than the task. "Open Instances" → "Manage instances". "Open Routing" → "Configure routing". |
| **Style navigation as links, not buttons** | Navigation-only buttons (`Link` elements styled as buttons) should use `ff-btn-nav` or `ff-compact-link` styling, not `ff-btn-primary` or `ff-btn-secondary`. |
| **Consolidate multiple equal buttons** | Pages that show "Open X", "Open Y", "Open Z" as separate primary-tier buttons should group them into a single "Related pages" overflow menu or compact link row. |

### 2.5 Action Buttons
| Classification | Reasoning |
|---|---|
| **Keep visible but de-emphasize when disabled** | Disabled action buttons waste space and imply missing prerequisites. Hide disabled buttons when the prerequisite is obvious (e.g., "Create policy" when no instance is selected). Show a muted note instead: "Select an instance to create policies." |
| **Single primary action per section** | Each card or section should have at most one primary action button. Secondary actions go to secondary/tertiary variants or overflow menus. |
| **Use task labels, not UI labels** | "Create policy" > "Open create form". "Approve run" > "Open approval". The button label should describe what the operator achieves, not what UI element appears. |

### 2.6 Empty States
| Classification | Reasoning |
|---|---|
| **Keep visible but improve** | Current empty states (EmptyState component) are clean but generic. Replace "No data yet" with specific, actionable content: what this section does, why the operator should care, exactly one action to take. |
| **Make more specific** | Instead of "No skills registered" + "Create skill" button, use: "No skills found. Skills define what agents can do. Register one or install from the catalog." Then the button. |
| **Remove illustration patterns** | If any empty state uses an illustration or SVG blob, replace it with a concise text message. Illustrations add visual noise without answering Q1/Q2/Q3. |

### 2.7 Detail Panels / Sidebars
| Classification | Reasoning |
|---|---|
| **Keep visible when selection is active** | Detail panels (ff-detail-panel, ff-detail-drawer) are good patterns for showing secondary information on demand. |
| **Show empty state when nothing selected** | When no item is selected, show a brief hint about selecting an item rather than a blank box. Current patterns ("Pick a data class to inspect coverage") are good — keep them. |
| **Move raw evidence to drawer** | Raw JSON, payloads, and technical metadata displayed in detail panels should be moved to a dedicated detail drawer or Advanced Diagnostics section with a "Show raw evidence" link. |

### 2.8 Diagnostic Sections
| Classification | Reasoning |
|---|---|
| **Move to Advanced Diagnostics** | All raw technical output — JSON payloads, env vars, route keys, system paths, raw blocker codes, database identifiers — belongs in Advanced Diagnostics or a detail drawer. Never show these in the main reading flow. |
| **Keep human-readable summaries visible** | The human-readable summary of a diagnostic (e.g., "Certificate expires in 14 days") stays visible. The raw data (expiration timestamp, cert fingerprint, issuer) goes to diagnostics. |
| **Standardize component** | Use `AdvancedDiagnostics` (already exists at `components/ui/AdvancedDiagnostics.tsx`) consistently. Remove inline diagnostic blocks. |

### 2.9 Tables
| Classification | Reasoning |
|---|---|
| **Merge table styles** | `fg-table` and `ff-data-table` are near-duplicates. Choose `ff-data-table` (newer, used by DataTable component) as canonical. Keep `fg-table` only for simple/list tables. |
| **Add healthy-state collapse to tables** | Tables with many rows where most entries have status=healthy should offer a "Show only issues" toggle at the top. When active, filter to non-healthy rows. Default: show all rows but highlight non-healthy ones. |
| **Raw IDs as last column, hidden by default** | All tables that display raw IDs (instance_id, policy_id, run_id, etc.) should put the ID column last and hide it by default. Show via column visibility toggle (DataTable already supports this). |
| **Timestamps default to relative time** | Show relative time ("2h ago", "3d ago") in the default view. Show exact ISO timestamp in a tooltip or in the detail row. |

### 2.10 Scope Selectors
| Classification | Reasoning |
|---|---|
| **Keep visible but collapse to compact** | The `InstanceScopeCard` takes a full `fg-card` slot on every page. When an instance is already selected, collapse the scope card to a compact header line: "Scoped to: prod-instance [change]" with a dropdown in a popover/toolbar. Only expand to full card when no instance is selected or when the operator explicitly clicks to edit scope. |
| **Move tenant metadata to detail** | The "Bound: tenant X · execution Y · deployment Z" line in InstanceScopeCard is detailed metadata useful for debugging but not for daily operations. Move it to a tooltip or the instance detail page. |

### 2.11 Audit / Activity Rows
| Classification | Reasoning |
|---|---|
| **Group into timeline** | Raw audit/activity rows shown as individual table rows create visual noise. Group repeated events (e.g., "Login from IP X" × 5) into a grouped timeline with expand/collapse. Use `ActivityTimeline` or `AuditTimeline` components. |
| **Group healthy systems** | When displaying multiple system components with identical healthy status, collapse them into a "Healthy systems" group with a count. |

### 2.12 Setup Instructions
| Classification | Reasoning |
|---|---|
| **Convert to checklist** | Long setup prose should be converted to a checklist with completion states. Each step should have a clear completion indicator. Use `ReadinessChecklist` or `RemediationChecklist` components. |
| **Show progress** | Setup flows should show progress (steps completed / total steps) and highlight the next incomplete step. |

### 2.13 Raw Blocker Codes
| Classification | Reasoning |
|---|---|
| **Show human-readable message, keep code in diagnostics** | Replace raw blocker codes (e.g., `ERR_BLOCKER_CERT_EXPIRY_2026`) with a human-readable message ("TLS certificate expired on 2026-04-01"). The raw code goes to Advanced Diagnostics or a tooltip. |
| **Use consistent format** | All blocker messages should follow the format: `[What is wrong] — [Why it matters] — [What to do next]`. |

### 2.14 Ready / Success / Idle / n/a / Zero-count States
| Classification | Reasoning |
|---|---|
| **Collapse by default** | These states provide no actionable information. Collapse them into a summary line or hide them entirely behind a "Show all" toggle. |
| **Example patterns** | "0 items", "All healthy", "Ready", "n/a", "Idle" — all should be de-emphasized or collapsed. A page showing "4 services: all healthy" is better than "4 service cards each showing green checks." |

### 2.15 Raw IDs, Timestamps, File Paths, Env Vars, Route Keys, Payloads
| Classification | Reasoning |
|---|---|
| **Hidden by default** | All technical identifiers and raw data belong in detail views, tooltips, or Advanced Diagnostics. Never display them in the main reading flow. |
| **Accessible via detail interaction** | "Copy ID" button, "Show raw" toggle, or tooltip on hover. The identifier is accessible but not always visible. |
| **Exception** | Instance ID in scope selector may need to be visible for multi-instance operators. Show it only in the scope control, not in every card. |

---

## 3. Global Presentation Replacement Rules

### 3.1 Pattern: Large Low-Content Card
```
Before: fg-card with 2-line heading, 1-line description, 1 muted stat, 1 nav link = 80% whitespace
After:  Compact summary row inside an accordion group, or inline badge, or tooltip content
Rule:   If a card's content fits in <60 characters and no action is available, it's not a card.
```

### 3.2 Pattern: Multiple Status Cards in a Grid
```
Before: 4-6 fg-kpi cards in fg-grid-compact showing "Total: 12", "Active: 8", "Draft: 2", "Archived: 2", etc.
After:  Single inline strip: "12 skills · 8 active · 2 draft · 2 archived" 
Rule:   When all stats are nominal, show as text. When any stat is non-nominal, highlight that stat.
```

### 3.3 Pattern: Repeated Navigation Buttons
```
Before: [Open Instances] [Open Routing] [Open Targets] [Open Provider Targets] as separate ff-btn-secondary
After:  [Related pages ▾] → Instances, Routing, Targets, Provider Targets (overflow menu or compact links)
Rule:   One navigation action per section. More than 2 nav links → overflow menu.
```

### 3.4 Pattern: Raw Technical Evidence at Page Level
```
Before: <pre>{JSON.stringify(payload, null, 2)}</pre> visible in a card or section
After:  <AdvancedDiagnostics data={payload} label="Raw payload" /> at the bottom of the section, collapsed by default
Rule:   Every page should have exactly one AdvancedDiagnostics section at the bottom. All raw data goes there.
```

### 3.5 Pattern: Healthy Rows in Tables
```
Before: 50 rows, 48 show status=healthy green badge, 2 show warning/error
After:  "Show only issues" checkbox checked by default when issues exist, unchecked when all healthy
Rule:   Healthy rows are noise. Default to compact view when healthy, full view only when filtering or searching.
```

### 3.6 Pattern: Equal-Weight Primary Buttons
```
Before: [Create] [Edit] [Delete] [Import] [Export] all same button variant
After:  [Create] is primary. [Edit] is secondary. [Delete] is destructive. [Import]/[Export] → overflow ▾
Rule:   One primary action per section. Others demoted by tier or hidden in overflow.
```

### 3.7 Pattern: Instance Scope Card on Every Page
```
Before: fg-card with full form, 5 nav links, tenant metadata, status pill = ~200px of page chrome
After:  Compact "Scope: prod-instance [change]" inline with dropdown. Full card only on scope selection page.
Rule:   Instance scope is a toolbar concern, not a page content concern. Move to app shell or compact bar.
```

### 3.8 Pattern: PageIntro Badges
```
Before: 3-4 badges in PageIntro header showing policy count, runtime status, mutation permissions, etc.
After:  0 badges in PageIntro. Move badge info to the first content section or status hero.
Rule:   Header is for page identity (eyebrow, title, description). Badges belong with content.
```

### 3.9 Pattern: ActionBar with Tab Buttons
```
Before: ActionBar has 5 tab buttons + 2 action buttons = 7 items in the action bar
After:  ActionBar title + description + 1 primary action. Tab nav below it or as a separate PageTabs.
Rule:   ActionBar is for actions, not navigation. Tab switching is navigation, use PageTabs.
```

### 3.10 Pattern: "Open ..." Button Labels
```
Before: "Open Instances", "Open Routing", "Open Recovery"
After:  "Manage instances", "Configure routing", "Review recovery posture"
Rule:   Button labels describe the task, not the UI action. "Open" is always wrong for a task label.
```

---

## 4. Concrete Examples from Existing Pages

### 4.1 Health Page — HealthGroupCard Pattern
- **Before:** Each health group rendered as `fg-card` with title + summary + pill + "Last check" + "Error" + evidence list + nav link. A 590-line page showing 3-6 large cards.
- **Problem:** Every card has the same structure and same visual weight. Healthy cards look identical to warning cards in size/emphasis. The evidence list shows raw check IDs like `bootstrap_001: ok · bootstrap_state_migration applied`.
- **Decision:** Keep visible for unhealthy groups, collapse for healthy. Convert raw check IDs to human-readable summaries. Move evidence details to expand section.
- **After:** Healthy groups collapse to a single line "Bootstrap checks: 4/4 passing". Unhealthy groups expand to show summary + next action. Raw check IDs → tooltip.
- **Data location:** Full evidence list available on expand. Raw check IDs in Advanced Diagnostics.

### 4.2 Recovery Page — PageIntro Badge Overload
- **Before:** `PageIntro` displays 4 badges: policy count, runtime status, upgrade posture, mutation permission. Plus a note. Plus 3 nav links. Plus a question paragraph.
- **Problem:** The header section is visually dense with 4 badges, a multi-line question, a long note, and 3 links — all before any content. Badge information (policy count, runtime status) repeats what's shown in the SummaryStrip and ActionBar below.
- **Decision:** Remove badges from PageIntro. Move runtime status to the SummaryStrip. Remove the question (it's a design-thinking artifact, not operator guidance). Shorten the note.
- **After:** Clean header: eyebrow + title + short description + nav links. Status info lives in the first actionable section.
- **Data location:** Badge data (policy count, status, permissions) shown as text in the first content section.

### 4.3 Recovery Page — SummaryStrip with Zero-Value Stats
- **Before:** SummaryStrip shows 5-6 items including "0 databases", "0 blocked", "0 manual snapshots".
- **Problem:** Zero-value stats occupy the same visual weight as meaningful stats. Three zero values out of 6 items means 50% of the strip is noise.
- **Decision:** Hide zero-value stats by default. Show only non-zero items. Add "Show all" link to display zero values for operators who want the full picture.
- **After:** If only "2 policies" and "1 blocker" are non-zero, the strip shows only those two items with a "+4 all nominal" link.
- **Data location:** Zero values accessible via "Show all" expand.

### 4.4 Recovery Page — ActionBar with Both Tabs and Actions
- **Before:** `ActionBar` contains 5 section tab buttons + "Create policy" + "Edit policy" (when applicable). The action bar serves as both tab navigation and action container.
- **Problem:** Mixing navigation (tab switching) with actions (create/edit) in the same component confuses the function. The tab buttons occupy space meant for actions.
- **Decision:** Tab buttons → separate `PageTabs` component below ActionBar. ActionBar retains only the primary action and context description.
- **After:** ActionBar shows "Recovery policy" + description + [Create policy]. PageTabs below it: Overview, Policies, Backup, Restore, Upgrade.
- **Data location:** Tab state is navigation only — no data loss.

### 4.5 HealthPage — Raw Check IDs in Evidence
- **Before:** `buildGroup()` creates evidence strings like `health_control_signals: ok` and `runtime_memory_pressure_check: ok · Memory pressure is nominal`.
- **Problem:** Raw check IDs (`health_control_signals`) are visible in the main reading flow. The operator needs to parse internal identifiers to understand what passed/failed.
- **Decision:** Replace check IDs with human-readable labels. Show check IDs in tooltip or Advanced Diagnostics only.
- **After:** `Control signals: ok` instead of `health_control_signals: ok`. Full identifier visible on hover.
- **Data location:** Raw check IDs in hover tooltip.

### 4.6 Costs Page — Large Inline Page with Multiple Data Sections
- **Before:** 1734-line monolithic page with cost truth table, budget scopes, circuits, cost mix, blocked classes — all in one file.
- **Problem:** The page tries to show every cost-related data point at once. Budget scopes with raw JSON config, circuit tables, and cost mix details are all visible simultaneously.
- **Decision:** Decompose into sections with tab navigation (Cost Truth, Budget, Circuits, Cost Mix). Raw budget config JSON goes to detail drawer or Advanced Diagnostics. Circuit detail moves to selected-item detail panel.
- **After:** Tabs for each major view. Only one view visible at a time. Raw JSON config available via "Show full budget config" link → detail drawer.
- **Data location:** All data remains accessible via tab switching and detail drawer.

### 4.7 InstanceScopeCard — Full Card on Every Page
- **Before:** Every operational page shows InstanceScopeCard as a full `fg-card` with select dropdown, 3-5 nav links, tenant metadata, and status pill.
- **Problem:** ~200px of chrome on every page for a control that changes infrequently. Nav links ("Instances", "Targets", "Routing") duplicate what's in the sidebar.
- **Decision:** Collapse InstanceScopeCard to a compact toolbar line when an instance is selected. Full card only on pages without an active selection or when the operator clicks to change scope. Remove duplicated nav links — rely on sidebar navigation.
- **After:** "Scope: prod-instance [change]" as a compact header element. Full card only on scope selection.
- **Data location:** Tenant metadata moves to instance detail page or tooltip.

### 4.8 Skills Page — SkillsSummaryHero with Tron Frame
- **Before:** `SkillsSummaryHero` is an `fg-card` with GridCN-inspired corner brackets (`ff-skills-tron-frame`), a kicker label, title, status LED, 6-item KPI strip, "Next action" text, admin status text, and a create button.
- **Problem:** The hero is ~200px tall and contains 3 separate information layers (text header, 6-item stat strip, footer with action + status). The tron frame corner brackets add 30+ lines of CSS per feature for a decorative effect. The 6-item stat strip is almost entirely zero/nominal for most sessions.
- **Decision:** Collapse KPI strip to show only non-zero stats. Remove tron frame — share a single `ff-tron-frame` class if the effect is wanted, but prefer no frame. Merge "Next action" into the main heading line. Remove admin status text ("Admin mutations available") — it's not actionable information.
- **After:** Compact hero: `fg-card` with title line (including next-action badge) + inline non-zero stats + create button. ~80px tall.
- **Data location:** Zero stats accessible on hover or "Show all" expand. Admin status visible in user menu/profile.

### 4.9 Skills Page — Feature-Specific Button System
- **Before:** Skills page defines `.ff-skills-primary-action`, `.ff-skills-secondary-action`, `.ff-skills-lifecycle-btn`, `.ff-skills-lifecycle-btn-primary`, `.ff-skills-lifecycle-btn-danger` in 822-line skills.css. Learning page has identical duplicates with `ff-learning-*` prefix.
- **Problem:** 5 page-specific button classes for each feature, each re-implementing the same hover/active/disabled/transition patterns already provided by `ff-btn-*` and the React `Button` component.
- **Decision:** Remove all feature-specific button classes. Use `ff-btn-primary` / `Button variant="primary"` consistently. The CSS already exists.
- **After:** `<Button variant="primary" onPress={onCreateSkill}>Create skill</Button>` — no page-specific button CSS needed.
- **Data location:** N/A — pure CSS consolidation, no data impact.

### 4.10 Routing Page — Status Hero with Healthy Stats
- **Before:** `RoutingStatusHero` always shows 6 stats in the hero stats row: "2 / 2 policies", "0 circuits open", "Budget open", "4 decisions", "0 blocked", "5 targets".
- **Problem:** Most sessions show all-green stats. "0 circuits open" and "Budget open" and "0 blocked" are all ways of saying "routing is healthy". 6 separate visual items for one signal.
- **Decision:** When routing is healthy, collapse to "Routing is ready · 2/2 policies · 5 targets". Show circuit/budget info only when relevant. When not healthy, show only the relevant non-nominal stats.
- **After:** Healthy: `"Routing is ready — 2 policies active, 5 targets configured, no active blockers"`. Unhealthy: `"1 circuit open — OpenAI provider blocked due to rate limit"`.
- **Data location:** Full stat breakdown available on hero click or expand.

### 4.11 Notifications Page — Large Inline Page with Complex Outbox
- **Before:** 1143-line monolithic page with inline DrawerMode management, 7 state variables, complex form state, and full outbox/inbox rendering.
- **Problem:** The page's complexity makes it hard to maintain and the full outbox rendering shows every notification at once — including drafts, previews, and historical deliveries.
- **Decision:** Decompose into features/notifications/ module. Default view: show only pending/actionable notifications. Historical deliveries move to a "History" tab or collapsible section. Create/edit forms move to a DetailDrawer.
- **After:** Feature module with tabs: Action Required (default), All Outbox, History. DetailDrawer for creating/editing. Compact list view filtered to actionable items.
- **Data location:** All history accessible via tab switch.

### 4.12 Plugins Page — Large Inline CRUD with Raw JSON
- **Before:** 1852-line page with inline create/edit/binding forms, raw JSON config schema editor, security posture JSON editor.
- **Problem:** The page shows raw JSON editors (`<textarea>` with JSON.stringify'd content) as primary input surfaces. Security posture, config schema, and metadata are all raw JSON inputs visible in the main flow.
- **Decision:** Move raw JSON editors to Advanced Diagnostics or a "Raw editor" toggle. Default view uses structured form fields (key-value pairs, dropdowns, toggles) for common settings. Raw JSON still accessible for advanced users.
- **After:** Structured form for common fields with a "Switch to raw JSON" toggle. Security posture rendered as structured toggle fields (network_access, writes_external_state, etc.).
- **Data location:** Raw JSON editor available via toggle. All JSON data preserved.

### 4.13 Artifacts Page — Form-Intensive Page with Many Technical Fields
- **Before:** 1229-line page with a large create/edit form containing 15+ fields including checksum_sha256, mediaType, sizeBytes, retentionPolicy, advancedMetadataJson.
- **Problem:** Technical fields (checksum, size, media type) are presented with the same visual weight as user-facing fields (label, URI). The raw JSON metadata editor is a textarea in the main form.
- **Decision:** Group form fields into sections: "Basic info" (label, URI, type), "Technical details" (collapsible: checksum, size, media type, version), "Advanced" (collapsible: metadata JSON, retention policy). Raw JSON metadata moves to an Advanced Diagnostics section.
- **After:** Collapsed technical sections by default. Raw JSON via "Edit raw metadata" toggle.
- **Data location:** All fields accessible in expanded sections or toggle.

---

## 5. Consolidation Opportunities (CSS & Component)

These are pure styling/component refactors that unify the presentation layer without changing any page behavior:

### 5.1 Button Consolidation
| System | Action |
|---|---|
| `.ff-btn-*` CSS classes (utilities.css) | Keep as utility escape hatch |
| `Button` React component | Canonical system — use everywhere |
| `DestructiveAction` component | Remove — use `<Button variant="destructive">` |
| `NavigationAction` component | Remove — use `<Button variant="navigation">` |
| `.ff-skills-*` page-specific buttons (skills.css) | Remove — use shared Button component |
| `.ff-learning-*` page-specific buttons (learning.css) | Remove — use shared Button component |
| `.ff-primary-action` (runtime.css) | Remove — use `Button variant="primary"` |

### 5.2 Status Indicator Consolidation
| System | Action |
|---|---|
| `StatusBadge` React component | Canonical system — add `compact` prop and `dot` option |
| `StatusPill` React component | Merge into StatusBadge with `dot` prop |
| `.fg-pill` CSS class | Keep for raw HTML use, but migrate page usage to StatusBadge |
| `.ff-skills-status-led` (skills.css) | Remove — use `StatusBadge variant="dot"` |
| `.ff-learning-status-led` (learning.css) | Remove — use `StatusBadge variant="dot"` |
| `toneToTailwind()` in types.ts | Merge into StatusBadge — single tone resolution source |

### 5.3 Tron Frame Consolidation
| System | Action |
|---|---|
| `.ff-skills-tron-frame` (skills.css, 37 lines) | Remove from page CSS. Extract shared `.ff-tron-frame` if decorative frame is desired. |
| `.ff-learning-tron-frame` (learning.css, 37 lines) | Same — remove from page CSS. |
| **Recommendation** | Prefer no tron frame in standard pages. Reserve for special status/summary banners only. |

### 5.4 Page-Specific CSS Reduction Targets
| File | Lines | Target reduction |
|---|---|---|
| `skills.css` | 822 | ~400 lines (remove button classes, status LEDs, tron frame, duplicate lifecycle CSS) |
| `learning.css` | 917 | ~450 lines (same: buttons, LEDs, tron frame, duplicate form CSS) |
| `logs.css` | 502 | ~200 lines (remove duplicate hero cards, status dots, corner brackets) |
| `runtime.css` | 821 | ~200 lines (remove duplicate status badge, primary-action, state blocks covered by components) |

### 5.5 Component Consolidation
| Current Pattern | Target |
|---|---|
| `Section.tsx` + `ActionBar.tsx` + DataTable inline header | Share base "card-header" layout. Each is a `<div class="fg-card"><div class="ff-table-card-header">...</div>` wrapper |
| `StateBlocks.tsx` (deprecated) with `EmptyState` re-export | Remove deprecated wrappers. Update pages to use `EmptyState`, `ErrorState`, `LoadingState` from canonical locations. |

---

## 6. Priority Order for Application

### Tier 1: High Impact, Low Risk (Do First)
1. Remove PageIntro badges (4.2) — pure prop change
2. Hide zero-value KPI stats by default (4.3) — pure display change
3. Style navigation links as links, not buttons (3.3, 3.10) — component prop change
4. Collapse InstanceScopeCard when scoped (4.7) — component change
5. Consolidate button usage to single `Button` component (3.6, 5.1) — component import change

### Tier 2: Medium Impact, Medium Risk
6. Move raw evidence / JSON to Advanced Diagnostics (3.4, 4.12, 4.13)
7. Convert raw blocker codes to human-readable messages (2.13)
8. Collapse healthy KPI strips to single line (3.2, 4.10)
9. Merge StatusPill into StatusBadge (5.2)
10. Remove feature-specific button CSS from skills/learning pages (5.1)

### Tier 3: Architectural (Needs Planning)
11. Decompose large monolithic pages (4.6, 4.11, 4.12) into feature modules
12. Remove deprecated StateBlocks wrappers (5.5)
13. Consolidate tron frame or remove entirely (5.3)
14. Merge fg-table and ff-data-table (2.9)
15. Move instance scope to app shell (3.7)

---

## 7. Verification Checklist

When applying these rules to any page or component:

- [ ] Does every visible element answer Q1, Q2, or Q3?
- [ ] Is there at most one primary action per section?
- [ ] Are healthy/nominal/zero states collapsed or de-emphasized?
- [ ] Are raw IDs, timestamps (full ISO), and technical identifiers hidden from default view?
- [ ] Are navigation-only buttons styled as navigation, not action?
- [ ] Is raw JSON / evidence in Advanced Diagnostics or a detail drawer?
- [ ] Are repeated patterns consolidated (single button system, single status badge)?
- [ ] Are "Open ..." labels replaced with task-specific labels?
- [ ] Is the InstanceScopeCard in compact mode when an instance is selected?
- [ ] Are PageIntro badges removed (moved to first content section)?
- [ ] Are empty states specific and actionable (not generic)?
- [ ] Are feature-specific CSS classes avoided (use shared component classes)?
