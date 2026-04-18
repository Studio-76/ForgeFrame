# Backend (Phase 4 Core Baseline)

Dieses Backend enthält jetzt einen tragfähigen ForgeGate-Runtime-Kern mit internem und erstem externem Providerpfad.

## Aktueller Stand
- Runtime-Zielpfade: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`.
- Interner Success Path: `forgegate_baseline`.
- Externer Success Path: `openai_api` (wenn `FORGEGATE_OPENAI_API_KEY` gesetzt ist).
- Externe Provider ohne Umsetzung liefern strukturierte Fehler (`provider_not_implemented` oder `provider_configuration_error`).
- Model-Registry, Routing und Dispatch sind durchgängig verdrahtet.

## Bewusst noch nicht vollständig
- OAuth-Flows
- Streaming-Engine
- Tool-Calling-Engine
- Fallback-Engine
- Vollständige Gemini/Codex/Anthropic-Integrationen

## Start (Dev)
```bash
../scripts/dev-backend.sh
```

## Tests
```bash
../scripts/test-backend.sh
```
