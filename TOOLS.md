# ForgeGate Tools

This file lists the normal tools and workflows for working in this repository.

## Core Shell Tools

- `rg` for code and file search
- `git` for status, diff, branch, and remote inspection
- `bash` for repo scripts
- `jq` for JSON inspection during Paperclip/API work
- `docker compose` for local stack startup and smoke validation

## Paperclip Coordination

- Use the Paperclip API and issue workflow for status updates, blockers, child issues, and execution handoffs.
- Include `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` on mutating Paperclip API calls.
- Use issue comments for durable context, not transient terminal notes.

## Repo-Native Verification

- Backend tests: `bash scripts/test-backend.sh`
- Frontend tests: `bash scripts/test-frontend.sh`
- Compose smoke: `bash scripts/compose-smoke.sh`
- Backup/restore smoke: `bash scripts/compose-backup-restore-smoke.sh`
- Bootstrap flow: `bash scripts/bootstrap-forgegate.sh`
- Release validation bundle: `bash scripts/release-validate.sh`

## Git / Workspace Access

- Shared root: `/opt/forgegate`
- Canonical local Git remote: `git@github-forgegate:DaCHRIS/forgegate.git`
- Stored Paperclip workspace URL: `ssh://git@github-forgegate/DaCHRIS/forgegate.git`
- Use the `github-forgegate` SSH alias so the server applies the repo-specific deploy key.

## Editing Rules

- Use repository scripts and existing patterns before inventing one-off workflows.
- Keep edits ASCII unless the file already needs non-ASCII content.
- Avoid destructive git commands in the shared root.
- Do not remove or overwrite unrelated in-flight changes.
