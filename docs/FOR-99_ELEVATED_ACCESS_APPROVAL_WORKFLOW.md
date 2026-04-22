# FOR-99 Elevated-Access Approval Workflow and State Coverage

## Objective and Operator Problem

ForgeGate already requires elevated-access evidence such as `approval_reference`, `justification`, `notification_targets`, and `duration_minutes`, but that alone is not an approval-backed workflow. Operators need a request-first flow that creates a pending approval item, routes the decision through the shared control-plane approvals pattern, and keeps the approval decision separate from the live session start so the UI never implies that approval immediately grants access.

This slice matters now because [FOR-93](/FOR/issues/FOR-93) explicitly chose the real approval-backed path, and the backend contract is already modeled as two transitions: request approval first, then let the original requester exchange the approved request for a live elevated session. Without a concrete workflow contract, frontend and QA will still blur `pending approval`, `approved and ready to start`, `active`, `rejected`, `timed out`, `cancelled`, conflict, permission-limited, and `Recovery required` states.

Current beta truth in this checkout:

- Backend approval APIs exist for the shared approvals domain, and the shipped `/approvals` route already consumes them.
- `/approvals` is the live shared queue/detail review surface for execution-run and elevated-access approvals.
- `/security` is the live request-entry, requester-history, recovery, and requester-issued session-start surface for `operator` and `admin` sessions, with admin-only posture modules layered into the same route.

Assumptions:

- ForgeGate stays a UI-first control plane for routine elevated-access handling.
- Execution approvals already provide the canonical approval lifecycle ForgeGate should reuse where clean: `open`, `approved`, `rejected`, `timed_out`, and `cancelled`.
- Elevated access covers two request types only in this slice: `break_glass` and `impersonation`.
- `viewer` never requests or decides elevated access.
- `admin` can request break-glass or impersonation. `operator` can request break-glass only.
- Approval decision requires an `admin` other than the requester. The UI must not support self-approval.
- [FOR-113](/FOR/issues/FOR-113) fixed the beta single-admin posture: when no eligible second admin approver exists, the normal in-product state is `Recovery required` and ForgeGate routes the operator to a separate recovery-only path outside the normal approval workflow.

## Prioritized Workflows and State Coverage

Shared actor model and evidence requirements:

- Requester:
  - `admin` requesting break-glass for self
  - `admin` requesting impersonation for a target user
  - `operator` requesting break-glass for self
- Approver:
  - `admin` with approval-decision permission
  - must not be the requester
- Activation actor:
  - the original requester only
  - receives the token or session only after approval
- Observer:
  - `admin` or `operator` who can inspect evidence or audit history but cannot decide or start the approved session

Evidence required before approval:

- request type
- requester identity and role
- target user for impersonation, or explicit self-target for break-glass
- incident / ticket / approval reference
- written justification
- notification targets
- requested duration and policy maximum
- current active elevated sessions for the requester or impersonation target
- latest related audit event link

Shared state vocabulary:

- Approval-item state:
  - `Pending approval` for backend `open`
  - `Approved` for backend `approved`
  - `Rejected` for backend `rejected`
  - `Expired` for backend `timed_out`
  - `Cancelled` for backend `cancelled`
- Session state:
  - `Not issued` when approval is still pending or ended without issuance
  - `Ready to start` when approval is granted but issuance is still pending
  - `Active` when a live elevated session exists
  - `Expired`
  - `Revoked`
- The control plane must never collapse approval state and session state into one label. `Approved` means a decision happened. `Ready to start` means only the requester can issue the session now. `Active` means a session exists right now.

Copy rules that should remain stable across the first implementation:

- Pending banner: `Approval request submitted. No elevated session is active until this request is approved.`
- Approved / ready-to-start banner: `Access approved. Start the elevated session to receive the temporary token.`
- Ready-to-start helper: `Only the original requester can start this session.`
- Active banner: `Elevated session active until {time}.`
- Rejected banner: `Request rejected. No elevated session was issued.`
- Expired banner: `Request expired before approval. Submit a new request if elevated access is still required.`
- Cancelled banner: `Request cancelled. No elevated session will be issued.`
- Already-resolved banner: `This request was already resolved by {actor} at {time}.`
- Permission-limited banner: `You can review this request, but you do not have permission to approve elevated access.`
- Recovery-required banner: `No eligible admin approver is available in this environment. Elevated access requires approval from a different admin. Add or restore a second admin, or use the documented recovery procedure before requesting access.`
- Recovery-required helper: `ForgeGate will not create a pending approval item or issue elevated access while no eligible approver exists.`

### 1. Request Elevated Access From Security

- Trigger or entry point:
  - `Governance > Security & Policies`
  - incident response or support investigation
  - return from a dashboard finding that elevated access is waiting or has expired
- Happy path:
  1. Requester opens `Security`.
  2. Chooses `Request break-glass access` or `Request impersonation`.
  3. Reviews a policy summary before editing: who can request, who can approve, max duration, whether the resulting session is read-only or write-capable, and whether an eligible approving admin is currently available.
  4. Completes the request form with the required evidence.
  5. Submits the request.
  6. Sees a `Pending approval` confirmation state with no token, no live session, and a deep link to the approval detail plus a request-history row in `Security`.
- Key decision points:
  - whether the task truly needs break-glass or impersonation
  - whether the requester has the correct role for the chosen request type
  - whether the justification, approval reference, and notification targets are sufficient to send for approval
  - whether an active elevated session already exists and should be reused, revoked, or treated as a conflict
  - whether the absence of an eligible second approver pushes the request into `Recovery required` before a pending item is created
- Required states and edge cases:
  - loading state where policy limits, approver availability, and eligible impersonation targets load before the submit CTA becomes active
  - empty-target state for impersonation when no eligible runtime/admin target exists
  - validation state for missing evidence, excessive duration, or malformed notification targets
  - permission-limited state:
    - `operator` can see impersonation rules but not submit impersonation
    - `viewer` is routed away from `/security` and must stay on audit or runtime-access surfaces such as `Audit History`, `Accounts`, or `API Keys`; policy posture does not open on the security route for viewer sessions
  - recovery-required state:
    - copy: `No eligible admin approver is available in this environment. Elevated access requires approval from a different admin. Add or restore a second admin, or use the documented recovery procedure before requesting access.`
    - secondary copy: `ForgeGate will not create a pending approval item or issue elevated access while no eligible approver exists.`
    - the draft stays editable
    - the submit CTA is disabled or the submit response returns a deterministic recovery-required error
    - no approval item is created and `Approvals` receives no new queue item
    - if the requester still has an admin session, the primary recovery CTA routes to `Security & Policies` admin management to add, restore, or reset a second admin
    - otherwise the primary recovery CTA routes to the documented bootstrap or recovery procedure outside the normal elevated-access flow
    - the blocked attempt emits a dedicated audit event with reason `no_eligible_second_admin`
  - duplicate-active-session conflict:
    - copy: `An elevated session is already active for this subject. Review the active session before creating a new request.`
  - submit success state:
    - copy: `Approval request submitted. No elevated session is active until this request is approved.`
  - request-create error state that preserves entered values and names the failed dependency
  - already-resolved state when the requester follows an old link after the request was decided elsewhere
- Operator success criteria:
  - the requester can tell in under five seconds that submitting the form does not grant access immediately
  - the requester can see which evidence is missing before submission
  - the requester can tell before submit whether the environment is eligible for the normal approval path or requires recovery
  - the requester can reach the pending approval detail and audit trail without searching the shell
- Trust, accessibility, and feedback signals:
  - the form header states `Request elevated access`, not `Start break-glass` or other copy that implies instant issuance
  - the policy summary shows read-only versus write-capable consequences before the form fields
  - helper text stays visible above or below fields; no placeholder-only labels
  - pending, conflict, recovery-required, and permission states use explicit text labels in addition to tone

### 2. Review And Decide From The Shared Approvals Queue

- Trigger or entry point:
  - `Governance > Approvals`
  - dashboard finding for `Pending approval`
  - deep link from the `Security` request confirmation
- Happy path:
  1. Approver opens the shared approvals queue.
  2. Filters by `Approval type`, `Status`, `Requester`, or `Opened at`.
  3. Opens an elevated-access request into the standard approval detail view.
  4. Reviews the evidence block first, then the audit/history block, then any secondary raw metadata.
  5. Chooses `Approve access` or `Reject request`.
  6. Confirms the decision and sees the resulting approval state, session state, audit reference, and next actor.
- Key decision points:
  - whether the approver is eligible to decide or is the requester and therefore blocked from acting
  - whether the evidence is complete enough to approve
  - whether an active elevated session already makes the request unsafe or redundant
  - whether rejection needs explicit rationale for downstream audit clarity
- Required states and edge cases:
  - queue loading state and detail loading state
  - queue empty state:
    - copy: `No elevated-access approvals waiting.`
  - permission-limited state:
    - copy: `You can review this request, but you do not have permission to approve elevated access.`
  - self-approval blocked state:
    - copy: `You requested this access and cannot approve it. Another admin must decide.`
  - missing-evidence state where the approve CTA is disabled and the evidence block shows what is missing
  - approve confirmation state:
    - copy: `Approve access request? The requester must start the elevated session separately.`
  - reject confirmation state with rationale input
  - cancelled state:
    - copy: `This request was cancelled before a decision. No elevated session will be issued.`
    - decision CTAs are removed
  - already-resolved state when another approver acted while the detail view was open
  - expired state when the request timed out before decision
  - active-session conflict state when a conflicting session already exists
  - success states:
    - `Approved` plus `Ready to start`
    - `Rejected` plus `Not issued`
  - transport or backend error state that keeps the item open and preserves decision context
- Operator success criteria:
  - the approver can make the decision without leaving the control plane for terminal or raw database inspection
  - the queue makes it obvious whether the item is an execution approval or elevated-access approval
  - the detail view states exactly what changed after the decision
  - the approver can tell whether they finished the workflow or whether the requester still has a next step
- Trust, accessibility, and feedback signals:
  - decision CTAs use explicit verbs: `Approve access` and `Reject request`
  - the evidence section is first in reading and focus order
  - raw IDs remain available in a secondary metadata section, not as the primary decision content
  - reject rationale uses a labeled field with persistent helper text
  - post-decision copy names the next actor explicitly when the request becomes `Ready to start`

### 3. Requester Starts The Approved Session From Security

- Trigger or entry point:
  - `Security` request-history row with `Approved` and `Ready to start`
  - deep link from the approval detail after a successful decision
  - return to `Security` after an approval notification
- Happy path:
  1. The original requester reopens the request from `Security`.
  2. Reads `Approved` plus `Ready to start` and the helper text that only the requester can start the session.
  3. Chooses `Start break-glass session` or `Start impersonation session`.
  4. ForgeGate exchanges the approved request for a temporary bearer token or live elevated session.
  5. The requester lands on an active elevated-session card with expiry time, session type, approver identity, and audit link.
- Key decision points:
  - whether access is still needed before starting
  - whether the current actor is the same person who opened the request
  - whether a new active-session conflict appeared after approval
  - whether token exchange failed and should be retried
- Required states and edge cases:
  - ready-to-start state:
    - copy: `Access approved. Start the elevated session to receive the temporary token.`
  - non-requester permission-limited state:
    - copy: `This request is approved, but only the original requester can start the session.`
  - already-issued state when the requester opens the request after starting the session elsewhere
  - start conflict state:
    - copy: `This request is approved, but another elevated session is already active. Review the active session before starting a new one.`
  - start transport/error state that preserves the approved request and does not expose a partial token
  - active state:
    - copy: `Elevated session active until {time}.`
- Operator success criteria:
  - the requester never has to infer from `Approved` alone whether access is already live
  - the requester can start access from `Security` without returning to `Approvals` or the shell
  - no actor other than the requester is shown a start CTA
- Trust, accessibility, and feedback signals:
  - the start CTA sits beside the status summary instead of behind secondary navigation
  - the loading state explains that ForgeGate is starting an elevated session, not just refreshing the page
  - token or session details appear only after successful issuance
  - the active session card shows who approved the access and who issued it

### 4. Confirm Outcome And Return To Security Or Audit History

- Trigger or entry point:
  - requester or approver lands on the resolved request summary
  - operator reopens the request from `Security` or `Logs`
  - an active elevated session later expires or is revoked
- Happy path:
  1. The user lands on the request summary.
  2. Reads the approval outcome, current session state, and timestamps.
  3. If the session is active, opens the active elevated-session card from `Security`.
  4. If the request was rejected, expired, or cancelled, opens the audit record or submits a new request if still necessary.
  5. Leaves the workflow with a clear audit link and no ambiguity about whether access exists.
- Key decision points:
  - whether the approved session is still `Ready to start`, `Active`, `Expired`, or `Revoked`
  - whether the request needs a new submission because it expired, was rejected, or was cancelled
  - whether the operator needs session detail or audit evidence next
- Required states and edge cases:
  - approved / ready-to-start state with one-click return to `Security`
  - approved-and-active state:
    - copy: `Elevated session active until {time}.`
  - approved-but-expired state:
    - copy: `Approval completed, but the elevated session has expired.`
  - rejected state:
    - copy: `Request rejected. No elevated session was issued.`
  - expired-before-decision state:
    - copy: `Request expired before approval. Submit a new request if elevated access is still required.`
  - cancelled state:
    - copy: `Request cancelled. No elevated session will be issued.`
  - revoked-session state with audit link
  - permission-limited state where a user can see summary outcome but not full session detail
  - latest-audit-event state with one-click return path to `Audit History`
  - no-history / retention-limited state when older evidence is no longer retained
- Operator success criteria:
  - the user never has to infer whether access exists from approval state alone
  - every resolution path points to the relevant audit event or active session record in one click
  - the post-decision state does not strand the user at a dead end
- Trust, accessibility, and feedback signals:
  - outcome banners separate `approval outcome` from `session status`
  - timestamps show `decided at`, `issued at`, and `session expires at` when applicable
  - success and failure states remain readable without color
  - cancelled, rejected, and expired states use distinct copy and next actions instead of one generic terminal banner

## IA / Navigation Implications

- `Security & Policies` remains the request-entry, request-history, recovery, and active-session surface.
- `Security` needs separate regions for `Request history` and `Active elevated sessions` so `Approved` does not visually masquerade as `Active`.
- `Governance > Approvals` should remain the discoverable route label and the live shared queue/detail surface for both execution-run approvals and elevated-access approvals. Elevated access should not ship as a separate security-only review queue.
- The queue must expose an `Approval type` filter with at least `Execution run`, `Break-glass`, and `Impersonation`, plus a `Status` filter that includes `Cancelled`.
- Dashboard findings should deep-link by state:
  - pending item -> `Approvals`
  - recovery-required posture -> `Security` recovery or admin-management callout
  - approved ready-to-start item for the requester -> `Security` request history filtered to `Ready to start`
  - approved active access -> `Security` active-session card
  - rejected, expired, cancelled, or otherwise resolved item -> `Audit History` or request-history detail
- If the first implementation still uses an execution-backed route or shell seam, the visible navigation label should still be `Approvals`. Elevated-access reviewers should not have to reason about execution internals just to decide a security request.

## Token / Component Implications

### 1. Approval Status Chip Family

- Intended behavior:
  - reusable approval chips for `Pending approval`, `Approved`, `Rejected`, `Expired`, and `Cancelled`
  - separate session chips for `Not issued`, `Ready to start`, `Active`, `Expired`, and `Revoked`
- Reuse rationale:
  - execution approvals and elevated-access approvals need the same approval-state vocabulary, but elevated access also needs a clear session-state layer
- Accessibility constraints:
  - chips use text labels, not color alone
  - `Approved`, `Ready to start`, and `Active` must never share one ambiguous badge label

### 2. Approval Evidence Block

- Intended behavior:
  - top-of-detail panel summarizing requester, target, justification, reference, duration, active-session conflicts, latest audit link, and who acts next
- Reuse rationale:
  - execution approvals already need an evidence-first decision panel; elevated access adds specific fields but should not invent a second layout
- Accessibility constraints:
  - evidence labels remain visible and grouped logically
  - disabled approval actions must explain why they are disabled

### 3. Outcome Banner And Start Panel

- Intended behavior:
  - reusable post-decision status region that states approval outcome, session state, timestamp, and either a requester-only start CTA or `Open audit history`
- Reuse rationale:
  - requesters and approvers both need a stable end-of-workflow pattern across approvals, security, and audit surfaces
- Accessibility constraints:
  - banner content must be announced as a status update
  - the primary CTA remains keyboard reachable in the same region as the status message

### 4. Policy Blocker Callout

- Intended behavior:
  - reusable blocking callout for `Recovery required`, `self-approval blocked`, and `permission-limited` states
- Reuse rationale:
  - the same policy-derived blocker pattern appears in `Security`, `Approvals`, and resolved summaries
- Accessibility constraints:
  - the blocker reason must be present in text, not only iconography or color
  - the recovery CTA must remain reachable without dismissing the message

## Implementation Handoff

Affected surfaces and contracts:

- `frontend/src/pages/SecurityPage.tsx`
- `frontend/src/pages/ApprovalsPage.tsx`
- `frontend/src/pages/LogsPage.tsx` for the audit return path
- `frontend/src/api/admin.ts`
- security admin API contract for request creation, recovery-required validation, and requester-only issuance
- approval list/detail/decision API contract
- `GET /admin/security/credential-policy` or equivalent policy payload for approver availability, recovery posture, status vocabulary, and session capability
- audit/event payloads for elevated-access request lifecycle plus resulting session lifecycle

Reuse from the existing execution-approval pattern:

- one approval lifecycle with backend statuses `open`, `approved`, `rejected`, `timed_out`, and `cancelled`
- one shared approvals queue/detail layout with the same loading, empty, already-resolved, and conflict handling
- one decision action model with explicit approve/reject actions and immutable decision timestamps
- one audit-link pattern from approval resolution back to history

Current elevated-access requirements:

- `Security` request entry creates an approval item instead of issuing a token immediately
- approval detail fields cover request type, impersonation target, notification targets, requested duration, session capability, and who must act next
- session issuance happens only after approval succeeds and only when the original requester starts the session
- `Approved` plus `Ready to start` is a first-class state, backed by the approved request plus pending issuance
- pending-request cancellation or withdrawal needs a defined UI path if the shared approval lifecycle keeps `cancelled`
- `Security` must render `Recovery required` when no eligible second approver exists, route the operator to the recovery-only path chosen in [FOR-113](/FOR/issues/FOR-113), and avoid creating a false pending state
- active elevated-session state and request-history return path live on `Security`
- self-approval prevention and role-based request restrictions remain explicit in the UI

Concrete acceptance criteria for engineering and QA:

- Submitting break-glass or impersonation from `Security` ends in `Pending approval` with no access token exposed in the UI.
- If no eligible second approver exists, `Security` shows the `Recovery required` state, preserves the draft, disables submission or returns a deterministic recovery-required error, and shows recovery guidance instead of creating a pending approval item.
- A no-eligible-second-admin attempt creates a dedicated audit event with blocked reason `no_eligible_second_admin`, and `Approvals` shows no new item for that attempt.
- The shared approvals queue can distinguish elevated-access items from execution items by `Approval type`.
- The approval detail shows all required evidence before raw metadata and blocks approval when required evidence is missing.
- Approving a request results in:
  - approval state `Approved`
  - session state `Ready to start`
  - visible copy that only the original requester can start the session
  - no token exposed to the approver
- Starting an approved request from `Security` results in:
  - session state `Active`
  - visible expiry time
  - audit link
  - a type-specific active session card
- Rejecting a request results in:
  - approval state `Rejected`
  - session state `Not issued`
  - visible rationale in audit/history context
- Cancelling a request results in:
  - approval state `Cancelled`
  - session state `Not issued`
  - decision CTAs removed
  - visible audit or resubmit path
- Expired, already-resolved, conflict, and permission-limited states are explicitly defined and testable.
- `Security` shows separate request history, ready-to-start status, and active-session status so operators do not confuse `approved` with `currently active`.
- Every resolved or started request has a one-click return path to audit history.

Copy and interaction rules that should not be improvised:

- Primary request CTAs:
  - `Request break-glass access`
  - `Request impersonation`
- Detail decision CTAs:
  - `Approve access`
  - `Reject request`
- Requester-only start CTAs:
  - `Start break-glass session`
  - `Start impersonation session`
- Pending-only withdrawal CTA:
  - `Cancel request`
- Do not use copy that implies instant access before approval. Avoid verbs such as `Start break-glass` on the request-entry surface.
- Use `Pending approval`, not `Open`, as the user-facing waiting label.
- Use `Ready to start`, not `Session active`, for approved requests that have not been issued yet.
- Use `Elevated session active until {time}` for live access. Do not reuse `Approved` as the live-session label.

## Residual UX Risks

- Shared approvals intentionally reject `companyId` filtering while elevated-access items remain non-company-scoped. Queue copy and follow-on docs must keep that constraint explicit so operators do not infer tenant scoping that does not exist yet.
- The requester-side `Cancel request` path now exists only for still-pending requests on `Security`. If future work broadens who can cancel or adds queue-side withdrawal, it must keep requester, approver, and session-state semantics separate.
- If backend does not expose `ready_to_issue`, approver availability, or active-session conflict data early, the UI will still force operators to infer critical state from secondary details.
- Timeout and expiry can be confused if request expiry, issued-at, and session expiry are not timestamped separately in the UI.
- If audit history does not log cancellation and session-start events distinctly, post-incident review will still blur request versus session semantics.

## Next Action

Owner: Auditor via [FOR-313](/FOR/issues/FOR-313), then Backend API / Frontend owners only if runtime or UI drift is found.

Expected artifact or decision: confirm that [FOR-99](/FOR/issues/FOR-99) now reflects the live `/approvals` plus `/security` operator workflow, including recovery-only handling from [FOR-113](/FOR/issues/FOR-113), and keep any future approval-scope changes grounded in that shipped contract.
