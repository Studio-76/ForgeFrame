-- FOR-215 closes the remaining tenant-led composite indexes from the
-- first observability query-performance guardrail pack.
-- Provider/client leading indexes already landed with tenant keying in 0007.

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_traffic_created_at
    ON usage_events(tenant_id, traffic_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_tenant_traffic_created_at
    ON error_events(tenant_id, traffic_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_tenant_type_status_created_at
    ON error_events(tenant_id, error_type, status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_tenant_provider_model_created_at
    ON health_events(tenant_id, provider, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oauth_operations_tenant_provider_action_executed_at
    ON oauth_operations(tenant_id, provider_key, action, executed_at DESC);
