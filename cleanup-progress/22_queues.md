Promptdatei: `22_queues.md`

Developer-Zusammenfassung:
- Die Queue-Seite wurde von einer einfachen Run-Liste zu einer lane-zentrierten Backlog-Fläche umgebaut.
- Lane-Summaries zeigen jetzt Queue-Length, Runnable, Running, Paused, Quarantined und ein sofort sichtbares Fairness-/Capacity-Signal.
- `Oldest age` misst jetzt echtes lane-weites Backlog-Alter und verschweigt keine alten pausierten, quarantinierten oder approval-blockierten Runs mehr.
- Filter nach Instanz, Lane, State, Target und Alter sind URL-gebunden und wirken über die reale Queue-API.
- Die Backlog-Tabelle erklärt für jeden Eintrag den Grund des Wartens, die zugeordnete Lane, den Target-Kontext, das Alter und die nächste erlaubte Folgeaktion.
- Die Seite verlinkt konsequent in die Execution-Detailfläche, dupliziert aber keine vollständige Run-Bedienung.
- `no backlog` wird als positiver Success-State gerendert.

Geänderte Dateien:
- `frontend/src/pages/QueuesPage.tsx`
- `frontend/tests/queues-page.test.tsx`
- `frontend/src/api/admin.ts`
- `backend/app/api/admin/execution.py`
- `backend/app/execution/admin_models.py`
- `backend/app/execution/admin_service.py`
- `backend/tests/test_execution_queue_dispatch_api.py`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Erste Audit-Runde abgelehnt:
  - `frontend/src/pages/QueuesPage.tsx`: `Oldest age` und der Fairness-Text beschrieben nur runnable Backlog statt die älteste Arbeit der Lane.
  - `backend/app/execution/admin_service.py`: `longest_wait_seconds` wurde nur aus `admitted`/`retry_scheduled` berechnet und blendete altes blockiertes Backlog aus.
  - `frontend/tests/queues-page.test.tsx` und `backend/tests/test_execution_queue_dispatch_api.py`: Es fehlten Regressionstests für altes nicht-runnable Backlog.
- In Fix-Runde 1 behoben und vom Auditor erneut geprüft.

Fix-Runden:
- `1`

Finale Freigabe:
- `APPROVED`
- Aquinas: `APPROVED`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- queues-page`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`46` Testdateien, `189` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_execution_queue_dispatch_api.py backend/tests/test_execution_admin_api.py`
  - Ergebnis: `PASS` (`16` Tests)
- Nach Fix-Runde 1 erneut ausgeführt:
  - `cd /opt/ForgeFrame/frontend && npm run build`
    - Ergebnis: `PASS`
  - `cd /opt/ForgeFrame/frontend && npm test -- queues-page`
    - Ergebnis: `PASS` (`1` Testdatei, `5` Tests)
  - `cd /opt/ForgeFrame/frontend && npm test`
    - Ergebnis: `PASS` (`46` Testdateien, `190` Tests)
  - `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_execution_queue_dispatch_api.py backend/tests/test_execution_admin_api.py`
    - Ergebnis: `PASS` (`16` Tests)
