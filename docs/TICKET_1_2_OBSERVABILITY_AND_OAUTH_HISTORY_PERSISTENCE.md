## Ticket 1.2 - Observability-Events und OAuth-Historie persistent machen

Stand: 20.04.2026

### Ziel

JSONL sollte fuer Observability und OAuth-Operations nicht mehr der produktive Hauptpfad sein. ForgeGate braucht dafuer einen belastbaren Persistenzpfad, waehrend Datei-Storage nur noch als Dev-/Recovery-Fallback erhalten bleibt.

### Umgesetzte Aenderungen

- Observability-Eventmodelle aus `usage/analytics.py` in `backend/app/usage/events.py` als gemeinsame Domaintypen ausgelagert.
- Neue Repository-Schicht `backend/app/storage/observability_repository.py` eingefuehrt.
- Neue Repository-Schicht `backend/app/storage/oauth_operations_repository.py` eingefuehrt.
- PostgreSQL-ORM-Modelle fuer `usage_events`, `error_events`, `health_events` und `oauth_operations` ergaenzt.
- Migration `backend/app/storage/migrations/0004_phase18_observability_and_oauth_ops.sql` angelegt.
- `UsageAnalyticsStore` auf Repository-basiertes Laden und Schreiben umgestellt.
- `ControlPlaneService` auf persistente OAuth-Operations-Historie umgestellt.
- Settings fuer produktiven Observability-Backendpfad (`FORGEGATE_OBSERVABILITY_STORAGE_BACKEND`, `FORGEGATE_OBSERVABILITY_POSTGRES_URL`) ergaenzt.
- Datei-Fallback fuer bestehende JSONL-Dateien beibehalten, damit Dev- und Recovery-Modus weiter funktionieren.

### Audit-/Reviewer-Pass

Nach dem ersten Implementierungsschritt wurden diese Auffaelligkeiten direkt behoben:

- Datei-Fallbacks laden jetzt toleranter und ignorieren invalide Eventzeilen statt die komplette Historie zu blockieren.
- Testumgebung isoliert jetzt auch `oauth_operations.jsonl`, damit keine lokalen Repo-Dateien verschmutzt werden.
- Persistenztests pruefen jetzt nicht nur das Schreiben, sondern auch den Reload fuer OAuth-Operations.
- Persistenztests decken jetzt sowohl Runtime-Usage-Events als auch Health-Events ueber Cache-Reload ab.

### Verifikation

Erfolgreich:

- Statischer Python-Check per `py_compile` fuer alle geaenderten Ticket-1.2-Dateien.

Nicht moeglich auf dieser Workstation:

- `pytest`-Ausfuehrung, weil im verfuegbaren Python-Setup weder `pytest` noch die Backend-Runtime-Abhaengigkeiten wie `fastapi` installiert waren.
- Docker-/Live-Checks gemaess Vorgabe bewusst nicht ausgefuehrt.

### Ergebnis gegen Zielbild

ForgeGate hat fuer Observability- und OAuth-Historien jetzt denselben Architekturtrend wie fuer andere Persistenzachsen:

- produktiver Primaerpfad ueber PostgreSQL,
- Datei-Fallback nur fuer lokale/offline Modi,
- gemeinsame Domaintypen statt Inline-Modelle,
- explizite Migration statt impliziter JSONL-Wahrheit.

Damit ist Ticket `1.2` fuer die Offline-Codebasis abgeschlossen.
