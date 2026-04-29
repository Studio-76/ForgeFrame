# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/04_instances.md`
- Developer-Zusammenfassung: `Instances wurde zu einer echten Instanzverwaltung mit filterbarer Tabelle, scoped Detailpanel, Readiness-/Operator-/Routing-/Work-Interaction-Zustand, ehrlicher Operator-Erzeugungsrueckmeldung beim Create und echten Deep-Links fuer die naechsten Setup-Aktionen umgebaut.`
- Geaenderte Dateien:
  - `backend/app/agents/service.py`
  - `backend/app/api/admin/agents.py`
  - `backend/app/api/admin/control_plane.py`
  - `backend/app/api/admin/instances.py`
  - `backend/tests/test_agents_admin_api.py`
  - `backend/tests/test_instances_admin_api.py`
  - `frontend/src/api/admin.ts`
  - `frontend/src/components/InstanceScopeCard.tsx`
  - `frontend/src/pages/AgentsPage.tsx`
  - `frontend/src/pages/InstancesPage.tsx`
  - `frontend/tests/instances-page.test.tsx`
  - `frontend/tests/instances-page-agents-truth.test.tsx`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Peirce`: `Open Agents` heilte einen fehlenden Default-Operator noch still auf GET; zusaetzlich schrieben Instance-Filter die `instanceId` in der URL heimlich um, sobald die aktuelle Scope aus dem Filter fiel.
- Fix-Runden: `1`
- Finale Freigabe: `APPROVED durch Hypatia`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `passed`
  - `cd frontend && npm test -- --runInBand` -> `failed as tooling incompatibility (Vitest: Unknown option --runInBand)`
  - `cd frontend && npm test -- instances-page` -> `passed`
  - `cd frontend && npm test` -> `passed (41 test files, 151 tests)`
  - `./.venv/bin/pytest backend/tests/test_instances_admin_api.py backend/tests/test_agents_admin_api.py` -> `passed (5 tests)`

## Revalidation 2026-04-29

- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel: `keine`
- Finale Freigabe: `APPROVED`
- Begruendung:
  - Die Instances-Seite bleibt auf aktuellem HEAD eine echte Instanzverwaltung mit Filtertabelle, defektem Operator-Zustand, scoped Deep-Links und ehrlicher Auto-Create-Rueckmeldung fuer den Default-Operator.
  - Der nachgezogene Global-Contract-Fix aus `00` hat den Instances-Flow nicht regressiv veraendert.
  - Die auf aktuellem HEAD erfolgreich gelaufenen Pruefkommandos `cd frontend && npm run build`, `cd frontend && npm test -- --runInBand` (Vitest-Option objektiv unsupported) und `cd frontend && npm test` decken den Instances-Stand mit ab.
