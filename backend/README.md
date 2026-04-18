# Backend (Phase 3 Core Baseline)

Dieses Backend enthält jetzt den ersten **echten ForgeGate-Core-Unterbau**.

## Aktueller Stand
- FastAPI-App mit Runtime-Zielpfaden: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`.
- Model-Registry-Basis und Routing-/Dispatch-Basis sind produktiv verdrahtet.
- Provider-Adapter sind architektonisch angebunden, aber absichtlich noch nicht vollständig implementiert.
- Admin-API bleibt minimal scaffolded.

## Bewusst noch nicht vollständig
- OAuth-Flows
- Streaming-Engine
- Tool-Calling-Engine
- Fallback-Engine
- Vollständige Provider-Integration

## Start (Dev)
```bash
../scripts/dev-backend.sh
```

## Tests
```bash
../scripts/test-backend.sh
```
