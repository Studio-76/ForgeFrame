CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    workspace_id VARCHAR(64),
    subject VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    triage_status VARCHAR(32) NOT NULL DEFAULT 'new',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    contact_ref VARCHAR(191),
    run_id VARCHAR(64),
    artifact_id VARCHAR(64),
    approval_id VARCHAR(191),
    decision_id VARCHAR(191),
    active_thread_id VARCHAR(64),
    latest_message_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversations_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT conversations_status_ck CHECK (status IN ('open', 'paused', 'closed', 'archived')),
    CONSTRAINT conversations_triage_status_ck CHECK (triage_status IN ('new', 'relevant', 'delegated', 'blocked', 'done')),
    CONSTRAINT conversations_priority_ck CHECK (priority IN ('low', 'normal', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS conversations_instance_triage_updated_idx ON conversations (instance_id, triage_status, updated_at);
CREATE INDEX IF NOT EXISTS conversations_company_links_idx ON conversations (company_id, workspace_id, run_id, approval_id);

CREATE TABLE IF NOT EXISTS conversation_threads (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    title VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    latest_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_threads_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT conversation_threads_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE CASCADE,
    CONSTRAINT conversation_threads_status_ck CHECK (status IN ('open', 'closed', 'archived'))
);

CREATE INDEX IF NOT EXISTS conversation_threads_company_conversation_updated_idx
    ON conversation_threads (company_id, conversation_id, updated_at);

CREATE TABLE IF NOT EXISTS conversation_sessions (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(64) NOT NULL,
    session_kind VARCHAR(32) NOT NULL DEFAULT 'operator',
    continuity_key VARCHAR(191),
    started_by_type VARCHAR(32) NOT NULL DEFAULT 'system',
    started_by_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    CONSTRAINT conversation_sessions_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE CASCADE,
    CONSTRAINT conversation_sessions_company_thread_fk
        FOREIGN KEY (company_id, thread_id) REFERENCES conversation_threads (company_id, id) ON DELETE CASCADE,
    CONSTRAINT conversation_sessions_kind_ck CHECK (session_kind IN ('runtime', 'operator', 'assistant', 'external'))
);

CREATE INDEX IF NOT EXISTS conversation_sessions_company_thread_started_idx
    ON conversation_sessions (company_id, thread_id, started_at);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64),
    message_role VARCHAR(32) NOT NULL DEFAULT 'system',
    author_type VARCHAR(32) NOT NULL DEFAULT 'system',
    author_id VARCHAR(64),
    body TEXT NOT NULL,
    structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_messages_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE CASCADE,
    CONSTRAINT conversation_messages_company_thread_fk
        FOREIGN KEY (company_id, thread_id) REFERENCES conversation_threads (company_id, id) ON DELETE CASCADE,
    CONSTRAINT conversation_messages_role_ck CHECK (message_role IN ('user', 'assistant', 'system', 'operator', 'tool'))
);

CREATE INDEX IF NOT EXISTS conversation_messages_company_thread_created_idx
    ON conversation_messages (company_id, thread_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_messages_company_session_created_idx
    ON conversation_messages (company_id, session_id, created_at);

CREATE TABLE IF NOT EXISTS inbox_items (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64),
    thread_id VARCHAR(64),
    workspace_id VARCHAR(64),
    title VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    triage_status VARCHAR(32) NOT NULL DEFAULT 'new',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    contact_ref VARCHAR(191),
    run_id VARCHAR(64),
    artifact_id VARCHAR(64),
    approval_id VARCHAR(191),
    decision_id VARCHAR(191),
    latest_message_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inbox_items_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT inbox_items_company_thread_fk
        FOREIGN KEY (company_id, thread_id) REFERENCES conversation_threads (company_id, id) ON DELETE SET NULL,
    CONSTRAINT inbox_items_triage_status_ck CHECK (triage_status IN ('new', 'relevant', 'delegated', 'blocked', 'done')),
    CONSTRAINT inbox_items_priority_ck CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT inbox_items_status_ck CHECK (status IN ('open', 'snoozed', 'closed', 'archived'))
);

CREATE INDEX IF NOT EXISTS inbox_items_instance_triage_updated_idx
    ON inbox_items (instance_id, triage_status, updated_at);
CREATE INDEX IF NOT EXISTS inbox_items_company_links_idx
    ON inbox_items (company_id, conversation_id, thread_id, workspace_id);
