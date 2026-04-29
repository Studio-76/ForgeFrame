# Promptdatei

`cleanup/33_automations.md`

# Developer-Zusammenfassung

Automations wurde zu einer echten Regel- und Trigger-Flaeche ausgebaut. Die Inventaransicht ist jetzt tabellarisch mit Status, Schedule, Next Run, Last Run, Target und Outcome; das Detailpanel zeigt Trigger-History, letzte materialisierte Objekte, ein sichtbares `Test now`-Ergebnis und einen klaren Governance-Hinweis fuer Automationen mit Aussenwirkung. Der Schedule wird primär ueber einen strukturierten `Every`/`Unit`-Editor gepflegt; Raw-Cadence und `Metadata JSON` sind nur noch ueber einen expliziten Advanced-Bereich erreichbar.

# Geaenderte Dateien

- `frontend/src/pages/AutomationsPage.tsx`
- `frontend/tests/tasking-delivery-pages.test.tsx`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Erste Audit-Runde: `Advanced raw cadence minutes` war sichtbar statt hinter einem Advanced-Bereich.
- Zweite Audit-Runde: `Metadata JSON` war weiterhin primär sichtbar statt im Advanced-Bereich.

# Fix-Runden

- `2`

# Finale Freigabe

`APPROVED: Der aktuelle Stand von frontend/src/pages/AutomationsPage.tsx erfuellt cleanup/33_automations.md jetzt sauber: Inventar mit Status/Schedule/Next Run/Last Run/Target/Outcome, Detailpanel mit Trigger-History und ehrlicher bridge-only-Kennzeichnung fuer fehlende Run-Ledger-/Approval-Modelldaten, sichtbares Test-now-Ergebnis und klarer Governance-Hinweis fuer Automationen mit Aussenwirkung. Der strukturierte Schedule-Editor ist primaer, waehrend Raw-Cadence und Metadata JSON nur noch im expliziten Advanced-Bereich liegen; frontend/tests/tasking-delivery-pages.test.tsx deckt genau diese Sichtbarkeits- und Persistenzpfade ab.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- tasking-delivery-pages` -> erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `49` Testdateien und `200` Tests bestanden
