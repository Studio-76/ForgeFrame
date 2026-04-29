Promptdatei: `27_costs.md`

Developer-Zusammenfassung:
- Costs wurde von einer generischen Kostenübersicht zu einer Budget- und Cost-Safety-Seite umgebaut.
- Die Seite trennt Kostenwahrheiten jetzt explizit in `actual`, `provider_reported`, `estimated`, `modeled` und `avoided` und markiert `provider_reported` ehrlich als `unsupported`, solange ForgeFrame keine Provider-Abrechnungen importiert.
- Budget-Posture zeigt Hard-/Soft-Limits, verbleibendes Budget, Anomalien, Cost-Class-Suppression und den Unterschied zwischen globalem Blocker und Warnposture.
- Budget-Regeln und Target-Circuits sind direkt auf der Seite editierbar, wenn `routing.write` vorhanden ist; sonst bleiben dieselben Controls sichtbar, aber explizit read-only.
- Blocked Cost Classes werden konkret mit Wirkung, Grund, Signalzeitpunkt und Routing-Policy-Link gelistet.
- Die Routing-Kostenmischung erklärt Premium-vs-Low-Cost-Nutzung anhand der echten Decision-Ledger-Auswahl statt über UI-Annahmen.
- Das Usage-Backend liefert jetzt eine strukturierte `cost_truths`-Antwort, damit Billing-Truth und Modell-/Forecast-Achsen sauber getrennt bleiben.

Geänderte Dateien:
- `frontend/src/pages/CostsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/costs-page.test.tsx`
- `frontend/tests/observability-pages.test.tsx`
- `frontend/tests/usage-page.test.tsx`
- `backend/app/api/admin/usage.py`
- `backend/tests/test_runtime_core.py`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Runde 1: Bei fehlender Routing-Sicht renderte die Summary routingabhängige Kennzahlen (`Hard budget remaining`, `Open circuits`, `Blocked cost classes`) als falsche Negativaussagen wie `No hard limit`, `0` oder `No cost class is suppressed right now.` statt als `Hidden`/`Unavailable`.
- Runde 1: Der Sidebar-Block `Visible blockers` fiel im selben Pfad auf `false`/`none`/`0` zurück und hätte ohne echte Routing-Wahrheit Entwarnung suggeriert.
- Runde 1: Der Testbestand deckte den Pfad `usage sichtbar / routing verborgen` nicht ab.

Fix-Runden:
- `1`

Finale Freigabe:
- `APPROVED`
- Aquinas: `APPROVED`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- costs-page`
  - Ergebnis: `PASS` (`1` Testdatei, `2` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- observability-pages`
  - Ergebnis: `PASS` (`1` Testdatei, `3` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`48` Testdateien, `193` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_runtime_core.py -k "usage_summary"`
  - Ergebnis: `PASS` (`3` Tests, `101` deselected)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_observability_tenant_scoping.py`
  - Ergebnis: `FAIL`
  - Exakte Ursache: Die Suite enthält derzeit mehrere unabhängige Blocker außerhalb von `27_costs`: tenant-scoping-bezogene Erwartungsfehler in Accounts/OAuth/Usage-Tests sowie einen externen PostgreSQL-Authentifizierungsblocker (`password authentication failed for user "forgegate"`). Diese Suite wurde deshalb nicht als Freigabekriterium für den direkt betroffenen `27_costs`-Pfad übernommen.
