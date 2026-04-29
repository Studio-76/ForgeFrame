Promptdatei: `/opt/ForgeFrame/cleanup/20_audit_export.md`

Developer-Zusammenfassung:
- `/logs#audit-export` fokussiert jetzt direkt den Export-Bereich sichtbar und trennt den Evidence-Package-Flow klar von `Audit History`.
- Das Export-Formular verwendet jetzt echte Exportfelder statt nur impliziter Logs-/History-Nebenwirkungen: `Instance`, `Window`, optional `Actor`, optional `Action`, optional `Outcome`, `Format`, `Include Raw Details`, `Limit`.
- `generateAuditExport` akzeptiert jetzt echte Exportoptionen fuer `actor` und `include_raw_details`; der Backend-Export filtert Actor serverseitig und kann Rohmetadaten bewusst ein- oder ausschliessen.
- Das Ergebnis zeigt jetzt nutzbare Paket-Metadaten: Dateiname, Artefakt-ID, Zeilenanzahl, Paketgroesse, Zeitraum, angewandte Actor-/Action-/Outcome-Filter und ob Rohdetails enthalten sind.
- Export-Fehler werden nicht mehr als generisches rotes Alert ausgegeben, sondern mit `Cause` und `How to fix`.
- Der Export-Backendpfad wurde auf denselben realen instance-scoped Contract wie Audit History gezogen; relevante Export-/History-Tests sind dafuer gruen.

Geaenderte Dateien:
- `frontend/src/features/logs/LogsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/logs-page.test.tsx`
- `backend/app/api/admin/logs.py`
- `backend/tests/test_admin_logs_export.py`
- `cleanup-progress/20_audit_export.md`

Audit-Ergebnis:
- Runde 1: `APPROVED`
  - Grund: `/logs#audit-export` fokussiert den Export-Bereich sichtbar, der Export besitzt einen eigenen Evidence-Package-Flow mit echten Feldern und Backend-Wirkung, und Ergebnis-/Fehlerdarstellung entsprechen dem Prompt.

Konkrete Audit-Maengel:
- Keine offenen Maengel nach Auditor-Readthrough.

Fix-Runden:
- Runde 1:
  - Export-Workflow innerhalb `LogsPage` vom History-Review separiert.
  - Exportformular um explizite Actor-/Action-/Outcome-/Raw-Details-Steuerung erweitert.
  - Exportergebnis um Paket-Metadaten und klaren Download-/Audit-Event-Nachlauf erweitert.
  - Fehlerdarstellung auf Ursache + Korrekturhinweis umgebaut.
  - Backend-Exportfilter um Actor und `include_raw_details` erweitert.
  - Export-Inhalt so umgesetzt, dass Rohmetadaten bewusst redacted inkludiert oder ausgeschlossen werden koennen.
  - Relevante Frontend- und Backend-Tests auf den neuen Export-Contract angehoben und gruen gezogen.

Finale Freigabe:
- `APPROVED`
- Auditor-Begruendung:
  - Prompt 20 ist erfüllt. `/logs#audit-export` fokussiert den Export-Bereich direkt, der Export läuft als eigener Evidence-Package-Flow mit separatem Formularzustand, klaren Feldern inklusive `Include raw details`, nicht-generischer Fehlerdarstellung mit Ursache/Korrekturhinweis und einem nutzbaren Ergebnis mit Dateiname, Artefakt-ID, Größe, Zeitraum und Download/Audit-Link.
  - Die Backend-Wirkung ist echt umgesetzt und durch die direkt relevanten Signale gedeckt: `npm run build` grün, `frontend/tests/logs-page.test.tsx` grün, `backend/tests/test_admin_logs_export.py` grün; `npm test -- --runInBand` scheitert nur am dokumentierten Vitest-Option-Blocker.

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- logs-page`
  - Ergebnis: erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: fehlgeschlagen, objektiver Tooling-Blocker
  - Exakter Grund: `CACError: Unknown option '--runInBand'`
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: erfolgreich, `46` Testdateien / `185` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py backend/tests/test_admin_logs_export.py`
  - Ergebnis: erfolgreich, `22` Tests bestanden
