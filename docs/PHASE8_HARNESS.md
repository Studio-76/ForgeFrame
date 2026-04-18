# ForgeGate Phase 8 Harness Erweiterung

## Ziel
ForgeGate wird um eine Harness-Schicht erweitert, damit einfache/exotische Anbieter ohne separates Adapter-Projekt eingebunden, verifiziert und beobachtet werden können.

## Backend-Substanz
- Neues Modul `app/harness` mit:
  - Provider-Profilen (`HarnessProviderProfile`)
  - deklarativen Request-/Response-/Error-/Stream-Mappings
  - Template-Katalog (`openai_compatible`, `templated_http`, `static_catalog`)
  - Verifikationsachse (`test_connection`, `test_authentication`, `test_discovery`, `test_model`, `test_chat`, optional `test_stream`)
- Neuer Runtime-Provider `generic_harness`, der Harness-Profile für non-stream Chat nutzt.
- Control-Plane-Endpunkte:
  - `GET /admin/providers/harness/templates`
  - `GET /admin/providers/harness/profiles`
  - `PUT /admin/providers/harness/profiles/{provider_key}`
  - `POST /admin/providers/harness/verify`

## Observability-Erweiterung
- Error-Events tragen jetzt zusätzliche Harness-Dimensionen:
  - `integration_class`
  - `template_id`
  - `test_phase`
- Aggregationen enthalten `errors_by_integration`.

## UI-Substanz
- Providers-Seite zeigt Harness-Templates, Harness-Onboarding, gespeicherte Profiles und Verify-Aktionen.
- Integrationsfehler werden als zusätzliche Achse in Usage/Providers sichtbar.

## Grenzen dieser Phase
- Streaming über generische Harness-Provider ist vorbereitet, aber noch nicht aktiviert.
- Discovery/Sync für Harness-Profile ist leichtgewichtig und nicht als Workflow-Engine umgesetzt.
- Persistenz der Harness-Profile ist aktuell pro Prozess (in-memory) und noch nicht in eigener Storage-Schicht abgelegt.
