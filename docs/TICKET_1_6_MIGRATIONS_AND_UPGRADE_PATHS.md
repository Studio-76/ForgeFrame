## Ticket 1.6 - Migrationen und Upgrade-Pfade fuer neue Persistenzachsen

Stand: 20.04.2026

### Ziel

Die neuen Persistenzachsen fuer Control Plane, Observability und OAuth-Historien durften nicht nur aus Tabellen- oder Dateiformaten bestehen, sondern brauchten explizite Migrations- und Upgrade-Pfade.

### Umgesetzte Aenderungen

- Neuer PostgreSQL-Migrationsrunner in `backend/app/storage/migrator.py`.
- Migrationserkennung basiert auf den SQL-Dateien in `backend/app/storage/migrations`.
- Neue Migration-Manifest-Tabelle: `forgegate_schema_migrations`.
- Neuer CLI-Einstiegspunkt: [apply-storage-migrations.py](/F:/Projekte/ForgeGate/repo-auto/scripts/apply-storage-migrations.py)
- Der Runner erkennt alle relevanten PostgreSQL-Ziele ueber die aktiven Storage-Backends und fuehrt Migrationen pro Datenbankziel idempotent aus.
- `FileControlPlaneStateRepository` fuehrt jetzt beim Laden automatische Schema-Upgrades fuer alten Control-Plane-State aus.
- Legacy-Control-Plane-State ohne Modellmetadaten wird automatisch auf Schema-Version `2` angehoben und kanonisch zurueckgeschrieben.

### Audit-/Reviewer-Pass

Wesentliche direkte Nachschaerfung:

- Upgrade-Logik wurde nicht nur fuer neue Dateien, sondern auch fuer bereits gespeicherten PostgreSQL-Control-Plane-State eingebaut.
- Dadurch gibt es nicht nur einen Vorwaertspfad fuer Neuinstallationen, sondern auch einen echten Upgrade-Pfad fuer bereits vorhandene persistierte Daten.

### Verifikation

Erfolgreich:

- Statischer Python-Check per `py_compile` fuer Migrationsrunner, Upgrade-Logik, CLI-Einstiegspunkt und die neuen Tests.
- Neue Offline-Tests decken ab:
  - Upgrade eines alten Control-Plane-State-Files,
  - geordnete Discovery der SQL-Migrationen.

Nicht moeglich auf dieser Workstation:

- Tatsaechliche Ausfuehrung gegen PostgreSQL oder Docker gemaess Vorgabe nicht durchgefuehrt.

### Ergebnis gegen Zielbild

ForgeGate hat jetzt fuer die neu eingefuehrten Persistenzachsen nicht mehr nur Datenstrukturen, sondern auch explizite Evolution:

- SQL-Migrationspfad fuer PostgreSQL,
- Upgrade-Pfad fuer persistierten Control-Plane-State im File-Modus,
- idempotente Nachverfolgung bereits angewandter Migrationen.

Damit ist Block `1` fuer die offline umsetzbaren Teile konsistent geschlossen.
