CREATE TABLE IF NOT EXISTS usage_events (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(191) NOT NULL,
    model VARCHAR(191) NOT NULL,
    traffic_type VARCHAR(32) NOT NULL,
    client_id VARCHAR(191) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events(model);
CREATE INDEX IF NOT EXISTS idx_usage_events_traffic_type ON usage_events(traffic_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_client_id ON usage_events(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);

CREATE TABLE IF NOT EXISTS error_events (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(191) NULL,
    model VARCHAR(191) NULL,
    traffic_type VARCHAR(32) NOT NULL,
    client_id VARCHAR(191) NOT NULL,
    error_type VARCHAR(191) NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_events_provider ON error_events(provider);
CREATE INDEX IF NOT EXISTS idx_error_events_model ON error_events(model);
CREATE INDEX IF NOT EXISTS idx_error_events_traffic_type ON error_events(traffic_type);
CREATE INDEX IF NOT EXISTS idx_error_events_client_id ON error_events(client_id);
CREATE INDEX IF NOT EXISTS idx_error_events_error_type ON error_events(error_type);
CREATE INDEX IF NOT EXISTS idx_error_events_status_code ON error_events(status_code);
CREATE INDEX IF NOT EXISTS idx_error_events_created_at ON error_events(created_at);

CREATE TABLE IF NOT EXISTS health_events (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(191) NOT NULL,
    model VARCHAR(191) NOT NULL,
    check_type VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_events_provider ON health_events(provider);
CREATE INDEX IF NOT EXISTS idx_health_events_model ON health_events(model);
CREATE INDEX IF NOT EXISTS idx_health_events_check_type ON health_events(check_type);
CREATE INDEX IF NOT EXISTS idx_health_events_status ON health_events(status);
CREATE INDEX IF NOT EXISTS idx_health_events_created_at ON health_events(created_at);

CREATE TABLE IF NOT EXISTS oauth_operations (
    id BIGSERIAL PRIMARY KEY,
    provider_key VARCHAR(191) NOT NULL,
    action VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_operations_provider_key ON oauth_operations(provider_key);
CREATE INDEX IF NOT EXISTS idx_oauth_operations_action ON oauth_operations(action);
CREATE INDEX IF NOT EXISTS idx_oauth_operations_status ON oauth_operations(status);
CREATE INDEX IF NOT EXISTS idx_oauth_operations_executed_at ON oauth_operations(executed_at);
