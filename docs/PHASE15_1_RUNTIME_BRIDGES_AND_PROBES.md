# ForgeGate Phase 15.1 — Runtime Bridges & OAuth Probes

Phase 15.1 fokussiert auf operative Substanz ohne Scope-Explosion:

- **OpenAI Codex**: non-fake partial runtime bridge (optional aktivierbar via `FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED`).
- **Gemini**: probe-ready OAuth-/Account-Flow (optional live probe via `FORGEGATE_GEMINI_PROBE_ENABLED`).
- **Ollama**: dedizierter lokaler Runtime-Adapter + bestehendes lokales Harness-Template.
- **OpenAI-compatible Clients**: `/v1/responses` robuster (Input-Varianten + klarer stream-Fehlerpfad).
- **OpenAI-compatible Provider**: Generic Harness Model-Fallback standardmäßig gehärtet (`FORGEGATE_GENERIC_HARNESS_ALLOW_MODEL_FALLBACK=false`).

## Neue/erweiterte Settings

- `FORGEGATE_OPENAI_CODEX_BRIDGE_ENABLED`
- `FORGEGATE_OPENAI_CODEX_BASE_URL`
- `FORGEGATE_OPENAI_CODEX_TIMEOUT_SECONDS`
- `FORGEGATE_GEMINI_PROBE_ENABLED`
- `FORGEGATE_GEMINI_PROBE_BASE_URL`
- `FORGEGATE_GEMINI_TIMEOUT_SECONDS`
- `FORGEGATE_OLLAMA_BASE_URL`
- `FORGEGATE_OLLAMA_DEFAULT_MODEL`
- `FORGEGATE_GENERIC_HARNESS_ALLOW_MODEL_FALLBACK`

## Ehrlichkeitsgrenze

- Keine Vollruntime für alle fünf OAuth-/Account-Provider.
- Codex und Gemini sind operativer, aber weiterhin bewusst beta-partiell.
- `ready` im Control Plane setzt für Codex/Gemini echte Probe- oder Runtime-Evidenz voraus; reine Credentials bleiben `partial`.
- Antigravity, GitHub Copilot und Claude Code bleiben in diesem Slice onboarding-/bridge-only und erben keine native Runtime-Claims.
