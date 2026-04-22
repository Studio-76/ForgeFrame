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
