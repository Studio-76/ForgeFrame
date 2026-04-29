# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/14_recovery_backup_restore.md`
- Developer-Zusammenfassung: `Die Recovery-Seite wurde von einer langen Formularsammlung zu einer echten Betriebsflaeche mit den Bereichen Overview, Policies, Backup Evidence, Restore Evidence und Upgrade / Rollback umgebaut. Das Overview zeigt jetzt pro Datenklasse explizit `Protected`, Backup-Ziel, letzte Sicherung, letzten Restore-Test und das aktuelle Risiko. Policies werden ueber einen echten Drawer mit strukturierten Feldern erstellt und bearbeitet. Backup-, Restore- und Upgrade-Imports validieren semantisch vor dem Submit und zeigen nach erfolgreichem Import ein sichtbares Ergebnis. Backup allein bleibt hart blockiert, solange keine Restore-Evidence vorliegt. Pausierte Policies zaehlen weder im Backend-Summary noch in der UI als wirksamer Schutz oder gruenes Signal. Die Recovery-API unterscheidet sauber zwischen `404 recovery_policy_not_found` und `400 ..._report_invalid`.`
- Geaenderte Dateien:
  - `frontend/src/pages/RecoveryPage.tsx`
  - `frontend/src/api/admin.ts`
  - `frontend/tests/recovery-page.test.tsx`
  - `backend/app/api/admin/recovery.py`
  - `backend/app/recovery/service.py`
  - `backend/tests/test_recovery_admin_api.py`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Runde 1`: Die Ausgangsseite war noch eine breite Formularwand ohne klare Bereiche, ohne Datenklassen-Coverage pro Klasse und ohne Drawer-basierte Policy-Bearbeitung.
  - `Runde 2`: `Protected` fehlte als explizite Aussage im Coverage-Overview; `Restore nie getestet` war nicht hart genug regressionsgesichert; der Upgrade-Import-Test pruefte kein koharentes sichtbares Ergebnis.
  - `Runde 3`: Importvalidierung war nur syntaktisch/strukturell, pausierte Policies konnten teils als Schutz gelten und Importform-Ziel plus Seitentitel konnten auseinanderlaufen.
  - `Runde 4`: Pausierte Policies wurden noch nicht ueberall als nicht wirksamer Schutz behandelt; Recovery-Summary und Policy-/Evidence-Flows mussten strenger nur aktive Schutzpfade zaehlen.
  - `Runde 5`: Die Frontend-Validatoren mussten exakt auf die Backend-Semantik gezogen werden, inklusive Integer-Zwang fuer `tables_compared`, nicht-leere Upgrade-Snapshots und ehrlicher UI-Signale in Drawer, Intro-Badges und Upgrade-Status.
- Fix-Runden: `5`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `PASS`
  - `cd frontend && npm test -- --runInBand` -> `FAIL, Vitest/CAC in diesem Projekt kennt die Option --runInBand nicht`
  - `cd frontend && npm test -- recovery-page` -> `PASS (5 Tests)`
  - `cd frontend && npm test` -> `PASS (44/44 Testdateien, 171/171 Tests)`
  - `/opt/ForgeFrame/.venv/bin/pytest backend/tests/test_recovery_admin_api.py` -> `PASS (12 Tests)`

## Finale Freigabe

- Audit-Ergebnis: `APPROVED`
- Begruendung:
  - Die Seite ist in die geforderten Betriebsbereiche getrennt und fuehrt Coverage, Policies, Backup-Evidence, Restore-Evidence sowie Upgrade-/Rollback-Proof real getrennt.
  - Das Coverage-Overview zeigt pro Datenklasse explizit Schutzstatus, Backup-Ziel, letzte Sicherung, letzten Restore-Test und Risiko.
  - Policy-Create/Edit laufen ueber einen echten Drawer mit strukturierter Formularvalidierung statt ueber lange Seitenformulare.
  - Backup-, Restore- und Upgrade-Reports validieren semantisch vor dem Submit und liefern nach erfolgreichem Import sichtbare Ergebnisse.
  - Restore nie getestet bleibt hart sichtbar blockierend; Backup allein wird nirgends kosmetisch gruen.
  - Pausierte Policies zaehlen weder im Backend-Summary noch in irgendeinem UI-Bereich als wirksamer Schutz oder positives Signal.
  - Die API trennt sauber `404 recovery_policy_not_found` von `400 ..._report_invalid`.
