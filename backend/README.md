# Backend

Dieses Backend enthaelt den aktuellen ForgeFrame-Runtime-, Governance- und Control-Plane-Kern.

## Aktueller Stand
- Runtime-Zielpfade: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/responses`.
- `GET /health` ist bewusst oeffentlich und liefert nur grobe Readiness-Kategorien ohne interne Fehlerdetails; vollstaendige Runtime-Diagnostik liegt hinter der authentifizierten Admin-Session auf `GET /admin/auth/runtime-readiness`.
- Erfolgreiche `/v1/chat/completions`- und `/v1/responses`-Payloads bleiben frei von interner Routing-/Credential-Provenance; solche Details gehoeren in Observability und Control Plane, nicht in den Client-Contract.
- Oeffentliche Runtime-Fehlerhullen auf `/v1/*` leaken ebenfalls keine internen Provider-IDs; provider-spezifische Provenienz bleibt in Observability- und Admin-Surfaces.
- Standard-Runtime-Katalog: `forgeframe_baseline`, `openai_api`, `openai_codex`, `gemini`, `generic_harness`, `ollama`.
- Codex und Gemini bleiben im Beta-Slice explizit evidenzbasiert: Credential-/Bridge-Konfiguration allein macht sie noch nicht live-ready.
- `anthropic` bleibt opt-in und ist standardmaessig weiter deaktiviert; sobald die Provider-Achse aktiviert ist, seedet ForgeFrame jedoch ein initiales Anthropic-Modell ehrlich in Runtime- und Control-Plane-Wahrheit, damit Bootstrap und Provider-Sync nicht in einem Dead-End landen. Explizite Anthropic-Requests koennen dann den nativen Runtime-Pfad erreichen, waehrend die oeffentliche Runtime-Inventarliste Anthropic bis zu einer bewussten Produktscope-Aenderung weiter ausblendet.
- Model-Registry, Routing, Dispatch, Governance und Control-Plane sind durchgaengig verdrahtet.

## Bewusst noch nicht vollstaendig
- Harte Security-/Policy-Durchsetzung ueber Accounts, Keys, Scopes und Bindings
- Native `/v1/responses`-Tiefe statt Chat-Shim-Semantik
- Produktreife Codex-/Gemini-Runtime ohne Bridge-/Probe-Lastigkeit
- Native Live-Runtime-Wahrheit fuer Antigravity/Copilot/Claude Code ueber reines Onboarding/Bridge hinaus
- Vollstaendige OpenAI-Kompatibilitaet ueber Harness, Streaming und Tool-Fidelity

## Start (Dev)
```bash
../scripts/dev-backend.sh
```

## Tests
```bash
../scripts/test-backend.sh
```
