Promptdatei: `24_provider_health_runs.md`

Developer-Zusammenfassung:
- Der Health-&-Runs-Bereich auf Providers ist jetzt eine eigene Operations-Fläche mit stabilem DOM-Anchor `provider-health-runs` direkt auf der fokussierbaren Card.
- Beim Öffnen mit `#provider-health-runs` wird der Abschnitt sichtbar markiert, gescrollt und fokussiert.
- Die Health-Run-Tabelle zeigt jetzt pro Provider Target/Model, letzten Run, Status, Fehler und die nächste echte Folgeaktion.
- `Show probe` selektiert eine konkrete Provider-Probe-Detailansicht statt nur auf einen zufälligen Abschnitt zu verweisen.
- Fehler- und Setup-Handoffs verlinken ehrlich in Provider Inventory, OAuth Targets oder Provider Targets.
- Die Providers-Seite lädt wieder die vorhandenen Harness-/Probe-Runs, nutzt sie aber nur für diesen fokussierten Health-&-Runs-Abschnitt statt die ganze Harness-Fläche zurückzubringen.

Geänderte Dateien:
- `frontend/src/pages/ProvidersPage.tsx`
- `frontend/src/features/providers/ProvidersSections.tsx`
- `frontend/tests/providers-page.test.tsx`
- `frontend/tests/provider-health-runs-anchor.test.tsx`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Keine.

Fix-Runden:
- `0`

Finale Freigabe:
- `APPROVED`
- Aquinas: `APPROVED`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- providers-page provider-health-runs-anchor`
  - Ergebnis: `PASS` (`2` Testdateien, `6` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`47` Testdateien, `192` Tests)
