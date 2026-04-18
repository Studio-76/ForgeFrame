# ForgeGate Phase 11 — PostgreSQL Harness-Control-Plane Lift

## Zielbild

Phase 11 hebt Harness-Profile, Runs und Snapshot-nahe Persistenz von JSON-first auf eine produktnähere PostgreSQL-Basis mit klarer Repository-Abstraktion.

## Implementierte Kernpunkte

- Neue Storage-Repository-Schicht mit zwei Backends:
  - `PostgresHarnessRepository` (primär)
  - `FileHarnessRepository` (Fallback / Übergang)
- SQLAlchemy-Datenmodell für:
  - `harness_profiles`
  - `harness_runs`
- Initiales SQL-Migrationsskript unter `backend/app/storage/migrations/0001_phase11_harness_postgres.sql`.
- Operationalisierte Settings:
  - `FORGEGATE_HARNESS_STORAGE_BACKEND` (`postgresql` oder `file`)
  - `FORGEGATE_HARNESS_POSTGRES_URL`
  - bestehende JSON-Pfade als Fallback weiter vorhanden
- Harness-Service wired storage-backend-abhängig und liefert Snapshot inkl. `storage_backend`.

## Discovery/Sync und Lifecycle

- Profil-Lifecycle, Verify/Probe-Zähler, letzte Sync-/Verify-/Probe-Status werden im Profilpayload zentral weitergeführt.
- Runs werden in PostgreSQL als einzelne Datensätze geführt (inkl. Steps/Fehler payload).
- Harte Begrenzung der Run-Historie auf die letzten 1000 Einträge bleibt auch im DB-Backend erhalten.

## Betriebsmodus

- Produktivziel: `postgresql`.
- Tests/isolierte Umgebungen können explizit auf `file` gesetzt werden.
- Bei inkonsistenter URL wird der PostgreSQL-Start klar mit Fehler abgebrochen.

## Offene Punkte für nächste Phase

- Alembic-basierte, versionierte Migrationen mit Upgrade/Downgrade-Flows.
- Erweiterte relationale Auswertungstabellen (z. B. materialisierte Trendachsen).
- Vollständige Umstellung weiterer dateibasierter Persistenzdomänen über denselben Repository-Ansatz.
