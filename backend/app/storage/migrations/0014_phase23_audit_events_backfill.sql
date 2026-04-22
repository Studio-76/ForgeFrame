CREATE INDEX IF NOT EXISTS audit_events_tenant_actor_service_account_idx
    ON audit_events(tenant_id, actor_service_account_id, created_at DESC);

WITH legacy_audit_events AS (
    SELECT
        COALESCE(NULLIF(event ->> 'event_id', ''), 'audit_legacy_' || LPAD(ordinality::text, 12, '0')) AS event_id,
        COALESCE(
            NULLIF(event ->> 'tenant_id', ''),
            NULLIF(event -> 'metadata' ->> 'tenant_id', ''),
            NULLIF(event -> 'metadata' ->> 'account_id', ''),
            'tenant_bootstrap'
        ) AS tenant_id,
        gs.updated_at AS state_updated_at
    FROM governance_state AS gs
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(gs.payload -> 'audit_events', '[]'::jsonb)) WITH ORDINALITY AS events(event, ordinality)
    WHERE gs.state_key = 'default'
)
INSERT INTO tenants (
    tenant_id,
    slug,
    display_name,
    status,
    created_at,
    updated_at,
    attributes
)
SELECT DISTINCT
    legacy.tenant_id,
    legacy.tenant_id,
    legacy.tenant_id,
    'active',
    legacy.state_updated_at,
    legacy.state_updated_at,
    jsonb_build_object('synthetic', true, 'source', 'audit_backfill')
FROM legacy_audit_events AS legacy
ON CONFLICT (tenant_id) DO NOTHING;

WITH legacy_audit_events AS (
    SELECT
        COALESCE(NULLIF(event ->> 'event_id', ''), 'audit_legacy_' || LPAD(ordinality::text, 12, '0')) AS event_id,
        COALESCE(
            NULLIF(event ->> 'tenant_id', ''),
            NULLIF(event -> 'metadata' ->> 'tenant_id', ''),
            NULLIF(event -> 'metadata' ->> 'account_id', ''),
            'tenant_bootstrap'
        ) AS tenant_id,
        COALESCE(NULLIF(event ->> 'actor_type', ''), 'system') AS actor_type,
        NULLIF(event ->> 'actor_id', '') AS actor_id,
        COALESCE(NULLIF(event ->> 'action', ''), 'legacy_audit_event') AS action,
        COALESCE(NULLIF(event ->> 'target_type', ''), 'governance_state') AS target_type,
        NULLIF(event ->> 'target_id', '') AS target_id,
        NULLIF(COALESCE(event ->> 'company_id', event -> 'metadata' ->> 'company_id'), '') AS company_id,
        COALESCE(NULLIF(event ->> 'status', ''), 'ok') AS status,
        COALESCE(NULLIF(event ->> 'details', ''), 'Legacy governance audit event backfilled from governance_state.') AS details,
        COALESCE(event -> 'metadata', '{}'::jsonb) AS raw_metadata,
        COALESCE(NULLIF(event ->> 'created_at', ''), gs.updated_at::text) AS created_at_text
    FROM governance_state AS gs
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(gs.payload -> 'audit_events', '[]'::jsonb)) WITH ORDINALITY AS events(event, ordinality)
    WHERE gs.state_key = 'default'
)
INSERT INTO audit_events (
    event_id,
    tenant_id,
    actor_membership_id,
    actor_service_account_id,
    actor_type,
    action,
    target_type,
    target_id,
    request_id,
    company_id,
    status,
    details,
    metadata,
    created_at
)
SELECT
    legacy.event_id,
    legacy.tenant_id,
    NULL,
    NULL,
    legacy.actor_type,
    legacy.action,
    legacy.target_type,
    legacy.target_id,
    NULLIF(legacy.raw_metadata ->> 'request_id', ''),
    legacy.company_id,
    legacy.status,
    legacy.details,
    CASE
        WHEN legacy.actor_id IS NULL THEN legacy.raw_metadata
        WHEN legacy.actor_type = 'runtime_key'
            THEN jsonb_set(legacy.raw_metadata, '{runtime_key_id}', to_jsonb(legacy.actor_id), true)
        ELSE jsonb_set(legacy.raw_metadata, '{legacy_actor_id}', to_jsonb(legacy.actor_id), true)
    END,
    legacy.created_at_text::timestamptz
FROM legacy_audit_events AS legacy
ON CONFLICT (event_id) DO NOTHING;
