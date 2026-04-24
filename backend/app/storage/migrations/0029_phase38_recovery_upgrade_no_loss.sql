CREATE TABLE IF NOT EXISTS recovery_upgrade_reports (
    id VARCHAR(64) PRIMARY KEY,
    release_id VARCHAR(191) NOT NULL,
    target_version VARCHAR(64) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'warning',
    upgrade_result VARCHAR(32) NOT NULL DEFAULT 'partial_failure',
    rollback_classification VARCHAR(191) NOT NULL DEFAULT '',
    failure_classification VARCHAR(191) NOT NULL DEFAULT '',
    bootstrap_recovery_state VARCHAR(191) NOT NULL DEFAULT '',
    before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    no_loss_ok BOOLEAN NOT NULL DEFAULT FALSE,
    queue_drain_ok BOOLEAN NOT NULL DEFAULT FALSE,
    source_identity_stable BOOLEAN NOT NULL DEFAULT FALSE,
    mismatch_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL DEFAULT '',
    CONSTRAINT recovery_upgrade_report_status_ck CHECK (status IN ('ok', 'warning', 'failed')),
    CONSTRAINT recovery_upgrade_report_result_ck CHECK (upgrade_result IN ('succeeded', 'failed', 'rolled_back', 'partial_failure'))
);

CREATE INDEX IF NOT EXISTS recovery_upgrade_report_created_idx
    ON recovery_upgrade_reports (created_at, imported_at);

CREATE INDEX IF NOT EXISTS recovery_upgrade_report_release_idx
    ON recovery_upgrade_reports (release_id, created_at);
