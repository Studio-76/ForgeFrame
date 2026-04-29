Promptdatei: `26_usage.md`

Developer-Zusammenfassung:
- Usage wurde von einer gemischten Kosten-/Diagnosefläche zu einer fokussierten Nutzungsanalyse umgebaut.
- Die Seite hat jetzt einen echten Filterkopf für Zeitfenster, Provider, Client und Modell; die API-Key-Achse ist sichtbar, aber ehrlich als `unsupported` geblockt, weil Runtime-Fehlerereignisse Auth-Attribution noch nicht persistieren.
- Die Summary zeigt Requests, Tokens, Streaming-Anteil, Fehlerquote, p95-Latenz sowie Top-Provider und Top-Client.
- Provider-, Client- und Modell-Drilldowns sind als Tabellen mit echten Deep-Links zu `Provider Health & Runs`, `Errors` und `Costs` umgesetzt.
- Costs wird nur noch als Querverweis benutzt; Budget-/Kostensteuerung bleibt aus dieser Seite herausgenommen.
- Das Backend liefert für gefilterte Usage-Summaries jetzt echte gefilterte Aggregate inklusive Streaming-Anteil, Latenzmetrik und Filter-Echo zurück.

Geänderte Dateien:
- `frontend/src/api/admin.ts`
- `frontend/src/features/usage/UsagePage.tsx`
- `frontend/src/features/usage/sections.tsx`
- `frontend/tests/usage-page.test.tsx`
- `backend/app/api/admin/usage.py`
- `backend/app/usage/analytics.py`
- `backend/app/storage/observability_repository.py`
- `backend/tests/test_runtime_core.py`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Runde 1: Provider- und Client-Drilldown-Tabellen verlinkten nur auf generische Folge-Routen (`Providers`, `Errors`, `Costs`) statt auf zeilenspezifische Usage-Deep-Links.
- Runde 1: Die vorhandenen Provider-/Client-Drilldown-Endpunkte wurden im Frontend für diese Tabellen nicht genutzt, sodass der Drilldown-Kontext pro Zeile fehlte.
- Runde 1: Die Tests prüften nur generische Links und hätten den fehlenden row-spezifischen Drilldown nicht erkannt.

Fix-Runden:
- `1`

Finale Freigabe:
- `APPROVED`
- Aquinas: `APPROVED`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- usage-page`
  - Ergebnis: `PASS` (`1` Testdatei, `5` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`47` Testdateien, `190` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_runtime_core.py -k "admin_usage"`
  - Ergebnis: `PASS` (`4` Tests, `100` deselected)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_observability_sql_queries.py`
  - Ergebnis: `FAIL`
  - Exakte Ursache: externer Infrastrukturblocker; die lokale PostgreSQL-Verbindung unter `postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate` scheitert mit `password authentication failed for user "forgegate"`.
