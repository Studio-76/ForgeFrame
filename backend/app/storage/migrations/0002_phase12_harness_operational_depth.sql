-- Phase 12: deepen harness operational persistence.

ALTER TABLE harness_profiles ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE harness_runs ADD COLUMN IF NOT EXISTS run_id VARCHAR(40);
ALTER TABLE harness_runs ADD COLUMN IF NOT EXISTS client_id VARCHAR(128);
ALTER TABLE harness_runs ADD COLUMN IF NOT EXISTS consumer VARCHAR(128);
ALTER TABLE harness_runs ADD COLUMN IF NOT EXISTS integration VARCHAR(128);

UPDATE harness_runs SET run_id = CONCAT('run_', id::text) WHERE run_id IS NULL;
ALTER TABLE harness_runs ALTER COLUMN run_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_harness_runs_run_id ON harness_runs(run_id);

CREATE TABLE IF NOT EXISTS harness_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_type VARCHAR(32) NOT NULL DEFAULT 'periodic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_harness_snapshots_created_at ON harness_snapshots(created_at DESC);
