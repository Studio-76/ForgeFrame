# ARCHITECTURE

## Architekturziel
ForgeGate wird als modularer Neuaufbau erstellt: klare Schichten, klare Verantwortlichkeiten, keine implizite Referenzkopplung.

## Produktleitlinie (verbindlich)
- ForgeGate entwickelt sich zur **UI-first Control Plane**.
- Regelbetrieb soll über UI + Admin-API erfolgen.
- Shell ist für Dev/Infra/Recovery/Migration vorgesehen, nicht als primärer Produktbedienweg.

## Backend-Schichten

### Core
- Routing, Klassifizierung, Streaming, Fallback, Tool Calling, Kontextoptimierung, Modell-Registry.
- Runtime-Dispatch-Vertrag für non-stream + stream.
- Usage-/Token-/Kosten-Grundlagen (actual, hypothetical, avoided cost) als vorbereitende Kernsemantik.
- Nur forgegate-native Implementierungen.

### Platform
- Auth, Accounts, Keys, Usage, Storage, Telemetry, Settings.
- Unterstützt Runtime- und Admin-Schicht, enthält aber keine UI.

### API
- `api/runtime`: Laufzeit-Endpunkte für Anfragen.
- `api/admin`: Betriebs-/Admin-Endpunkte.

## Frontend
- Admin-Frontend als Control Plane zur Verwaltung von Providern, Konten, API-Keys, Logs und Settings.
- Vorbereitung für Provider-Readiness, Discovery-Sync, Modellsichtbarkeit, Usage- und Kostenanalysen.
- Klare Trennung zu Backend-Implementierungsdetails.

## Runtime API vs Admin API
- Runtime API: request/response-orientierte Gateway-Aufrufe.
- Admin API: Konfiguration, Betrieb, Einsicht, Governance.

## Referenzcode vs Produktcode
- `reference/` enthält nur Vergleichs- und Lernmaterial.
- Produktiver Code lebt ausschließlich in `backend/` und `frontend/`.
- Keine Imports aus `reference/`.

## Provider-Adapter-Konzept
- Pro Provider eigenes Modul.
- Einheitlicher Adapter-Vertrag als spätere Integrationsbasis.
- Feature-Divergenzen werden in Adapter-Layern normalisiert.

## Persistenzmodell (grob)
- Storage-Layer kapselt DB-Zugriff und Modelle.
- Domänenmodelle in Accounts/Keys/Usage.
- Migrationsstruktur separat unter `storage/migrations`.

## Erweiterbarkeit
- Modulweise Erweiterung ohne Core-Refactoring als Ziel.
- Zusätzliche Provider und Features durch isolierte Module.
- Observability- und Governance-Bausteine als durchgängige Querschnittsthemen.

## Runtime-Zielpfade (Stand Phase 5)
- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions` (non-stream + stream)

## Providerpfade (Stand Phase 5)
- Interner Baseline-Provider (`forgegate_baseline`): non-stream + stream.
- Externer OpenAI-API-Provider (`openai_api`): non-stream + stream.
- OpenAI-Codex: ehrliche Auth-/Readiness-/Discovery-Vorstufe, kein Fake-Success-Path.


## UI-Theming (Control Plane)
- Heller und dunkler Modus sind vorgesehen.
- Dark Mode ist der Default im aktuellen Ausbau.
- Theme-Umschaltung erfolgt im UI und wird clientseitig persistiert.
