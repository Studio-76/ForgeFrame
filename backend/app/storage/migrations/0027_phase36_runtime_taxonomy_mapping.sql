-- Phase 36: durable native runtime taxonomy mapping for responses persistence.

ALTER TABLE IF EXISTS runtime_responses
    ADD COLUMN IF NOT EXISTS native_mapping JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE runtime_responses
SET native_mapping = COALESCE(response_body->'metadata'->'forgeframe_native_mapping', '{}'::jsonb)
WHERE native_mapping = '{}'::jsonb;
