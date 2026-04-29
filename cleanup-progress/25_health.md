Promptdatei: `25_health.md`

Developer-Zusammenfassung:
- Die Health-Seite trennt technische Laufzeitgesundheit und operative Readiness jetzt explizit in zwei getrennte Statusflächen.
- Die Seite gruppiert die operativen Checks in `DB / Migration`, `API`, `Frontend`, `Providers`, `Queue / Worker`, `TLS / FQDN` und `Observability` und zeigt pro Gruppe Status, letzte Prüfung, Evidence, Fehler und Korrekturroute.
- `Provider Needing Review` listet nur echte Problemprovider und verlinkt abhängig vom Blocker in `Provider Health & Runs` oder `OAuth Targets`.
- `Signal Path` prüft Logs, Usage, Costs und Audit auf echte gespeiste Evidenz statt auf kosmetische Statuschips.
- Die Frontend-Typen wurden um `bootstrap_readiness` erweitert, damit die Readiness-Oberfläche den vorhandenen Backend-Bootstrapzustand ehrlich auswertet.

Geänderte Dateien:
- `frontend/src/pages/HealthPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/observability-pages.test.tsx`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Runde 1: OAuth-bezogene Provider-Probleme wurden auf der Health-Seite nur über `oauth_connect_required` nach `OAuth Targets` geleitet. Fälle mit `next_action_kind = "connect_oauth"` fielen fälschlich auf `Provider Health & Runs` zurück.
- Runde 1: Der Observability/Health-Test deckte diesen OAuth-Handoff-Fall nicht ab und hätte die Fehlverdrahtung deshalb nicht erkannt.

Fix-Runden:
- `1`

Finale Freigabe:
- `APPROVED`
- Aquinas: `APPROVED`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- observability-pages`
  - Ergebnis: `PASS` (`1` Testdatei, `3` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`47` Testdateien, `192` Tests)
