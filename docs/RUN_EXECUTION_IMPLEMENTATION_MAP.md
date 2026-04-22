# Run Execution Implementation Map

## Purpose

This note adapts the execution design from [FOR-22](/FOR/issues/FOR-22#document-orchestration-boundary), [FOR-29](/FOR/issues/FOR-29#document-run-persistence-schema), and [FOR-30](/FOR/issues/FOR-30#document-provider-adapter-secret-broker-contract) to the actual ForgeGate repository at `/opt/forgegate`.

The Paperclip issue documents assume a `packages/db` + `packages/shared` + `server` layout. This repository is a Python FastAPI service under `backend/`, so the implementation work for [FOR-37](/FOR/issues/FOR-37), [FOR-38](/FOR/issues/FOR-38), and [FOR-39](/FOR/issues/FOR-39) needs a Python-native landing zone.

## Confirmed Repo Reality

- Runtime and admin code lives in `backend/app/`.
- Persistence is implemented through `backend/app/storage/` with SQLAlchemy ORM plus file-backed fallbacks for some domains.
- Tests live under `backend/tests/`.
- The execution schema substrate now lives in `backend/app/storage/execution_repository.py` with the additive migration pack in `backend/app/storage/migrations/0006_phase20_run_persistence_pack.sql`.
- Shared execution-state vocabularies and validation models now live in `backend/app/execution/models.py`.

## Python-Native Landing Zones

### Domain models and services

- `backend/app/execution/models.py`
  - run states
  - command types
  - approval-link state
  - outbox event types
- `backend/app/execution/service.py`
  - create admission
  - cancel admission
  - retry admission
  - approval open / resume / reject transitions
  - worker claim and lease compare-and-set rules

### Persistence

- `backend/app/storage/execution_repository.py`
  - SQLAlchemy ORM models for the eight FOR-29 tables
  - repository methods for transactional state transitions
  - claim helpers using `SELECT ... FOR UPDATE SKIP LOCKED` on PostgreSQL
- `backend/app/storage/models.py`
  - export the new execution ORM types alongside the existing storage models
- `backend/app/storage/migrations/`
  - additive migration pack for the new execution tables and indexes

### API and worker integration

- `backend/app/api/admin/`
  - `execution.py` exposes the minimum operator controls for background-job replay and dead-letter inspection
- `backend/app/api/runtime/`
  - only if public runtime-facing command resources are introduced in the Python service
- `backend/app/providers/execution_contract.py`
  - remains the provider/secret contract boundary for worker-side side effects

### Retry, dead-letter, and replay contract

- Retryable worker failures close the current attempt as terminal evidence, create a fresh follow-up attempt, and move the run into `retry_backoff` until the bounded jittered delay expires.
- Non-retryable failures, or retryable failures that exhaust the configured attempt budget, move both the run and the active attempt into `dead_lettered`.
- Dead-letter transitions preserve diagnostics in `run_attempts.last_error_*`, `runs.result_summary`, and a `dead_letter` outbox row.
- Operators inspect background-job state through `/admin/execution/runs` and `/admin/execution/runs/{run_id}` and must pass an explicit request-scoped `companyId`.
- Operator replay is admitted through `POST /admin/execution/runs/{run_id}/replay`, which persists the replay reason in the immutable `run_commands` ledger and the admin audit log within the requested company scope.
- The replay response now carries an explicit audit reference (`event_id`, action, target, scope) so the control plane can open the exact `Audit History` slice without forcing operators to hunt by timestamp.

### Verification

- `backend/tests/test_execution_transitions.py`
  - duplicate command admission
  - stale worker claim
  - cancel during execution
  - approval resume and reject
- `backend/tests/test_execution_repository.py`
  - transaction-level repository behavior
  - optimistic concurrency failures
  - outbox enqueue invariants

## Ownership Split

- [FOR-37](/FOR/issues/FOR-37) should own the schema, ORM, and migration substrate in `backend/app/storage/`.
- [FOR-38](/FOR/issues/FOR-38) should own service-layer command admission, worker-claim logic, approval transitions, and tests that prove the transition rules.
- [FOR-39](/FOR/issues/FOR-39#document-run-history-retention-controls) already defines retention and replay controls that can attach after the hot-path substrate exists.

## Immediate Blocker

[FOR-38](/FOR/issues/FOR-38) no longer needs to invent its own persistence substrate, but it still owns the service-layer transition logic:

- command admission and duplicate handling
- worker claim and lease compare-and-set flows
- approval resume and reject transitions
- timeout reconciliation and outbox publication logic

## Next Action

Implement the [FOR-29](/FOR/issues/FOR-29#document-run-persistence-schema) transition logic in `backend/app/execution/` against the landed schema substrate, then wire the service path behind feature flags.
