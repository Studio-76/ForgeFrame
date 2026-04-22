# ForgeGate API Idempotency And Retry Contract

This document records the first backend slice for `FOR-25`.

## Request envelope

All mutating HTTP routes (`POST`, `PUT`, `PATCH`, `DELETE`) now project a
stable envelope on the response:

- `X-ForgeGate-Request-Id`
- `X-ForgeGate-Correlation-Id`
- `X-ForgeGate-Causation-Id`
- `Idempotency-Key` when the client supplied one

`X-Request-Id` is accepted as the inbound request-id source. Correlation and
causation default to the request id when the client does not supply explicit
ForgeGate headers.

## Retry envelope

Retryable runtime provider failures continue to surface JSON error metadata such
as `retryable` and `retry_after_seconds`. When ForgeGate has an upstream retry
hint, it now also emits the HTTP `Retry-After` header.

## Persisted idempotency

The execution store now contains `request_idempotency_records`, which persist:

- the route scope and caller subject key
- the idempotency key
- the canonical request fingerprint hash
- the replayable JSON response snapshot for opted-in routes

Opted-in API routes now include:

- `POST /admin/execution/runs/{run_id}/replay`
- `POST /admin/providers/sync`
- `POST /admin/providers/health/run`
- `POST /admin/providers/oauth-account/probe/{provider_key}`
- `POST /admin/providers/oauth-account/bridge-profiles/sync`
- `PUT /admin/providers/harness/profiles/{provider_key}`
- `DELETE /admin/providers/harness/profiles/{provider_key}`
- `POST /admin/providers/harness/profiles/{provider_key}/activate`
- `POST /admin/providers/harness/profiles/{provider_key}/deactivate`
- `POST /admin/providers/harness/profiles/{provider_key}/rollback/{revision}`
- `POST /admin/providers/harness/import`
- `POST /admin/providers/harness/preview`
- `POST /admin/providers/harness/dry-run`
- `POST /admin/providers/harness/verify`

Behavior:

- matching duplicate requests replay the original JSON response
- a reused key with a different fingerprint fails with
  `409 idempotency_fingerprint_mismatch`
- in-flight reuse fails with `409 idempotency_in_progress`
- harness profile mutation responses are redacted before persistence and replay:
  `auth_value` and request-header values whose names imply credentials are
  replaced with `***redacted***`
- harness preview, dry-run, and verify responses are redacted before
  persistence and replay so rendered credential headers are not stored
- `POST /admin/providers/harness/probe` rejects `Idempotency-Key` with
  `400 idempotency_not_supported` until raw upstream payload redaction is
  defined

## Job producer alignment

Execution command admission already used idempotency keys in `run_commands`.
This slice tightens that path so a reused command key with a different request
fingerprint now fails instead of silently deduplicating.

Execution job producers also now have explicit contract coverage for the
metadata that must stay stable across retries and replays:

- `run_outbox.dedupe_key` stays deterministic for create, retry, dead-letter,
  cancel, approval-notify, resume, and approval-driven cancel events
- provider adapter calls project the same request, correlation, causation, and
  idempotency identifiers into `AdapterCallMetadata` headers, alongside the
  execution attempt number

## Rollout tracker

Residual admin-route audit and rollout follow-up now live in `FOR-137`.

## Remaining admin mutation audit (`FOR-137`)

The remaining governance/admin mutation surfaces now have an explicit stance
instead of silently ignoring `Idempotency-Key`.

| Surface | Route(s) | Stance | Rationale |
| --- | --- | --- | --- |
| Accounts | `POST /admin/accounts/`, `PATCH /admin/accounts/{account_id}` | `400 idempotency_not_supported` | These writes are not on the replay store yet, and duplicate retries would currently duplicate governance audit side effects. |
| Runtime keys | `POST /admin/keys/`, `POST /admin/keys/{key_id}/rotate`, `POST /admin/keys/{key_id}/disable`, `POST /admin/keys/{key_id}/activate`, `POST /admin/keys/{key_id}/revoke` | `400 idempotency_not_supported` | Key issuance, rotation, and status changes are secret-bearing/security-critical and need an explicit redaction contract before persisted replay is safe. |
| Settings | `PATCH /admin/settings/`, `DELETE /admin/settings/{key}` | `400 idempotency_not_supported` | Settings writes mutate runtime behavior and governance audit state, but do not yet persist replay-safe response snapshots. |
| Admin auth | `POST /admin/auth/login`, `POST /admin/auth/logout`, `POST /admin/auth/rotate-password` | `400 idempotency_not_supported` | These routes mint/revoke sessions or rotate passwords and must not imply replay safety until credential/session redaction is designed. |
| Admin security | `POST /admin/security/users`, `PATCH /admin/security/users/{user_id}`, `POST /admin/security/users/{user_id}/rotate-password`, `POST /admin/security/sessions/{session_id}/revoke`, `POST /admin/security/secret-rotations`, `POST /admin/security/impersonations`, `POST /admin/security/break-glass`, `POST /admin/security/elevated-access-requests/{request_id}/approve`, `POST /admin/security/elevated-access-requests/{request_id}/reject`, `POST /admin/security/elevated-access-requests/{request_id}/cancel`, `POST /admin/security/elevated-access-requests/{request_id}/issue` | `400 idempotency_not_supported` | These flows govern credentials, privileged access, approval state, or session issuance and need replay-safe governance snapshots before accepting the header. |
| Shared approvals: elevated access | `POST /admin/approvals/{approval_id}/approve`, `POST /admin/approvals/{approval_id}/reject` when `approval_id` is `elevated:{request_id}` | `400 idempotency_not_supported` | The elevated-access governance branch does not yet persist replay-safe approval outcomes. |
| Shared approvals: execution runs | `POST /admin/approvals/{approval_id}/approve`, `POST /admin/approvals/{approval_id}/reject` when `approval_id` is `run:{company_id}:{approval_id}` | Scoped exclusion | These decisions already forward a stable idempotency key/fingerprint into the execution command path, but they do not yet persist/replay the final HTTP response snapshot at the shared-approvals layer. |

## Next rollout

Promote the state-setting admin surfaces that do not mint secrets or privileged
sessions into persisted response replay once their audit and redaction contract
is explicit. Keep security-, auth-, and session-bearing admin mutations on the
explicit rejection path until replay-safe snapshots are defined.
