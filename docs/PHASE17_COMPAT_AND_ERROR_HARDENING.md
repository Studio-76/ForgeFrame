# Phase 17 — Compatibility and Error-Handling Hardening

## Delivered runtime hardening

- Added deeper provider error taxonomy:
  - `provider_rate_limited`
  - `provider_conflict`
  - `provider_timeout`
  - `provider_protocol_error`
- Extended runtime HTTP mapping so provider failures now surface as:
  - `429` for provider rate-limit,
  - `409` for provider conflict,
  - `504` for provider timeout,
  - `502` for provider protocol/upstream errors.
- Hardened OpenAI API, Codex, Gemini and Ollama adapters with:
  - timeout mapping,
  - protocol/JSON decode handling,
  - 409/429 status mapping,
  - stricter stream chunk handling and done-marker enforcement.
- Upgraded Gemini from pure readiness scaffold to partial runtime bridge when
  `FORGEGATE_GEMINI_PROBE_ENABLED=true` and credentials are present.
- Hardened generic harness adapter error mapping to classify timeout/rate-limit/
  conflict/protocol situations more explicitly.

## Client-compatibility hardening

- `/v1/responses` now validates:
  - `max_output_tokens > 0`,
  - `temperature` range `[0, 2]`,
  - non-empty input,
  - structured list object input requiring `content`.

## Control-plane realism hardening

- Provider snapshot now includes OAuth operational failure context:
  - `oauth_failure_count`,
  - `oauth_last_probe`,
  - `oauth_last_bridge_sync`.

