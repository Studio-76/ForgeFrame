-- Phase 27: native runtime responses persistence and retrieval substrate.

CREATE TABLE IF NOT EXISTS runtime_responses (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    account_id VARCHAR(64),
    request_path TEXT NOT NULL,
    processing_mode VARCHAR(32) NOT NULL,
    lifecycle_status VARCHAR(32) NOT NULL,
    background BOOLEAN NOT NULL DEFAULT FALSE,
    stream BOOLEAN NOT NULL DEFAULT FALSE,
    requested_model VARCHAR(191),
    resolved_model VARCHAR(191),
    provider_key VARCHAR(191),
    instructions TEXT,
    input_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_tool_choice JSONB,
    request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_client JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_body JSONB NOT NULL,
    error_json JSONB,
    execution_run_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT runtime_responses_processing_mode_ck
        CHECK (processing_mode IN ('sync', 'background')),
    CONSTRAINT runtime_responses_lifecycle_status_ck
        CHECK (lifecycle_status IN ('queued', 'in_progress', 'completed', 'failed', 'incomplete'))
);

CREATE UNIQUE INDEX IF NOT EXISTS runtime_responses_company_id_id_uq
    ON runtime_responses(company_id, id);

CREATE INDEX IF NOT EXISTS runtime_responses_company_status_created_idx
    ON runtime_responses(company_id, lifecycle_status, created_at);

CREATE INDEX IF NOT EXISTS runtime_responses_company_run_created_idx
    ON runtime_responses(company_id, execution_run_id, created_at);
