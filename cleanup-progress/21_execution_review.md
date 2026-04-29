Promptdatei: `21_execution_review.md`

Developer-Zusammenfassung:
- Execution Review wurde von einer diagnostiklastigen Listenansicht zu einer echten Run-Control-Fläche umgebaut.
- Die Filterleiste bindet jetzt Instanz, Run-State, Lane, Target/Issue, Approval-Wait, Fehler und Zeitraum an URL und API.
- Die Run-Ansicht zeigt eine belastbare Tabelle mit ID, Titel/Purpose, State, Lane, Target, Attempts, Cost-Class, Start/Update und nächster Aktion.
- Das Detailpanel erklärt den Run-Lifecycle in Operator-Sprache und bündelt Timeline, Dispatch-Jobs, Decisions, Approval-Links, Artefakte, Operator-Aktionen, Replay und Raw Details.
- Operator-Aktionen werden nur aktiviert, wenn die Backend-Transitionen sie für den aktuellen Zustand zulassen.
- Das Backend liefert jetzt Approval-Link-Daten im Detailpayload und wertet die neuen Listenfilter real auf `/admin/execution/runs` aus.

Geänderte Dateien:
- `frontend/src/features/execution/ExecutionPage.tsx`
- `frontend/src/features/execution/sections.tsx`
- `frontend/src/features/execution/helpers.ts`
- `frontend/src/api/admin.ts`
- `frontend/src/app/executionReview.ts`
- `frontend/tests/execution-page.test.tsx`
- `backend/app/api/admin/execution.py`
- `backend/app/execution/admin_models.py`
- `backend/app/execution/admin_service.py`
- `backend/tests/test_execution_admin_api.py`
- `backend/tests/test_execution_queue_dispatch_api.py`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Keine.

Fix-Runden:
- `0`

Finale Freigabe:
- `APPROVED`
- Aquinas: `Prompt 21 ist erfüllt. frontend/src/features/execution/ExecutionPage.tsx, sections.tsx und helpers.ts bilden die geforderten Filter, die Run-Tabelle, Lifecycle-Erklärung, Approval-Handoffs, Artefakte, Raw-Details, Replay und zustandsabhängige Operator-Aktionen mit realer API-Wirkung ab; frontend/src/api/admin.ts sowie backend/app/api/admin/execution.py und backend/app/execution/admin_service.py liefern die dazugehörigen echten List/Detail/Replay/Action-Endpunkte. Relevante Signale sind grün: frontend Build, frontend/tests/execution-page.test.tsx, backend/tests/test_execution_admin_api.py und backend/tests/test_execution_queue_dispatch_api.py; npm test -- --runInBand scheitert nur am bekannten Vitest-Option-Blocker (CACError: Unknown option '--runInBand').`

Ausgeführte Prüfkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- execution-page`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Exakte Ursache: `vitest run --runInBand` scheitert in diesem Projekt mit `CACError: Unknown option '--runInBand'`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`46` Testdateien, `187` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_execution_admin_api.py backend/tests/test_execution_operator_fabric.py backend/tests/test_execution_queue_dispatch_api.py`
  - Ergebnis: `PASS` (`18` Tests)
