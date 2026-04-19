# Phase 17.1 — Error Families, Tool Calling, Compatibility Hardening

## Focus

- Deepened practical error-family coverage and status mappings (including 410/413/415/503).
- Hardened provider-specific timeout/protocol/stream handling.
- Added stricter tool-calling runtime semantics (explicit unsupported behavior where not available).
- Tightened OpenAI-compatible client validation paths.

## Key outcomes

- Runtime error mapping now distinguishes:
  - invalid request/resource classes,
  - auth/permission,
  - rate-limit with retry hints,
  - upstream unavailable/timeout/protocol failures.
- OpenAI API / Codex / Gemini / Ollama / Generic Harness have stronger provider-specific mappings.
- Tool-calling no longer silently succeeds on providers that do not support it.
- `/v1/chat/completions` validates `tool_choice` semantics.
- `/v1/responses` keeps stricter request compatibility checks from Phase 17.

