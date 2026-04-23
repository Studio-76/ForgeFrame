-- Phase 32: assistant profiles and personal-assistant policies.

CREATE TABLE IF NOT EXISTS assistant_profiles (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(191) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(191) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    assistant_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
    tone VARCHAR(32) NOT NULL DEFAULT 'neutral',
    preferred_contact_id VARCHAR(64),
    mail_source_id VARCHAR(64),
    calendar_source_id VARCHAR(64),
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    communication_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_policies JSONB NOT NULL DEFAULT '{}'::jsonb,
    delegation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT assistant_profiles_company_preferred_contact_fk
        FOREIGN KEY (company_id, preferred_contact_id) REFERENCES contacts (company_id, id) ON DELETE SET NULL,
    CONSTRAINT assistant_profiles_company_mail_source_fk
        FOREIGN KEY (company_id, mail_source_id) REFERENCES knowledge_sources (company_id, id) ON DELETE SET NULL,
    CONSTRAINT assistant_profiles_company_calendar_source_fk
        FOREIGN KEY (company_id, calendar_source_id) REFERENCES knowledge_sources (company_id, id) ON DELETE SET NULL,
    CONSTRAINT assistant_profiles_status_ck CHECK (status IN ('active', 'paused')),
    CONSTRAINT assistant_profiles_tone_ck CHECK (tone IN ('neutral', 'warm', 'direct', 'formal'))
);

CREATE UNIQUE INDEX IF NOT EXISTS assistant_profiles_company_id_id_uq
    ON assistant_profiles (company_id, id);
CREATE INDEX IF NOT EXISTS assistant_profiles_instance_status_idx
    ON assistant_profiles (instance_id, status, assistant_mode_enabled);
CREATE INDEX IF NOT EXISTS assistant_profiles_instance_default_idx
    ON assistant_profiles (instance_id, is_default);

