-- Single-tenant bootstrap history backfills to tenant_bootstrap until
-- tenant-aware admin/control-plane identity exists.

ALTER TABLE usage_events
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(191);

UPDATE usage_events
SET tenant_id = COALESCE(NULLIF(payload->>'tenant_id', ''), 'tenant_bootstrap')
WHERE tenant_id IS NULL;

UPDATE usage_events
SET payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(tenant_id::text),
    true
)
WHERE COALESCE(NULLIF(payload->>'tenant_id', ''), '') = '';

ALTER TABLE usage_events
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_created_at
    ON usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_provider_created_at
    ON usage_events(tenant_id, provider, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_client_created_at
    ON usage_events(tenant_id, client_id, created_at);

ALTER TABLE error_events
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(191);

UPDATE error_events
SET tenant_id = COALESCE(NULLIF(payload->>'tenant_id', ''), 'tenant_bootstrap')
WHERE tenant_id IS NULL;

UPDATE error_events
SET payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(tenant_id::text),
    true
)
WHERE COALESCE(NULLIF(payload->>'tenant_id', ''), '') = '';

ALTER TABLE error_events
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_error_events_tenant_created_at
    ON error_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_events_tenant_provider_created_at
    ON error_events(tenant_id, provider, created_at);
CREATE INDEX IF NOT EXISTS idx_error_events_tenant_client_created_at
    ON error_events(tenant_id, client_id, created_at);

ALTER TABLE health_events
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(191);

UPDATE health_events
SET tenant_id = COALESCE(NULLIF(payload->>'tenant_id', ''), 'tenant_bootstrap')
WHERE tenant_id IS NULL;

UPDATE health_events
SET payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(tenant_id::text),
    true
)
WHERE COALESCE(NULLIF(payload->>'tenant_id', ''), '') = '';

ALTER TABLE health_events
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_events_tenant_created_at
    ON health_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_health_events_tenant_provider_created_at
    ON health_events(tenant_id, provider, created_at);

ALTER TABLE oauth_operations
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(191);

UPDATE oauth_operations
SET tenant_id = COALESCE(NULLIF(payload->>'tenant_id', ''), 'tenant_bootstrap')
WHERE tenant_id IS NULL;

UPDATE oauth_operations
SET payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(tenant_id::text),
    true
)
WHERE COALESCE(NULLIF(payload->>'tenant_id', ''), '') = '';

ALTER TABLE oauth_operations
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_operations_tenant_executed_at
    ON oauth_operations(tenant_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_oauth_operations_tenant_provider_executed_at
    ON oauth_operations(tenant_id, provider_key, executed_at);
