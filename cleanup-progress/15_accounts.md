Promptdatei: `/opt/ForgeFrame/cleanup/15_accounts.md`

Developer-Zusammenfassung:
- Accounts wurde von einer Kartenliste auf eine echte Inventaroberflaeche mit Tabelle, Filterleiste, Summary-Metriken und rechter Detailflaeche umgebaut.
- Create/Edit laeuft jetzt ueber einen validierten Drawer mit klar getrennten Feldern fuer Label, `provider_bindings` und Operator-Notizen.
- Lifecycle-Aktionen sind auf echte Backend-Zustaende begrenzt: `active`, `suspended`, `disabled`; Archivierung wird ehrlich als `unsupported` dargestellt.
- Der Detail-Handoff zu API Keys traegt jetzt `accountId` mit, und die API-Keys-Seite fokussiert sichtbar die betroffenen Keys des ausgewaehlten Accounts.
- Read-only-Sessions zeigen eine echte Review-Flaeche ohne scheinbar klickbare Mutationsaktionen.

Geaenderte Dateien:
- `frontend/src/pages/AccountsPage.tsx`
- `frontend/src/pages/ApiKeysPage.tsx`
- `frontend/tests/accounts-page.test.tsx`
- `frontend/tests/governance-pages.test.tsx`
- `frontend/tests/governance-tenant-scope.test.tsx`

Audit-Ergebnis:
- Erste Audit-Runde: `REJECTED`
- Zweite Audit-Runde: `APPROVED`

Konkrete Audit-Maengel:
- API-Keys-Handoff verlor den ausgewaehlten Account-Kontext und landete nur auf der generischen Instanz-Key-Liste.
- Drawer-Copy vermischte `provider_bindings` mit API-Keys (`Provider keys` statt `Provider bindings`).

Fix-Runden:
- Runde 1:
  - Accounts-Detaillink auf API Keys um `accountId` erweitert.
  - `ApiKeysPage` liest `accountId`, zeigt eine sichtbare Focus/Handoff-Flaeche und filtert die Key-Liste auf den betroffenen Account.
  - Drawer-Beschriftung und Hilfetext auf `Provider bindings` korrigiert.
  - Tests fuer den fokussierten Handoff und die neue Copy erweitert.
- Finale Runde:
  - Unabhaengiger Auditor hat die Fixes erneut gegen Prompt und Quelltext geprueft und `APPROVED` erteilt.

Finale Freigabe:
- `APPROVED: the previous defects are addressed. AccountsPage now hands off to API Keys with accountId, ApiKeysPage consumes that parameter and visibly focuses/filters the affected account’s keys, and the drawer copy consistently uses Provider bindings instead of conflating bindings with keys. The rest of prompt 15 still holds: required inventory columns are present, create/edit stays in a validated drawer, lifecycle actions match backend-supported states with archive shown honestly as unsupported, read-only sessions hide mutation controls, and the links/tests cover API Keys, Audit History, affected Instance, tenant scope, and audit handoff without placebo controls.`  
- Auditor/Sub-Agent: `Bohr` (`019dd78a-5bf5-7071-bf63-0d6cec4e4334`)

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- accounts-page governance-pages governance-tenant-scope audit-handoff-links`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Grund: Das Projekt nutzt `vitest run`; die Vitest/CAC-CLI kennt `--runInBand` nicht und bricht mit `CACError: Unknown option '--runInBand'` ab.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`45/45` Test Files, `175/175` Tests)

