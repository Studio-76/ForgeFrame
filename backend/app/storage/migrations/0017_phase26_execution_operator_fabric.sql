-- Phase 26: execution operator fabric state, lanes, and lease truth.

ALTER TABLE runs
    ADD COLUMN IF NOT EXISTS execution_lane VARCHAR(64) NOT NULL DEFAULT 'background_agentic',
    ADD COLUMN IF NOT EXISTS operator_state VARCHAR(32) NOT NULL DEFAULT 'admitted';

ALTER TABLE run_attempts
    ADD COLUMN IF NOT EXISTS operator_state VARCHAR(32) NOT NULL DEFAULT 'admitted',
    ADD COLUMN IF NOT EXISTS lease_status VARCHAR(32) NOT NULL DEFAULT 'not_leased';

ALTER TABLE runs
    DROP CONSTRAINT IF EXISTS runs_execution_lane_ck,
    DROP CONSTRAINT IF EXISTS runs_operator_state_ck,
    ADD CONSTRAINT runs_execution_lane_ck
        CHECK (execution_lane IN ('interactive_low_latency', 'interactive_heavy', 'background_agentic', 'oauth_serialized')),
    ADD CONSTRAINT runs_operator_state_ck
        CHECK (operator_state IN ('admitted', 'leased', 'executing', 'waiting_external', 'waiting_on_approval', 'paused', 'interrupted', 'retry_scheduled', 'completed', 'quarantined', 'failed', 'cancel_requested', 'compensating'));

ALTER TABLE run_attempts
    DROP CONSTRAINT IF EXISTS run_attempts_operator_state_ck,
    DROP CONSTRAINT IF EXISTS run_attempts_lease_status_ck,
    ADD CONSTRAINT run_attempts_operator_state_ck
        CHECK (operator_state IN ('admitted', 'leased', 'executing', 'waiting_external', 'waiting_on_approval', 'paused', 'interrupted', 'retry_scheduled', 'completed', 'quarantined', 'failed', 'cancel_requested', 'compensating')),
    ADD CONSTRAINT run_attempts_lease_status_ck
        CHECK (lease_status IN ('not_leased', 'leased', 'released', 'expired'));

ALTER TABLE run_commands
    DROP CONSTRAINT IF EXISTS run_commands_command_type_ck,
    ADD CONSTRAINT run_commands_command_type_ck
        CHECK (command_type IN ('create', 'cancel', 'retry', 'pause', 'resume', 'interrupt', 'restart_from_scratch', 'quarantine', 'escalate', 'approval_resume', 'approval_reject', 'timeout_reconcile', 'webhook_reconcile'));

UPDATE runs
SET operator_state = CASE
    WHEN state = 'queued' THEN 'admitted'
    WHEN state = 'dispatching' THEN 'leased'
    WHEN state = 'executing' THEN 'waiting_external'
    WHEN state = 'waiting_on_approval' THEN 'waiting_on_approval'
    WHEN state = 'cancel_requested' THEN 'cancel_requested'
    WHEN state = 'retry_backoff' THEN 'retry_scheduled'
    WHEN state = 'succeeded' THEN 'completed'
    WHEN state = 'dead_lettered' THEN 'quarantined'
    ELSE state
END
WHERE operator_state IS NULL
   OR operator_state = 'admitted';

UPDATE run_attempts
SET operator_state = CASE
    WHEN attempt_state = 'queued' THEN 'admitted'
    WHEN attempt_state = 'dispatching' THEN 'leased'
    WHEN attempt_state = 'executing' THEN 'waiting_external'
    WHEN attempt_state = 'waiting_on_approval' THEN 'waiting_on_approval'
    WHEN attempt_state = 'cancel_requested' THEN 'cancel_requested'
    WHEN attempt_state = 'retry_backoff' THEN 'retry_scheduled'
    WHEN attempt_state = 'succeeded' THEN 'completed'
    WHEN attempt_state = 'dead_lettered' THEN 'quarantined'
    ELSE attempt_state
END,
lease_status = CASE
    WHEN lease_token IS NOT NULL THEN 'leased'
    WHEN lease_expires_at IS NOT NULL AND lease_expires_at < NOW() THEN 'expired'
    ELSE 'not_leased'
END
WHERE operator_state IS NULL
   OR operator_state = 'admitted'
   OR lease_status IS NULL
   OR lease_status = 'not_leased';

CREATE INDEX IF NOT EXISTS runs_company_lane_operator_idx
    ON runs(company_id, execution_lane, operator_state);

CREATE INDEX IF NOT EXISTS run_attempts_company_operator_state_idx
    ON run_attempts(company_id, operator_state, scheduled_at);
