CREATE TABLE IF NOT EXISTS instances (
    instance_id VARCHAR(191) PRIMARY KEY,
    slug VARCHAR(191) NOT NULL UNIQUE,
    display_name VARCHAR(191) NOT NULL,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    tenant_id VARCHAR(191) NOT NULL UNIQUE,
    company_id VARCHAR(191) NOT NULL UNIQUE,
    deployment_mode VARCHAR(64) NOT NULL DEFAULT 'restricted_eval',
    exposure_mode VARCHAR(64) NOT NULL DEFAULT 'local_only',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS instances_status_idx
    ON instances(status, updated_at DESC);
