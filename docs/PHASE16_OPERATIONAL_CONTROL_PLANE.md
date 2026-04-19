# Phase 16 — Operational Control-Plane Lift

## Implemented in this phase

- OAuth/account operations now expose actionable probe + bridge-sync history via:
  - `GET /admin/providers/oauth-account/operations`
  - `POST /admin/providers/oauth-account/probe-all`
- Bootstrap onboarding now exposes installer-grade readiness checks via:
  - `GET /admin/providers/bootstrap/readiness`
- Providers UI now includes:
  - OAuth “probe all” action
  - OAuth operation/failure view (`needs_attention`, last probe/sync status)
  - Docker-first bootstrap readiness checklist + next steps
- Docker onboarding improvements:
  - Added `docker/.env.compose.example`
  - `bootstrap-forgegate.sh` now validates `curl` and `python`, warns on default password,
    and persists bootstrap readiness output.
  - `compose-smoke.sh` now validates bootstrap + oauth operations endpoints.

## Non-goals kept intact

- No fake “fully working OAuth runtime for every provider”.
- No axis-mixing: OAuth/account providers, OpenAI-compatible providers, local providers, and
  OpenAI-compatible clients remain separate conceptual axes.
- No enterprise scope explosion (IAM/billing/multi-tenant suite still out of scope).

