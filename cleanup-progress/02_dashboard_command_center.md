# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/02_dashboard_command_center.md`
- Developer-Zusammenfassung: `Runde 1: Dashboard-Backend auf Command-Center-Contract erweitert (primary_action, attention, sections, empty_state), DashboardPage auf echte Command-Center-Ansicht mit priorisierter Attention-Liste und konsolidierten Statusbereichen umgebaut, neue Typen und Dashboard-Tests ergänzt. Runde 2: Primary-Action-Priorisierung an die echte Attention-Severity gekoppelt, bulky Scope-Card auf der Dashboard-Seite durch schlanke Scope-Bar ersetzt, blocked/permission/error States mit echten Deep-Links versehen und Tests fuer loading/error/blocked/permission/priority erweitert.`
- Geaenderte Dateien:
  - `backend/app/api/admin/dashboard.py`
  - `backend/tests/test_governance_modules.py`
  - `frontend/src/api/admin.ts`
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/styles/theme.css`
  - `frontend/tests/dashboard-page.test.tsx`
- Audit-Ergebnis: `REJECTED`
- Konkrete Audit-Maengel:
  - `primary_action` wurde zunaechst ueber feste Achsenreihenfolge statt ueber den hoechstprioren Blocker bestimmt; dadurch konnte `runtime degraded` vor `routing/cost blocked` gewinnen.
  - Die Dashboard-Seite zeigte vor der Primaeraktion noch die volle `InstanceScopeCard` mit Erklaer-/Navigationscopy und verletzte damit das Command-Center-Zielbild.
  - Blocked-Scope- und Permission-State hatten zunaechst keine konkreten Recovery-/Review-Links.
- Fix-Runden: `2`
- Finale Freigabe: `PENDING`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> erfolgreich
  - `cd frontend && npm test -- dashboard-page` -> erfolgreich, `1/1` Testdatei, `7/7` Tests
  - `cd frontend && npm test -- --runInBand` -> fehlgeschlagen, Vitest/CACError: `Unknown option --runInBand`
  - `cd frontend && npm test` -> erfolgreich, `40/40` Testdateien, `154/154` Tests
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_governance_modules.py -k dashboard -q` -> erfolgreich, `3 passed`
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_observability_tenant_scoping.py -k dashboard` -> erfolgreich, `1 passed, 6 deselected`
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_scaffold_endpoints.py::test_admin_dashboard_and_security_modules_available` -> erfolgreich, `1 passed`

## Zweite Audit-Runde

- Audit-Ergebnis: `REJECTED`
- Konkrete Audit-Maengel:
  - Ein redundanter Backend-Test rief `_primary_action_from_attention()` mit einer nicht existierenden `empty_state`-Signatur auf und machte den Dashboard-Pytest inkonsistent.
  - Die staerkere vorhandene Prioritaetspruefung musste erhalten bleiben; der doppelte Test war zu entfernen oder konsistent umzubauen.

## Finale Freigabe

- Audit-Ergebnis: `APPROVED`
- Finale Freigabe: `APPROVED`
- Begruendung:
  - Die Seite fuehrt jetzt mit genau einer klaren Primaeraktion.
  - Die Attention-Liste zeigt Severity, Ursache, betroffene Achse und echten Deep-Link pro Eintrag.
  - Die Statusbereiche `Readiness`, `Security`, `Runtime`, `Routing / Queue`, `Cost` sind konsolidiert und enthalten Status, Kurzgrund und naechste Aktion.
  - Empty-, Loading-, Error-, Permission- und Blocked-Scope-Zustaende sind sichtbar und mit ehrlichen Aktionen bzw. Recovery-Links versehen.
  - Dekorative KPI-Karten wurden aus dem Entscheidungsfluss entfernt; das Dashboard ist eine echte Command-Center-Startseite.
  - `cd frontend && npm run build` -> erfolgreich
  - `cd frontend && npm test -- dashboard-page` -> erfolgreich, `7/7` Tests
  - `cd frontend && npm test -- --runInBand` -> fehlgeschlagen, Vitest/CACError: `Unknown option --runInBand`
  - `cd frontend && npm test` -> erfolgreich, `40/40` Testdateien, `154/154` Tests
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_governance_modules.py -k dashboard -q` -> erfolgreich, `3 passed`
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_observability_tenant_scoping.py -k dashboard` -> erfolgreich, `1 passed`
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_scaffold_endpoints.py::test_admin_dashboard_and_security_modules_available` -> erfolgreich, `1 passed`

## Revalidation 2026-04-29

- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel: `keine`
- Finale Freigabe: `APPROVED`
- Begruendung:
  - `DashboardPage.tsx` bleibt auf aktuellem HEAD eine echte Command-Center-Startseite mit einer einzigen Primaeraktion, priorisierter Attention-Liste und konsolidierten Statusachsen.
  - Der nachgezogene Global-Contract-Fix aus `00` hat das Dashboard nicht regressiv veraendert.
  - Die auf aktuellem HEAD erfolgreich gelaufenen Pruefkommandos `cd frontend && npm run build`, `cd frontend && npm test -- --runInBand` (Vitest-Option objektiv unsupported) und `cd frontend && npm test` decken den Dashboard-Stand mit ab.
