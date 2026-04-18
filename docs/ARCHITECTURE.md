# ARCHITECTURE

## Architekturziel
ForgeGate wird als modularer Neuaufbau erstellt: klare Schichten, klare Verantwortlichkeiten, keine implizite Referenzkopplung.

## Backend-Schichten

### Core
- Routing, Klassifizierung, Streaming, Fallback, Tool Calling, Kontextoptimierung, Modell-Registry.
- Nur forgegate-native Implementierungen.

### Platform
- Auth, Accounts, Keys, Usage, Storage, Telemetry, Settings.
- Unterstützt Runtime- und Admin-Schicht, enthält aber keine UI.

### API
- `api/runtime`: Laufzeit-Endpunkte für Anfragen.
- `api/admin`: Betriebs-/Admin-Endpunkte.

## Frontend
- Admin-Frontend zur Verwaltung von Providern, Konten, API-Keys, Logs und Settings.
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
