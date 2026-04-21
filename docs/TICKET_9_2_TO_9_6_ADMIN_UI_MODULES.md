## Tickets 9.2 bis 9.6 - Dashboard- und Admin-UI-Module

Stand: 20.04.2026

### Umgesetzt

- Dashboard-Seite in eine echte operative Startseite mit KPIs, Alerts, Needs-Attention und Security-Snapshot umgebaut.
- Login-, Accounts-, API-Keys-, Logs- und Settings-Seiten von Scaffolds auf echte API-gebundene Module gehoben.
- App-Shell zeigt Session-Status und Logout-Aktion.
- Frontend-API unterstuetzt Admin-Token, neue Admin-Module und Runtime-Key-Operationen.
- Theme-System mit staerkerer visueller Sprache, neuen Layout-Helfern und Dark/Light-Paritaet ausgebaut.

### Ergebnis gegen Zielbild

- Die vorherigen Placeholder-Seiten sind jetzt funktionale Control-Plane-Module.
- Security- und Governance-Domaenen sind nicht nur im Backend, sondern direkt in der UI bedienbar.
- Die Providers-Seite zeigt jetzt auch die Kompatibilitaetsmatrix.

### Verifikation

- Frontend-Dateien wurden statisch ueberarbeitet; mangels lokaler Node-/Build-Tooling-Ausfuehrung erfolgte keine Build-Pruefung.

### Nicht moeglich auf dieser Workstation

- `npm`/Frontend-Build nicht verfuegbar.
- Kein visueller Browser- oder Docker-Smoke-Test.
