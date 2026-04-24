-- Phase 35: agent registry, structured conversation agent references, skills, learning loop, and memory truth extensions.

CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(191) NOT NULL,
    default_name VARCHAR(191) NOT NULL,
    role_kind VARCHAR(32) NOT NULL DEFAULT 'specialist',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    participation_mode VARCHAR(32) NOT NULL DEFAULT 'direct',
    allowed_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    assistant_profile_id VARCHAR(64),
    is_default_operator BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agents_role_kind_ck CHECK (role_kind IN ('operator', 'specialist', 'reviewer', 'worker', 'observer')),
    CONSTRAINT agents_status_ck CHECK (status IN ('active', 'paused', 'archived')),
    CONSTRAINT agents_participation_mode_ck CHECK (participation_mode IN ('direct', 'mentioned_only', 'roundtable', 'handoff_only'))
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_company_id_id_uq
    ON agents(company_id, id);

CREATE INDEX IF NOT EXISTS agents_instance_status_idx
    ON agents(instance_id, status, updated_at);

CREATE INDEX IF NOT EXISTS agents_instance_default_operator_idx
    ON agents(instance_id, is_default_operator);

CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    scope VARCHAR(32) NOT NULL DEFAULT 'instance',
    scope_agent_id VARCHAR(64),
    current_version_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    activation_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    instruction_core TEXT NOT NULL,
    telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT skills_scope_ck CHECK (scope IN ('instance', 'agent')),
    CONSTRAINT skills_status_ck CHECK (status IN ('draft', 'review', 'active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS skills_company_id_id_uq
    ON skills(company_id, id);

CREATE INDEX IF NOT EXISTS skills_instance_scope_status_idx
    ON skills(instance_id, scope, status, updated_at);

CREATE TABLE IF NOT EXISTS skill_versions (
    id VARCHAR(64) PRIMARY KEY,
    skill_id VARCHAR(64) NOT NULL,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    summary TEXT NOT NULL DEFAULT '',
    instruction_core TEXT NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    activation_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT skill_versions_status_ck CHECK (status IN ('draft', 'review', 'active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_versions_company_skill_version_uq
    ON skill_versions(company_id, skill_id, version_number);

CREATE INDEX IF NOT EXISTS skill_versions_instance_skill_created_idx
    ON skill_versions(instance_id, skill_id, created_at);

CREATE TABLE IF NOT EXISTS skill_activations (
    id VARCHAR(64) PRIMARY KEY,
    skill_id VARCHAR(64) NOT NULL,
    version_id VARCHAR(64) NOT NULL,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    scope VARCHAR(32) NOT NULL DEFAULT 'instance',
    scope_agent_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    activation_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    activated_by_type VARCHAR(32) NOT NULL DEFAULT 'system',
    activated_by_id VARCHAR(64),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT skill_activations_scope_ck CHECK (scope IN ('instance', 'agent')),
    CONSTRAINT skill_activations_status_ck CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE INDEX IF NOT EXISTS skill_activations_company_skill_status_idx
    ON skill_activations(company_id, skill_id, status, activated_at);

CREATE TABLE IF NOT EXISTS skill_usage_events (
    id VARCHAR(64) PRIMARY KEY,
    skill_id VARCHAR(64) NOT NULL,
    version_id VARCHAR(64) NOT NULL,
    activation_id VARCHAR(64),
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64),
    run_id VARCHAR(64),
    conversation_id VARCHAR(64),
    outcome VARCHAR(32) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT skill_usage_outcome_ck CHECK (outcome IN ('success', 'blocked', 'error'))
);

CREATE INDEX IF NOT EXISTS skill_usage_instance_skill_created_idx
    ON skill_usage_events(instance_id, skill_id, created_at);

ALTER TABLE memory_entries
    ADD COLUMN IF NOT EXISTS truth_state VARCHAR(32) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS source_trust_class VARCHAR(32) NOT NULL DEFAULT 'operator_verified',
    ADD COLUMN IF NOT EXISTS learned_from_event_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS human_override BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS learning_events (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    trigger_kind VARCHAR(32) NOT NULL,
    suggested_decision VARCHAR(32) NOT NULL DEFAULT 'review_required',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    summary TEXT NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    agent_id VARCHAR(64),
    run_id VARCHAR(64),
    conversation_id VARCHAR(64),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_skill JSONB NOT NULL DEFAULT '{}'::jsonb,
    promoted_memory_id VARCHAR(64),
    promoted_skill_id VARCHAR(64),
    human_override BOOLEAN NOT NULL DEFAULT FALSE,
    decision_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    CONSTRAINT learning_events_trigger_kind_ck CHECK (trigger_kind IN ('run_completion', 'session_rotation', 'pattern_detected', 'operator_action')),
    CONSTRAINT learning_events_suggested_decision_ck CHECK (suggested_decision IN ('discard', 'history_only', 'boot_memory', 'durable_memory', 'skill_draft', 'review_required')),
    CONSTRAINT learning_events_status_ck CHECK (status IN ('pending', 'applied', 'discarded', 'review_required'))
);

CREATE UNIQUE INDEX IF NOT EXISTS learning_events_company_id_id_uq
    ON learning_events(company_id, id);

CREATE INDEX IF NOT EXISTS learning_events_instance_status_created_idx
    ON learning_events(instance_id, status, created_at);

CREATE INDEX IF NOT EXISTS learning_events_instance_trigger_created_idx
    ON learning_events(instance_id, trigger_kind, created_at);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(64),
    participant_kind VARCHAR(32) NOT NULL,
    participant_status VARCHAR(32) NOT NULL DEFAULT 'active',
    agent_id VARCHAR(64),
    participant_ref VARCHAR(191),
    display_label VARCHAR(191) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_participants_kind_ck CHECK (participant_kind IN ('agent', 'user', 'contact', 'system')),
    CONSTRAINT conversation_participants_status_ck CHECK (participant_status IN ('active', 'mentioned', 'roundtable', 'handoff_pending', 'review_requested', 'blocked', 'archived'))
);

CREATE INDEX IF NOT EXISTS conversation_participants_company_conversation_idx
    ON conversation_participants(company_id, conversation_id, updated_at);

CREATE INDEX IF NOT EXISTS conversation_participants_company_agent_idx
    ON conversation_participants(company_id, agent_id, updated_at);

CREATE TABLE IF NOT EXISTS conversation_mentions (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(64) NOT NULL,
    message_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    token VARCHAR(191) NOT NULL,
    agent_display_name VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_mentions_status_ck CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

CREATE INDEX IF NOT EXISTS conversation_mentions_company_agent_idx
    ON conversation_mentions(company_id, agent_id, created_at);

CREATE INDEX IF NOT EXISTS conversation_mentions_company_message_idx
    ON conversation_mentions(company_id, message_id);

CREATE TABLE IF NOT EXISTS conversation_events (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(64) NOT NULL,
    source_message_id VARCHAR(64),
    event_type VARCHAR(32) NOT NULL,
    source_agent_id VARCHAR(64),
    target_agent_id VARCHAR(64),
    related_object_type VARCHAR(64),
    related_object_id VARCHAR(64),
    summary TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_events_type_ck CHECK (event_type IN ('mention_event', 'handoff_event', 'review_request_event', 'blocker_event', 'roundtable_event'))
);

CREATE INDEX IF NOT EXISTS conversation_events_company_conversation_idx
    ON conversation_events(company_id, conversation_id, created_at);

CREATE INDEX IF NOT EXISTS conversation_events_company_target_agent_idx
    ON conversation_events(company_id, target_agent_id, created_at);
