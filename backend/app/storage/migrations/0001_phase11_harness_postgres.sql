-- Phase 11 initial PostgreSQL schema for harness control-plane persistence.

CREATE TABLE IF NOT EXISTS harness_profiles (
  provider_key VARCHAR(191) PRIMARY KEY,
  payload JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'draft',
  integration_class VARCHAR(64) NOT NULL,
  last_verify_status VARCHAR(32) NOT NULL DEFAULT 'never',
  last_probe_status VARCHAR(32) NOT NULL DEFAULT 'never',
  last_sync_status VARCHAR(32) NOT NULL DEFAULT 'never',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS harness_runs (
  id BIGSERIAL PRIMARY KEY,
  provider_key VARCHAR(191) NOT NULL,
  integration_class VARCHAR(64) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  success BOOLEAN NOT NULL,
  error TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_harness_runs_provider_key ON harness_runs(provider_key);
CREATE INDEX IF NOT EXISTS idx_harness_runs_executed_at ON harness_runs(executed_at DESC);
