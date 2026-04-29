Promptdatei: `23_dispatch.md`

Developer-Zusammenfassung:
- Dispatch wurde zur technischen Lease-/Worker-/Outbox-Fläche unterhalb von Runs und Queues umgebaut.
- `Worker Leases` zeigt jetzt pro aktivem Lease Worker, Instance, Lane, Target, Lease-Expiry, letzte Renewal/Heartbeat-Zeit und ein explizites Stale-Risk.
- `Leased Attempts` trennt abgelaufene/stalled Attempts von allen aktiven Attempts und verlinkt jede betroffene Run-ID in die Execution Review.
- `Outbox Pressure` erklärt Publish-State-Ursachen auf Basis der echten Outbox-States und verlinkt in Notifications sowie Execution Review.
- `Reconciliation` rendert echte Mutationsergebnisse mit korrigierten Lease-/Attempt-Zahlen, Ergebnisliste und ehrlichem Permission-Blocker im Read-only-Fall.
- Rohdaten bleiben in `Advanced Diagnostics` sichtbar, dominieren aber die Seite nicht mehr.
- Das Backend liefert für Dispatch-Attempts jetzt echten Target-Kontext, damit die Oberfläche Zielbezug nicht halluzinieren muss.

Geänderte Dateien:
- `frontend/src/pages/DispatchPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/dispatch-page.test.tsx`
- `backend/app/execution/admin_models.py`
- `backend/app/execution/admin_service.py`
- `backend/tests/test_execution_queue_dispatch_api.py`

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
- `cd /opt/ForgeFrame/frontend && npm test -- dispatch-page`
  - Ergebnis: `PASS` (`1` Testdatei, `2` Tests)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`46` Testdateien, `191` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_execution_queue_dispatch_api.py backend/tests/test_execution_operator_fabric.py`
  - Ergebnis: `PASS` (`6` Tests)
