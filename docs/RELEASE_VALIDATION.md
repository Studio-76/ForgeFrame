# Release Validation

ForgeGate release validation should use repo-owned scripts so the same command set works from a clean checkout and from a reused local workspace.

## Command Set

1. `scripts/test-backend.sh`
   Validates the backend pytest suite, including OpenAI-compatible runtime and admin/control-plane behavior. The script now refreshes the reusable test venv if the editable install points at the wrong checkout.
2. `scripts/test-frontend.sh`
   Installs frontend dependencies when needed and produces a production build.
3. `scripts/compose-smoke.sh`
   Boots the docker-compose stack, validates health/auth/harness/bootstrap paths, proves the container startup path upgrades a disposable pre-`0007_phase21_observability_tenant_keying` database before runtime validation, and captures artifacts under `/tmp/forgegate-*.json` plus `/tmp/forgegate-db-profiles.txt`. If `.env.compose` is missing, the script seeds it from `docker/.env.compose.example` and generates a bootstrap admin password so the stack does not start on the insecure repo default.
4. `scripts/compose-client-compat-signoff.sh`
   Runs against the live compose stack after `scripts/compose-smoke.sh` and captures `/tmp/forgegate-client-compat-signoff.json` plus raw request/response artifacts. The signoff proves `GET /v1/models` returns a sanitized public inventory that includes the verified compose baseline model, rejects the seeded `compose-model` leak from the local compose harness profile, proves `POST /v1/chat/completions` and `POST /v1/responses` on the current compose/runtime path in stream and non-stream mode, and verifies that a hidden `gpt-5.3-codex` `/v1/responses` stream request fails as `model_not_found` while persisting the exact `error_events` row that matches the signoff request headers (`request_id`, `correlation_id`, `trace_id`, `span_id`).
5. `scripts/compose-backup-restore-smoke.sh`
   Captures a PostgreSQL backup from the running compose database, restores it into a disposable database, compares row counts for every user table, and writes `/tmp/forgegate-backup-restore-smoke.json`. The report records `validated_source_databases` with the source database name plus PostgreSQL `cluster_system_identifier` so later purge validation can bind to the exact recovery-tested source.
6. `scripts/compose-ollama-smoke.sh`
   Optional operator-run validation for the dedicated Ollama/local axis. The script still boots only the default `forgegate + postgres` compose stack, but requires `FORGEGATE_OLLAMA_BASE_URL` and `FORGEGATE_OLLAMA_DEFAULT_MODEL` to point at a container-reachable live Ollama endpoint. It proves `/health`, provider truth/readiness, `/v1/models`, `/v1/chat/completions`, SSE streaming, and the explicit unsupported tool-calling boundary for Ollama. This script is intentionally not called by `scripts/release-validate.sh`.
7. `scripts/run-history-retention.py --purge-archive`
   `scripts/release-validate.sh` runs this as a dry-run inside the compose `forgegate` image after the backup/restore smoke. The default policy set is scoped to the active FOR-214 tables (`usage_events`, `error_events`, `health_events`, and `oauth_operations`). Because the command omits `--apply`, it does not archive or purge rows, but it still enforces the fresh backup/restore report guard before validating the destructive retention path. The guard now rejects reports that do not match the active target database identity, even when the report is fresh and `ok`. The release gate writes `/tmp/forgegate-retention-release-validation.json`.
8. `scripts/release-validate.sh`
   Runs backend tests, frontend build/test, compose smoke, client compatibility signoff, backup/restore smoke, and the retention purge-guard dry-run in sequence so the default release gate covers client-axis signoff, recovery, and retention safeguards together.

## Known Local Gaps

- Browser-only operator regression checks are still manual.
- Live-provider OAuth/account probes remain dependent on local credentials or external accounts; the default compose smoke covers the control-plane surfaces without asserting live third-party connectivity.
- Live Ollama/local-axis evidence is intentionally separate from the default release gate. Use `scripts/compose-ollama-smoke.sh` only after an operator points ForgeGate at a reachable Ollama endpoint and ensures the validation model is already present there.
- The default release gate does not execute `scripts/run-history-retention.py --apply` or destructive archive purge. Those remain explicit operator maintenance actions after environment review; the gate only proves the dry-run policy scan for the active raw-observability and OAuth history tables plus the fresh, source-database-bound backup/restore prerequisite for purge.

## Startup and Readiness Contract

- ForgeGate now validates its startup contract before serving traffic on the normal server path. Invalid storage URLs, disabled default-provider config, or missing/default/placeholder bootstrap admin credentials fail fast instead of waiting for a later request path to discover the problem.
- `GET /health` now reports readiness states:
  - `booting`: critical startup checks are not yet satisfied and ForgeGate must not accept traffic.
  - `degraded`: ForgeGate can serve traffic, but operator action is still required, for example because configured provider secrets still lack rotation evidence.
  - `ready`: startup checks passed and no current readiness warnings remain.

## Config and Secret Rollouts

- Before changing storage-affecting config, capture a backup with `scripts/backup-forgegate.sh`.
- Apply the config or secret update and restart ForgeGate so startup validation reruns against the new contract. Bootstrap admin credentials must already be rotated away from repo defaults or placeholders before the restart.
- The compose/bootstrap scripts automatically satisfy the first-login bootstrap password rotation guard with the configured secret before they exercise privileged admin APIs. They do not silently swap the operator-chosen secret to a different value.
- Verify `GET /health`, `scripts/compose-smoke.sh`, and, for storage changes, `python3 scripts/apply-storage-migrations.py` or `scripts/bootstrap-forgegate.sh` as appropriate for the environment.
- If the rollout regresses readiness, restore the prior config or secret material, restart ForgeGate, and use `scripts/restore-forgegate.sh <dump> <target_db>` for non-destructive recovery validation before replacing a live database.
