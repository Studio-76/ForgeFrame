# Ticket 1.1 - Persistente Control-Plane-Zustände

## Ziel

Ticket `1.1` aus der GAP-Analyse fordert, dass zentrale In-Memory-Zustände der Control Plane nicht mehr flüchtig bleiben, sondern in einen persistierten Primärpfad überführt werden.

Betroffene Zustände:

- Provider-Management-State
- Health-Konfiguration
- aktuelle Health-Status-Sicht
- Bootstrap-Readiness-Zustand

## Umgesetzte Änderungen

- Neue gemeinsame Control-Plane-Domänenmodelle unter `backend/app/control_plane/models.py` eingeführt.
- Neue Repository-Schicht unter `backend/app/storage/control_plane_repository.py` ergänzt.
- Persistenz unterstützt jetzt:
  - PostgreSQL als Primärpfad
  - JSON-Datei als Dev-/Fallback-Pfad
- Neuer Settings-Bereich ergänzt:
  - `FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND`
  - `FORGEGATE_CONTROL_PLANE_POSTGRES_URL`
  - `FORGEGATE_CONTROL_PLANE_STATE_PATH`
- `ControlPlaneService` lädt den zuletzt persistierten State beim Start und schreibt ihn nach relevanten Änderungen zurück.
- Persistiert werden jetzt:
  - Provider-Zustände
  - Health-Config
  - Health-Records
  - letzter Bootstrap-Readiness-Report
- Der Provider-Control-Plane-Endpoint liefert zusätzlich den letzten bekannten Bootstrap-Readiness-Stand.
- Migration `0003_phase18_control_plane_state.sql` für den neuen Primärspeicher ergänzt.
- Tests für Persistenz-Reload-Szenarien ergänzt.

## Reviewer-/Auditor-Durchgang

Nach der Implementierung wurde ein statischer Audit gemacht.

Direkt nachgezogene Korrekturen:

- Bootstrap-Readiness wird jetzt bereits beim Service-Start initialisiert, damit diese Zustandsachse nicht erst nach einem manuellen Endpoint-Aufruf existiert.
- Persistierter State wird deterministisch sortiert gespeichert, um Drift und unnötige Diff-Unruhe zu reduzieren.
- Python-Syntax der geänderten Dateien wurde per `py_compile` geprüft.

## Bekannte Grenzen

- Kein Live-Datenbanktest auf dieser Windows-Workstation durchgeführt.
- Kein Docker-/Compose-Test durchgeführt, bewusst gemäß Arbeitsmodus übersprungen.
- Die OAuth-Operations- und Observability-Event-Historien liegen weiterhin außerhalb dieses Tickets in separaten Datei-/Append-Pfaden; deren Primärpfad-Migration gehört weiterhin zu späteren Tickets.

## Ergebnis gegen Zielbild

Ticket `1.1` bringt ForgeGate näher an das Zielbild einer belastbaren, nicht-flüchtigen UI-first-Control-Plane:

- zentrale Operator-Zustände sind nicht mehr nur Prozessspeicher
- ein persistenter Primärpfad ist vorbereitet und angebunden
- der Bootstrap-/Health-/Provider-State ist zwischen Service-Neustarts rekonstruierbar

Damit ist die Grundlage für die folgenden Tickets im Block `1.x` deutlich stabiler.
