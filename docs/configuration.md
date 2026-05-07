# ForgeFrame Configuration Reference

ForgeFrame reads runtime settings from environment variables using the `FORGEFRAME_` prefix. Legacy `FORGEGATE_` names are still accepted for compatibility and tests, but new configuration should use `FORGEFRAME_`.

Authoritative backend settings source: `backend/app/settings/config.py`.

## Environment file layout

- Root runtime env: `.env` (example: `.env.example`)
- Backend-local env: `backend/.env` (example: `backend/.env.example`)
- Frontend-local env: `frontend/.env` (example: `frontend/.env.example`)
- Docker Compose env: `.env.compose` (seed from `deploy/docker/.env.compose.example`)

## Required variables (typical PostgreSQL setup)

The following are required for standard PostgreSQL-backed operation:

- `FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME`
- `FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD`
- `FORGEFRAME_HARNESS_STORAGE_BACKEND=postgresql`
- `FORGEFRAME_CONTROL_PLANE_STORAGE_BACKEND=postgresql`
- `FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND=postgresql`
- `FORGEFRAME_GOVERNANCE_STORAGE_BACKEND=postgresql`
- `FORGEFRAME_INSTANCES_STORAGE_BACKEND=postgresql`
- `FORGEFRAME_HARNESS_POSTGRES_URL`
- `FORGEFRAME_CONTROL_PLANE_POSTGRES_URL`
- `FORGEFRAME_OBSERVABILITY_POSTGRES_URL`
- `FORGEFRAME_GOVERNANCE_POSTGRES_URL`
- `FORGEFRAME_INSTANCES_POSTGRES_URL`

## Core runtime variables

- `FORGEFRAME_HOST` (default `127.0.0.1`)
- `FORGEFRAME_PORT` (default `8080`)
- `FORGEFRAME_API_BASE` (default `/v1`)
- `FORGEFRAME_FRONTEND_DIST_PATH` (default `frontend/dist`)

## Database variables

Connection and topology helpers seen in examples:

- `FORGEFRAME_PG_MODE` (`native`, `existing`, or deployment-specific value)
- `FORGEFRAME_PG_HOST`, `FORGEFRAME_PG_PORT`, `FORGEFRAME_PG_DB`, `FORGEFRAME_PG_USER`, `FORGEFRAME_PG_PASSWORD`
- `FORGEFRAME_POSTGRES_URL`
- Per-domain URLs (`FORGEFRAME_*_POSTGRES_URL`)

Notes:

- `FORGEFRAME_POSTGRES_URL` may be used as a base convenience variable in deployment workflows.
- Storage-domain URLs are validated by backend settings for PostgreSQL-backed modes.

## Authentication and admin variables

- `FORGEFRAME_ADMIN_AUTH_ENABLED` (default `true`)
- `FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME`
- `FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD`
- `FORGEFRAME_ADMIN_SESSION_TTL_HOURS`

If `FORGEFRAME_ADMIN_AUTH_ENABLED=true`, bootstrap admin username/password must be configured.

## TLS and ingress variables

Supported posture settings:

- `FORGEFRAME_PUBLIC_TLS_MODE` = `disabled` | `manual` | `integrated_acme`
- `FORGEFRAME_PUBLIC_FQDN`
- `FORGEFRAME_PUBLIC_HTTPS_HOST`, `FORGEFRAME_PUBLIC_HTTPS_PORT`
- `FORGEFRAME_PUBLIC_HTTP_HELPER_HOST`, `FORGEFRAME_PUBLIC_HTTP_HELPER_PORT`
- `FORGEFRAME_PUBLIC_ADMIN_BASE`
- `FORGEFRAME_PUBLIC_TLS_CERT_PATH`, `FORGEFRAME_PUBLIC_TLS_KEY_PATH`
- `FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH`, `FORGEFRAME_PUBLIC_TLS_STATE_PATH`, `FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH`
- `FORGEFRAME_PUBLIC_TLS_ACME_EMAIL`, `FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL`

### Local-only vs public HTTPS

- Local-only development typically keeps TLS disabled and uses loopback/localhost URLs.
- Public deployment uses `FORGEFRAME_PUBLIC_FQDN` and a non-disabled TLS mode.

## Frontend-only variables

Frontend vars must use the `VITE_` prefix.

- `VITE_ENABLE_UX_REVIEW`

UX Review Mode activation is dev-gated and requires explicit opt-in (`"true"`). See `docs/frontend/ux-review-mode.md` for full details.

## Optional provider and runtime variables

Common optional settings include:

- Default routing/model/provider: `FORGEFRAME_DEFAULT_PROVIDER`, `FORGEFRAME_DEFAULT_MODEL`, `FORGEFRAME_ROUTING_STRATEGY`
- Provider credentials/tokens (for enabled providers only)
- Probe toggles and base URLs for OAuth/account-capable providers
- `FORGEFRAME_OLLAMA_BASE_URL`, `FORGEFRAME_OLLAMA_DEFAULT_MODEL`

If a provider is disabled, keep related secrets unset.

## Safe example values

Use placeholders in committed files:

- FQDN: `forgeframe.example.com`
- Email: `admin@example.com`
- Password/token placeholders: `replace-with-...`
- Database URL pattern:
  `postgresql+psycopg://forgeframe:replace-with-password@127.0.0.1:5442/forgeframe`

## Secret handling rules

- Never commit real passwords, API keys, OAuth tokens, or certificates.
- Keep local secret values in untracked `.env` files.
- Rotate credentials after any accidental exposure.
- Use separate values for local, staging, and production environments.
