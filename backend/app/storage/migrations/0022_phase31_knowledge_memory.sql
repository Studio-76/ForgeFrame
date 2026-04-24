-- Phase 31: contacts, knowledge sources, and memory/context entries.

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    source_kind VARCHAR(32) NOT NULL,
    label VARCHAR(191) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    connection_target VARCHAR(400) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    visibility_scope VARCHAR(32) NOT NULL DEFAULT 'team',
    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_sources_kind_ck CHECK (source_kind IN ('mail', 'calendar', 'contacts', 'drive', 'knowledge_base')),
    CONSTRAINT knowledge_sources_status_ck CHECK (status IN ('active', 'paused', 'error')),
    CONSTRAINT knowledge_sources_visibility_ck CHECK (visibility_scope IN ('instance', 'team', 'personal', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_sources_company_id_id_uq
    ON knowledge_sources (company_id, id);
CREATE INDEX IF NOT EXISTS knowledge_sources_instance_kind_status_idx
    ON knowledge_sources (instance_id, source_kind, status);

CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    contact_ref VARCHAR(191) NOT NULL,
    source_id VARCHAR(64),
    display_name VARCHAR(191) NOT NULL,
    primary_email VARCHAR(191),
    primary_phone VARCHAR(64),
    organization VARCHAR(191),
    title VARCHAR(191),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    visibility_scope VARCHAR(32) NOT NULL DEFAULT 'team',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contacts_company_source_fk
        FOREIGN KEY (company_id, source_id) REFERENCES knowledge_sources (company_id, id) ON DELETE SET NULL,
    CONSTRAINT contacts_status_ck CHECK (status IN ('active', 'snoozed', 'archived')),
    CONSTRAINT contacts_visibility_ck CHECK (visibility_scope IN ('instance', 'team', 'personal', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_company_id_id_uq
    ON contacts (company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_company_ref_uq
    ON contacts (company_id, contact_ref);
CREATE INDEX IF NOT EXISTS contacts_instance_status_idx
    ON contacts (instance_id, status, updated_at);

CREATE TABLE IF NOT EXISTS memory_entries (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    source_id VARCHAR(64),
    contact_id VARCHAR(64),
    conversation_id VARCHAR(64),
    task_id VARCHAR(64),
    notification_id VARCHAR(64),
    workspace_id VARCHAR(64),
    memory_kind VARCHAR(32) NOT NULL,
    title VARCHAR(191) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    visibility_scope VARCHAR(32) NOT NULL DEFAULT 'team',
    sensitivity VARCHAR(32) NOT NULL DEFAULT 'normal',
    correction_note TEXT,
    supersedes_memory_id VARCHAR(64),
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT memory_entries_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT memory_entries_company_source_fk
        FOREIGN KEY (company_id, source_id) REFERENCES knowledge_sources (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_contact_fk
        FOREIGN KEY (company_id, contact_id) REFERENCES contacts (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_task_fk
        FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_notification_fk
        FOREIGN KEY (company_id, notification_id) REFERENCES notifications (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_workspace_fk
        FOREIGN KEY (company_id, workspace_id) REFERENCES workspaces (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_company_supersedes_fk
        FOREIGN KEY (company_id, supersedes_memory_id) REFERENCES memory_entries (company_id, id) ON DELETE SET NULL,
    CONSTRAINT memory_entries_supersedes_self_ck CHECK (supersedes_memory_id IS NULL OR supersedes_memory_id <> id),
    CONSTRAINT memory_entries_kind_ck CHECK (memory_kind IN ('fact', 'preference', 'constraint', 'summary')),
    CONSTRAINT memory_entries_status_ck CHECK (status IN ('active', 'corrected', 'deleted')),
    CONSTRAINT memory_entries_visibility_ck CHECK (visibility_scope IN ('instance', 'team', 'personal', 'restricted')),
    CONSTRAINT memory_entries_sensitivity_ck CHECK (sensitivity IN ('normal', 'sensitive', 'restricted')),
    CONSTRAINT memory_entries_deleted_status_ck CHECK (deleted_at IS NULL OR status = 'deleted')
);

CREATE INDEX IF NOT EXISTS memory_entries_instance_status_idx
    ON memory_entries (instance_id, status, updated_at);
CREATE INDEX IF NOT EXISTS memory_entries_company_links_idx
    ON memory_entries (company_id, source_id, contact_id, conversation_id, task_id);
