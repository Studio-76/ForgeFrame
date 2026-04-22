-- Repair reused Postgres volumes that still carry the pre-relational
-- `principals.must_rotate_password` column without a server default.
-- Relational shadow refreshes omit that legacy column on insert, so this
-- repair makes the old column harmless and mirrors its value into attributes.
ALTER TABLE principals
    ADD COLUMN IF NOT EXISTS must_rotate_password BOOLEAN;

UPDATE principals
SET must_rotate_password = COALESCE(must_rotate_password, TRUE)
WHERE must_rotate_password IS NULL;

UPDATE principals
SET attributes = jsonb_set(
    COALESCE(attributes, '{}'::jsonb),
    '{must_rotate_password}',
    to_jsonb(must_rotate_password),
    true
)
WHERE attributes IS NULL OR attributes->'must_rotate_password' IS NULL;

ALTER TABLE principals
    ALTER COLUMN must_rotate_password SET DEFAULT TRUE;

ALTER TABLE principals
    ALTER COLUMN must_rotate_password SET NOT NULL;
