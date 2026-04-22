CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(191) PRIMARY KEY,
    slug VARCHAR(191) NOT NULL UNIQUE,
    display_name VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS principals (
    principal_id VARCHAR(191) PRIMARY KEY,
    principal_type VARCHAR(32) NOT NULL,
    external_subject VARCHAR(191),
    username VARCHAR(191),
    display_name VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS principals_type_external_subject_idx
    ON principals(principal_type, external_subject)
    WHERE external_subject IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS principals_lower_username_idx
    ON principals(LOWER(username))
    WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_memberships (
    membership_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL REFERENCES tenants(tenant_id),
    principal_id VARCHAR(191) NOT NULL REFERENCES principals(principal_id),
    membership_role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_by_membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, principal_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_principal_status_idx
    ON tenant_memberships(principal_id, status);

CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_role_status_idx
    ON tenant_memberships(tenant_id, membership_role, status);

CREATE TABLE IF NOT EXISTS service_accounts (
    service_account_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL REFERENCES tenants(tenant_id),
    slug VARCHAR(191) NOT NULL,
    display_name VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL,
    owner_membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS service_accounts_tenant_status_idx
    ON service_accounts(tenant_id, status);

CREATE INDEX IF NOT EXISTS service_accounts_tenant_owner_idx
    ON service_accounts(tenant_id, owner_membership_id);

CREATE TABLE IF NOT EXISTS scope_grants (
    grant_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL REFERENCES tenants(tenant_id),
    membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    service_account_id VARCHAR(191) REFERENCES service_accounts(service_account_id),
    scope_kind VARCHAR(32) NOT NULL,
    scope_id VARCHAR(191),
    permission_set VARCHAR(64) NOT NULL,
    effect VARCHAR(16) NOT NULL,
    created_by_membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT scope_grants_subject_check CHECK (
        (membership_id IS NOT NULL AND service_account_id IS NULL)
        OR (membership_id IS NULL AND service_account_id IS NOT NULL)
    )
);

-- Early relational governance checkouts created `permission_key` before the
-- field settled on `permission_set`. Backfill the canonical column before the
-- unique indexes run so reused volumes can still migrate cleanly.
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

CREATE TABLE IF NOT EXISTS agent_credentials (
    credential_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL REFERENCES tenants(tenant_id),
    service_account_id VARCHAR(191) NOT NULL REFERENCES service_accounts(service_account_id),
    provider_key VARCHAR(64) NOT NULL,
    credential_kind VARCHAR(32) NOT NULL,
    slot VARCHAR(64) NOT NULL,
    secret_ref VARCHAR(191) NOT NULL,
    secret_hash VARCHAR(191) NOT NULL,
    secret_prefix VARCHAR(32),
    status VARCHAR(32) NOT NULL,
    rotation_state VARCHAR(32) NOT NULL,
    rotated_from_credential_id VARCHAR(191) REFERENCES agent_credentials(credential_id),
    issued_by_membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, service_account_id, provider_key, slot)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_credentials_secret_hash_idx
    ON agent_credentials(tenant_id, secret_hash);

CREATE INDEX IF NOT EXISTS agent_credentials_provider_status_idx
    ON agent_credentials(tenant_id, provider_key, status);

CREATE INDEX IF NOT EXISTS agent_credentials_service_account_last_used_idx
    ON agent_credentials(tenant_id, service_account_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL REFERENCES tenants(tenant_id),
    membership_id VARCHAR(191) NOT NULL REFERENCES tenant_memberships(membership_id),
    session_hash VARCHAR(191) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(64),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS auth_sessions_membership_status_idx
    ON auth_sessions(tenant_id, membership_id, status);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx
    ON auth_sessions(tenant_id, expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
    event_id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) REFERENCES tenants(tenant_id),
    actor_membership_id VARCHAR(191) REFERENCES tenant_memberships(membership_id),
    actor_service_account_id VARCHAR(191) REFERENCES service_accounts(service_account_id),
    actor_type VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(191),
    request_id VARCHAR(64),
    company_id VARCHAR(191),
    status VARCHAR(32) NOT NULL,
    details TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
    ON audit_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_tenant_target_idx
    ON audit_events(tenant_id, target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_tenant_actor_membership_idx
    ON audit_events(tenant_id, actor_membership_id, created_at DESC);
