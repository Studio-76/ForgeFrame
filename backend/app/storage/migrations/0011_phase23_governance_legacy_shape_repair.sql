-- Repair reused Postgres volumes that recorded phase-23 governance migrations
-- before the final legacy-column backfills were present.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE tenants
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE tenants
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE tenants
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE principals
    ADD COLUMN IF NOT EXISTS external_subject VARCHAR(191);

ALTER TABLE principals
    ADD COLUMN IF NOT EXISTS username VARCHAR(191);

ALTER TABLE principals
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE principals
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE principals
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE principals
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE tenant_memberships
    ADD COLUMN IF NOT EXISTS created_by_membership_id VARCHAR(191);

ALTER TABLE tenant_memberships
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE tenant_memberships
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE tenant_memberships
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE tenant_memberships
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS owner_membership_id VARCHAR(191);

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

ALTER TABLE service_accounts
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE service_accounts
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE service_accounts
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE service_accounts
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS membership_id VARCHAR(191);

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS service_account_id VARCHAR(191);

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS scope_id VARCHAR(191);

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS permission_set VARCHAR(64);

UPDATE scope_grants AS grants
SET permission_set = COALESCE(permission_set, to_jsonb(grants)->>'permission_key')
WHERE permission_set IS NULL;

ALTER TABLE scope_grants
    ALTER COLUMN permission_set SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scope_grants_membership_scope_idx
    ON scope_grants(tenant_id, membership_id, scope_kind, scope_id, permission_set)
    WHERE membership_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scope_grants_service_account_scope_idx
    ON scope_grants(tenant_id, service_account_id, scope_kind, scope_id, permission_set)
    WHERE service_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scope_grants_tenant_scope_idx
    ON scope_grants(tenant_id, scope_kind, scope_id);

ALTER TABLE scope_grants
    DROP COLUMN IF EXISTS permission_key;

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS created_by_membership_id VARCHAR(191);

ALTER TABLE scope_grants
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS secret_prefix VARCHAR(32);

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS rotated_from_credential_id VARCHAR(191);

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS issued_by_membership_id VARCHAR(191);

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE agent_credentials
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE agent_credentials
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE agent_credentials
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(64);

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS attributes JSONB;

UPDATE auth_sessions
SET attributes = '{}'::jsonb
WHERE attributes IS NULL;

ALTER TABLE auth_sessions
    ALTER COLUMN attributes SET DEFAULT '{}'::jsonb;

ALTER TABLE auth_sessions
    ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS actor_membership_id VARCHAR(191);

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS actor_service_account_id VARCHAR(191);

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS company_id VARCHAR(191);

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE audit_events
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE audit_events
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE audit_events
    ALTER COLUMN metadata SET NOT NULL;

ALTER TABLE auth_sessions
    DROP CONSTRAINT IF EXISTS auth_sessions_membership_same_tenant_fk;

ALTER TABLE agent_credentials
    DROP CONSTRAINT IF EXISTS agent_credentials_issued_by_same_tenant_fk;

ALTER TABLE agent_credentials
    DROP CONSTRAINT IF EXISTS agent_credentials_rotated_from_same_tenant_fk;

ALTER TABLE agent_credentials
    DROP CONSTRAINT IF EXISTS agent_credentials_service_account_same_tenant_fk;

ALTER TABLE scope_grants
    DROP CONSTRAINT IF EXISTS scope_grants_created_by_same_tenant_fk;

ALTER TABLE scope_grants
    DROP CONSTRAINT IF EXISTS scope_grants_service_account_same_tenant_fk;

ALTER TABLE scope_grants
    DROP CONSTRAINT IF EXISTS scope_grants_membership_same_tenant_fk;

ALTER TABLE service_accounts
    DROP CONSTRAINT IF EXISTS service_accounts_owner_membership_same_tenant_fk;

ALTER TABLE tenant_memberships
    DROP CONSTRAINT IF EXISTS tenant_memberships_created_by_same_tenant_fk;

ALTER TABLE agent_credentials
    DROP CONSTRAINT IF EXISTS agent_credentials_tenant_credential_key;

ALTER TABLE service_accounts
    DROP CONSTRAINT IF EXISTS service_accounts_tenant_service_account_key;

ALTER TABLE tenant_memberships
    DROP CONSTRAINT IF EXISTS tenant_memberships_tenant_membership_key;

ALTER TABLE tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_membership_key
    UNIQUE (tenant_id, membership_id);

ALTER TABLE service_accounts
    ADD CONSTRAINT service_accounts_tenant_service_account_key
    UNIQUE (tenant_id, service_account_id);

ALTER TABLE agent_credentials
    ADD CONSTRAINT agent_credentials_tenant_credential_key
    UNIQUE (tenant_id, credential_id);

ALTER TABLE tenant_memberships
    ADD CONSTRAINT tenant_memberships_created_by_same_tenant_fk
    FOREIGN KEY (tenant_id, created_by_membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);

ALTER TABLE service_accounts
    ADD CONSTRAINT service_accounts_owner_membership_same_tenant_fk
    FOREIGN KEY (tenant_id, owner_membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);

ALTER TABLE scope_grants
    ADD CONSTRAINT scope_grants_membership_same_tenant_fk
    FOREIGN KEY (tenant_id, membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);

ALTER TABLE scope_grants
    ADD CONSTRAINT scope_grants_service_account_same_tenant_fk
    FOREIGN KEY (tenant_id, service_account_id)
    REFERENCES service_accounts(tenant_id, service_account_id);

ALTER TABLE scope_grants
    ADD CONSTRAINT scope_grants_created_by_same_tenant_fk
    FOREIGN KEY (tenant_id, created_by_membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);

ALTER TABLE agent_credentials
    ADD CONSTRAINT agent_credentials_service_account_same_tenant_fk
    FOREIGN KEY (tenant_id, service_account_id)
    REFERENCES service_accounts(tenant_id, service_account_id);

ALTER TABLE agent_credentials
    ADD CONSTRAINT agent_credentials_rotated_from_same_tenant_fk
    FOREIGN KEY (tenant_id, rotated_from_credential_id)
    REFERENCES agent_credentials(tenant_id, credential_id);

ALTER TABLE agent_credentials
    ADD CONSTRAINT agent_credentials_issued_by_same_tenant_fk
    FOREIGN KEY (tenant_id, issued_by_membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);

ALTER TABLE auth_sessions
    ADD CONSTRAINT auth_sessions_membership_same_tenant_fk
    FOREIGN KEY (tenant_id, membership_id)
    REFERENCES tenant_memberships(tenant_id, membership_id);
