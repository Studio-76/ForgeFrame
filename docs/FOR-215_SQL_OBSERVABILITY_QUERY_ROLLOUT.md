# FOR-215 SQL Observability Query Rollout

This note records the FOR-215 backend rollout that moved the current admin observability surfaces off full-history in-memory loads and onto SQL-backed PostgreSQL queries. It also captures the first composite index pack, the remaining JSONB promotion backlog, and representative planner output taken on April 22, 2026.

## SQL-backed query paths

FOR-215 replaced the old `load_*` / `load_operations()` history reads on the PostgreSQL path with repository queries that aggregate or tail directly in SQL.

Current PostgreSQL-backed paths:

| Surface | SQL-backed method(s) |
| --- | --- |
| `/admin/usage` window summary | `PostgresObservabilityRepository.aggregate_summary()` |
| `/admin/usage` 24h timeline | `PostgresObservabilityRepository.timeline()` |
| `/admin/usage/providers/{provider}` | `PostgresObservabilityRepository.provider_drilldown()` |
| `/admin/usage/clients/{client_id}` | `PostgresObservabilityRepository.client_drilldown()` |
| Provider truth latest usage/error evidence | `PostgresObservabilityRepository.latest_usage_event()` and `latest_error_event()` |
| `/admin/providers/oauth-account/operations` tail and per-provider summary | `PostgresOAuthOperationsRepository.recent_operations()`, `latest_operation()`, and `provider_operation_summary()` |

The file-backed observability path still exists for non-PostgreSQL development modes, but the PostgreSQL runtime no longer needs to materialize full `usage_events`, `error_events`, `health_events`, or `oauth_operations` histories just to answer current admin queries.

## Composite index pack

FOR-215 adds `backend/app/storage/migrations/0015_phase24_observability_query_index_pack.sql`.

Indexes added in `0015`:

| Index | Query family it targets |
| --- | --- |
| `idx_usage_events_tenant_traffic_created_at` | tenant-scoped runtime vs health-check usage tails and windows |
| `idx_error_events_tenant_traffic_created_at` | tenant-scoped runtime vs health-check error tails and windows |
| `idx_error_events_tenant_type_status_created_at` | tenant-scoped incident review by `error_type` + `status_code` |
| `idx_health_events_tenant_provider_model_created_at` | latest health per provider/model tuple |
| `idx_oauth_operations_tenant_provider_action_executed_at` | latest OAuth probe / bridge-sync per provider |

FOR-215 intentionally builds on the tenant-led indexes introduced by `0007_phase21_observability_tenant_keying.sql`, which already covered:

- `usage_events(tenant_id, provider, created_at)`
- `usage_events(tenant_id, client_id, created_at)`
- `error_events(tenant_id, provider, created_at)`
- `error_events(tenant_id, client_id, created_at)`
- `health_events(tenant_id, provider, created_at)`
- `oauth_operations(tenant_id, provider_key, executed_at)`

## JSONB promotion backlog

The raw `payload JSONB` remains useful as an evidence ledger, but the fields below are still hot enough that they should move into typed columns and be dual-written there.

| Table | Fields that should move out of `payload JSONB` next | Why |
| --- | --- | --- |
| `usage_events` | `credential_type`, `auth_source`, `stream_mode`, `tool_call_count`, `consumer`, `integration`, `input_tokens`, `output_tokens`, `total_tokens`, `actual_cost`, `hypothetical_cost`, `avoided_cost` | Current usage summary and truth queries cast or group these on every request. |
| `error_events` | `stream_mode`, `consumer`, `integration`, `route`, `integration_class`, `profile_key`, `test_phase`, `template_id` | Current error evidence and drilldowns still filter, group, or display these through JSONB reads. |
| `health_events` | `readiness_reason`, `last_error` | Current latest-health responses project these from JSONB for every row returned. |
| `oauth_operations` | No urgent dimension gap for current admin surfaces. | Current filter and sort keys are already typed columns; `payload` is mainly evidence duplication. |

The highest-value next step is promoting the numeric usage ledger fields plus `stream_mode`, because those are the fields that still force repeated JSONB casts in the hottest summary endpoints.

## Representative EXPLAIN output

Capture method:

1. Create two disposable schemas on local PostgreSQL.
2. Apply migrations through `0014` for the "before" schema.
3. Apply migrations through `0015` for the "after" schema.
4. Seed synthetic observability histories.
5. Run `EXPLAIN (ANALYZE, COSTS OFF, SUMMARY OFF, TIMING OFF)` for the target query.

### Usage runtime tail

Representative query:

```sql
SELECT payload
FROM usage_events
WHERE tenant_id = 'tenant_a'
  AND traffic_type = 'runtime'
ORDER BY created_at DESC
LIMIT 20;
```

Before `0015`:

```text
Limit
  ->  Index Scan Backward using idx_usage_events_created_at on usage_events
        Filter: ((tenant_id = 'tenant_a') AND (traffic_type = 'runtime'))
        Rows Removed by Filter: 706
```

After `0015`:

```text
Limit
  ->  Index Scan using idx_usage_events_tenant_traffic_created_at on usage_events
        Index Cond: ((tenant_id = 'tenant_a') AND (traffic_type = 'runtime'))
```

### Error type/status tail

Representative query:

```sql
SELECT payload
FROM error_events
WHERE tenant_id = 'tenant_a'
  AND error_type = 'provider_upstream_error'
  AND status_code = 502
ORDER BY created_at DESC
LIMIT 20;
```

Before `0015`:

```text
Limit
  ->  Sort
        Sort Key: created_at DESC
        Sort Method: top-N heapsort
        ->  Bitmap Heap Scan on error_events
              Recheck Cond: ((status_code = 502) AND (error_type = 'provider_upstream_error'))
              Filter: (tenant_id = 'tenant_a')
              ->  BitmapAnd
                    ->  Bitmap Index Scan on idx_error_events_status_code
                    ->  Bitmap Index Scan on idx_error_events_error_type
```

After `0015`:

```text
Limit
  ->  Index Scan using idx_error_events_tenant_type_status_created_at on error_events
        Index Cond: (
          (tenant_id = 'tenant_a')
          AND (error_type = 'provider_upstream_error')
          AND (status_code = 502)
        )
```

### Provider/model health tail

Representative query:

```sql
SELECT payload
FROM health_events
WHERE tenant_id = 'tenant_a'
  AND provider = 'provider_01'
  AND model = 'model_01'
ORDER BY created_at DESC
LIMIT 20;
```

Before `0015`:

```text
Limit
  ->  Index Scan Backward using idx_health_events_tenant_provider_created_at on health_events
        Index Cond: ((tenant_id = 'tenant_a') AND (provider = 'provider_01'))
        Filter: (model = 'model_01')
        Rows Removed by Filter: 39
```

After `0015`:

```text
Limit
  ->  Index Scan using idx_health_events_tenant_provider_model_created_at on health_events
        Index Cond: (
          (tenant_id = 'tenant_a')
          AND (provider = 'provider_01')
          AND (model = 'model_01')
        )
```

### OAuth latest probe per provider

Representative query:

```sql
SELECT DISTINCT ON (provider_key) provider_key, payload
FROM oauth_operations
WHERE tenant_id = 'tenant_a'
  AND action = 'probe'
ORDER BY provider_key ASC, executed_at DESC;
```

Before `0015`:

```text
Unique
  ->  Sort
        Sort Key: provider_key, executed_at DESC
        Sort Method: external merge
        ->  Seq Scan on oauth_operations
              Filter: ((tenant_id = 'tenant_a') AND (action = 'probe'))
```

After `0015`:

```text
Result
  ->  Unique
        ->  Index Scan using idx_oauth_operations_tenant_provider_action_executed_at on oauth_operations
              Index Cond: ((tenant_id = 'tenant_a') AND (action = 'probe'))
```

### Tenant-wide latest health summary note

The current tenant-wide latest-health summary query is now SQL-backed, but on a synthetic `175000`-row tenant slice the planner still chose a full scan + sort before and after `0015`:

```sql
SELECT DISTINCT ON (provider, model) provider, model, created_at
FROM health_events
WHERE tenant_id = 'tenant_a'
ORDER BY provider ASC, model ASC, created_at DESC;
```

Before and after `0015`:

```text
Unique
  ->  Sort
        Sort Key: provider, model, created_at DESC
        Sort Method: external merge
        ->  Seq Scan on health_events
              Filter: (tenant_id = 'tenant_a')
```

That means FOR-215 successfully moved the path into SQL, but the full tenant-wide summary will likely need either larger production cardinality, extended statistics, or a follow-on query shape change before PostgreSQL consistently prefers the new composite for that exact `DISTINCT ON` rollup.
