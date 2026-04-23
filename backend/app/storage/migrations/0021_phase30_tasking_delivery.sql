-- Phase 30: tasks, reminders, automations, notifications, and delivery channels.

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    task_kind VARCHAR(32) NOT NULL DEFAULT 'task',
    title VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    owner_id VARCHAR(64),
    conversation_id VARCHAR(64),
    inbox_id VARCHAR(64),
    workspace_id VARCHAR(64),
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tasks_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT tasks_task_kind_ck CHECK (task_kind IN ('task', 'follow_up')),
    CONSTRAINT tasks_status_ck CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
    CONSTRAINT tasks_priority_ck CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT tasks_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT tasks_company_inbox_fk
        FOREIGN KEY (company_id, inbox_id) REFERENCES inbox_items (company_id, id) ON DELETE SET NULL,
    CONSTRAINT tasks_company_workspace_fk
        FOREIGN KEY (company_id, workspace_id) REFERENCES workspaces (company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tasks_instance_status_due_idx
    ON tasks (instance_id, status, due_at);
CREATE INDEX IF NOT EXISTS tasks_company_links_idx
    ON tasks (company_id, conversation_id, inbox_id, workspace_id);

CREATE TABLE IF NOT EXISTS delivery_channels (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    channel_kind VARCHAR(32) NOT NULL,
    label VARCHAR(191) NOT NULL,
    target VARCHAR(400) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    fallback_channel_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT delivery_channels_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT delivery_channels_kind_ck CHECK (channel_kind IN ('in_app', 'email', 'webhook', 'slack')),
    CONSTRAINT delivery_channels_status_ck CHECK (status IN ('active', 'disabled', 'degraded')),
    CONSTRAINT delivery_channels_fallback_self_ck CHECK (fallback_channel_id IS NULL OR fallback_channel_id <> id)
);

CREATE INDEX IF NOT EXISTS delivery_channels_instance_status_idx
    ON delivery_channels (instance_id, status, updated_at);

CREATE TABLE IF NOT EXISTS automations (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    title VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    action_kind VARCHAR(32) NOT NULL,
    cadence_minutes INTEGER NOT NULL DEFAULT 60,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    target_task_id VARCHAR(64),
    target_conversation_id VARCHAR(64),
    target_inbox_id VARCHAR(64),
    target_workspace_id VARCHAR(64),
    channel_id VARCHAR(64),
    fallback_channel_id VARCHAR(64),
    preview_required BOOLEAN NOT NULL DEFAULT TRUE,
    task_template_title VARCHAR(191),
    task_template_summary TEXT,
    notification_title VARCHAR(191),
    notification_body TEXT,
    last_task_id VARCHAR(64),
    last_reminder_id VARCHAR(64),
    last_notification_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT automations_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT automations_status_ck CHECK (status IN ('active', 'paused', 'archived')),
    CONSTRAINT automations_action_kind_ck CHECK (action_kind IN ('create_follow_up', 'create_reminder', 'create_notification')),
    CONSTRAINT automations_cadence_minutes_ck CHECK (cadence_minutes >= 1 AND cadence_minutes <= 10080),
    CONSTRAINT automations_company_channel_fk
        FOREIGN KEY (company_id, channel_id) REFERENCES delivery_channels (company_id, id) ON DELETE SET NULL,
    CONSTRAINT automations_company_fallback_channel_fk
        FOREIGN KEY (company_id, fallback_channel_id) REFERENCES delivery_channels (company_id, id) ON DELETE SET NULL,
    CONSTRAINT automations_company_task_fk
        FOREIGN KEY (company_id, target_task_id) REFERENCES tasks (company_id, id) ON DELETE SET NULL,
    CONSTRAINT automations_company_conversation_fk
        FOREIGN KEY (company_id, target_conversation_id) REFERENCES conversations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT automations_company_inbox_fk
        FOREIGN KEY (company_id, target_inbox_id) REFERENCES inbox_items (company_id, id) ON DELETE SET NULL,
    CONSTRAINT automations_company_workspace_fk
        FOREIGN KEY (company_id, target_workspace_id) REFERENCES workspaces (company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS automations_instance_status_next_run_idx
    ON automations (instance_id, status, next_run_at);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64),
    reminder_id VARCHAR(64),
    conversation_id VARCHAR(64),
    inbox_id VARCHAR(64),
    workspace_id VARCHAR(64),
    channel_id VARCHAR(64),
    fallback_channel_id VARCHAR(64),
    title VARCHAR(191) NOT NULL,
    body TEXT NOT NULL,
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    preview_required BOOLEAN NOT NULL DEFAULT TRUE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT notifications_delivery_status_ck CHECK (delivery_status IN ('draft', 'preview', 'confirmed', 'queued', 'delivering', 'delivered', 'failed', 'fallback_queued', 'rejected', 'cancelled')),
    CONSTRAINT notifications_priority_ck CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT notifications_retry_count_ck CHECK (retry_count >= 0),
    CONSTRAINT notifications_max_retries_ck CHECK (max_retries >= 0),
    CONSTRAINT notifications_company_task_fk
        FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id) ON DELETE SET NULL,
    CONSTRAINT notifications_company_channel_fk
        FOREIGN KEY (company_id, channel_id) REFERENCES delivery_channels (company_id, id) ON DELETE SET NULL,
    CONSTRAINT notifications_company_fallback_channel_fk
        FOREIGN KEY (company_id, fallback_channel_id) REFERENCES delivery_channels (company_id, id) ON DELETE SET NULL,
    CONSTRAINT notifications_company_conversation_fk
        FOREIGN KEY (company_id, conversation_id) REFERENCES conversations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT notifications_company_inbox_fk
        FOREIGN KEY (company_id, inbox_id) REFERENCES inbox_items (company_id, id) ON DELETE SET NULL,
    CONSTRAINT notifications_company_workspace_fk
        FOREIGN KEY (company_id, workspace_id) REFERENCES workspaces (company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS notifications_instance_status_attempt_idx
    ON notifications (instance_id, delivery_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS notifications_company_links_idx
    ON notifications (company_id, task_id, reminder_id, conversation_id, inbox_id);

CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64),
    automation_id VARCHAR(64),
    notification_id VARCHAR(64),
    title VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    due_at TIMESTAMPTZ NOT NULL,
    triggered_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reminders_company_id_id_uq UNIQUE (company_id, id),
    CONSTRAINT reminders_status_ck CHECK (status IN ('scheduled', 'due', 'triggered', 'dismissed', 'cancelled')),
    CONSTRAINT reminders_company_task_fk
        FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id) ON DELETE SET NULL,
    CONSTRAINT reminders_company_automation_fk
        FOREIGN KEY (company_id, automation_id) REFERENCES automations (company_id, id) ON DELETE SET NULL,
    CONSTRAINT reminders_company_notification_fk
        FOREIGN KEY (company_id, notification_id) REFERENCES notifications (company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reminders_instance_status_due_idx
    ON reminders (instance_id, status, due_at);
