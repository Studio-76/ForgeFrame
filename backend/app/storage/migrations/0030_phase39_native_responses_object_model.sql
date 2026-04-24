-- Phase 39: native /v1/responses object model substrate.

CREATE TABLE IF NOT EXISTS native_responses (
    response_id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    instance_id VARCHAR(64) NOT NULL,
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
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_json JSONB,
    output_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT native_responses_processing_mode_ck
        CHECK (processing_mode IN ('sync', 'background')),
    CONSTRAINT native_responses_lifecycle_status_ck
        CHECK (lifecycle_status IN ('queued', 'in_progress', 'completed', 'failed', 'incomplete'))
);

CREATE UNIQUE INDEX IF NOT EXISTS native_responses_company_id_id_uq
    ON native_responses(company_id, response_id);

CREATE INDEX IF NOT EXISTS native_responses_company_status_created_idx
    ON native_responses(company_id, lifecycle_status, created_at);

CREATE TABLE IF NOT EXISTS native_response_items (
    row_id VARCHAR(96) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    item_index INTEGER NOT NULL,
    item_id VARCHAR(96),
    item_type VARCHAR(64) NOT NULL,
    role VARCHAR(32),
    status VARCHAR(32),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT native_response_items_phase_ck
        CHECK (phase IN ('input', 'output'))
);

CREATE INDEX IF NOT EXISTS native_response_items_company_response_phase_idx
    ON native_response_items(company_id, response_id, phase, item_index);

CREATE TABLE IF NOT EXISTS native_response_events (
    event_id VARCHAR(96) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    sequence_no INTEGER NOT NULL,
    event_type VARCHAR(96) NOT NULL,
    lifecycle_status VARCHAR(32),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS native_response_events_company_response_seq_idx
    ON native_response_events(company_id, response_id, sequence_no);

CREATE TABLE IF NOT EXISTS native_response_tool_calls (
    row_id VARCHAR(120) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    item_id VARCHAR(96),
    call_id VARCHAR(96) NOT NULL,
    name VARCHAR(191) NOT NULL,
    arguments_text TEXT NOT NULL DEFAULT '',
    status VARCHAR(32),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS native_response_tool_calls_company_response_idx
    ON native_response_tool_calls(company_id, response_id, phase);

CREATE TABLE IF NOT EXISTS native_response_tool_outputs (
    row_id VARCHAR(120) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    call_id VARCHAR(96) NOT NULL,
    output_index INTEGER NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS native_response_tool_outputs_company_response_idx
    ON native_response_tool_outputs(company_id, response_id, call_id);

CREATE TABLE IF NOT EXISTS native_response_follow_objects (
    row_id VARCHAR(120) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    object_kind VARCHAR(64) NOT NULL,
    object_id VARCHAR(96) NOT NULL,
    relation VARCHAR(64) NOT NULL,
    lifecycle_state VARCHAR(64),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS native_response_follow_objects_company_response_idx
    ON native_response_follow_objects(company_id, response_id, relation);

CREATE TABLE IF NOT EXISTS native_response_stream_events (
    event_id VARCHAR(120) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    response_id VARCHAR(64) NOT NULL,
    sequence_no INTEGER NOT NULL,
    event_name VARCHAR(96) NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS native_response_stream_events_company_response_seq_idx
    ON native_response_stream_events(company_id, response_id, sequence_no);

CREATE TABLE IF NOT EXISTS native_response_mappings (
    response_id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS native_response_mappings_company_response_uq
    ON native_response_mappings(company_id, response_id);
