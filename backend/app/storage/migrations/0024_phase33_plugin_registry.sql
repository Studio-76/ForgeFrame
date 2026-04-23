-- Phase 33: plugin manifest registry and instance bindings.

CREATE TABLE IF NOT EXISTS plugin_manifests (
    plugin_id VARCHAR(191) PRIMARY KEY,
    display_name VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    vendor VARCHAR(191) NOT NULL DEFAULT 'customer',
    version VARCHAR(64) NOT NULL DEFAULT '0.1.0',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    ui_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    api_mounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    runtime_surfaces JSONB NOT NULL DEFAULT '[]'::jsonb,
    config_schema JSONB NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
    default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    security_posture JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT plugin_manifests_status_ck CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS instance_plugin_bindings (
    id BIGSERIAL PRIMARY KEY,
    plugin_id VARCHAR(191) NOT NULL REFERENCES plugin_manifests (plugin_id) ON DELETE CASCADE,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(191) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled_ui_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled_api_mounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS instance_plugin_bindings_instance_plugin_uq
    ON instance_plugin_bindings (instance_id, plugin_id);
CREATE INDEX IF NOT EXISTS instance_plugin_bindings_company_plugin_idx
    ON instance_plugin_bindings (company_id, plugin_id);
