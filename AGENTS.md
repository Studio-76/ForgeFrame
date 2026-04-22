# ForgeGate Agents

This repository is the primary ForgeGate engineering workspace. Treat it as the source of truth for backend, frontend, Docker, scripts, and product docs.

## Mission

- Ship ForgeGate as an enterprise-grade AI gateway, harness, and control plane.
- Keep runtime, governance, and admin behavior aligned with the product definition in `README.md` and `docs/`.
- Preserve the rule that `reference/` is reference material only. Do not introduce production imports from `reference/`.

## Ownership Model

- Backend work lives under `backend/`.
- Control-plane frontend work lives under `frontend/`.
- Deployment, bootstrap, smoke, backup, and restore automation live under `scripts/` and `docker/`.
- Project-level technical decisions and acceptance criteria live in Paperclip issues first, then in repo docs when they need to persist for future execution.

## Workspace Rules

- Canonical shared repo path on this server: `/opt/forgegate`
- Canonical Git remote for local Git operations: `git@github-forgegate:DaCHRIS/forgegate.git`
- Paperclip project metadata currently stores the URL-valid equivalent `ssh://git@github-forgegate/DaCHRIS/forgegate.git` because workspace `repoUrl` is validated as a URL.
- Do not switch the repo to HTTPS or `git@github.com:DaCHRIS/forgegate.git`.
- Treat `/opt/forgegate` as the shared project root. Issue execution should happen in isolated Paperclip workspaces or branches derived from this root whenever possible.
- Never revert unrelated user changes in the shared root. This repo may be intentionally dirty.

## Execution Rules

- Start from the current issue objective and acceptance criteria, not from generic cleanup.
- Acknowledge the latest wake comment before broad exploration when the heartbeat is comment-driven.
- Use child issues for long-running or parallel work instead of busy polling.
- When a ForgeGate issue is completed and it changed shipped code, runtime contracts, operator workflows, or release automation, route it into the Auditor review queue before considering the delivery loop closed.
- If blocked, record the blocker, the unblock owner, and the exact next action in Paperclip before exiting.
- Leave durable handoff context on every task update: objective, owner, acceptance criteria impact, blocker if any, and next action.

## Engineering Bar

- Protect authentication, authorization, tenant isolation, and governance semantics.
- Keep provider integrations behind stable contracts; do not let one provider special case leak across the platform.
- Favor targeted tests close to the changed behavior before broad smoke coverage.
- Send audit findings back to the directly responsible specialist when the owning surface is clear; escalate to the CTO only for cross-cutting or ownership-ambiguous defects.
- Update docs when shipped behavior or operator workflow changes.

## Verification Defaults

- Backend: `bash scripts/test-backend.sh`
- Frontend: `bash scripts/test-frontend.sh`
- Release sanity: `bash scripts/release-validate.sh`
- Compose/bootstrap: `bash scripts/bootstrap-forgegate.sh`

Run the smallest command set that proves the change, then report exactly what was verified and what was not.
