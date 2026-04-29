# Promptdatei

`cleanup/28_errors_incident_review.md`

# Developer-Zusammenfassung

Errors wurde von einer einfachen Alert-/Summary-Seite zu einer echten Incident-Review-Fläche umgebaut. Die Seite lädt jetzt strukturierte `incident_review`-Daten aus `/admin/logs/`, priorisiert Incident-Achsen nach Severity und Impact, trennt blockierte Routing-Failures in einen eigenen Triage-Block, zeigt für jede Achse aktuelle Wirkung plus nächste Aktion und hält Roh-Evidenz bewusst erst im Detailpanel unterhalb der Kurzinterpretation. Im Backend liefert `/admin/logs/` dafür gruppierte Incidents für Runtime, Provider, OAuth, Routing, Queue/Dispatch, Security, TLS und Work Interaction sowie reason-spezifische Routing-Blocker. Der kritische Sonderfall `budget_blocked=true` ohne Failure-Row bleibt jetzt explizit ein aktiver Routing-Incident mit echter Next-Action.

# Geänderte Dateien

- `backend/app/api/admin/logs.py`
- `backend/tests/test_admin_logs_audit_history_api.py`
- `backend/tests/test_scaffold_endpoints.py`
- `frontend/src/api/admin.ts`
- `frontend/src/pages/ErrorsPage.tsx`
- `frontend/tests/errors-page.test.tsx`
- `frontend/tests/observability-pages.test.tsx`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Mängel

## Audit Runde 1

- `backend/app/api/admin/logs.py`: Routing-Achse konnte bei `budget_blocked=true` als `critical` markiert sein und gleichzeitig fälschlich `No blocked routing decision is currently recorded.`, `Monitor only.` und `No routing incident is currently recorded.` ausliefern.
- `frontend/tests/errors-page.test.tsx` und `backend/tests/test_admin_logs_audit_history_api.py`: Kein Test deckte den Pfad `budget_blocked=true` ohne Failure-Row ab.

# Fix-Runden

## Fix Runde 1

- Routing-Incident-Logik in `backend/app/api/admin/logs.py` auf die persistierte Budget-Wahrheit aus `routing_metrics.budget.hard_blocked` umgestellt.
- Routing-Achse liefert bei aktivem Budget-Gate jetzt konkrete `current_effect`, `next_step` und `summary`, auch wenn noch keine Failure-Row existiert.
- Backend-Ausgabe der `blocked_routing_failures` deterministisch nach `created_at` absteigend sortiert.
- Frontend-Test `frontend/tests/errors-page.test.tsx` um den Budget-Gate-ohne-Failure-Row-Fall ergänzt.
- Backend-Test `backend/tests/test_admin_logs_audit_history_api.py` um denselben Pfad ergänzt.

# Finale Freigabe

Senior Audit/Review Sub-Agent: `APPROVED`

Begründung: Prompt 28 ist vollständig erfüllt. Errors arbeitet jetzt als echte Incident-Review-Fläche mit priorisierten Achsen, separatem Block für Blocked Routing Failures, Kurzinterpretation vor Roh-Evidenz und passenden Handoffs. Der zuvor beanstandete Budget-Gate-Pfad bleibt korrekt ein aktiver Routing-Incident mit konkreter Next-Action und ist in Frontend und Backend abgesichert.

# Ausgeführte Prüfkommandos

- `cd /opt/ForgeFrame/frontend && npm run build`
  - PASS
- `cd /opt/ForgeFrame/frontend && npm test -- errors-page`
  - PASS
- `cd /opt/ForgeFrame/frontend && npm test -- observability-pages`
  - PASS
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - FAIL
  - Objektiver Blocker: Das Projekt verwendet Vitest; die CLI meldet `CACError: Unknown option --runInBand`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - PASS (`49` Testdateien, `196` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py -k "logs_overview or blocked_routing_failures"`
  - PASS (`4 passed, 7 deselected`)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_scaffold_endpoints.py -k "admin_dashboard_and_security_modules_available"`
  - PASS (`1 passed, 31 deselected`)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py -k "groups_security_and_tls_incidents or blocked_routing_failures"`
  - PASS (`2 passed, 9 deselected`)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py -k "budget_blocked_without_failure_row or blocked_routing_failures"`
  - PASS (`2 passed, 10 deselected`)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_logs_audit_history_api.py`
  - PASS (`12 passed`)
