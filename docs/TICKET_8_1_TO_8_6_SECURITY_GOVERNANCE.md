## Tickets 8.1 bis 8.6 - Security-, Auth- und Governance-Ausbau

Stand: 20.04.2026

### Umgesetzt

- Neue Governance-Persistenzachse fuer Admin-User, Sessions, Accounts, Runtime-Keys, Settings-Overrides und Audit-Events.
- Reale Admin-Authentifizierung mit Login, Session-Token, geschuetzten Admin-Routern und Rollenmodell `admin` / `operator` / `viewer`.
- Neue funktionale Admin-Module fuer:
  - Accounts
  - Runtime API Keys
  - Settings-Overrides
  - Audit-/Logs-Sicht
  - Dashboard-Snapshot
- Runtime-Gateway-Auth ueber ForgeGate-eigene Keys vorbereitet und in `/v1/models`, `/v1/chat/completions` und `/v1/responses` integriert.
- Audit-Trail fuer sicherheits- und governance-relevante Aktionen.

### Wichtige Architekturentscheidung

- Die neue Governance-Achse ist offline-freundlich als File-Repository und cloud-faehig als PostgreSQL-State aufgebaut.
- Produktive Klartext-Secrets werden nicht persistiert; Runtime-Keys werden gehasht gespeichert und nur einmalig ausgegeben.

### Verifikation

- Python-Syntax-/Import-Checks fuer neue Governance-, API- und Runtime-Dateien erfolgreich.
- Testdateien wurden auf die neue Auth-/Runtime-Key-Semantik angehoben.

### Nicht moeglich auf dieser Workstation

- Ausfuehrung von `pytest` nicht moeglich, da `pytest` lokal nicht installiert ist.
- Live- oder Docker-Validierung gemaess Vorgabe nicht durchgefuehrt.
