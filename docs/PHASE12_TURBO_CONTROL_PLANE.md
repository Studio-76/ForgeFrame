# ForgeGate Phase 12 Turbo — Operational Depth

## Kernfortschritt

Phase 12 Turbo zieht die bestehende Postgres-Einführung tiefer in den Produktkern, statt sie nur als Grundgerüst zu belassen.

### 1) Storage-/Repository-Vertiefung

- Repository-Layer erweitert um Query-Objekt (`HarnessRunQuery`) für provider/mode/status/client/limit.
- Runs erhalten stabile `run_id` plus optionale `client_id` / `consumer` / `integration`-Achse.
- Profile erhalten operative Counter (`request_count`, `stream_request_count`, `total_tokens`) und `needs_attention`.
- Snapshots werden in eigener Tabelle (`harness_snapshots`) persistiert und rotiert.

### 2) Harness Lifecycle / Inventory

- Sync führt jetzt Inventory-Diff durch (`added` / `removed` / `stale`) statt nur blindem Überschreiben.
- Stale-Modelle bleiben sichtbar und werden explizit markiert (`status=stale`).
- Profile erfassen `last_used_at` / `last_used_model` und laufende Nutzungscounter.

### 3) Discovery / Sync / Orchestrierung

- Sync-Runs enthalten differenzierte Steps für `discovery` und `inventory_diff` inkl. Änderungszahlen.
- Control-Plane nutzt backendseitig gefilterte Runs statt nur In-Memory-Nachfilterung.

### 4) Frontend Control Plane

- Providers/Harness-Seite erweitert um:
  - Runs-Filter für provider/client zusätzlich zu mode/status
  - runtime-run-Details (`client`, `integration`, `run_id`)
  - Profil-Nutzungsfelder und Needs-Attention-Flag
  - Client/Consumer-Operational-View direkt in der Seite

## Migration

Neue SQL-Migration: `backend/app/storage/migrations/0002_phase12_harness_operational_depth.sql`.

## Noch offen

- Vollwertige Alembic-Chain statt SQL-Dateien.
- Komplette Umstellung aller verbleibenden JSONL-Achsen auf relationale Auswertungsmodelle.
- Noch tiefere UI-Zeitachsen (Trend-Charts über Runs/Snapshots) und Workflows.
