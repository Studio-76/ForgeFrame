CREATE TABLE IF NOT EXISTS governance_state (
    state_key VARCHAR(32) PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
