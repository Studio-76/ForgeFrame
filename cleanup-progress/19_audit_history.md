Promptdatei: `/opt/ForgeFrame/cleanup/19_audit_history.md`

Developer-Zusammenfassung:
- `Audit History` innerhalb von `Logs` wurde zu einer fokussierten Evidence-Suche ausgebaut, statt nur ein unstrukturierter Unterabschnitt zu bleiben.
- `/logs#audit-history` und `/logs#audit-export` setzen jetzt sichtbaren Anchor-Fokus auf die jeweilige Karte und behalten den Hash bei Filterwechseln.
- Die Audit-Tabelle zeigt jetzt die geforderten Kernspalten `Actor`, `Action`, `Target`, `Outcome`, `Correlation` und `Timestamp`, plus echte Detailoeffnung.
- Die Filter sind URL-gebunden und wirken reproduzierbar auf die API-Abfrage: `instanceId`, `auditWindow`, `auditAction`, `auditActor`, `auditTargetType`, `auditTargetId`, `auditStatus`.
- Das Detailpanel startet mit einer kurzen Interpretation und kapselt Rohdaten separat in `AdvancedDiagnostics`.
- Im Backend wurden zwei echte Scope-/Filterfehler behoben:
  - Audit-/Logs-Endpunkte filterten ohne Benutzerwunsch auf `instance.company_id` und blendeten dadurch normale Audit-Events aus.
  - `targetId` wurde serverseitig zu frueh nur gegen rohe `target_id` gefiltert; jetzt laeuft die Suche gegen normalisierte Target-/Correlation-Daten.
- Audit-Links aus anderen Seiten bleiben vorausgefuellt und fuehren auf denselben Hash-/Filterpfad zurueck.

Geaenderte Dateien:
- `frontend/src/features/logs/LogsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/src/styles/theme.css`
- `frontend/tests/logs-page.test.tsx`
- `backend/app/api/admin/logs.py`
- `backend/tests/test_admin_logs_audit_history_api.py`
- `backend/tests/test_admin_logs_export.py`
- `cleanup-progress/19_audit_history.md`

Audit-Ergebnis:
- Runde 1: `APPROVED`
  - Grund: Audit-History fokussiert den Hash-Zielbereich sichtbar, Filter sind URL-gebunden und API-wirksam, Tabelle/Detailpanel entsprechen dem Prompt, und die relevanten Backend-Scope-/Filterpfade sind echt umgesetzt.

Konkrete Audit-Maengel:
- Keine offenen Maengel nach Auditor-Readthrough.

Fix-Runden:
- Runde 1:
  - Hash-Fokus und Hash-Erhalt bei Audit-History-/Audit-Export-Filtern implementiert.
  - Target-Suchfeld und Correlation-Spalte in der Audit-Tabelle ergänzt.
  - Detailpanel auf Kurzinterpretation zuerst, Rohdetails danach umgebaut.
  - Backend-Audit-History auf lokales, normalisiertes Filtermatching umgestellt.
  - Backend-Scope-Bug beseitigt, der ohne explizite `companyId` ungewollt auf `instance.company_id` filterte.
  - Direkt betroffene Audit-History- und Audit-Export-Tests auf den aktuellen instance-scoped Contract aktualisiert und gruen gezogen.

Finale Freigabe:
- `APPROVED`
- Auditor-Begruendung:
  - Prompt 19 ist erfüllt. `/logs#audit-history` springt und fokussiert den Audit-Bereich sichtbar, die Filter sind URL-gebunden und wirken auf echte API-Abfragen, die Audit-History rendert als echte Tabelle mit `Outcome` und `Correlation`, Rohdetails bleiben separat ausklappbar, und vorausgefüllte Audit-Links sind aus relevanten Seiten verdrahtet.
  - Die betroffenen Scope-/Filterpfade im Backend sind real umgesetzt und durch gruene Signale aus `npm run build`, `npm test` sowie den relevanten Backend-Tests gedeckt; `npm test -- --runInBand` scheitert nur am dokumentierten Vitest-Option-Blocker.

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- logs-page audit-handoff-links execution-page approvals-page`
  - Ergebnis: erfolgreich, `26` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: fehlgeschlagen, objektiver Tooling-Blocker
  - Exakter Grund: `CACError: Unknown option '--runInBand'`
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: erfolgreich, `46` Testdateien / `185` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py`
  - Ergebnis: erfolgreich, `9` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_export.py`
  - Ergebnis: erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_export.py backend/tests/test_observability_tenant_scoping.py`
  - Ergebnis: fehlgeschlagen
  - Bewertung: breiter Explorationssatz ausserhalb des direkten Prompt-19-Scope; Failures betreffen Usage-/Dashboard-/OAuth-/Runtime-Scoping und einen externen lokalen Postgres-Authentifizierungsblocker (`password authentication failed for user "forgegate"`). Nicht als Gating-Signal fuer Prompt 19 verwendet.
