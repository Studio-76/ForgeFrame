# OpenAI-Compatible Client Beta Signoff

This document packages the release-facing evidence boundary for [FOR-208](/FOR/issues/FOR-208) after [FOR-148](/FOR/issues/FOR-148) and [FOR-115](/FOR/issues/FOR-115) closed.

## Repo-Owned Command Path

1. `bash scripts/compose-smoke.sh`
2. `bash scripts/compose-client-compat-signoff.sh`

The default release gate also runs the client signoff immediately after compose smoke:

- `bash scripts/release-validate.sh`

Artifacts land under `/tmp/forgegate-client-compat-*.json`, `/tmp/forgegate-client-compat-*.txt`, and `/tmp/forgegate-client-compat-signoff.json`.

## What Is Beta-Ready Today

- `GET /v1/models` returns a sanitized public inventory and includes the verified compose baseline model on the current compose/runtime path.
- The compose signoff explicitly rejects the seeded `generic_harness` `compose-model` leak, so unproven local compose smoke profiles stay off the public client inventory.
- `POST /v1/chat/completions` works in non-stream and stream mode on the compose baseline path without leaking provider or credential provenance into the public client contract.
- `POST /v1/responses` works in non-stream and stream mode on the compose baseline path without leaking provider or credential provenance into the public client contract.
- A hidden `gpt-5.3-codex` `/v1/responses` stream request fails as `model_not_found`, keeps the public inventory sanitized, and persists the exact `error_events` record correlated to the signoff request headers.

## What Remains Partial

- This signoff is intentionally scoped to the documented beta client endpoints under the current compose/runtime path. It is not a blanket claim that every provider or model route is now fully OpenAI-parity complete.
- Tool-calling parity remains provider-specific. This signoff does not claim universal tool fidelity across all providers or profile classes.
- Dedicated Ollama/local runtime proof and OAuth/account-provider runtime truth remain separate evidence tracks and keep their own release boundaries.

## Expected Report Shape

`scripts/compose-client-compat-signoff.sh` writes `/tmp/forgegate-client-compat-signoff.json` with:

- passed checks for `/v1/models`, `/v1/chat/completions`, `/v1/responses`, stream/non-stream coverage, and the explicit `/v1/responses` stream-start negative case
- the `verified_runtime_model_id` that links the successful compose baseline runtime path back to the public inventory
- the negative request context (`client_id`, `request_id`, `correlation_id`, `trace_id`, `span_id`) plus raw response-header and database artifacts that prove the persisted observability row came from this exact signoff run
- artifact paths for the raw request/response payloads
- the current beta-ready vs partial claim boundary above
