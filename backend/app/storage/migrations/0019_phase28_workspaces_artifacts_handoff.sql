CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    issue_id VARCHAR(191),
    title VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL,
    preview_status VARCHAR(32) NOT NULL,
    review_status VARCHAR(32) NOT NULL,
    handoff_status VARCHAR(32) NOT NULL,
    owner_type VARCHAR(32) NOT NULL DEFAULT 'system',
    owner_id VARCHAR(64),
    active_run_id VARCHAR(64),
    latest_approval_id VARCHAR(191),
    preview_artifact_id VARCHAR(64),
    handoff_artifact_id VARCHAR(64),
    pr_reference TEXT,
    handoff_reference TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_company_id_id_uq ON workspaces (company_id, id);
CREATE INDEX IF NOT EXISTS workspaces_instance_status_idx ON workspaces (instance_id, status, updated_at);
CREATE INDEX IF NOT EXISTS workspaces_company_issue_idx ON workspaces (company_id, issue_id, updated_at);

CREATE TABLE IF NOT EXISTS artifacts (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    workspace_id VARCHAR(64),
    artifact_type VARCHAR(64) NOT NULL,
    label VARCHAR(191) NOT NULL,
    uri TEXT NOT NULL,
    media_type VARCHAR(191),
    preview_url TEXT,
    size_bytes INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by_type VARCHAR(32) NOT NULL DEFAULT 'system',
    created_by_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_company_id_id_uq ON artifacts (company_id, id);
CREATE INDEX IF NOT EXISTS artifacts_company_workspace_created_idx ON artifacts (company_id, workspace_id, created_at);
CREATE INDEX IF NOT EXISTS artifacts_instance_status_created_idx ON artifacts (instance_id, status, created_at);

CREATE TABLE IF NOT EXISTS artifact_attachments (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64) NOT NULL,
    target_kind VARCHAR(32) NOT NULL,
    target_id VARCHAR(191) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'related',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS artifact_attachments_company_artifact_target_role_uq
    ON artifact_attachments (company_id, artifact_id, target_kind, target_id, role);
CREATE INDEX IF NOT EXISTS artifact_attachments_target_lookup_idx
    ON artifact_attachments (company_id, target_kind, target_id, created_at);

CREATE TABLE IF NOT EXISTS workspace_events (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    workspace_id VARCHAR(64) NOT NULL,
    event_kind VARCHAR(32) NOT NULL,
    note TEXT,
    artifact_id VARCHAR(64),
    approval_id VARCHAR(191),
    run_id VARCHAR(64),
    actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
    actor_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_events_company_workspace_created_idx
    ON workspace_events (company_id, workspace_id, created_at);
