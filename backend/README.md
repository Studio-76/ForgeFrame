# Backend

Dieses Backend enthaelt den aktuellen ForgeGate-Runtime-, Governance- und Control-Plane-Kern.

## Aktueller Stand
- Runtime-Zielpfade: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/responses`.
- Standard-Runtime-Wahrheit: `forgegate_baseline`, `openai_api`, `openai_codex`, `gemini`, `generic_harness`, `ollama`.
- `anthropic` ist opt-in und nicht Teil der Standard-Runtime-Wahrheit im Bootstrap-Katalog.
- Model-Registry, Routing, Dispatch, Governance und Control-Plane sind durchgaengig verdrahtet.

## Bewusst noch nicht vollstaendig
- Harte Security-/Policy-Durchsetzung ueber Accounts, Keys, Scopes und Bindings
- Native `/v1/responses`-Tiefe statt Chat-Shim-Semantik
- Produktreife Codex-/Gemini-Runtime ohne Bridge-/Probe-Lastigkeit
- Vollstaendige OpenAI-Kompatibilitaet ueber Harness, Streaming und Tool-Fidelity

## Start (Dev)
```bash
../scripts/dev-backend.sh
```

## Tests
```bash
../scripts/test-backend.sh
```
