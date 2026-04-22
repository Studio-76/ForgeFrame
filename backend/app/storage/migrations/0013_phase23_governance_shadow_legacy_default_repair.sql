-- Repair reused Postgres volumes that still carry legacy shadow columns with
-- NOT NULL constraints and no defaults. Current relational shadow writes store
-- the same data in JSON attributes and omit these older columns on insert.

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS source_kind VARCHAR(32);

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS provider_bindings JSONB;

UPDATE service_accounts
SET source_kind = COALESCE(source_kind, 'relational_shadow')
WHERE source_kind IS NULL;

UPDATE service_accounts
SET notes = COALESCE(notes, attributes->>'notes', '')
WHERE notes IS NULL;

UPDATE service_accounts
SET provider_bindings = COALESCE(
    provider_bindings,
    CASE
        WHEN jsonb_typeof(attributes->'provider_bindings') = 'array' THEN attributes->'provider_bindings'
        ELSE '[]'::jsonb
    END
)
WHERE provider_bindings IS NULL;

UPDATE service_accounts
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{notes}',
    to_jsonb(notes),
    true
)
WHERE attributes IS NULL OR attributes->'notes' IS NULL;

UPDATE service_accounts
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{provider_bindings}',
    provider_bindings,
    true
)
WHERE attributes IS NULL OR attributes->'provider_bindings' IS NULL;

ALTER TABLE service_accounts
    ALTER COLUMN source_kind SET DEFAULT 'relational_shadow';

ALTER TABLE service_accounts
    ALTER COLUMN source_kind SET NOT NULL;

ALTER TABLE service_accounts
    ALTER COLUMN notes SET DEFAULT '';

ALTER TABLE service_accounts
    ALTER COLUMN notes SET NOT NULL;

ALTER TABLE service_accounts
    ALTER COLUMN provider_bindings SET DEFAULT '[]'::jsonb;

ALTER TABLE service_accounts
    ALTER COLUMN provider_bindings SET NOT NULL;

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS label VARCHAR(191);

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS permission_scopes JSONB;

UPDATE agent_credentials
SET label = COALESCE(label, attributes->>'label', slot, credential_id)
WHERE label IS NULL;

UPDATE agent_credentials
SET permission_scopes = COALESCE(
    permission_scopes,
    CASE
        WHEN jsonb_typeof(attributes->'scopes') = 'array' THEN attributes->'scopes'
        ELSE '[]'::jsonb
    END
)
WHERE permission_scopes IS NULL;

UPDATE agent_credentials
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{label}',
    to_jsonb(label),
    true
)
WHERE attributes IS NULL OR attributes->'label' IS NULL;

UPDATE agent_credentials
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{scopes}',
    permission_scopes,
    true
)
WHERE attributes IS NULL OR attributes->'scopes' IS NULL;

ALTER TABLE agent_credentials
    ALTER COLUMN label SET DEFAULT '';

ALTER TABLE agent_credentials
    ALTER COLUMN label SET NOT NULL;

ALTER TABLE agent_credentials
    ALTER COLUMN permission_scopes SET DEFAULT '[]'::jsonb;

ALTER TABLE agent_credentials
    ALTER COLUMN permission_scopes SET NOT NULL;

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS session_role VARCHAR(32);

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS session_type VARCHAR(32);

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE auth_sessions
SET session_role = COALESCE(session_role, attributes->>'role', 'viewer')
WHERE session_role IS NULL;

UPDATE auth_sessions
SET session_type = COALESCE(session_type, attributes->>'session_type', 'standard')
WHERE session_type IS NULL;

UPDATE auth_sessions
SET created_at = COALESCE(created_at, issued_at, NOW())
WHERE created_at IS NULL;

UPDATE auth_sessions
SET updated_at = COALESCE(updated_at, last_used_at, issued_at, created_at, NOW())
WHERE updated_at IS NULL;

UPDATE auth_sessions
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{role}',
    to_jsonb(session_role),
    true
)
WHERE attributes IS NULL OR attributes->'role' IS NULL;

UPDATE auth_sessions
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{session_type}',
    to_jsonb(session_type),
    true
)
WHERE attributes IS NULL OR attributes->'session_type' IS NULL;

ALTER TABLE auth_sessions
    ALTER COLUMN session_role SET DEFAULT 'viewer';

ALTER TABLE auth_sessions
    ALTER COLUMN session_role SET NOT NULL;

ALTER TABLE auth_sessions
    ALTER COLUMN session_type SET DEFAULT 'standard';

ALTER TABLE auth_sessions
    ALTER COLUMN session_type SET NOT NULL;

ALTER TABLE auth_sessions
    ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE auth_sessions
    ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE auth_sessions
    ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE auth_sessions
    ALTER COLUMN updated_at SET NOT NULL;
