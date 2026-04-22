# FOR-69 Control-Plane Route and Navigation Inventory

Last reviewed: 2026-04-22

Companion artifact for `FOR-12`. This document maps the current control-plane implementation surface so IA work lands against the real frontend, not an idealized shell.

## Source of truth

- Router: `frontend/src/main.tsx`
- App shell and main nav: `frontend/src/app/App.tsx`
- Page entry points: `frontend/src/pages/*.tsx`
- Shared providers surface: `frontend/src/features/providers/ProvidersSections.tsx`
- Shared layout primitives: `frontend/src/styles/theme.css`

## Router topology

The current control plane is a single `createBrowserRouter` tree with a signed-out `PublicShell` for `/login` and a protected `App` shell for the authenticated control plane.

- `/` redirects to `/dashboard` inside the protected shell.
- `/login` is isolated from the signed-in navigation and uses its own auth-only shell.
- There are no nested route segments.
- There are no dynamic params.
- `/approvals` is a live shared queue/detail route for operator/admin review, with decision mutations still reserved for standard `admin` sessions.
- `/security` opens for `operator` and `admin` sessions. Operators get the elevated-access request/start flow and request history there; admins additionally see bootstrap, admin-user, session, and secret-posture modules.
- Execution run review is URL-addressable through `/execution?companyId=<scope>&state=<filter>&runId=<id>`, but the route only opens for `operator` and `admin` sessions because the backend keeps company-scoped execution truth off the viewer surface.
- Most other drilldowns still live inside page-local state, `details` blocks, local `select` filters, or hash-based anchors.

This means the current navigation seam is mostly page-level, not route-level.

## Current top-level routes

| Route | Entry point | Current primary purpose | Current page shape | IA seam |
| --- | --- | --- | --- | --- |
| `/login` | `frontend/src/pages/LoginPage.tsx` | Create admin session and show bootstrap status before entry | Single login form plus bootstrap status card | Signed-out auth shell is isolated now, but the post-login handoff still relies on redirect state rather than a richer entry workflow |
| `/dashboard` | `frontend/src/pages/DashboardPage.tsx` | Command center for KPIs, alerts, needs-attention, and security bootstrap snapshot | KPI card grid plus alert/status lists | Good home surface, but no deep links into the correct downstream workflow yet |
| `/onboarding` | `frontend/src/pages/OnboardingPage.tsx` | Bootstrap readiness and OAuth/account-provider onboarding guidance | Readiness card plus onboarding list | Setup intent is clear, but bootstrap content overlaps with `login`, `security`, and `providers` |
| `/providers` | `frontend/src/pages/ProvidersPage.tsx` plus `frontend/src/features/providers/ProvidersSections.tsx` | Multi-workflow provider and harness operating surface | Long stacked operations hub with overview, onboarding, inventory, runs, health, compatibility, expansion targets, and OAuth status | This is the largest nav seam in the app; one route currently holds multiple distinct operator jobs |
| `/accounts` | `frontend/src/pages/AccountsPage.tsx` | Runtime account inventory, provider bindings, and account lifecycle | Create form plus account inventory cards | Read inventory is broader than `Security`, but lifecycle mutations are still admin-only |
| `/api-keys` | `frontend/src/pages/ApiKeysPage.tsx` | Runtime key inventory, one-time secret reveal, and key lifecycle | Create form, one-time secret display, key inventory cards | Strongly tied to `accounts`; read inventory is broader than `Security`, but lifecycle mutations are admin-only |
| `/approvals` | `frontend/src/pages/ApprovalsPage.tsx` | Shared queue and detail review for execution-run and elevated-access approvals | Filtered queue, evidence/detail panels, linked execution/security drilldowns, admin-only decision panel | Review is open to `operator` and `admin`, but approve/reject mutations remain a standard-`admin` action and downstream issuance still happens on other routes |
| `/execution` | `frontend/src/pages/ExecutionPage.tsx` | Company-scoped execution run inspection, detail, and replay admission for operator/admin sessions | Scope chooser and exact-scope form, run queue, URL-addressable detail pane, replay panel | First route with query-param drilldown for `companyId`, `state`, and `runId`; required because backend execution truth is not provider-local and is not exposed to viewers |
| `/security` | `frontend/src/pages/SecurityPage.tsx` | Elevated-access request/start workflow plus admin security posture | Policy/elevated-access request modules for operator/admin sessions, with admin-only bootstrap, user, session, and secret-posture cards | One route mixes operator-safe request/start flow with deeper admin-only posture modules, so copy and disabled states currently carry the boundary |
| `/usage` | `frontend/src/pages/UsagePage.tsx` | Usage, cost, health, provider/client drilldowns, and error aggregations | Large analytics hub with local filters and collapsible drilldowns | One route currently contains both summary monitoring and detailed investigation |
| `/logs` | `frontend/src/pages/LogsPage.tsx` | Operability, alerts, error summary, and recent audit trail | Three-card operational summary plus audit event list | Mixed operator intents: operations evidence and governance evidence share the same route |
| `/settings` | `frontend/src/pages/SettingsPage.tsx` | Mutable environment and operating defaults | Settings card grid with inline save/reset | Clean top-level settings surface with low routing pressure today |

## Current nav grouping

The actual nav grouping in code is grouped by operator domain in `frontend/src/app/navigation.ts`, with `Approvals` exposed inside the `Governance` section alongside runtime access, security posture, and audit evidence, and `Execution Review` exposed inside `Operations`. Those entries do not share the same permission envelope: `Approvals` supports operator/admin review with admin-only decisions, while `Execution Review` is restricted to operator/admin sessions and keeps replay blocked for read-only sessions.

The implied workflow groupings are broader than the actual nav:

| Implied workflow group | Current routes involved | Current seam |
| --- | --- | --- |
| Auth and entry | `/login`, `/dashboard` | Signed-out and signed-in shells are separated, but the post-login protected IA is still flat |
| Setup and go-live | `/onboarding`, `/providers`, parts of `/accounts` and `/api-keys` | Operators have to infer setup order across multiple routes |
| Governance and access | `/security`, `/accounts`, `/api-keys`, part of `/logs` | Identity posture, runtime access, and audit evidence are split and do not share one permission envelope |
| Operations and triage | `/dashboard`, `/providers`, `/execution`, `/usage`, `/logs` | Triage and action surfaces are separated by implementation domain, not by operator task |
| System configuration | `/settings` | Least ambiguous current grouping |

## Major navigation seams and route collisions

### 1. `Login` now has a signed-out shell, but the protected surface is still route-flat

`/login` uses `frontend/src/app/PublicShell.tsx`, while the rest of the control plane stays behind `frontend/src/app/App.tsx`.

Design implication: the auth boundary is now real in routing and shell structure, but richer post-login wayfinding still depends on the flat protected shell and redirect behavior.

### 2. `Providers` is three surfaces in one route

The providers route currently contains:

- live provider inventory and compatibility truth
- harness onboarding, profile management, import/export, and run history
- expansion-target and OAuth bridge guidance

The code is already honest about the boundary between runtime truth and future expansion work. That honesty currently lives in section copy, not in route structure.

Design implication: `providers` is the strongest candidate for local tabs, anchored subnav, or a route split.

### 3. Bootstrap and readiness content is repeated across multiple routes

Readiness or bootstrap posture appears on:

- `/login`
- `/dashboard`
- `/onboarding`
- `/security`
- `/providers`

Design implication: the IA should identify one canonical setup/readiness destination and treat the other occurrences as supporting summary states or deep links.

### 4. Governance is split across three routes plus one slice of `logs`, with mixed permissions

Current governance-related work is spread across:

- `/approvals` for shared approval queue/detail review
- `/security` for elevated-access request/start plus admin users, sessions, password rotation, and secret posture
- `/accounts` for runtime account lifecycle
- `/api-keys` for runtime key lifecycle
- `/logs` for audit events

Current backend permission boundary across those routes is not uniform:

- `/approvals` exposes queue/detail review to `operator` and `admin`, but approval decisions still require a standard `admin` session.
- `/security` exposes credential policy, approver posture, request history, break-glass request, cancel, and requester-issued start flows to write-capable `operator` or `admin` sessions, while bootstrap security, admin-user posture, sessions, secret posture, and impersonation creation remain `admin`-only.
- `/accounts` and `/api-keys` expose runtime access inventory to authenticated control-plane roles, but creation and lifecycle mutations are `admin`-only.
- `/logs` keeps the operational overview and audit preview open to authenticated control-plane roles, but dedicated audit history/detail now require `operator` or `admin` sessions.

Design implication: the backend surface already supports a governance cluster, but the route model does not express it yet and the grouped navigation cannot pretend the whole cluster shares one role boundary.

### 5. `Logs` merges operations evidence with governance evidence

`/logs` combines:

- operability checks
- alert summary
- error summary
- audit events

Design implication: the route currently serves both operational triage and audit review. IA should treat this as a split-intent page even if it remains one backend endpoint for now.

### 6. Client and provider investigation is duplicated across `providers` and `usage`

Current overlap:

- client operational view exists in both `providers` and `usage`
- provider health and run history live in `providers`
- provider/client error and cost drilldowns live in `usage`

Design implication: operators can investigate one incident from multiple pages today, but the handoff should not assume those paths are coherent yet.

### 7. Only execution and audit drilldowns are URL-addressable today

Execution review uses query params for `companyId`, `state`, and `runId`. Audit history uses query/hash deep links. Provider selection, client selection, most usage drilldowns, and most provider sub-workflows still live in local component state.

Design implication: shareable URLs now exist for execution and audit evidence, but most other deep links still require router or state-model work rather than styling-only changes.

### 8. `Execution Review` has a stricter route gate than the rest of `Operations`

`/execution` is not a generic read-only operations page. The shipped backend requires `operator` or `admin` even for company-scoped list/detail reads, while replay remains further limited by read-only session posture.

Design implication: operations grouping can include execution review, but role cues and disabled states must stay explicit so viewers are sent to logs, usage, or provider truth instead of a blocked company-scope workflow.

## Shared page patterns available for IA reuse

| Pattern | Current implementation examples | Notes for reuse |
| --- | --- | --- |
| Shell plus pill nav | `frontend/src/app/App.tsx`, `frontend/src/styles/theme.css` | One global shell, pill links, session banner, theme toggle |
| Metric card grid | `/dashboard`, provider overview metrics in `ProvidersSections.tsx` | Good fit for command-center summaries and section headers |
| Card inventory list | `/accounts`, `/api-keys`, `/settings`, provider inventory, compatibility matrix | Current control plane is card-first, not table-first |
| Inline action form | `/accounts`, `/api-keys`, `/security`, provider creation, harness onboarding | Existing surface favors inline create/edit actions close to inventory |
| Evidence list | `/logs`, `/usage`, `/security`, `/onboarding`, provider runs, OAuth operations | Most evidence is currently list-based rather than structured tables |
| Collapsible secondary detail | `details` blocks in `/usage`, provider model truth, OAuth recent operations | Existing drilldowns hide secondary detail without changing routes |
| Raw operation payload panel | provider action result and `logs.error_summary` | Useful for advanced operator/debug states, but not a primary IA anchor |

## Page-level reuse map

| Current page | Primary reusable patterns |
| --- | --- |
| `Dashboard` | KPI summary, alert list, needs-attention list |
| `Onboarding` | Readiness checklist, next-step list, provider onboarding guide |
| `Providers` | Dense subnav candidate, inventory cards, filterable run history, action result panel, honest truth-vs-expansion split |
| `Accounts` | Create form plus lifecycle inventory |
| `API Keys` | Create form plus sensitive one-time secret reveal and lifecycle inventory |
| `Security` | Elevated-access policy posture, request/start workflow, request history, and admin-only posture evidence |
| `Usage` | Time-window filter, summary metrics, provider/client drilldowns, historical evidence lists |
| `Logs` | Audit/evidence list plus operational summary |
| `Settings` | Mutable settings catalog with inline save/reset |

## Constraints the Design Lead should account for

- The current frontend is route-flat. Any IA that relies on nested workflows, tabs reflected in the URL, or detail pages will require router work in `frontend/src/main.tsx`.
- Signed-out and signed-in navigation are now separated by `frontend/src/app/PublicShell.tsx` and `frontend/src/app/App.tsx`, but the protected control plane still shares one flat route tree.
- `Approvals` and `Execution Review` now have route-specific role gates inside otherwise broader governance/operations groupings. IA regrouping cannot flatten those differences away.
- The app already uses reusable layout primitives from `frontend/src/styles/theme.css`: `fg-card`, `fg-subcard`, `fg-grid`, `fg-card-grid`, `fg-inline-form`, `fg-note`, and pill-based status/nav styling.
- The current surface is card/list oriented. A table-heavy IA is possible, but it would require new component work rather than simple rearrangement.
- `Providers` already protects the product boundary between live runtime truth and expansion/backlog truth in its copy and section structure. Any redesign should preserve that honesty.
- Execution and audit evidence are URL-addressable, but most other investigations are not. Dashboard-to-detail deep linking outside those seams still needs new routing or explicit in-page anchor patterns.
- Bootstrap/readiness appears in multiple places. The next IA pass should decide which page owns the authoritative readiness narrative.

## Handoff summary for FOR-12

The present control plane is not blocked by missing routes. It is blocked by route compression.

- The protected shell currently carries twelve child routes, plus the separate `/login` public shell.
- The real IA pressure comes from too many operator jobs inside `providers`, `usage`, and `logs`.
- Governance work is split across multiple pages and permission envelopes, so grouped navigation must separate operator-visible security request/start flow from admin-only security posture, runtime access, operator/admin approval review, and the stricter operator/admin audit-history contract.
- Execution review is a real top-level operations route now, but it keeps a stricter operator/admin gate than the rest of the viewer-safe monitoring cluster.
- Setup/readiness signals are repeated instead of being owned by one canonical destination.
- The current component system is sufficient for an IA regrouping pass, but not for a route-rich redesign without additional frontend work.
