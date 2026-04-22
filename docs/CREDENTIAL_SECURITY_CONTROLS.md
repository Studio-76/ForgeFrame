# ForgeGate Credential Lifecycle and Security Controls

Last updated: 2026-04-22

This document defines the operational credential, audit, break-glass, and impersonation controls implemented in ForgeGate's governance stack.

## Credential classes

### Human admin sessions

- Endpoint: `POST /admin/auth/login`
- Token type: bearer session token
- Default TTL: `FORGEGATE_ADMIN_SESSION_TTL_HOURS` (default `12`)
- Storage at rest: SHA-256 hash only
- Pre-auth bootstrap hint: `GET /admin/auth/bootstrap` returns only a static signed-out hint (`message: "Sign in to inspect bootstrap posture."`) and does not disclose bootstrap username, default-credential state, admin/session counts, or storage backend before authentication
- Runtime readiness diagnostics: `GET /admin/auth/runtime-readiness` requires an authenticated admin session, does not accept raw bootstrap credentials in request headers, and remains available to `must_rotate_password=true` sessions as a read-only pre-rotation diagnostics exception
- Control-plane reset workflow: `/security` requires the acting admin to enter and confirm a temporary password before rotation; the UI forces first-login rotation and expects out-of-band handoff of that temporary secret
- Admin-managed security mutations may preserve or assert `must_rotate_password=true`, but only `POST /admin/auth/rotate-password` may clear the forced-rotation gate after the affected admin proves knowledge of the temporary secret
- Sessions flagged with `must_rotate_password=true` may only call the following authenticated auth routes until the user completes self-rotation:
  - `GET /admin/auth/me`
  - `GET /admin/auth/runtime-readiness`
  - `POST /admin/auth/rotate-password`
  - `POST /admin/auth/logout`
- `GET /admin/auth/runtime-readiness` is the approved exception to the control-plane lock so a password-rotation-required admin can inspect startup and readiness blockers before unlocking the rest of the admin surface
- Forced rotation triggers:
  - password rotation
  - explicit session revocation
  - user disablement
  - role change

### Service-account runtime keys

- Endpoints:
  - `POST /admin/keys/`
  - `POST /admin/keys/{key_id}/rotate`
  - `POST /admin/keys/{key_id}/disable`
  - `POST /admin/keys/{key_id}/revoke`
- Token prefix: `fgk_`
- Default TTL: `FORGEGATE_RUNTIME_KEY_TTL_DAYS` (default `90`)
- Rotation warning threshold: `FORGEGATE_RUNTIME_KEY_ROTATION_WARNING_DAYS` (default `14`)
- Storage at rest: SHA-256 hash only
- Plaintext exposure: returned once at issuance or rotation only

### Elevated admin sessions

- Shared approvals queue: `GET /admin/approvals`
- Shared approval detail: `GET /admin/approvals/{approval_id}`
- Shared approval decision endpoints:
  - `POST /admin/approvals/{approval_id}/approve`
  - `POST /admin/approvals/{approval_id}/reject`
- Shipped approval-route truth: `/approvals` is the live shared queue/detail review surface for execution-run and elevated-access approvals.
- Shared approval observer truth: `operator` and `admin` sessions can inspect approval evidence through `/admin/approvals`, but decision endpoints remain limited to standard, non-impersonated `admin` sessions and requester issuance stays on the dedicated security route.
- Shipped security-route truth: `/security` is the live elevated-access request/start surface for `operator` and `admin` sessions. `admin` additionally sees bootstrap, admin-user, session, and secret-posture modules there.
- Request-history envelope: `operator` sessions see only their own elevated-access requests on `Security`; `admin` sessions can inspect the broader request history and admin posture.
- Impersonation endpoint: `POST /admin/security/impersonations`
- Break-glass endpoint: `POST /admin/security/break-glass`
- Pending-request queue: `GET /admin/security/elevated-access-requests`
- Direct elevated-access decision endpoints:
  - `POST /admin/security/elevated-access-requests/{request_id}/approve`
  - `POST /admin/security/elevated-access-requests/{request_id}/reject`
- Requester issuance endpoint: `POST /admin/security/elevated-access-requests/{request_id}/issue`
- Required fields:
  - `approval_reference`
  - `justification`
  - `notification_targets`
  - `duration_minutes`
- Approval request TTL: min of the elevated-session max TTLs (default `30` minutes)
- Maximum TTLs:
  - impersonation: `FORGEGATE_IMPERSONATION_SESSION_MAX_MINUTES` (default `30`)
  - break-glass: `FORGEGATE_BREAK_GLASS_SESSION_MAX_MINUTES` (default `60`)

## Audit coverage

ForgeGate audit events retain the newest `FORGEGATE_AUDIT_EVENT_RETENTION_LIMIT` events in governance storage. The implemented audit set includes request, decision, and issuance transitions for elevated access:

- `admin_login`
  - success and failed credentials
  - failed rate-limited attempts
- `admin_role_change`
- `admin_status_change`
- `admin_password_rotate`
- `admin_session_revoke`
- `admin_session_bulk_revoke`
- `runtime_key_issue`
- `runtime_key_rotate`
- `runtime_key_status`
- `runtime_key_expired`
- `admin_token_exchange`
- `admin_impersonation_requested`
- `admin_impersonation_approved`
- `admin_impersonation_rejected`
- `admin_impersonation_timed_out`
- `admin_impersonation_start`
- `admin_break_glass_requested`
- `admin_break_glass_approved`
- `admin_break_glass_rejected`
- `admin_break_glass_timed_out`
- `admin_break_glass_start`

Audit metadata captures approval references, notification targets, prior and new roles or status values, and rotation lineage where applicable.

## Secret storage rules

- Admin passwords use salted PBKDF2-SHA256 hashes.
- Startup validation rejects missing, default, or placeholder bootstrap admin passwords before ForgeGate is allowed to accept traffic.
- Admin session tokens are stored as SHA-256 hashes only.
- Runtime keys are stored as SHA-256 hashes only and shown once on issuance.
- Provider secrets remain operator-managed environment or OAuth material and should be backed by external secret management in self-hosted deployments.

## Rate limiting

ForgeGate currently enforces admin login throttling:

- Endpoint: `POST /admin/auth/login`
- Window: `FORGEGATE_ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES` (default `15`)
- Attempt limit: `FORGEGATE_ADMIN_LOGIN_RATE_LIMIT_ATTEMPTS` (default `5`)
- Exceeded limit response: HTTP `429`

Additional auth-sensitive endpoints should inherit equivalent upstream limits at the ingress or API gateway layer for self-hosted deployments.

## Break-glass and impersonation rules

- Every elevated session must carry an approval reference and an explicit justification.
- Every elevated session must declare at least one notification target.
- ForgeGate separates approval from live session issuance. `/approvals` records the approval outcome, while `/security` keeps requester-owned session start and live session posture separate.
- Request approval and session issuance are separate transitions so audit history can distinguish `requested`, `approved` or `rejected`, `timed_out`, and `issued`.
- The original requester must claim the approved request through the issuance endpoint to receive the bearer token.
- Self-approval is forbidden; the approving principal must differ from the requester.
- Break-glass is limited to `admin` and `operator` users.
- Impersonation can only be created by an `admin`.
- Impersonation sessions inherit the target user's role for read access, not the issuing admin's role.
- Impersonation sessions are read-only for mutating admin/control-plane routes, including provider, account, key, settings, password, security state changes, and audit export generation.
- Break-glass sessions mint a temporary `admin` role session for the requesting user.

## Observability requirements

Self-hosted operators should monitor and alert on:

- auth latency
- auth denials
- repeated login failures
- credential rotations
- active break-glass sessions
- active impersonation sessions
- expiring runtime keys

The policy payload is available from `GET /admin/security/credential-policy`, including the explicit `read_only` flag for impersonation sessions, and the current storage posture is available from `GET /admin/security/secret-posture`.
