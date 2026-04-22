# FOR-14 Priority Workflows and State Coverage

## Objective and Operator Problem

ForgeGate now has an IA baseline in `FOR-12` and a visual-system baseline in `FOR-13`, but the highest-value operator workflows still lack a screen-level contract. The current control plane exposes raw route surfaces for dashboard, providers, usage, security, and logs, yet it does not consistently tell an operator what needs action first, what evidence supports that action, or which state means a workflow is actually complete. That gap is highest on the four surfaces that shape daily trust in the product: overview/dashboard, findings triage, approvals, and audit history.

This slice matters now because frontend and backend work is already landing against these areas. Without an explicit workflow and state definition, engineering will keep inventing page-local behavior, QA will test the wrong success criteria, and the UI will imply workflow maturity that ForgeGate does not yet provide.

Assumptions:

- ForgeGate remains a UI-first control plane for routine operator work.
- The current implementation is the source of truth for this spec: `Dashboard`, `Providers`, `Usage`, `Security`, `Approvals`, `Logs`, and `Execution`.
- No prototype exists yet, so this artifact is flow-first, state-first, and implementation-grounded.
- `Findings` is a UI grouping over existing backend signals such as dashboard alerts, provider not-ready state, harness profiles with `needs_attention`, OAuth failures, client error-rate warnings, and audit-worthy governance events. It is not a separate backend entity yet.
- Execution-run approvals and elevated-access approvals are both live on the shared `/approvals` surface today; elevated access still keeps requester-owned session start and active session posture on `/security`.

Current shipped truth for this checkout:

- `/approvals` is the shipped shared queue/detail review surface for execution-run and elevated-access approvals, with admin-only decisions and operator/admin review.
- `/security` is no longer an admin-only monolith: `operator` and `admin` can request/start elevated access there, while admin-only posture modules remain guarded inside the same route.

## Prioritized Workflows and State Coverage

### 1. Overview / Dashboard

- Trigger or entry point:
  - first signed-in landing after login
  - routine daily operator check
  - return point after handling a finding, approval, or governance action
- Happy path:
  1. Operator lands on `Home > Dashboard`.
  2. Scans a compact summary band for platform health, open findings, governance posture, and freshness.
  3. Opens the highest-priority finding or workflow from one primary action per card.
  4. Handles the issue in the destination surface.
  5. Returns to the dashboard and verifies whether the top risk cleared, persisted, or changed severity.
- Key decision points:
  - whether ForgeGate is broadly healthy, degraded, or still not ready for routine traffic
  - whether the top issue belongs to provider operations, client impact, governance posture, audit follow-up, or approvals
  - whether the snapshot is fresh enough to trust or needs a manual refresh / retry
- Required states and edge cases:
  - loading state with skeleton KPI tiles and stable card frames; the page must not collapse to blank space while data loads
  - healthy / empty state with neutral language such as `No current findings` rather than celebratory success treatment
  - stale-data state when the dashboard snapshot or linked evidence is older than the selected monitoring window
  - partial-data state when dashboard KPIs load but one source area such as alerts or governance status fails
  - permission-limited state where viewers still see the top-level summary but mutating calls to action are replaced with read-only wording
  - no-session or expired-session return path that makes reauthentication explicit instead of leaving dead controls visible
  - post-action confirmation state that shows the latest status change or latest audit event without forcing the user to rescan every card
- Operator success criteria:
  - the operator can identify the highest-risk issue and the correct next click in under five seconds
  - the operator can tell whether ForgeGate is broadly ready for routine operation without opening more than one downstream surface
  - the dashboard never implies that a warning has been resolved unless the backing source-of-truth data has actually cleared
- Trust, accessibility, and feedback signals:
  - every dashboard card exposes `Last updated`, `Latest audit event`, or equivalent freshness evidence
  - alert and finding rows include text severity labels, not color alone
  - keyboard focus follows scan order: page header, summary band, findings preview, governance snapshot
  - each card answers one question only, to reduce cognitive load and improve information scent

### 2. Findings Triage

- Trigger or entry point:
  - `Needs attention` row or alert from the dashboard
  - direct entry into `Providers`, `Usage`, or `Logs`
  - operator complaint or provider/client incident
- Happy path:
  1. Operator opens the findings queue preview from the dashboard or the findings-focused section on the downstream page.
  2. Filters by severity, source surface, provider/client, or finding type.
  3. Reviews the evidence row that explains why the item exists.
  4. Opens the right destination action:
     - provider sync, probe, verify, or activation
     - harness run review
     - client impact drilldown
     - governance or audit follow-up
     - approval decision
  5. Confirms whether the finding cleared, remained open, or escalated.
- Key decision points:
  - whether this is a configuration gap, live operational degradation, client-specific incident, or governance problem
  - whether the finding is actionable now or only informational
  - whether the correct response is to inspect more evidence, take a control-plane action, or open the audit trail
- Required states and edge cases:
  - loading state where filter controls stay visible and results use placeholder rows instead of disappearing
  - empty-filter state with `No results for the current filters.` plus a reset action
  - no-findings state that remains neutral and still shows the active time window or scope
  - stale evidence state when the finding preview is older than the data behind it
  - partial-source state when one class of findings loads and another fails
  - duplicate-signal state where multiple sources describe the same issue; the UI should group or cross-link rather than show four disconnected warnings
  - recurring finding state where an item cleared and returned; use timestamps and recurrence wording rather than silently replacing the old signal
  - permission-limited state where the operator can inspect the issue but not run the required action
  - success state that clearly says findings clear from source truth, not from manual dismissal
- Operator success criteria:
  - the operator can understand why an item is in the queue without opening raw JSON
  - one triage step is enough to determine the correct downstream workflow
  - findings never disappear because of UI-only acknowledgement; they clear only when the underlying condition is resolved
- Trust, accessibility, and feedback signals:
  - each row shows source, severity, status text, and freshness in a consistent pattern
  - filter labels remain visible above controls and stay keyboard reachable
  - findings use recognition over recall: provider name, client name, action label, and latest status are visible in the row
  - cross-links name the destination explicitly, for example `Open provider health`, `Open client impact`, or `Open audit history`

### 3. Approvals

- Trigger or entry point:
  - dashboard finding that an approval is waiting
  - direct entry to a dedicated approval surface or an `Execution` review view
  - elevated access request from `Security`
- Happy path:
  1. Operator opens the approvals queue.
  2. Sees open approval items grouped by approval type and urgency.
  3. Opens one item into a decision view with summary, evidence, and impact.
  4. Reviews request context, actor/requester, reason, timestamps, and related run or access target.
  5. Approves or rejects with explicit outcome wording.
  6. Sees the resulting system state, audit reference, and any next action needed.
- Key decision points:
  - whether the approval is for a waiting execution run or an elevated governance action
  - whether the operator has enough evidence to decide now or needs to inspect related run/audit context first
  - whether the decision should resume work, fail work, cancel work, or deny access
- Required states and edge cases:
  - loading state for the queue and for the selected approval detail
  - empty state with `No approvals waiting.` and a visible note about what kinds of work appear here
  - already-resolved state when another operator acted while the current operator was viewing the request
  - conflict state for closed or timed-out approvals
  - permission-limited state when the current user can inspect but not decide
  - confirmation state for reject and high-risk approve actions
  - success state that names the resulting transition:
    - execution run resumed
    - execution run rejected / failed
    - execution run cancelled or compensating
    - elevated request approved and ready to start
    - elevated request rejected or cancelled with no issued session
  - audit/history state that exposes approval ID or approval reference and links to the latest audit event
- Operator success criteria:
  - the operator can make a decision without leaving the UI for terminal or raw database inspection
  - the operator always understands what the decision changed in system terms
  - the UI keeps approval outcome separate from downstream session issuance or execution resumption
- Trust, accessibility, and feedback signals:
  - approve and reject actions are visually separated and use explicit verbs
  - the evidence panel shows request time, requester, target, and impact before secondary detail
  - raw IDs remain available but are not the primary decision content
  - reject flows require text rationale when that rationale is needed for downstream audit clarity

Implementation honesty for the first pass:

- `/approvals` is already shipped as the shared queue/detail review surface for execution-run and elevated-access approvals.
- `Security` break-glass and impersonation actions create real approval items, deep-link into `/approvals`, and keep requester-only session start on `/security`.
- The shipped approval surface is therefore intentionally split by responsibility:
  - review and decision on `/approvals`
  - requester-owned session start and active session posture on `/security`

### 4. Audit History

- Trigger or entry point:
  - direct navigation from `Governance > Audit History`
  - post-action confirmation after account, key, session, settings, or approval mutations
  - incident review or policy review
- Happy path:
  1. Operator opens the audit history surface from dashboard, governance, or approvals.
  2. Filters by time window, action, actor, target type, target ID, and status.
  3. Scans the evidence table for the relevant event.
  4. Opens a detail view that shows human-readable change context first and raw metadata second.
  5. Uses the audit result to confirm the action, support an incident review, or hand evidence to another operator.
- Key decision points:
  - whether the operator needs audit evidence, operational logs, or both
  - whether the current event list is sufficient or has hit retention / pagination limits
  - whether the operator needs to branch into the related route, for example account detail, key lifecycle, or execution run history
- Required states and edge cases:
  - loading state with persistent filters and placeholder rows
  - no-events state when the environment is new
  - no-results state when filters exclude all current events
  - retention-limited state when older evidence is outside the retained event set
  - mixed-evidence state because `/logs` currently combines audit and operational summaries on one route
  - permission-limited state when the user can inspect summary posture but not full evidence detail
  - post-mutation success state with one-click return to the newest related audit event
  - redacted-detail state when sensitive material must not appear in-line
- Operator success criteria:
  - the operator can answer who did what, when, to which target, and with what outcome
  - high-risk mutations from `Security`, `Accounts`, `API Keys`, `Settings`, or future approvals can be verified in one click
  - audit history is clearly distinguished from error summary and operability checks
- Trust, accessibility, and feedback signals:
  - action labels are human-readable first, with raw action keys secondary
  - timestamps use a consistent readable format and remain sortable/filterable
  - the current filter scope is always visible
  - screen-reader users can distinguish summary tables from detail panels and feedback banners

## IA / Navigation Implications

- `Dashboard` should become the explicit triage start point for all four workflows, with direct links into findings, approvals, and audit history when relevant.
- `Findings` should first exist as a dashboard preview plus downstream findings-oriented sections on `Providers`, `Usage`, and `Logs`. This avoids inventing a new route before backend aggregation or URL-addressable drilldowns exist.
- `Approvals` should be treated as a `Governance` workflow in operator language and remain the live shared review surface, with deep links into `/execution`, `/security`, and audit history instead of hiding review behind execution-only entry points.
- `Audit History` should be presented as the governance-intent slice of `/logs` until a dedicated route exists. In the first pass, wayfinding must separate `Errors & Activity` from `Audit History` even if both still live on one backend surface.
- Dashboard and success banners must deep-link into in-page sections, anchored tabs, or future route detail views. Do not land operators at the top of a page and make them hunt for the relevant state.

## Token / Component Implications

### 1. Findings Queue Row

- Intended behavior:
  - compact row with severity, source, title, freshness, and one primary CTA
- Reuse rationale:
  - dashboard preview, providers attention rows, usage client warnings, and audit-worthy governance alerts all need the same scan shape
- Accessibility constraints:
  - severity uses text plus tone
  - the row title and CTA remain associated in keyboard and screen-reader order

### 2. Approval Decision Panel

- Intended behavior:
  - header with request summary and impact, evidence body, fixed decision action bar
- Reuse rationale:
  - execution-run approvals and future elevated-access approvals should not invent separate decision layouts
- Accessibility constraints:
  - action buttons remain reachable without scrolling through raw payloads
  - focus returns to the originating queue row after close or resolve

### 3. Audit Evidence Table

- Intended behavior:
  - filterable, comparable evidence table with human-readable action and status columns plus a detail drawer
- Reuse rationale:
  - `/logs` audit events, future approval history, and governance evidence all require the same pattern
- Accessibility constraints:
  - filters remain labeled
  - the table stays readable at laptop widths without horizontal-scroll traps for primary columns

### 4. Freshness / Source-of-Truth Meta Pattern

- Intended behavior:
  - reusable meta line that shows `Last updated`, `Latest audit event`, `Opened at`, or `Resolved at`
- Reuse rationale:
  - dashboard, findings, approvals, and audit history all depend on trust in recency and source-of-truth state
- Accessibility constraints:
  - freshness is visible as text, not only iconography
  - stale states are announced explicitly

## Implementation Handoff

Affected surfaces and contracts:

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/ProvidersPage.tsx`
- `frontend/src/features/providers/ProvidersSections.tsx`
- `frontend/src/pages/UsagePage.tsx`
- `frontend/src/pages/LogsPage.tsx`
- `frontend/src/pages/SecurityPage.tsx`
- `frontend/src/api/admin.ts`
- `backend/app/api/admin/dashboard.py`
- `backend/app/api/admin/providers.py`
- `backend/app/api/admin/usage.py`
- `backend/app/api/admin/logs.py`
- `backend/app/api/admin/security_admin.py`
- `backend/app/api/admin/execution.py`

Concrete acceptance criteria for engineering and QA:

- Dashboard shows a findings preview and governance/approval evidence summary, not only raw KPI tiles and unordered lists.
- Every dashboard finding row includes source, severity, freshness, and an explicit destination action.
- Findings clear only when the backing source-of-truth state clears; there is no UI-only dismiss action in the first pass.
- Providers and usage views expose findings-oriented sections that preserve filters while the operator investigates.
- The shared approval surface stays honest about scope:
  - execution-run and elevated-access approvals are reviewable in the UI
  - admin-only decision controls and requester-only session start stay explicitly separated in copy and disabled states
- Security forms that use `approval_reference` distinguish `approval metadata captured` from `approval request pending`.
- Audit history distinguishes governance evidence from operational error summary even if both remain on `/logs`.
- Audit history supports filter, empty, error, permission, and retention-limited states without losing current scope.
- High-risk actions from security, accounts, keys, settings, or approvals show a success state that points to the latest related audit event.
- QA can verify all four workflows using seeded states for:
  - no findings
  - provider not ready / failed sync
  - client needs attention
  - waiting execution approval
  - already-resolved approval
  - no audit results for current filters

Copy and interaction rules that should not be improvised:

- Use `Findings` as the normalized label for actionable operational or governance items.
- Use `Needs attention` for non-terminal risk that still requires operator review.
- Use `Waiting on approval` for open approval gates.
- Use `Latest audit event` or `Last updated` for freshness evidence.
- Use `No results for the current filters.` when filtered findings or audit history are empty.
- Use `Clears when source state resolves` or equivalent helper text where operators might expect a manual dismiss flow.

## Residual UX Risks

- ForgeGate still lacks a first-class backend finding entity, so the first queue will be composed from multiple sources and may drift unless engineering normalizes the aggregation rules.
- Shared approvals intentionally reject company-scoped filtering while elevated-access approvals remain non-company-scoped. If copy or filters blur that constraint, operators will misread queue scope.
- `/logs` still mixes operational and governance intent on one route. Clear sectioning and filters reduce confusion, but a dedicated audit route remains the stronger long-term IA move.
- The current route-flat frontend still lacks URL-addressable detail views. Deep links in the first pass may need anchors or local tabs rather than shareable record URLs.
- Audit history is currently backed by the newest retained event set and not a fully queryable historical explorer. The UI must make retention and scope limits explicit.

## Next Action

Owner: Auditor for truth-checking, then frontend/backend owners for any follow-on IA drift.

Expected artifact or decision: keep dashboard findings and audit-history work aligned with the shipped `/approvals` plus `/security` split, and route any future approval-scope changes back through Auditor review before the docs drift again.
