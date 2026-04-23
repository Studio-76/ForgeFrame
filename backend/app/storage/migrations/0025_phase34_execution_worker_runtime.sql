-- Phase 34: dedicated execution worker registry and background response reconstruction substrate.

CREATE TABLE IF NOT EXISTS execution_workers (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    instance_id VARCHAR(64) NOT NULL,
    worker_key VARCHAR(191) NOT NULL,
    execution_lane VARCHAR(64) NOT NULL DEFAULT 'background_agentic',
    worker_state VARCHAR(32) NOT NULL DEFAULT 'starting',
    active_attempts INTEGER NOT NULL DEFAULT 0,
    current_run_id VARCHAR(64),
    current_attempt_id VARCHAR(64),
    lease_token VARCHAR(64),
    process_id INTEGER,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    last_claimed_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    heartbeat_expires_at TIMESTAMPTZ,
    last_error_code VARCHAR(64),
    last_error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT execution_workers_active_attempts_nonnegative_ck
        CHECK (active_attempts >= 0),
    CONSTRAINT execution_workers_execution_lane_ck
        CHECK (execution_lane IN ('interactive_low_latency', 'interactive_heavy', 'background_agentic', 'oauth_serialized')),
    CONSTRAINT execution_workers_worker_state_ck
        CHECK (worker_state IN ('starting', 'idle', 'busy', 'stopping', 'stopped', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_workers_company_worker_key_uq
    ON execution_workers(company_id, worker_key);

CREATE INDEX IF NOT EXISTS execution_workers_company_state_heartbeat_idx
    ON execution_workers(company_id, worker_state, heartbeat_expires_at);

CREATE INDEX IF NOT EXISTS execution_workers_company_current_attempt_idx
    ON execution_workers(company_id, current_attempt_id);

ALTER TABLE runtime_responses
    ADD COLUMN IF NOT EXISTS instance_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS request_controls JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE runtime_responses
SET instance_id = company_id
WHERE instance_id IS NULL;

ALTER TABLE runtime_responses
    ALTER COLUMN instance_id SET NOT NULL;
