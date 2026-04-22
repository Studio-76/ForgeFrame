# Operational History Retention Controls

This document records the FOR-214 retention contract for ForgeGate's raw observability and OAuth history tables. The goal is to let operators bound hot-table growth without enabling silent data loss or a purge path that has never been validated against backup and restore.

The retention utility lives in `scripts/run-history-retention.py`.

## Active FOR-214 policies

The default command path only selects the active policies below:

| Policy key | Source table | Archive table | Hot retention | Archive retention | Why it exists |
| --- | --- | --- | --- | --- | --- |
| `usage_events` | `usage_events` | `usage_events_archive` | 30 days | 180 days | Usage and cost analytics ledger |
| `error_events` | `error_events` | `error_events_archive` | 30 days | 180 days | Runtime and health error review |
| `health_events` | `health_events` | `health_events_archive` | 30 days | 180 days | Provider and model health timeline |
| `oauth_operations` | `oauth_operations` | `oauth_operations_archive` | 90 days | 365 days | OAuth probe and bridge-sync history |

The helper keeps placeholder policies for later execution-pack and harness-history retention work, but those policies are inactive in FOR-214 and are not selected by the default CLI flow.

## Execution flow

1. Dry-run first and capture the report. This prints candidate row counts plus oldest/newest eligible timestamps for each active table:

```bash
python scripts/run-history-retention.py --report-path /tmp/forgegate-retention-dry-run.json
```

2. Apply archive moves only after reviewing the dry-run. Rows move from the hot table into the matching `_archive` table inside PostgreSQL, so the first destructive step stays reversible inside the same database:

```bash
python scripts/run-history-retention.py --apply --report-path /tmp/forgegate-retention-apply.json
```

3. Before any permanent deletion from archive tables, prove recovery with the repo-owned smoke:

```bash
bash scripts/compose-backup-restore-smoke.sh
```

The smoke report now records `validated_source_databases`, which binds the recovery proof to the exact PostgreSQL source database by `database` name plus `cluster_system_identifier`.

4. Only after the smoke report is fresh and successful, allow archive purge:

```bash
python scripts/run-history-retention.py \
  --apply \
  --purge-archive \
  --backup-restore-report /tmp/forgegate-backup-restore-smoke.json \
  --report-path /tmp/forgegate-retention-purge.json
```

The purge path is blocked unless the backup/restore report exists, has `status=ok`, is newer than 24 hours, and its `validated_source_databases` exactly match the active retention target databases. Legacy reports or reports captured from a different database or PostgreSQL cluster are rejected even if they are fresh.

## Release validation

`bash scripts/release-validate.sh` proves the safe path end to end:

1. backend and frontend validation
2. compose smoke
3. backup/restore smoke
4. retention purge-guard dry-run

The release gate calls `scripts/run-history-retention.py --purge-archive` without `--apply`, so it never archives or purges rows during release validation. It proves that the destructive path stays blocked unless a fresh backup/restore proof exists for the same source database and PostgreSQL cluster that the retention command would target.

## Rollback and index posture

ForgeGate's current storage migrator runs each SQL migration inside a normal transaction and splits statements on `;`. On branches that still use this migrator, `CREATE INDEX CONCURRENTLY` is not a supported migration pattern.

That constraint drives the rollback posture:

- FOR-214 does not add archive-specific index migrations. Archive tables are created with `LIKE ... INCLUDING ALL`, so they inherit the source-table indexes that already exist on the active schema.
- If a branch needs new source-table indexes for retention or query performance, treat them as additive rollout work in a low-traffic window or run them manually outside the migrator. Do not treat `DROP INDEX` or `DROP TABLE` as the first rollback move.
- If an index or retention rollout behaves unexpectedly, stop scheduled `--apply` and keep `--purge-archive` disabled. Prefer a forward fix or a validated restore drill over destructive rollback.
- Use `scripts/backup-forgegate.sh` before storage-affecting rollout work and validate recovery with `scripts/restore-forgegate.sh <dump> <target_db>` or `scripts/compose-backup-restore-smoke.sh` before enabling archive purge.
- Leave additive archive tables and indexes in place during incident response unless there is a proven, separately validated reason to remove them. Removing evidence during a retention incident increases blast radius.

## Operator query examples

Recent OAuth probe failures:

```sql
SELECT provider_key, action, status, details, executed_at
FROM oauth_operations
WHERE status IN ('warning', 'failed')
ORDER BY executed_at DESC
LIMIT 100;
```

Archived runtime and health errors:

```sql
SELECT provider, model, error_type, status_code, created_at, payload
FROM error_events_archive
WHERE created_at >= NOW() - INTERVAL '90 days'
ORDER BY created_at DESC;
```
