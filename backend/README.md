# Backend (Phase 3 Core Baseline)

Dieses Backend enthält den ersten tragfähigen ForgeGate-Core-Unterbau für Runtime-Pfade.

## Aktueller Stand
- FastAPI-App mit Runtime-Zielpfaden: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`.
- Chat besitzt einen echten Success Path über den internen `forgegate_baseline`-Adapter.
- Externe Provider-Adapter sind architektonisch angebunden; nicht implementierte Provider liefern strukturierte 501-Fehler.
- Model-Registry, Routing und Dispatch sind durchgängig verdrahtet.

## Bewusst noch nicht vollständig
- OAuth-Flows
- Streaming-Engine
- Tool-Calling-Engine
- Fallback-Engine
- Vollständige externe Provider-Integrationen

## Start (Dev)
```bash
../scripts/dev-backend.sh
```

## Tests
```bash
../scripts/test-backend.sh
```
