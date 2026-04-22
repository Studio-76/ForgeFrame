CREATE TABLE IF NOT EXISTS request_idempotency_records (
    id VARCHAR(64) PRIMARY KEY,
    scope_key VARCHAR(191) NOT NULL,
    subject_key VARCHAR(191) NOT NULL,
    request_path TEXT NOT NULL,
    idempotency_key VARCHAR(191) NOT NULL,
    request_fingerprint_hash VARCHAR(191) NOT NULL,
    record_state VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    request_metadata JSONB,
    response_status_code INTEGER,
    response_headers JSONB,
    response_body JSONB,
    resource_type VARCHAR(64),
    resource_id VARCHAR(64),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_idempotency_records_state_ck
        CHECK (record_state IN ('in_progress', 'completed')),
    CONSTRAINT request_idempotency_records_status_code_ck
        CHECK (response_status_code IS NULL OR (response_status_code >= 100 AND response_status_code <= 599))
);

CREATE UNIQUE INDEX IF NOT EXISTS request_idempotency_records_scope_subject_key_uq
    ON request_idempotency_records(scope_key, subject_key, idempotency_key);

CREATE INDEX IF NOT EXISTS request_idempotency_records_expires_idx
    ON request_idempotency_records(expires_at)
    WHERE expires_at IS NOT NULL;
