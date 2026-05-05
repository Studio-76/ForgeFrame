# ForgeFrame Page UX Rules

**Status:** Final  
**Scope:** All ForgeFrame frontend pages (44+ routes, 26 feature modules)  
**Constraint:** No underlying data, settings, evidence, logs, controls, configuration, or diagnostic information may be removed. Information may be collapsed, moved, grouped, summarized, or visually de-emphasized but must remain accessible where appropriate.  
**Applies to:** All future page development, feature decomposition, and component consolidation work. Any new page or page migration MUST conform to one of the six page patterns defined below.

---

## Table of Contents

1. [Global Mandatory Rules](#1-global-mandatory-rules)
2. [Page Pattern Definitions](#2-page-pattern-definitions)
3. [Pattern 1: Setup Workflow](#21-pattern-setup-workflow)
4. [Pattern 2: Registry Management](#22-pattern-registry-management)
5. [Pattern 3: Incident Response](#23-pattern-incident-response)
6. [Pattern 4: Settings Management](#24-pattern-settings-management)
7. [Pattern 5: Review Queue](#25-pattern-review-queue)
8. [Pattern 6: Diagnostics / Observability](#26-pattern-diagnostics--observability)
9. [Page Classification Map](#3-page-classification-map)
10. [Forbidden Patterns](#4-forbidden-patterns)
11. [Component Reference](#5-component-reference)
12. [Pattern Adoption Checklist](#6-pattern-adoption-checklist)

---

## 1. Global Mandatory Rules

Every page — regardless of pattern — MUST follow these rules.

### 1.1 State Visibility

| # | Rule | Enforcement |
|---|------|-------------|
| R1 | Every page must show the current state clearly. | At least one status element visible in the first content block. |
| R2 | Every page must show whether action is required. | If action needed: `PrimaryBlockerCallout`, `NextRecommendedAction`, or non-zero count badge. |
| R3 | Every page must show one next recommended action when blocked or degraded. | Use `NextRecommendedAction` component with a single task-specific action. Never show multiple equal-weight next actions. |
| R4 | Healthy, ready, zero-count, and diagnostic information must be collapsed or visually secondary. | Zero-value stats hidden by default. Healthy states shown as a single compact line. Full data accessible via expand/toggle. |
| R5 | Raw IDs, timestamps, env vars, file paths, payloads, route keys, and blocker codes must not be prominent by default. | All raw technical data goes to `AdvancedDiagnostics`, tooltips, or detail drawers. Never in the main reading flow. |
| R6 | No page may render a wall of equal-weight cards. | Max 2 cards at the same visual tier. Use a table, list, or SummaryStrip to show multiple items at the same level. |
| R7 | Navigation actions must not look like primary mutation actions. | Navigation uses `Button variant="navigation"` or `ff-compact-link`. Never use `variant="primary"` for navigation. |
| R8 | Avoid generic "Open ..." button labels when a task-specific label is possible. | "Manage instances" > "Open Instances". "Configure routing" > "Open Routing". "Review recovery posture" > "Open Recovery". |

### 1.2 Layout Rules

| # | Rule |
|---|------|
| L1 | Every page uses `PageHeader` as its topmost element. |
| L2 | `PageHeader` badges must be zero. Badge data moves to the first content section. |
| L3 | Every page has a single `section.fg-page` wrapper. |
| L4 | ActionBar is for actions, not navigation. Use `PageTabs` for tab navigation, `ActionBar` for buttons. |
| L5 | Each section or card has at most one primary action button. |
| L6 | Instance scope is a compact toolbar line when scoped, full card only on scope selection. |
| L7 | Every page reserves a single `AdvancedDiagnostics` section at the bottom for all raw technical data. |
| L8 | Empty states must be specific and actionable: state explanation, why it matters, exact one action to take. |

### 1.3 Component Rules

| # | Rule |
|---|------|
| C1 | Use `Button` component (5 variants) for all buttons. No raw `<button>` elements for actions. |
| C2 | Use `StatusBadge` for all status indicators. No `StatusPill`, no raw `fg-pill` for status, no page-specific LED classes. |
| C3 | Use `DataTable` (TanStack-based) for all tables. No `EntityTable`, no raw `<table>` for registry/queue data. |
| C4 | Use `ConfirmationDialog` for destructive confirmations. No raw `confirm()` or custom modal for standard deletes. |
| C5 | Use `PrimaryBlockerCallout` for blocked-workflow messages. Format: `[What is wrong] — [Why it matters] — [What to do next]`. |
| C6 | Use `NextRecommendedAction` for single next-step guidance when the page is degraded but not fully blocked. |

---

## 2. Page Pattern Definitions

Each page MUST implement exactly one of these six patterns. The pattern determines:
- What layout sections are required (in order)
- Which components to use for each section
- What data belongs at each tier

### Section Key

Each pattern defines a vertical stack of sections. The notation:

```
MANDATORY — Must exist on every page using this pattern.
REQUIRED  — Must exist when the condition is met (shown as REQUIRED IF ...).
OPTIONAL  — May exist based on feature needs.
```

### Diagram Conventions

```
[Section Name]          ← Section rendered as a single component or block
  ComponentName         ← Specific component to use (from components/ui/)
```

---

### 2.1 Pattern: Setup Workflow

**Purpose:** Guide the operator through a linear or branched setup process with clear progress and next steps.  
**Pages:** Setup progress, password rotation, onboarding.  
**Tonal quality:** Direct, instructional, step-oriented. No fluff or celebration. Each step is a concrete action, not a "journey."

```
MANDATORY [PageHeader]
  eyebrow="Setup"
  title + short description
  no badges

MANDATORY [Setup Progress]
  Progress bar: N of M steps complete
  Active step highlighted, completed steps collapsed

MANDATORY [Current Step Content]
  Step title, description, form fields or configuration display
  One primary action: "Continue", "Save & Next", "Complete"

MANDATORY IF blocked [PrimaryBlockerCallout]
  What prerequisite is missing
  Why it blocks progress
  Action to resolve it

REQUIRED IF step-zero [EmptyState]
  "No setup yet — start by configuring your first instance"
  Primary action: "Begin setup"

OPTIONAL [AdvancedDiagnostics]
  At bottom: technical config, env info, raw setup state
```

**Setup Pattern Rules:**
- Steps are sequential, one visible at a time.
- Each step has a single primary action. No "Skip" unless the step is genuinely optional.
- Never show "Step 3 of 7" progress without labeling what each step is.
- Completed steps collapse to a single-line summary.
- No celebration/confetti on completion. Show what's ready and what's next.

**Allowed Components:**
- `PageHeader` (no badges)
- `PrimaryBlockerCallout`
- `NextRecommendedAction`
- `EmptyState`
- `AdvancedDiagnostics`
- `ReadinessChecklist` / `GateChecklist`
- `Section`
- `TextField`, `Select`, `Toggle`, `ConfirmationDialog`

**Forbidden in Setup Workflow:**
- `SummaryStrip`, `PageSummary` (no KPI metrics during setup)
- `DataTable` (setup is a flow, not an inventory)
- `StatusBadge` in the header
- Multiple action buttons per step
- "Open ..." navigation buttons — setup is self-contained

---

### 2.2 Pattern: Registry Management

**Purpose:** Browse, filter, create, edit, and delete entries in a registry (instances, providers, skills, targets, etc.).  
**Pages:** Instances, Providers, Models, Provider Targets, Routing, OAuth Targets, Plugins, Skills, Knowledge Sources, Memory, Accounts, ApiKeys, Channels, Contacts, Workspaces, Assistant Profiles, Agents, Automations, Harness, Artifacts.  
**Tonal quality:** Precise, data-dense, tool-like. The operator manages a collection of items with status, version, and lifecycle.

```
MANDATORY [PageHeader]
  eyebrown (category)
  title + description
  no badges

MANDATORY IF multi-instance [ScopeCompactBar]
  "Scope: prod-instance [change]"
  Hidden nav links (sidebar already has them)

MANDATORY [StatusSummary]
  Compact inline strip, non-zero stats only
  "12 skills · 8 active · 2 draft · 2 archived"
  Zero-value stats hidden, "Show all" toggle for full view

MANDATORY [RegistryTable]
  DataTable with search, filter, sort
  StatusBadge column for lifecycle state
  Raw ID column: last column, hidden by default
  Timestamps: relative time by default, ISO on tooltip

MANDATORY IF empty [EmptyState]
  "No [items] found. [Items] define what [context] can do. Register one or install from the catalog."
  Primary action: "Create [item]" or "Import [items]"

MANDATORY IF item-selected [SelectedItemDetail]
  DetailPanel (sticky) or inline Section
  Status, metadata, lifecycle controls (activate/archive/delete)
  Edit form in same panel or DetailDrawer

MANDATORY IF item-not-selected [EmptyDetailHint]
  "Select an [item] from the table to inspect its configuration."

REQUIRED IF create-mode [CreateForm]
  DetailDrawer or collapsible Section
  Form fields grouped: Basic info, Technical details (collapsible), Advanced (collapsible)

REQUIRED [ActionBar]
  Title: section name
  One primary action (usually "Create [item]")
  Overflow menu for secondary actions (import, export, bulk)

OPTIONAL [AdvancedDiagnostics]
  At bottom: raw JSON of selected item, system metadata, raw IDs
```

**Registry Pattern Rules:**
- The table is the primary interaction surface. Filtering and selection happen in the table.
- Selected-item detail is always visible when an item is selected.
- Create and edit forms are drawers or inline sections, never separate pages.
- Lifecycle actions (activate/archive/delete) are in the detail panel, not the table row.
- Delete actions always use `ConfirmationDialog`.

**Allowed Components:**
- `PageHeader`, `ScopeCompactBar` (or inline compact scope)
- `SummaryStrip` (compact, non-zero only)
- `DataTable` with presets
- `DetailPanel`, `DetailDrawer`
- `Section`, `ActionBar`
- `Button` (primary on create, secondary on edit, destructive on delete)
- `StatusBadge`
- `NextRecommendedAction` (for blocked items)
- `PrimaryBlockerCallout` (for items that cannot operate)
- `AdvancedDiagnostics`, `ConfirmationDialog`
- `EmptyState`, `SearchInput`, `FilterBar`

**Forbidden in Registry Management:**
- `PageSummary` with `SummaryStrip` — use `SummaryStrip` directly without `PageSummary`
- Multiple primary action buttons in ActionBar
- Raw JSON editors as primary form inputs (toggleable only)
- Full InstanceScopeCard when scoped (use compact bar)
- Page-specific button CSS classes

---

### 2.3 Pattern: Incident Response

**Purpose:** Detect, diagnose, and resolve active incidents, blockers, and degraded states.  
**Pages:** Recovery/Backup/Restore, Health, Execution Review, Dispatch, Inbox (triage), Notifications (actionable), Errors.  
**Tonal quality:** Calm, direct, unemotional. Facts, evidence, and clear next actions. No "We're sorry" language — explain what happened, why, and what to do.

```
MANDATORY [PageHeader]
  eyebrow (category)
  title + description
  no badges

MANDATORY IF active-blocker [PrimaryBlockerCallout]
  Prominent at top of content area
  "Certificate expired — API calls will fail. Renew the certificate in Settings."
  Action button: "Fix [blocker type]"

MANDATORY IF degraded [NextRecommendedAction]
  Below blocker or at top if no blocker
  "Review 3 failing health checks — run diagnostics"
  Action: "Run diagnostics" or "View failing checks"

MANDATORY [IncidentSummary]
  SummaryStrip with non-zero counts only
  "3 active incidents · 2 blocked executions · 1 certificate expiry"
  Zero-count stats hidden

MANDATORY [IncidentList / TriageTable]
  DataTable or IncidentList component
  Sort by severity (critical first), then by age (oldest first)
  Each row: severity, summary, age, status, action

MANDATORY IF item-selected [IncidentDetail]
  DetailPanel or DetailDrawer
  Full incident info: timeline, evidence, related items
  Remediation steps (RemediationChecklist)

MANDATORY IF no-incidents [EmptyState]
  "All systems operational. No active incidents."
  Muted styling, no celebration

OPTIONAL [PageTabs]
  Tabs: Active Incidents (default), History, All

OPTIONAL [AdvancedDiagnostics]
  At bottom: raw error payloads, timestamps, stack traces, system paths
```

**Incident Response Rules:**
- Blocker callout is the most prominent element when active. It must be dismissable only when resolved.
- Incident list sorts by severity, not by date. Critical first, regardless of age.
- No empty state celebration for zero incidents — just a quiet "All clear."
- Evidence and raw data go to detail drawer or Advanced Diagnostics.
- Remediation checklist shows steps in order, with completion tracking.

**Allowed Components:**
- `PageHeader`
- `PrimaryBlockerCallout`, `NextRecommendedAction`
- `SummaryStrip` (compact, non-zero only)
- `IncidentList`, `RemediationChecklist`
- `DataTable` (for triage tables)
- `DetailPanel`, `DetailDrawer`
- `ActivityTimeline`, `AuditTimeline` (for incident timeline)
- `DiagnosticsSummary`
- `StatusBadge`, `SeverityIndicator`, `HealthState`
- `PageTabs`
- `AdvancedDiagnostics`

**Forbidden in Incident Response:**
- Equal-weight cards for healthy and unhealthy items
- Raw error codes in visible flow (use human-readable messages)
- "Open ..." navigation buttons — use task labels
- Confetti, celebration, or "Great news!" language

---

### 2.4 Pattern: Settings Management

**Purpose:** Configure system settings, rotate secrets, manage security policies.  
**Pages:** System Settings, Security.  
**Tonal quality:** Organized, hierarchical, safe. Settings are grouped, changes are confirmed, destructive actions require explicit confirmation.

```
MANDATORY [PageHeader]
  eyebrow="Settings"
  title + description
  no badges

MANDATORY [SettingsInventory]
  Section list or DataTable with settings groups
  Each group: name, summary, current value summary, edit action

REQUIRED IF group-selected [SettingsDetail]
  DetailPanel or inline Section
  All settings in the group with current values
  Edit toggle for each modifiable setting

REQUIRED IF editing [SettingsForm]
  Inline form or DetailDrawer
  One primary action: "Save changes"

REQUIRED IF destructive-action [ConfirmationDialog]
  Explicit confirmation for irreversible changes
  "Delete API key ? This can't be undone."

OPTIONAL [AdvancedDiagnostics]
  At bottom: raw config JSON, env vars, system paths
```

**Settings Management Rules:**
- Settings groups are the primary organization unit. Flat lists of 20+ individual settings are forbidden.
- Destructive actions require typed confirmation (type the setting name to confirm).
- All changes show a confirmation toast or inline success message.
- Read-only settings are visually distinct from editable ones.
- Raw config JSON is in Advanced Diagnostics, not the main view.

**Allowed Components:**
- `PageHeader`, `Section`
- `DetailPanel`, `DetailDrawer`
- `Button` (primary on save, destructive on delete)
- `TextField`, `Select`, `Toggle`, `TextArea`
- `ConfirmationDialog`
- `AdvancedDiagnostics`

**Forbidden in Settings Management:**
- SummaryStrip or KPI metrics (settings are static, not operational)
- StatusBadge for settings values (use text labels)
- "Open ..." labels
- Raw JSON editors as primary input (toggleable only)
- Table with lifecycle actions (settings are configured, not created/deleted)

---

### 2.5 Pattern: Review Queue

**Purpose:** Review, approve, reject, or triage items in a queue.  
**Pages:** Learning, Approvals, Tasks, Reminders.  
**Tonal quality:** Decisive, clear, action-oriented. Each item needs a binary or categorical decision. The queue status must be obvious at a glance.

```
MANDATORY [PageHeader]
  eyebrow (category)
  title + description
  no badges

MANDATORY [QueueStatusSummary]
  Compact SummaryStrip
  Pending count (most prominent), overdue count, total
  "12 pending · 3 overdue · 45 total"

MANDATORY IF queue-empty [EmptyState]
  "No pending [items]. All [items] have been reviewed."
  Option to show reviewed/all items

MANDATORY [QueueTable]
  DataTable with: priority, summary, age, status, review action
  Sort by priority then age (oldest actionable first)
  StatusBadge for decision status
  Quick-action column: approve/reject buttons

MANDATORY IF item-selected [ReviewDetail]
  DetailDrawer
  Full item details: context, evidence, related items
  Decision actions: Approve (primary), Reject (destructive)
  Optional: Defer, Request more info

OPTIONAL [PageTabs]
  Tabs: Pending (default), Reviewed, All

OPTIONAL [AdvancedDiagnostics]
  At bottom: raw payload, audit trail, system metadata
```

**Review Queue Rules:**
- The pending count is the most important metric. Show it prominently.
- Quick actions in the table row (approve/reject) prevent unnecessary navigation.
- Full detail drawer shows all evidence without leaving the queue view.
- Decision actions must be unambiguous: "Approve learning event" not "Submit."
- Reviewed items collapse to a single status line with the decision.

**Allowed Components:**
- `PageHeader`
- `SummaryStrip` (compact)
- `DataTable` with quick-action column
- `DetailDrawer`
- `Button` (primary on approve, destructive on reject)
- `StatusBadge`
- `EmptyState`, `PageTabs`
- `AdvancedDiagnostics`

**Forbidden in Review Queue:**
- Multiple items open at once (single-item detail drawer)
- Edit actions in the queue (queue is for review, not editing)
- Raw evidence/JSON in the queue table rows
- "Open ..." labels — "Approve" or "Review" are task labels

---

### 2.6 Pattern: Diagnostics / Observability

**Purpose:** Monitor system health, investigate issues, analyze usage and costs.  
**Pages:** Logs (Incidents, Activity, Audit, Diagnostics), Usage, Costs, Queues, Conversations, Execution.  
**Tonal quality:** Analytical, precise, informative. The operator is investigating — provide tools, not interpretations. Don't decorate findings with narrative.

```
MANDATORY [PageHeader]
  eyebrow="Observability" (or "Operations")
  title + description
  no badges

MANDATORY [StatusSummary]
  Compact SummaryStrip or HealthState
  Overall system state, non-zero issues prominently displayed
  "All systems nominal" when healthy (muted styling)

MANDATORY [MainContent]
  PageTabs or Section-based layout
  Tabs: Overview / Details / History (as appropriate)
  Each tab contains focused content, not everything at once

MANDATORY IF degraded [NextRecommendedAction]
  "3 services degraded — review Diagnostics tab"
  Action: switch to relevant tab

OPTIONAL [TimeRangeSelector]
  Compact date/time range picker for log/history views

OPTIONAL [DataTable]
  For event lists, log entries, usage records
  Sort by timestamp descending by default
  Filter by severity, type, source

OPTIONAL [ActivityTimeline / AuditTimeline]
  For grouped event views
  Repeated events collapsed: "Login from IP X (5 times)"

REQUIRED [AdvancedDiagnostics]
  At bottom: raw metrics, log payloads, trace IDs, full timestamps (ISO)
  Always present in diagnostics pages
```

**Diagnostics Pattern Rules:**
- The status summary is compact. Full diagnostic data is one click away in tabs.
- Time range selection is essential for history views.
- Repeated healthy events collapse into groups.
- Raw trace IDs, log payloads, and full timestamps go to Advanced Diagnostics.
- Chart and metric visualizations use standard components, not custom SVG.

**Allowed Components:**
- `PageHeader`
- `SummaryStrip`, `HealthState`
- `NextRecommendedAction`, `PrimaryBlockerCallout`
- `PageTabs`
- `DataTable` (for event lists)
- `ActivityTimeline`, `AuditTimeline`
- `DiagnosticsSummary`, `SeverityIndicator`
- `StatusBadge`
- `AdvancedDiagnostics`

**Forbidden in Diagnostics/Observability:**
- Raw log payloads in the main reading flow
- Stack traces without line wrapping or syntax highlighting
- Every event shown individually (group repeated events)
- "Open ..." navigation labels
- Cards for every subsystem when healthy (collapse healthy groups)
- Confetti or celebration for "0 errors"

---

## 3. Page Classification Map

Every ForgeFrame page is assigned to exactly one pattern. Pages are listed with their current file, size, and migration status.

### 3.1 Setup Workflow

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| Dashboard (Setup Progress) | `/dashboard` | `pages/DashboardPage.tsx` → `features/setup/` | 9 | ✅ Delegated |
| Password Rotation | `/rotate-password` | `pages/PasswordRotationPage.tsx` | — | Monolithic |
| Onboarding | `/onboarding` | (redirects to dashboard) | — | Redirect |

### 3.2 Registry Management

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| Instances | `/instances` | `pages/InstancesPage.tsx` + `features/instances/` | 539 | ✅ Decomposed (page-managed state) |
| Providers | `/providers` | `pages/ProvidersPage.tsx` + `features/providers/` | 173 | ✅ Decomposed |
| OAuth Targets | `/oauth-targets` | `pages/OAuthTargetsPage.tsx` | — | Monolithic |
| Models | `/models` | `pages/ModelsPage.tsx` | — | Monolithic |
| Provider Targets | `/provider-targets` | `pages/ProviderTargetsPage.tsx` | 220 | Monolithic |
| Routing | `/routing` | `pages/RoutingPage.tsx` | 499 | Monolithic |
| Ingress / TLS | `/ingress-tls` | `pages/IngressTlsPage.tsx` | 197 | Monolithic |
| Release / Validation | `/release-validation` | `pages/ReleaseValidationPage.tsx` | 814 | Monolithic |
| Plugins | `/plugins` | `pages/PluginsPage.tsx` | 1852 | 🚨 Monolithic |
| Skills | `/skills` | `pages/SkillsPage.tsx` + `features/skills/` | 189 | ✅ Delegated |
| Knowledge Sources | `/knowledge-sources` | `pages/KnowledgeSourcesPage.tsx` | 198 | Partial |
| Memory | `/memory` | `pages/MemoryPage.tsx` | 302 | Monolithic |
| API Keys | `/api-keys` | `pages/ApiKeysPage.tsx` | 1140 | 🚨 Monolithic |
| Accounts | `/accounts` | `pages/AccountsPage.tsx` | 854 | 🚨 Monolithic |
| Channels | `/channels` | `pages/ChannelsPage.tsx` | 780 | Monolithic |
| Contacts | `/contacts` | `pages/ContactsPage.tsx` | — | Monolithic |
| Workspaces | `/workspaces` | `pages/WorkspacesPage.tsx` | 1117 | 🚨 Monolithic |
| Assistant Profiles | `/assistant-profiles` | `pages/AssistantProfilesPage.tsx` | 598 | Monolithic |
| Agents | `/agents` | `pages/AgentsPage.tsx` | 1014 | 🚨 Monolithic |
| Automations | `/automations` | `pages/AutomationsPage.tsx` | 974 | 🚨 Monolithic |
| Harness | `/harness` | `pages/HarnessPage.tsx` | — | Monolithic |
| Artifacts | `/artifacts` | `pages/ArtifactsPage.tsx` | 1229 | 🚨 Monolithic |

### 3.3 Incident Response

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| Recovery / Backup / Restore | `/recovery` | `pages/RecoveryPage.tsx` | 1901 | 🚨 Monolithic |
| Health | `/health-status` | `pages/HealthPage.tsx` | 590 | Monolithic |
| Execution Review | `/execution` | `pages/ExecutionPage.tsx` → `features/execution/` | 1 | ✅ Delegated |
| Dispatch | `/dispatch` | `pages/DispatchPage.tsx` | 864 | 🚨 Monolithic |
| Inbox (triage) | `/inbox` | `pages/InboxPage.tsx` | 1165 | 🚨 Monolithic |
| Notifications (actionable) | `/notifications` | `pages/NotificationsPage.tsx` | 1143 | 🚨 Monolithic |
| Errors | `/errors` | `pages/ErrorsPage.tsx` | 722 | Monolithic |

### 3.4 Settings Management

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| System Settings | `/settings` | `pages/SettingsPage.tsx` + `features/settings/` | 182 | ✅ Delegated |
| Security | `/security` | `pages/SecurityPage.tsx` → `features/security/` | 1 | ✅ Delegated |

### 3.5 Review Queue

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| Learning | `/learning` | `pages/LearningPage.tsx` + `features/learning/` | 223 | ✅ Delegated |
| Approvals | `/approvals` | `pages/ApprovalsPage.tsx` → `features/approvals/` | 1 | ✅ Delegated |
| Tasks | `/tasks` | `pages/TasksPage.tsx` | 998 | 🚨 Monolithic |
| Reminders | `/reminders` | `pages/RemindersPage.tsx` | 853 | 🚨 Monolithic |

### 3.6 Diagnostics / Observability

| Page | Route | File | Lines | Status |
|------|-------|------|-------|--------|
| Logs (Incidents/Activity/Audit/Diagnostics) | `/logs` | `pages/LogsPage.tsx` → `features/logs/` | 1 | ✅ Delegated |
| Usage | `/usage` | `pages/UsagePage.tsx` → `features/usage/` | 1 | ✅ Delegated |
| Costs | `/costs` | `pages/CostsPage.tsx` | 1734 | 🚨 Monolithic |
| Queues | `/queues` | `pages/QueuesPage.tsx` + `features/queues/` | 7 | ✅ Delegated |
| Conversations | `/conversations` | `pages/ConversationsPage.tsx` + `features/conversations/` | 229 | ✅ Delegated |

### Migration Priority

Priority ordering for migrating monolithic pages to their assigned pattern:

| Priority | Page | Pattern | Lines | Migration Risk |
|----------|------|---------|-------|----------------|
| P1 | RecoveryPage | Incident Response | 1901 | High — complex tab structure |
| P1 | PluginsPage | Registry Management | 1852 | High — raw JSON editors |
| P1 | CostsPage | Diagnostics / Observability | 1734 | High — multiple data sections |
| P2 | ArtifactsPage | Registry Management | 1229 | Medium — form-heavy |
| P2 | InboxPage | Incident Response | 1165 | Medium — triage logic |
| P2 | NotificationsPage | Incident Response | 1143 | Medium — outbox/inbox state |
| P2 | ApiKeysPage | Registry Management | 1140 | Medium — CRUD + rotation |
| P2 | WorkspacesPage | Registry Management | 1117 | Medium — CRUD |
| P2 | AgentsPage | Registry Management | 1014 | Medium — CRUD |
| P2 | TasksPage | Review Queue | 998 | Medium — sorting/filtering |
| P2 | AutomationsPage | Registry Management | 974 | Medium — CRUD + rules |
| P3 | DispatchPage | Incident Response | 864 | Medium — lease management |
| P3 | AccountsPage | Registry Management | 854 | Medium — CRUD |
| P3 | RemindersPage | Review Queue | 853 | Medium — due-state |
| P3 | ReleaseValidationPage | Registry Management | 814 | Medium — readiness gates |
| P3 | ChannelsPage | Registry Management | 780 | Medium — CRUD |
| P3 | ErrorsPage | Incident Response | 722 | Medium — alert display |
| P3 | AssistantProfilesPage | Registry Management | 598 | Medium — CRUD |
| P3 | HealthPage | Incident Response | 590 | Medium — health check display |
| P3 | RoutingPage | Registry Management | 499 | Medium — policy display |
| P3 | MemoryPage | Registry Management | 302 | Low — simple CRUD |
| P4 | All remaining monolithic pages | varies | <500 | Low |

---

## 4. Forbidden Patterns

These patterns must never appear in any ForgeFrame page:

### 4.1 Presentation Anti-Patterns

| Anti-Pattern | Example | Replace With |
|-------------|---------|-------------|
| **Equal-weight card wall** | 6 `fg-card` elements stacked with same visual weight | One table or one SummaryStrip + detail |
| **Healthy state cards** | 4 green "All OK" cards taking 50% of viewport | Single compact "All nominal" line |
| **Raw JSON in main flow** | `<pre>{JSON.stringify(data)}</pre>` in a visible card | `AdvancedDiagnostics` section at bottom |
| **Raw blocker codes visible** | `ERR_BLOCKER_CERT_EXPIRY_2026` as primary text | Human-readable: "Certificate expired on 2026-04-01" |
| **Full InstanceScopeCard when scoped** | 200px card with dropdown + nav links + metadata on every page | Compact "Scope: prod-instance [change]" bar |
| **Multiple primary buttons per section** | `[Create] [Edit] [Delete]` all using `variant="primary"` | One primary, rest secondary/tertiary/destructive |
| **Navigation buttons styled as actions** | `Button variant="primary"` for a `<Link>` | `Button variant="navigation"` or `ff-compact-link` |

### 4.2 Component Anti-Patterns

| Anti-Pattern | Replace With |
|-------------|-------------|
| `StatusPill` | `StatusBadge` (with `dot` variant if needed) |
| `NavigationAction` | `Button variant="navigation"` |
| `DestructiveAction` | `Button variant="destructive"` |
| `EntityTable` | `DataTable` (TanStack-based) |
| `DataTableLegacy` | `DataTable` |
| `ErrorState`, `LoadingState`, `Skeleton`, `PermissionState`, `BlockedState` (from StateBlocks) | `EmptyState` or inline handling |
| Feature-specific button CSS classes (`.ff-skills-*`, `.ff-learning-*`) | `Button` component |
| Raw `<button>` for actions | `Button` component |
| `confirm()` for deletes | `ConfirmationDialog` component |

### 4.3 Copy Anti-Patterns

| Anti-Pattern | Replace With |
|-------------|-------------|
| "Open [page name]" | Task-specific label: "Manage [items]", "Configure [feature]" |
| "No data yet" | Specific: "No [items] found. [Explain what they do and why they matter.]" |
| "Are you sure?" | Specific: "Delete [item name]? This can't be undone." |
| "Loading..." with no context | Skeleton or progress indicator for expected content area |
| "Powered by AI" badge | Remove entirely |
| Emoji in headers | Remove entirely |
| "Great question!" | Direct answer |
| "We're excited to announce" | Changelog entry: what changed, why, what to do |

---

## 5. Component Reference

### 5.1 Available Layout Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `PageHeader` | `../components/ui` | Topmost element of every page |
| `Section` | `../components/ui` | Card-style content grouping |
| `ActionBar` | `../components/ui` | Section header with action buttons (not navigation) |
| `PageTabs` | `../components/ui` | Tab navigation between views |
| `SplitPane` | `../components/ui` | Side-by-side layout |
| `DetailPanel` | `../components/ui` | Sidebar detail (sticky or scroll) |
| `DetailDrawer` | `../components/ui` | Slide-over detail panel |
| `EmptyState` | `../components/ui` | Structured empty state with specific action |
| `AdvancedDiagnostics` | `../components/ui` | Collapsible raw data section (bottom of every page) |
| `SummaryStrip` | `../components/ui` | Compact KPI metric strip |

### 5.2 Available Action Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `Button` | `../components/ui` | All buttons (5 variants: primary, secondary, tertiary, destructive, navigation) |
| `IconButton` | `../components/ui` | Icon-only action |
| `ButtonGroup` | `../components/ui` | Grouped button layout |
| `OverflowMenu` | `../components/ui` | Secondary actions dropdown |

### 5.3 Available Status Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `StatusBadge` | `../components/ui` | All status badges (canonical) |
| `HealthState` | `../components/ui` | Health state display |
| `SeverityIndicator` | `../components/ui` | Severity level display |
| `PrimaryBlockerCallout` | `../components/ui` | Blocked-workflow banner |
| `NextRecommendedAction` | `../components/ui` | Single next-step guidance |

### 5.4 Available Workflow Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `RemediationChecklist` | `../components/ui` | Step-by-step remediation |
| `ReadinessChecklist` | `../components/ui` | Setup/readiness checklist |
| `GateChecklist` | `../components/ui` | Release gate checklist |
| `IncidentList` | `../components/ui` | Incident display list |
| `AuditTimeline` | `../components/ui` | Audit event timeline |
| `ActivityTimeline` | `../components/ui` | Activity event timeline |
| `DiagnosticsSummary` | `../components/ui` | Diagnostic findings |

### 5.5 Available Data Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `DataTable` | `../components/ui` | All tables (TanStack-based) |
| `SearchInput` | `../components/ui` | Search input |
| `FilterBar` | `../components/ui` | Filter controls |

### 5.6 Available Form Components

| Component | Import Path | Use |
|-----------|-------------|-----|
| `TextField` | `../components/ui` | Text input |
| `TextArea` | `../components/ui` | Multi-line text input |
| `Select` | `../components/ui` | Dropdown select |
| `Toggle` | `../components/ui` | Toggle switch |
| `ConfirmationDialog` | `../components/ui` | Destructive action confirmation |

---

## 6. Pattern Adoption Checklist

When creating a new page or migrating an existing one, verify against this checklist:

### Pattern Assignment

- [ ] Page is assigned to exactly one of the six patterns (Setup Workflow, Registry Management, Incident Response, Settings Management, Review Queue, Diagnostics/Observability)
- [ ] The pattern's layout order is followed (sections in the defined sequence)
- [ ] The pattern's allowed/forbidden component list is respected

### Global Rules

- [ ] PageHeader has zero badges (badge data moved to first content section)
- [ ] State is clearly communicated (R1)
- [ ] Action requirement is visible (R2)
- [ ] Next recommended action shown when blocked/degraded (R3)
- [ ] Healthy/zero states are collapsed or de-emphasized (R4)
- [ ] Raw technical data is in Advanced Diagnostics only (R5)
- [ ] No wall of equal-weight cards (R6)
- [ ] Navigation actions use `variant="navigation"`, not primary (R7)
- [ ] No "Open ..." labels — task-specific labels used (R8)

### Component Rules

- [ ] All buttons use `Button` component (no raw `<button>`, no `NavigationAction`, no `DestructiveAction`)
- [ ] All status indicators use `StatusBadge` (no `StatusPill`, no feature-specific LED classes)
- [ ] All tables use `DataTable` (no `EntityTable`, no raw `<table>` for registry data)
- [ ] Delete confirmations use `ConfirmationDialog` (no `confirm()`)
- [ ] Single `AdvancedDiagnostics` section at bottom
- [ ] Instance scope is compact bar when scoped (not full card)
- [ ] PrimaryBlockerCallout format: what → why → how
- [ ] EmptyState is specific and actionable

### Pattern-Specific Rules

- [ ] Setup: sequential steps, one visible at a time, single action per step
- [ ] Registry: table is primary surface, detail on selection, create/edit in drawer
- [ ] Incident: blocker callout prominent, incidents sorted by severity
- [ ] Settings: groups are primary organization, destructive actions require typed confirmation
- [ ] Review Queue: pending count prominent, quick actions in table row
- [ ] Diagnostics: time range selector present, repeated events grouped
