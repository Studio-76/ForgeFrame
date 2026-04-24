CREATE TABLE IF NOT EXISTS recovery_backup_policies (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL,
    target_class VARCHAR(32) NOT NULL,
    target_label VARCHAR(191) NOT NULL DEFAULT '',
    target_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    protected_data_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_source_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_hint VARCHAR(191) NOT NULL DEFAULT '',
    max_backup_age_hours INTEGER NOT NULL DEFAULT 24,
    max_restore_age_hours INTEGER NOT NULL DEFAULT 168,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recovery_backup_policy_status_ck CHECK (status IN ('active', 'paused')),
    CONSTRAINT recovery_backup_policy_target_class_ck CHECK (
        target_class IN (
            'local_secondary_disk',
            'second_host',
            'nas_share',
            'offsite_copy',
            'object_storage'
        )
    ),
    CONSTRAINT recovery_backup_policy_max_backup_age_hours_ck CHECK (max_backup_age_hours >= 1),
    CONSTRAINT recovery_backup_policy_max_restore_age_hours_ck CHECK (max_restore_age_hours >= 1)
);

CREATE INDEX IF NOT EXISTS recovery_backup_policy_target_class_idx
    ON recovery_backup_policies (target_class, status, updated_at);

CREATE TABLE IF NOT EXISTS recovery_backup_reports (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL REFERENCES recovery_backup_policies (id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    protected_data_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_locator TEXT NOT NULL DEFAULT '',
    backup_path TEXT NOT NULL DEFAULT '',
    manifest_path TEXT NOT NULL DEFAULT '',
    byte_size INTEGER,
    checksum_sha256 VARCHAR(128),
    source_identity_match BOOLEAN NOT NULL DEFAULT TRUE,
    coverage_match BOOLEAN NOT NULL DEFAULT TRUE,
    mismatch_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL DEFAULT '',
    CONSTRAINT recovery_backup_report_status_ck CHECK (status IN ('ok', 'warning', 'failed'))
);

CREATE INDEX IF NOT EXISTS recovery_backup_report_policy_created_idx
    ON recovery_backup_reports (policy_id, created_at);

CREATE TABLE IF NOT EXISTS recovery_restore_reports (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL REFERENCES recovery_backup_policies (id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    protected_data_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
    validated_source_identities JSONB NOT NULL DEFAULT '[]'::jsonb,
    restored_database VARCHAR(191) NOT NULL DEFAULT '',
    tables_compared INTEGER NOT NULL DEFAULT 0,
    source_identity_match BOOLEAN NOT NULL DEFAULT TRUE,
    coverage_match BOOLEAN NOT NULL DEFAULT TRUE,
    mismatch_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL DEFAULT '',
    CONSTRAINT recovery_restore_report_status_ck CHECK (status IN ('ok', 'warning', 'failed'))
);

CREATE INDEX IF NOT EXISTS recovery_restore_report_policy_created_idx
    ON recovery_restore_reports (policy_id, created_at);
