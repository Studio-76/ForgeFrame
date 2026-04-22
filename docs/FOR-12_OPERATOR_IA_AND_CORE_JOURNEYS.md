# FOR-12 Operator IA and Core Journeys

## Objective and Operator Problem

ForgeGate needs an operator-first information architecture before more control-plane surfaces land. Today the shell exposes backend modules as a flat route list (`Dashboard`, `Onboarding`, `Providers`, `Accounts`, `API Keys`, `Security`, `Usage`, `Logs`, `Settings`). That makes operators translate implementation domains into tasks on their own, which raises cognitive load and weakens information scent during high-stakes work such as first-time setup, provider recovery, policy review, and audit lookup.

This slice defines the first operator IA baseline so frontend and backend sequencing follows the actual operating loop: bring ForgeGate online, connect and verify providers, review access and policy posture, monitor live activity, and retrieve evidence when something needs review. The goal is not a pixel-perfect redesign in this ticket; it is a durable navigation and workflow map that reduces guesswork for engineering and QA.

Assumptions:

- ForgeGate remains a UI-first control plane for routine operator work.
- Existing backend/admin surfaces stay the source of truth for this IA baseline; this spec reorganizes wayfinding and workflow emphasis, not product scope.
- No current prototype exists, so this spec is flow-first and state-first.
- Current roles remain `admin`, `operator`, and `viewer`, with role-based action limits layered onto the same core navigation.
- The current permission boundary is mixed inside the governance cluster: `Security & Policies` is `admin`-only today, while `Accounts`, `API Keys`, and audit evidence are broader read surfaces with `admin`-only mutations where applicable.
- The implementation-grounded route inventory in `docs/FOR-69_CONTROL_PLANE_ROUTE_AND_NAV_INVENTORY.md` is the companion source for router and shell constraints.

## Prioritized Workflows and State Coverage

### 1. Onboarding and Go-Live

- Trigger or entry point:
  - first login after bootstrap
  - fresh Docker install
  - dashboard alert that readiness is incomplete
- Happy path:
  1. Operator enters `Home > Dashboard` or `Setup > Onboarding`.
  2. Reviews bootstrap readiness and unresolved prerequisites.
  3. Connects or validates the first provider or OAuth target.
  4. Runs preview, verify, probe, or sync from the provider flow.
  5. Creates the first runtime account and runtime key.
  6. Confirms the system is ready for traffic and hands off to operations monitoring.
- Key decision points:
  - whether an unmet bootstrap check is blocking or only advisory
  - whether a provider is truly runtime-ready or only planned/partially wired
  - whether runtime access should be issued globally or tied to a specific account
- Required states and edge cases:
  - loading state for readiness, provider targets, and account data
  - empty state with no configured providers
  - partial readiness where bootstrap succeeds but no provider is verified
  - provider verification failed, probe failed, or sync failed
  - one-time token display with explicit acknowledgement before leaving the page
  - permission-limited viewer state with read-only setup visibility
  - success state that names the next operational destination instead of leaving the operator at a dead end
- Operator success criteria:
  - at least one provider is verified or explicitly marked not ready for runtime
  - at least one runtime access path exists
  - the operator can tell whether ForgeGate is ready for live traffic in under two minutes
- Trust, accessibility, and feedback signals:
  - every readiness signal pairs text with color and status wording
  - last-updated timestamps are visible on readiness and provider checks
  - onboarding steps expose keyboard-focusable primary actions in task order
  - destructive or high-risk actions are separated from progress actions

### 2. Policy Review and Runtime Access Governance

- Trigger or entry point:
  - scheduled review
  - security alert from the dashboard
  - admin-user or credential change
  - incident follow-up that requires confirming who can access what
- Happy path:
  1. `Admin` enters `Governance > Security & Policies` when the task is about security bootstrap posture, admin users, active sessions, or provider secret posture.
  2. Reviews the admin-only posture and decides whether the next action belongs in security posture management or runtime access management.
  3. `Operator` or `admin` enters `Governance > Accounts`, `Governance > API Keys`, or `Governance > Audit & Export` when the task is runtime identity review, key posture review, or audit lookup.
  4. Cross-checks runtime accounts, runtime keys, and recent audit evidence from those linked surfaces.
  5. `Admin` rotates, revokes, creates, suspends, or disables the relevant subject when a mutation is required.
  6. Confirms the change or review outcome is reflected in audit history.
- Key decision points:
  - whether the task belongs to admin-only governance posture or operator-visible runtime access review
  - whether the issue is an admin identity problem, a secret-posture problem, or a runtime-access problem
  - whether to revoke a live session immediately or rotate the related credential first
  - whether an account or key should be suspended, disabled, or revoked permanently
- Required states and edge cases:
  - loading state for admin-only posture separate from runtime access inventory so a permission error is never the first signpost
  - empty state when no extra admin users or runtime accounts exist yet
  - permission state that labels `Security & Policies` as `Admin only` and redirects `operator` and `viewer` roles toward `Accounts`, `API Keys`, or `Audit & Export`
  - confirmation state for revocation, password reset, and disable flows
  - success state that points to the audit trail entry
  - failure state that preserves context so the operator can retry without re-entering data
- Operator success criteria:
  - an `admin` can review active human access, security posture, and runtime access from one governance cluster
  - an `operator` can review runtime accounts, runtime key posture, and audit evidence without being sent into admin-only screens
  - high-risk mutations always leave an observable audit trail
  - the operator can distinguish routine policy maintenance from active operational incidents
- Trust, accessibility, and feedback signals:
  - role labels, access labels, and account/key status labels are plain language, not only raw enums
  - `Admin only` and `Read only` labels are visible before a user commits to the route or action
  - revoke and reset actions require clear labels and confirmation copy
  - tables and lists remain readable in both dark and light themes

### 3. Operations Monitoring and Triage

- Trigger or entry point:
  - routine daily check
  - alert or needs-attention item on the dashboard
  - provider degradation, failed sync, or client complaint
- Happy path:
  1. Operator lands on `Home > Dashboard`.
  2. Scans KPIs, alerts, and needs-attention items.
  3. Chooses the correct drilldown:
     - `Operations > Execution Review`
     - `Operations > Provider Health & Runs`
     - `Operations > Usage & Costs`
     - `Operations > Errors & Activity`
  4. Compares provider readiness, client impact, cost, and error shape.
  5. Runs a health check, sync, probe, or provider control action if needed.
  6. Returns to the dashboard with a clear current-state summary.
- Key decision points:
  - whether the signal is a setup gap, an operational incident, or a governance issue
  - whether the blast radius is provider-wide, model-specific, client-specific, or limited to health traffic
  - whether to re-verify, re-sync, disable, or leave a degraded provider running
- Required states and edge cases:
  - healthy state with no current alerts
  - empty state for low-traffic or pre-launch installations
  - stale-data state when timestamps are older than the selected window
  - action-in-progress state for probes, health runs, and syncs
  - partial-data state when one backend feed loads and another fails
  - permission-limited state for viewers
- Operator success criteria:
  - the operator can identify what needs attention and where to act within one dashboard-to-detail transition
  - usage, provider, and log data do not imply unsupported readiness or fake runtime depth
  - the operator can tell whether an issue is resolved without leaving the monitoring loop
- Trust, accessibility, and feedback signals:
  - cards and alerts clearly label the source of truth: runtime truth, onboarding target, or historical evidence
  - window and filter changes preserve focus and announce loading state
  - alert severity uses reusable status language across dashboard, providers, usage, and logs

### 4. Audit Review and Export

- Trigger or entry point:
  - incident review
  - governance review
  - release validation or external evidence request
  - post-change confirmation after policy or provider mutations
- Happy path:
  1. Operator enters `Governance > Audit & Export` from dashboard, security, or operations.
  2. Filters recent audit events by time window, action, status, and subject.
  3. Cross-references related error or usage context without losing the audit trail.
  4. Exports or compiles the evidence package.
  5. Leaves the page with a durable statement of what changed and what was exported.
- Key decision points:
  - whether the operator needs operational logs, audit evidence, or both
  - which time window and subject scope are enough to support the review
  - whether retention limits or missing export capability require a fallback path
- Required states and edge cases:
  - loading state for audit history and export generation
  - empty state when the audit trail is present but no filters match
  - retention-limited state when older data is no longer available
  - export pending, ready, and failed states
  - explicit "export not available yet" state if backend support is missing
  - permission-limited export state
- Operator success criteria:
  - the operator can retrieve trustworthy evidence without manually scraping multiple pages
  - audit data is distinguishable from error summaries and health status
  - export limitations are explicit rather than implied
- Trust, accessibility, and feedback signals:
  - filter chips or controls expose active scope clearly
  - export progress and completion messages are screen-reader friendly
  - audit rows expose human-readable timestamps and action labels

## IA / Navigation Implications

### Recommended Primary Navigation

| Primary section | Purpose | Current surfaces mapped here | Notes |
| --- | --- | --- | --- |
| `Home` | command center and triage start point | `Dashboard` | Default landing surface after login. |
| `Setup` | bring ForgeGate live and connect providers | `Onboarding`, `Providers` | `Providers` needs local tabs that separate onboarding from live operations. |
| `Governance` | review runtime access and audit evidence, with admin-only security posture alongside it | `Security`, `Accounts`, `API Keys`, audit-focused part of `Logs` | Governance should feel like one cluster, but it cannot imply one shared permission envelope. |
| `Operations` | monitor health, execution truth, client impact, usage, and error activity | `Execution Review`, provider run/history view, `Usage`, operational part of `Logs` | Dashboard alerts should deep-link here by intent, but role cues must keep viewer-safe monitoring distinct from operator/admin execution review. |
| `Settings` | environment-level configuration and mutable operating defaults | `Settings` | Keep separate from routine operations to reduce accidental changes. |

### Recommended Secondary Navigation and Page Grouping

- `Home`
  - `Command Center` (`/dashboard`)
- `Setup`
  - `Onboarding` (`/onboarding`)
  - `Providers & Harness` (`/providers`)
    - local tabs or anchored sections: `Overview`, `Profiles`, `Runs`, `Expansion Targets`
- `Governance`
  - `Security & Policies` (`/security`, `admin` only)
  - `Accounts` (`/accounts`, operator-visible inventory, admin-only mutations)
  - `API Keys` (`/api-keys`, operator-visible inventory, admin-only mutations)
  - `Audit & Export` (initially a dedicated section on `/logs` until a separate route exists; operator-visible evidence)
- `Operations`
  - `Execution Review` (`/execution`, `operator`/`admin` only, read-only sessions inspect without replay)
  - `Provider Health & Runs` (deep-link into `/providers`)
  - `Usage & Costs` (`/usage`)
  - `Errors & Activity` (`/logs`)
- `Settings`
  - `System Settings` (`/settings`)

### Implementation Seams Confirmed By Route Inventory

- The current frontend is route-flat: one shared shell plus top-level routes, with no URL-addressable detail pages for providers, clients, runs, accounts, or audit records.
- The first IA pass should solve route compression before it solves route expansion.
  - `Providers` is currently the highest-pressure multi-job route.
  - `Usage` mixes summary monitoring and detailed investigation.
  - `Logs` mixes operational evidence and governance evidence.
- Dashboard deep links should land on the correct route section, local tab, or in-page anchor first. Full URL-addressable detail views are a later router task, not a requirement for the initial IA regrouping.
- Signed-out versus signed-in navigation separation is also a router and shell task. It should be treated as a follow-up improvement, not a hidden dependency of the first IA implementation slice.

### Wayfinding Rules

- The shell should group navigation by operator intent, not by backend module names alone.
- Every page should expose one primary question in the header:
  - `What needs setup?`
  - `What changed in policy posture?`
  - `What needs operational attention?`
  - `What evidence can I export?`
- Dashboard alerts and needs-attention rows should deep-link into the exact role-appropriate destination section or tab, not only the top of a page.
- `Providers` must visually separate live runtime truth from roadmap or expansion targets so planned support is not mistaken for active support.
- `Logs` currently mixes operability, alerts, error summary, and audit events. The IA should present it as two user intents on one backend surface until the data model is split:
  - `Operations > Errors & Activity`
  - `Governance > Audit & Export`
- Governance navigation must distinguish admin-only posture from operator-visible runtime access and evidence. `Security & Policies` should be labeled `Admin only` before entry instead of appearing as a broken shared destination.
- `Execution Review` must be labeled `Operator or admin` before entry. Viewer-safe operations monitoring lives on providers, usage, and logs instead of the company-scoped execution route.

### Role-Based Navigation Differences

- `viewer`
  - sees `Home`, read-only `Setup`, read-only runtime-access and audit surfaces inside `Governance`, read-only `Operations`
  - does not see `Security & Policies`
  - sees `Execution Review` as a disabled, clearly labeled route, but cannot open it because company-scoped execution list/detail truth is not part of the viewer surface
  - does not see mutating primary actions
- `operator`
  - can use routine operational actions in `Setup` and `Operations`
  - can open `Execution Review` for company-scoped run list/detail and replay when the session is not read-only
  - can review runtime accounts, runtime key posture, and audit/log evidence
  - does not see `Security & Policies`, security bootstrap posture, admin users, active sessions, or provider secret posture as operator tasks
- `admin`
  - full access to the governance cluster, including `Security & Policies`
  - can use `Execution Review`, including replay, unless the current session is read-only
  - only role that can review admin-user posture, active sessions, provider secret posture, and mutate runtime accounts or keys

## Token / Component Implications

### 1. Status Severity Tokens

- Proposal:
  - reusable semantic tokens for `ok`, `warning`, `critical`, `neutral`, and `unknown`
- Intended behavior:
  - use the same status tones for readiness, alerts, session posture, provider actions, audit status, and export status
- Reuse rationale:
  - operators should not relearn a different severity language on every screen
- Accessibility constraints:
  - status must always include text labels, not color alone
  - contrast must meet WCAG AA in both dark and light themes

### 2. Journey Checklist / Readiness Rail

- Proposal:
  - reusable checklist component with `status`, `blocker`, `last verified`, and `next action`
- Intended behavior:
  - used first on onboarding, then reused for policy review and release validation flows
- Reuse rationale:
  - ForgeGate has repeated "am I ready / what is missing / what do I do next?" moments across setup and governance
- Accessibility constraints:
  - steps must be keyboard navigable in logical order
  - blocked steps must expose text rationale that is available to assistive technology

### 3. Evidence Table Pattern

- Proposal:
  - reusable table/list pattern for audit events, log summaries, provider operations, and future exports
- Intended behavior:
  - supports filtering, last-updated visibility, empty states, and export affordances
- Reuse rationale:
  - operators need consistent evidence handling across governance and operations
- Accessibility constraints:
  - preserve readable row density
  - avoid horizontal overflow traps on smaller viewports
  - keep filter controls associated with the result set they affect

## Implementation Handoff

### Affected Surfaces

- `frontend/src/app/App.tsx`
  - regroup shell navigation into `Home`, `Setup`, `Governance`, `Operations`, `Settings`
  - make governance navigation role-aware so `Security & Policies` is only presented to `admin`
- `frontend/src/main.tsx`
  - keep the first IA pass compatible with the current route-flat topology; only introduce router changes where they are required for clearer auth or section ownership
- `frontend/src/pages/DashboardPage.tsx`
  - make dashboard the operational command center with deep links into setup, governance, and operations flows
  - send governance alerts to the correct role-appropriate destination instead of defaulting every governance item to `Security`
- `frontend/src/pages/OnboardingPage.tsx`
  - restructure around setup steps instead of raw data dumps
- `frontend/src/pages/ProvidersPage.tsx`
  - expose provider onboarding, live inventory, run history, and expansion targets as clearly distinct sub-areas
- `frontend/src/pages/SecurityPage.tsx`
  - position as `Security & Policies`, with explicit `Admin only` treatment and cross-links to accounts, keys, and audit review
- `frontend/src/pages/AccountsPage.tsx`
  - clarify runtime identity governance and downstream access impact
  - treat inventory as operator-visible but lifecycle mutations as admin-only
- `frontend/src/pages/ApiKeysPage.tsx`
  - clarify one-time secret display, lifecycle state, and audit implications
  - treat inventory as operator-visible but lifecycle mutations as admin-only
- `frontend/src/pages/UsagePage.tsx`
  - present as monitoring drilldown, not as a configuration page
- `frontend/src/pages/LogsPage.tsx`
  - split the page into `Errors & Activity` and `Audit & Export` zones, even if the route remains shared initially

### Backend and Policy Dependencies

- Current `/admin/logs/` payload mixes operational and audit intent; a future split API or better filter contract will improve this IA.
- A dedicated export endpoint is not obvious in the current repo surface. The frontend should not imply full export capability until the backend supports it.
- Current `/admin/security/*` reads and writes are `admin`-only, while `/admin/accounts/`, `/admin/keys/`, and `/admin/logs/` expose the operator-visible runtime access and evidence slice. The frontend must not imply broader governance access than that contract allows.
- Route and access-policy visibility is still concentrated in `Security`, `Accounts`, and `API Keys`. If policy review expands, the backend may need a more explicit policy summary surface.

### Concrete Acceptance Criteria

- Shell navigation groups the existing routes into the five primary sections defined above.
- Dashboard exposes at least one primary next action and at least one deep link or in-page destination into each of the following operator intents when relevant: onboarding, policy review, operations triage, audit review.
- Onboarding presents setup as a sequenced checklist: bootstrap readiness, provider verification, runtime access issuance, go-live handoff.
- Providers UI distinguishes live runtime truth from planned expansion and provides a clear sub-area for run history.
- Governance surfaces let `admin` reach security posture, users, sessions, accounts, keys, and audit review from one cluster, while `operator` reaches runtime access and audit review without false affordances to admin-only posture.
- Logs experience distinguishes operational troubleshooting from audit evidence retrieval, even if both remain on one route initially.
- The first implementation pass does not require a nested-route redesign; it can ship by regrouping the existing route-flat shell plus local page subnav where needed.
- Every core journey defines loading, empty, error, permission, confirmation, success, and audit/history states in the UI copy and layout.
- Status communication uses a shared severity vocabulary with text labels in both theme modes.

### Required Copy and Interaction Rules

- Use `Needs attention` only for actionable states, not informational states.
- Use `Ready for runtime` only when the provider or workflow is genuinely verified for live traffic.
- Use `Planned` or `Expansion target` for roadmap-facing provider rows to avoid fake readiness.
- If export is unavailable, show `Export not available yet` instead of a silent omission.
- Use `Admin only` on `Security & Policies` and any related entry point before the user clicks into a blocked route.
- Use `Read only` on runtime access surfaces when the signed-in role can inspect but not mutate.
- After high-risk mutations, show a confirmation that points to the audit trail or latest recorded event.

## Residual UX Risks

- No operator interviews or usability validation have confirmed whether governance and operations should stay separate at the primary-nav level or merge later into one operations center.
- `Providers` currently carries setup, live control, compatibility, run history, and expansion content. It may still be too dense after tabbing and could need route-level decomposition.
- `Logs` is doing double duty for operational troubleshooting and audit review. That is acceptable for the first IA baseline, but not ideal long term.
- Export is a required operator story, but the backend contract for export generation is not yet obvious from the repo surface.
- The current shell and page components do not yet consume `session.role` for role-aware navigation or action gating, so grouped-nav implementation still has to close that gap to avoid live 403 dead ends.

## Next Action

Immediate next action: Frontend engineering should re-review `FOR-76` against this revised IA baseline, then implement shell regrouping and page-level wayfinding with role-aware governance visibility for `Dashboard`, `Accounts`, `API Keys`, `Security`, and `Logs`, while Design follows with a low-fidelity layout pass for the grouped navigation and checklist/evidence patterns.

Owner: Design Lead for the IA baseline, Frontend Engineering for the first shell and page implementation slice.

Expected artifact or decision: a first implementation pass that makes the operator journey visible in the control-plane shell without changing documented product scope or implying unsupported runtime depth.
