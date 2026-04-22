# Run Persistence Schema Rollout

This note records the ForgeGate-native rollout posture for the transactional run-persistence substrate landed for [FOR-37](/FOR/issues/FOR-37).

## Scope

The schema pack adds these PostgreSQL tables under `backend/app/storage/migrations/0006_phase20_run_persistence_pack.sql`:

- `run_commands`
- `runs`
- `run_attempts`
- `run_approval_links`
- `run_outbox`
- `run_external_calls`
- `secret_references`
- `run_secret_bindings`

The Python-native ORM surface lives in `backend/app/storage/execution_repository.py`, and the shared state vocabulary and payload validation surface lives in `backend/app/execution/models.py`.

## Tenancy posture

- Every execution table carries a required `company_id`.
- Child execution tables use composite `(company_id, ...)` foreign keys when they point at other execution rows, so a row cannot cross company boundaries by referencing a parent from another tenant.
- Admin execution inspection and replay routes must resolve `company_id` from each request. Do not fall back to a process-wide default company when serving `/admin/execution/*`.
- `workspace_id`, `issue_id`, `approval_id`, and `company_secret_id` are currently soft references only. ForgeGate does not yet persist those upstream control-plane parents in this repository, so hard foreign keys would create a false guarantee. Keep those columns additive until the parent tables land locally.

## Rollout phases

### Phase 1: schema only

- Apply the migration pack.
- Do not switch runtime write paths yet.
- Confirm tables, indexes, and composite same-company foreign keys exist.

### Phase 2: dual write

- Start writing `run_commands`, `runs`, `run_attempts`, and `run_outbox` from the admission path behind a feature flag.
- Keep existing harness and runtime flows intact while comparing new rows with live transitions.
- Hold worker readers behind feature flags until lease and retry behavior is verified.

### Phase 3: reader cutover

- Move claim, resume, cancel, timeout reconciliation, and approval-wait reads onto the new tables.
- Roll back at the feature-flag layer first; do not drop or rename any of the additive tables in the same release train.

### Phase 4: constraint tightening

- Only after dual-write and reader cutover are stable should ForgeGate add hard foreign keys to future local workspace, approval, issue, or company-secret tables.
- Treat any destructive cleanup as a later migration with separate review.

## Verification queries

Run these queries immediately after migration apply, before any reader cutover, and again before tightening constraints.

```sql
-- 1. Composite same-company integrity for attempts, commands, and outbox rows.
SELECT COUNT(*) AS orphan_attempts
FROM run_attempts a
LEFT JOIN runs r
  ON r.company_id = a.company_id
 AND r.id = a.run_id
WHERE r.id IS NULL;

SELECT COUNT(*) AS orphan_commands
FROM run_commands c
LEFT JOIN runs r
  ON r.company_id = c.company_id
 AND r.id = c.run_id
WHERE c.run_id IS NOT NULL
  AND r.id IS NULL;

SELECT COUNT(*) AS orphan_outbox_rows
FROM run_outbox o
LEFT JOIN runs r
  ON r.company_id = o.company_id
 AND r.id = o.run_id
LEFT JOIN run_attempts a
  ON a.company_id = o.company_id
 AND a.id = o.attempt_id
WHERE (o.run_id IS NOT NULL AND r.id IS NULL)
   OR (o.attempt_id IS NOT NULL AND a.id IS NULL);

-- 2. Composite same-company integrity for approval links, provider calls, and secret bindings.
SELECT COUNT(*) AS orphan_approval_links
FROM run_approval_links l
LEFT JOIN runs r
  ON r.company_id = l.company_id
 AND r.id = l.run_id
LEFT JOIN run_attempts a
  ON a.company_id = l.company_id
 AND a.id = l.attempt_id
WHERE r.id IS NULL
   OR a.id IS NULL;

SELECT COUNT(*) AS orphan_external_calls
FROM run_external_calls c
LEFT JOIN runs r
  ON r.company_id = c.company_id
 AND r.id = c.run_id
LEFT JOIN run_attempts a
  ON a.company_id = c.company_id
 AND a.id = c.attempt_id
WHERE r.id IS NULL
   OR a.id IS NULL;

SELECT COUNT(*) AS orphan_secret_bindings
FROM run_secret_bindings b
LEFT JOIN secret_references s
  ON s.company_id = b.company_id
 AND s.id = b.secret_reference_id
LEFT JOIN run_attempts a
  ON a.company_id = b.company_id
 AND a.id = b.attempt_id
WHERE s.id IS NULL
   OR a.id IS NULL;

-- 3. At most one active attempt per run.
SELECT company_id, run_id, COUNT(*) AS active_attempts
FROM run_attempts
WHERE attempt_state IN (
  'queued',
  'dispatching',
  'executing',
  'waiting_on_approval',
  'cancel_requested',
  'retry_backoff',
  'compensating'
)
GROUP BY company_id, run_id
HAVING COUNT(*) > 1;

-- 4. Every waiting-on-approval run has an open approval link.
SELECT COUNT(*) AS waiting_without_open_gate
FROM runs r
LEFT JOIN run_approval_links l
  ON l.company_id = r.company_id
 AND l.run_id = r.id
 AND l.gate_status = 'open'
WHERE r.state = 'waiting_on_approval'
  AND l.id IS NULL;
```

## Rollback posture

- Disable dual-write and reader feature flags first.
- Leave the additive tables in place during rollback. Dropping them inside the incident window destroys evidence and increases blast radius.
- Prefer a forward fix, data freeze, or writer disable over destructive rollback.
- Only remove or rename execution tables in a later, separately reviewed cleanup migration after production stability is proven.

## Operational notes

- Keep provider I/O, webhook sends, and secret materialization outside database transactions.
- Use compare-and-set semantics on `runs.version` and `run_attempts.version` for transition writes.
- Until local control-plane parent tables exist, treat `workspace_id`, `issue_id`, `approval_id`, and `company_secret_id` as externally validated references, not database-enforced integrity anchors.
