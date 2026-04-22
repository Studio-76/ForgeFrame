# FOR-113 Single-Admin Elevated-Access Decision

## Beta Decision

ForgeGate beta chooses option 3: use a separate recovery-only path outside the normal elevated-access approval workflow when an environment has no eligible second admin approver.

This means:

- no bootstrap or self-approval exception inside the normal request, queue, or decision flow
- no elevated-access request should be treated as approvable if the requester is the only eligible admin approver in the environment
- single-admin posture is `Recovery required`, not `Pending approval`

An eligible approver for this decision is an active `admin` user who is not the requester and can perform approval decisions.

## Operator Contract

Normal control-plane state:

- state label: `Recovery required`
- primary copy: `No eligible admin approver is available in this environment. Elevated access requires approval from a different admin. Add or restore a second admin, or use the documented recovery procedure before requesting access.`
- secondary copy: `ForgeGate will not create a pending approval item or issue elevated access while no eligible approver exists.`

Expected behavior:

- `Security & Policies` blocks submit or returns a deterministic recovery-required error before an open approval item is created.
- `Approvals` shows no new item for that attempted request.
- Break-glass and impersonation both remain unavailable through the normal approval path until a second admin is active and eligible to decide.
- If the operator still has an admin session, the fastest recovery path is to create, re-enable, or temporarily reset a second admin from `Security & Policies`.
- If no admin session is available, recovery happens through the documented bootstrap or recovery procedure outside the normal approval flow, then the operator retries the elevated-access request from the beginning.

## Audit Expectation

- The blocked attempt is a governance event, not a fake approval. Record a dedicated recovery-required audit event with actor, request type, target, and blocked reason `no_eligible_second_admin`.
- Do not emit `approved`, `rejected`, or `start` elevated-access events for this case, and do not create an `open` approval record that can never be decided.
- Any out-of-band recovery action that restores approver availability must keep its own audit trail, such as admin creation, admin re-enablement, or temporary-password reset. The normal elevated-access audit sequence starts only after the operator submits a fresh request in a now-eligible environment.

## Why This Path

- It preserves the two-person approval rule in the highest-risk governance flow.
- It matches ForgeGate's product split: UI-first for routine operator work, shell or bootstrap only for recovery posture.
- It avoids product drift where `single admin` silently becomes self-approval or a hidden bootstrap backdoor.
- It is safer than an in-band exception and more operable than a permanent dead-end hard block.

## Implementation Handoff

- Backend owner: Backend API Lead 2
  - expose approver-availability posture to the control plane
  - reject request creation when no eligible second admin exists
  - emit recovery-required audit events
- Frontend owner: Frontend Control Plane Lead in [FOR-101](/FOR/issues/FOR-101)
  - render the `Recovery required` state and recovery instructions
  - avoid showing `Pending approval` when no request was created
- Design owner: Design Lead in [FOR-99](/FOR/issues/FOR-99)
  - fold this decision into the elevated-access request workflow, approval-state coverage, and QA acceptance
