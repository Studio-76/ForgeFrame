# FOR-168 Audit History Workflow Implementation

## Decision

ForgeGate will keep **Audit History** on the existing `/logs` page in the first
pass, but it will stop treating audit evidence as a raw side-list on the mixed
`GET /admin/logs/` payload.

The first-pass architecture is:

- frontend route stays on `/logs`, with the governance slice anchored and named
  `Audit History`
- `GET /admin/logs/` remains the **operations overview** payload for
  operability, alerts, error summary, and a small audit preview
- audit history becomes a dedicated backend contract under the same router seam:
  `GET /admin/logs/audit-events` and `GET /admin/logs/audit-events/{event_id}`
- FOR-171 follow-up adds a minimal real export contract on the same seam:
  `POST /admin/logs/audit-export`

This preserves the current IA guidance:

- `Errors & Activity` and `Audit History` are different operator intents
- both can live on `/logs` for now
- the control plane must stop forcing operators to scan a raw `/logs` list to
  answer governance questions

## Boundaries

What this issue resolves:

- the architecture decision for the first real audit-history workflow
- the backend list/detail/filter contract required to support that workflow
- the frontend behavior and state model that matches the documented operator
  journey
- the ownership split between backend and frontend execution

What this issue does not resolve:

- a new top-level page outside `/logs`
- queued export jobs, archived export history, or a long-running export worker
- a new persistent audit schema unless the backend implementation proves the
  current store cannot support the contract

## Backend Contract

### 1. Keep `/admin/logs/` as the overview route

`GET /admin/logs/` should continue to serve:

- operability checks
- alerts
- error summary
- a small `audit_preview` list for recent evidence context
- audit retention/freshness summary for the page header

It should stop being the full audit-history source of truth.

### 2. Add a dedicated audit list endpoint

`GET /admin/logs/audit-events`

Required query params:

- `tenantId`
- `window` with at least `24h`, `7d`, `30d`, `all`
- `action`
- `actor`
- `targetType`
- `targetId`
- `status`
- `cursor`
- `limit`

Required behavior:

- stable reverse-chronological ordering
- cursor pagination, not raw page numbers
- tenant/company scoping identical to existing governance semantics
- retention-aware response metadata so the UI can show when older evidence is
  outside the retained event set
- redaction-safe response shape; sensitive material must not leak into inline
  summary fields

Required response shape:

- `items[]` with normalized evidence rows
- `page.nextCursor`
- `page.hasMore`
- `retention.eventLimit`
- `retention.oldestAvailableAt`
- `retention.retentionLimited`
- `filters.applied`

Each row must include enough normalized data for the table without forcing the
frontend to reverse-engineer audit semantics from raw metadata:

- `eventId`
- `createdAt`
- `actionKey`
- `actionLabel`
- `status`
- `statusLabel`
- `actor` summary
- `target` summary
- `summary`
- `detailAvailable`

### 3. Add a dedicated audit detail endpoint

`GET /admin/logs/audit-events/{event_id}`

Required behavior:

- return one event by id inside the current tenant/company scope
- provide human-readable change context first, raw metadata second
- expose redaction markers explicitly when fields are intentionally hidden
- include related object hints when the user should branch to another workflow
  such as accounts, keys, settings, approvals, or run history

Required response shape:

- `event` basic identity and timestamps
- `actor` normalized summary
- `target` normalized summary
- `summary` / `outcome`
- `changeContext[]`
- `rawMetadata`
- `redactions[]`
- `relatedLinks[]`

Contract honesty rule:

- if an older event family does not contain enough structured context for a
  clean change summary, the backend should return an explicit fallback state
  such as `changeContextUnavailable=true` instead of fabricating precision

### 4. Governance-service expectations

The backend implementation should extend the governance/repository contract
behind the admin API rather than teach the frontend how to interpret raw audit
records.

First pass should prefer:

- filter + cursor support in the service layer
- normalized action/actor/target labeling at the API boundary
- no schema change unless query shape or redaction requirements force it

Escalate to the database architect only if:

- relational filtering cannot be done efficiently enough with the current
  repository abstraction, or
- the existing event payloads cannot support the required summary/detail
  contract without additional persisted structure

## FOR-171 Follow-up Export Contract

ForgeGate now exposes a minimal backend-backed export path without pretending a
larger archive system already exists.

- route stays on `/logs#audit-export`
- `POST /admin/logs/audit-export` generates a synchronous JSON or CSV package
- export scope follows the active tenant filter plus the requested audit
  filters (`window`, `action`, `status`, `subject`)
- export generation is available to standard `operator` and `admin` sessions;
  `viewer` remains read-only and read-only impersonation sessions are blocked
- every successful export writes its own `audit_export_generated` event so the
  evidence workflow stays self-auditing

This closes the permanent "export not available yet" gap without introducing a
fake pending-job model or a separate export archive surface.

## Frontend Workflow

### 1. Route and naming

The control plane should expose:

- `Errors & Activity` -> `/logs`
- `Audit History` -> `/logs#audit-history`

`Audit & Export` is misleading while export does not exist. In the first pass,
export should be presented as an unavailable secondary capability inside the
Audit History workflow, not as the workflow name.

### 2. Page behavior

The `/logs` page becomes a split-intent workflow surface:

- top-level wayfinding between `Errors & Activity` and `Audit History`
- the audit section owns its own loading, empty, no-results, retention-limited,
  permission-limited, and redacted-detail states
- success banners from security, accounts, keys, settings, and approvals should
  be able to deep-link to the newest related audit event

### 3. Audit History interaction model

The frontend should implement:

- persistent filter controls for time window, action, actor, target type,
  target id, and status
- a sortable evidence table using normalized labels from the API
- a detail drawer or panel that opens without losing the current table state
- an explicit fallback panel when the backend says structured change context is
  unavailable
- a real export trigger that reports pending, ready, and failed states against
  the backend-backed generation path

### 4. UX honesty rules

- human-readable labels first, raw action keys second
- timestamps readable and comparable
- current filter scope always visible
- operational logs and audit evidence visually separated even while sharing the
  same page

## Risks

- The current audit model stores `details` plus arbitrary `metadata`; some event
  families may not yet have enough structure for a rich detail drawer.
- Current `list_audit_events()` support is limit-only. Backend work must add
  proper filtering and cursor semantics instead of stretching the flat list.
- Navigation and success-state links still use `auditExport`; naming cleanup
  remains separate from closing the backend export gap.

## Owners

- Backend API and governance contract: Senior API Backend Developer
- Frontend workflow and control-plane navigation: Senior Frontend Control Plane
  Lead
- CTO remains the decision owner for route boundaries and contract honesty

## Acceptance For FOR-168

FOR-168 is complete when:

- the first-pass architecture decision above is recorded and linked from the
  issue
- backend and frontend execution are split into explicit child issues with named
  owners
- those child issues carry the contract and acceptance criteria needed to build
  the real workflow without guessing
