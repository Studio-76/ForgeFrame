# FOR-213 Relational Audit Events Rollout

## Decision

ForgeGate now treats PostgreSQL `audit_events` as the primary audit-history path
for `/admin/logs` when governance storage runs on PostgreSQL.

`governance_state.payload.audit_events` remains only as a legacy shadow / rollback
copy for the current phase. It is no longer the intended source of truth for
operator audit reads.

## Schema and Index Pack

Primary table:

- `audit_events`

Relevant indexes for the first pass:

- `audit_events_tenant_created_idx`
  recent reverse-chronological audit tail reads per tenant
- `audit_events_tenant_target_idx`
  target drilldowns by tenant + target type + target id
- `audit_events_tenant_actor_membership_idx`
  admin-user actor drilldowns by tenant
- `audit_events_tenant_actor_service_account_idx`
  runtime/service-account actor drilldowns by tenant

## Migration Behavior

Migration `0014_phase23_audit_events_backfill.sql` is additive and idempotent:

- creates the missing runtime-actor drilldown index
- materializes missing tenant rows required by the `audit_events.tenant_id` FK
- backfills legacy `governance_state.payload.audit_events` rows into
  `audit_events`
- preserves actor identity in `metadata.legacy_actor_id` or
  `metadata.runtime_key_id` when relational actor FKs cannot be resolved yet
- uses `ON CONFLICT (event_id) DO NOTHING` so replaying the migration does not
  duplicate audit rows

## Runtime Cutover Rule

For PostgreSQL governance storage:

- read path: hydrate audit history from relational `audit_events`
- write path: continue dual-writing the legacy JSON shadow for rollback, but
  reconcile relational audit rows on save
- safety rule: load-time shadow sync must not delete relational audit rows just
  because a stale JSON payload is missing `audit_events`
- safety rule: a stale JSON shadow row must not overwrite an existing
  relational audit row for the same `event_id`

This keeps the broader governance relational rollout decoupled from the smaller
audit-history cutover.

## Verification

Minimum checks for rollout:

1. Run storage migrations on a database that still contains legacy
   `governance_state.payload.audit_events`.
2. Confirm `SELECT count(*) FROM audit_events` is non-zero after migration.
3. Confirm `/admin/logs/audit-events?window=all` still returns the expected
   historical rows for the same tenant.
4. Confirm clearing only `payload.audit_events` in `governance_state` does not
   erase audit history from the API when PostgreSQL storage is enabled.
5. Confirm PostgreSQL-backed `/admin/logs/` and `/admin/logs/audit-events`
   continue to surface the relational row when the legacy JSON shadow is stale
   for the same `event_id`.

## Legacy Cleanup Gate

Do not remove `governance_state.payload.audit_events` until all are true:

- PostgreSQL migration/backfill has run successfully in release-like bootstrap
  paths
- `/admin/logs` and `/admin/logs/audit-events` are verified against relational
  audit reads under PostgreSQL, including stale-shadow same-`event_id` cases
- no recovery path still depends on JSON audit history as its only source
- a follow-up migration is ready to delete the legacy field deliberately rather
  than implicitly

## Residual Risks

- Full relational governance read cutover for users/sessions/accounts/keys is
  still a separate concern; FOR-213 only cuts over audit history.
- Older audit rows may initially rely on metadata actor fallbacks until the
  wider governance relational shadow is fully populated.
- Retention policy is still governed by application behavior; archive / purge
  controls remain follow-up work.
