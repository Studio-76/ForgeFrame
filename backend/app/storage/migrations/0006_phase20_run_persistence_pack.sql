-- Phase 20: transactional run-persistence substrate for execution orchestration.

CREATE TABLE IF NOT EXISTS secret_references (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    workspace_id VARCHAR(64),
    company_secret_id VARCHAR(64),
    provider_key VARCHAR(191) NOT NULL,
    secret_kind VARCHAR(64) NOT NULL,
    reference_locator TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    rotation_status VARCHAR(32) NOT NULL DEFAULT 'active',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    last_verified_at TIMESTAMPTZ,
    redaction_profile VARCHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT secret_references_version_positive_ck CHECK (version >= 1),
    CONSTRAINT secret_references_rotation_status_ck CHECK (rotation_status IN ('active', 'rotating', 'revoked', 'retired')),
    CONSTRAINT secret_references_verification_status_ck CHECK (verification_status IN ('pending', 'verified', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS secret_references_company_id_id_uq
    ON secret_references(company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS secret_references_company_locator_version_uq
    ON secret_references(company_id, provider_key, secret_kind, reference_locator, version);
CREATE INDEX IF NOT EXISTS secret_references_company_workspace_provider_kind_idx
    ON secret_references(company_id, workspace_id, provider_key, secret_kind);

CREATE TABLE IF NOT EXISTS runs (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    workspace_id VARCHAR(64),
    issue_id VARCHAR(64),
    run_kind VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'queued',
    status_reason TEXT,
    active_attempt_no INTEGER NOT NULL DEFAULT 1,
    current_attempt_id VARCHAR(64),
    current_approval_link_id VARCHAR(64),
    latest_command_id VARCHAR(64),
    current_step_key VARCHAR(191),
    result_summary JSONB,
    failure_class VARCHAR(32),
    next_wakeup_at TIMESTAMPTZ,
    cancel_requested_at TIMESTAMPTZ,
    terminal_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT runs_active_attempt_no_positive_ck CHECK (active_attempt_no >= 1),
    CONSTRAINT runs_version_nonnegative_ck CHECK (version >= 0),
    CONSTRAINT runs_state_ck CHECK (state IN ('queued', 'dispatching', 'executing', 'waiting_on_approval', 'cancel_requested', 'retry_backoff', 'compensating', 'succeeded', 'failed', 'cancelled', 'timed_out', 'compensated', 'dead_lettered')),
    CONSTRAINT runs_failure_class_ck CHECK (failure_class IS NULL OR failure_class IN ('validation', 'policy', 'provider_transient', 'provider_terminal', 'timeout', 'cancelled', 'internal'))
);

CREATE UNIQUE INDEX IF NOT EXISTS runs_company_id_id_uq
    ON runs(company_id, id);
CREATE INDEX IF NOT EXISTS runs_company_state_next_wakeup_idx
    ON runs(company_id, state, next_wakeup_at);
CREATE INDEX IF NOT EXISTS runs_company_issue_created_idx
    ON runs(company_id, issue_id, created_at);
CREATE INDEX IF NOT EXISTS runs_company_current_approval_idx
    ON runs(company_id, current_approval_link_id);

CREATE TABLE IF NOT EXISTS run_commands (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64),
    command_type VARCHAR(32) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(191) NOT NULL,
    request_fingerprint_hash VARCHAR(191) NOT NULL,
    command_status VARCHAR(32) NOT NULL DEFAULT 'accepted',
    accepted_transition VARCHAR(64),
    response_snapshot JSONB,
    expires_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_commands_command_type_ck CHECK (command_type IN ('create', 'cancel', 'retry', 'approval_resume', 'approval_reject', 'timeout_reconcile', 'webhook_reconcile')),
    CONSTRAINT run_commands_actor_type_ck CHECK (actor_type IN ('agent', 'user', 'system')),
    CONSTRAINT run_commands_command_status_ck CHECK (command_status IN ('accepted', 'rejected', 'completed')),
    CONSTRAINT run_commands_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS run_commands_company_idempotency_uq
    ON run_commands(company_id, actor_type, actor_id, command_type, idempotency_key);
CREATE INDEX IF NOT EXISTS run_commands_company_run_issued_idx
    ON run_commands(company_id, run_id, issued_at);
CREATE INDEX IF NOT EXISTS run_commands_company_expires_idx
    ON run_commands(company_id, expires_at)
    WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS run_attempts (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    attempt_no INTEGER NOT NULL,
    attempt_state VARCHAR(32) NOT NULL DEFAULT 'queued',
    worker_key VARCHAR(191),
    lease_token VARCHAR(64),
    lease_acquired_at TIMESTAMPTZ,
    lease_expires_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    backoff_until TIMESTAMPTZ,
    execution_deadline_at TIMESTAMPTZ,
    last_error_code VARCHAR(64),
    last_error_detail TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_attempts_attempt_no_positive_ck CHECK (attempt_no >= 1),
    CONSTRAINT run_attempts_retry_count_nonnegative_ck CHECK (retry_count >= 0),
    CONSTRAINT run_attempts_version_nonnegative_ck CHECK (version >= 0),
    CONSTRAINT run_attempts_attempt_state_ck CHECK (attempt_state IN ('queued', 'dispatching', 'executing', 'waiting_on_approval', 'cancel_requested', 'retry_backoff', 'compensating', 'succeeded', 'failed', 'cancelled', 'timed_out', 'compensated', 'dead_lettered')),
    CONSTRAINT run_attempts_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS run_attempts_company_id_id_uq
    ON run_attempts(company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS run_attempts_company_run_attempt_no_uq
    ON run_attempts(company_id, run_id, attempt_no);
CREATE INDEX IF NOT EXISTS run_attempts_company_scheduled_idx
    ON run_attempts(company_id, scheduled_at)
    WHERE attempt_state IN ('queued', 'retry_backoff');
CREATE INDEX IF NOT EXISTS run_attempts_company_lease_expiry_idx
    ON run_attempts(company_id, lease_expires_at)
    WHERE attempt_state IN ('dispatching', 'executing', 'cancel_requested', 'compensating');

CREATE TABLE IF NOT EXISTS run_approval_links (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    attempt_id VARCHAR(64) NOT NULL,
    approval_id VARCHAR(64) NOT NULL,
    gate_key VARCHAR(191) NOT NULL,
    gate_status VARCHAR(32) NOT NULL DEFAULT 'open',
    resume_disposition VARCHAR(32) NOT NULL DEFAULT 'resume',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    resume_enqueued_at TIMESTAMPTZ,
    decision_actor_type VARCHAR(32),
    decision_actor_id VARCHAR(64),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_approval_links_version_nonnegative_ck CHECK (version >= 0),
    CONSTRAINT run_approval_links_gate_status_ck CHECK (gate_status IN ('open', 'approved', 'rejected', 'timed_out', 'cancelled')),
    CONSTRAINT run_approval_links_resume_disposition_ck CHECK (resume_disposition IN ('resume', 'fail', 'compensate', 'cancel')),
    CONSTRAINT run_approval_links_decision_actor_type_ck CHECK (decision_actor_type IS NULL OR decision_actor_type IN ('agent', 'user', 'system')),
    CONSTRAINT run_approval_links_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id)
        ON DELETE CASCADE,
    CONSTRAINT run_approval_links_company_attempt_fk
        FOREIGN KEY (company_id, attempt_id)
        REFERENCES run_attempts(company_id, id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS run_approval_links_company_approval_uq
    ON run_approval_links(company_id, approval_id);
CREATE INDEX IF NOT EXISTS run_approval_links_company_run_opened_idx
    ON run_approval_links(company_id, run_id, opened_at);
CREATE INDEX IF NOT EXISTS run_approval_links_company_gate_status_opened_idx
    ON run_approval_links(company_id, gate_status, opened_at);

CREATE TABLE IF NOT EXISTS run_outbox (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64),
    attempt_id VARCHAR(64),
    event_type VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL,
    publish_state VARCHAR(32) NOT NULL DEFAULT 'pending',
    dedupe_key VARCHAR(191) NOT NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token VARCHAR(64),
    lease_expires_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    dead_lettered_at TIMESTAMPTZ,
    last_publish_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_outbox_publish_attempts_nonnegative_ck CHECK (publish_attempts >= 0),
    CONSTRAINT run_outbox_event_type_ck CHECK (event_type IN ('run_dispatch', 'run_resume', 'run_cancel', 'approval_notify', 'timeout_check', 'dead_letter', 'webhook_reconcile')),
    CONSTRAINT run_outbox_publish_state_ck CHECK (publish_state IN ('pending', 'leased', 'published', 'dead')),
    CONSTRAINT run_outbox_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id),
    CONSTRAINT run_outbox_company_attempt_fk
        FOREIGN KEY (company_id, attempt_id)
        REFERENCES run_attempts(company_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS run_outbox_company_dedupe_uq
    ON run_outbox(company_id, dedupe_key);
CREATE INDEX IF NOT EXISTS run_outbox_company_available_idx
    ON run_outbox(company_id, available_at)
    WHERE publish_state = 'pending';
CREATE INDEX IF NOT EXISTS run_outbox_company_lease_expiry_idx
    ON run_outbox(company_id, lease_expires_at)
    WHERE publish_state = 'leased';
CREATE INDEX IF NOT EXISTS run_outbox_company_run_created_idx
    ON run_outbox(company_id, run_id, created_at);

CREATE TABLE IF NOT EXISTS run_external_calls (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    attempt_id VARCHAR(64) NOT NULL,
    step_key VARCHAR(191) NOT NULL,
    provider_key VARCHAR(191) NOT NULL,
    operation_key VARCHAR(191) NOT NULL,
    provider_request_id VARCHAR(191),
    correlation_id VARCHAR(191) NOT NULL,
    call_status VARCHAR(32) NOT NULL DEFAULT 'started',
    idempotency_token VARCHAR(191),
    request_summary JSONB,
    response_summary JSONB,
    http_status INTEGER,
    error_code VARCHAR(64),
    error_class VARCHAR(64),
    error_detail TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_external_calls_call_status_ck CHECK (call_status IN ('started', 'succeeded', 'retryable_failure', 'terminal_failure', 'cancel_requested', 'cancelled')),
    CONSTRAINT run_external_calls_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id)
        ON DELETE CASCADE,
    CONSTRAINT run_external_calls_company_attempt_fk
        FOREIGN KEY (company_id, attempt_id)
        REFERENCES run_attempts(company_id, id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS run_external_calls_company_run_started_idx
    ON run_external_calls(company_id, run_id, started_at);
CREATE INDEX IF NOT EXISTS run_external_calls_company_provider_request_idx
    ON run_external_calls(company_id, provider_key, provider_request_id);
CREATE INDEX IF NOT EXISTS run_external_calls_company_correlation_idx
    ON run_external_calls(company_id, correlation_id);

CREATE TABLE IF NOT EXISTS run_secret_bindings (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    attempt_id VARCHAR(64) NOT NULL,
    step_key VARCHAR(191) NOT NULL,
    secret_reference_id VARCHAR(64) NOT NULL,
    required_version INTEGER NOT NULL,
    purpose VARCHAR(64) NOT NULL,
    binding_status VARCHAR(32) NOT NULL DEFAULT 'declared',
    materialized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT run_secret_bindings_required_version_positive_ck CHECK (required_version >= 1),
    CONSTRAINT run_secret_bindings_binding_status_ck CHECK (binding_status IN ('declared', 'materialized', 'expired', 'revoked')),
    CONSTRAINT run_secret_bindings_purpose_ck CHECK (purpose IN ('provider_api_key', 'oauth_access_token', 'oauth_refresh_token', 'webhook_signing_secret', 'session_token')),
    CONSTRAINT run_secret_bindings_company_run_fk
        FOREIGN KEY (company_id, run_id)
        REFERENCES runs(company_id, id)
        ON DELETE CASCADE,
    CONSTRAINT run_secret_bindings_company_attempt_fk
        FOREIGN KEY (company_id, attempt_id)
        REFERENCES run_attempts(company_id, id)
        ON DELETE CASCADE,
    CONSTRAINT run_secret_bindings_company_secret_reference_fk
        FOREIGN KEY (company_id, secret_reference_id)
        REFERENCES secret_references(company_id, id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS run_secret_bindings_company_attempt_step_secret_uq
    ON run_secret_bindings(company_id, attempt_id, step_key, secret_reference_id);
CREATE INDEX IF NOT EXISTS run_secret_bindings_company_run_created_idx
    ON run_secret_bindings(company_id, run_id, created_at);
