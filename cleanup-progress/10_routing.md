# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/10_routing.md`
- Developer-Zusammenfassung: `Die Routing-Seite wurde von einer dichten Mischansicht zu einem echten Policy-Editor und Simulator umgebaut: oben sichtbare Instanz-/Policy-/Blocker-Lage mit Primäraktion, strukturierter Policy-Editor fuer simple/non-simple inklusive Target-Pools, Fallback, Eskalation, Budget- und Circuit-Verhalten, ein Dry-Run mit Request-Class, Provider-/Model-Scope, Request-Path, Budget-Scope und Erwartungs-Lane sowie ein entscheidungsorientiertes Ledger mit Logs-/Execution-Handoffs. Zusätzlich wurde der Simulations-API-Vertrag bereinigt: Admin-Simulationen liefern jetzt denselben persistierten Routing-Decision-Datensatz wie das Ledger, und Provider-Scope plus Route-Context werden bis in die Routing-Domain durchgereicht.`
- Geaenderte Dateien:
  - `frontend/src/pages/RoutingPage.tsx`
  - `frontend/src/api/admin.ts`
  - `frontend/tests/routing-page.test.tsx`
  - `backend/app/api/admin/control_plane_models.py`
  - `backend/app/api/admin/control_plane_routing_domain.py`
  - `backend/tests/test_routing_admin_api.py`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Runde 1`: Die bestehende Seite mischte Routing-Klasse, Lane, Budget und Simulation zu dicht, hatte noch Header-Wegweiser statt klarer Operator-ActionBar und der Simulationsrequest bildete Provider-/Route-/Budget-Kontext nicht real ab.
  - `Runde 2`: Der erste Implementierungsschnitt enthielt einen JSX-Parserfehler (`->` im JSX-Text) sowie ungenutzte Symbole; dadurch war Build/Test noch nicht freigabefaehig.
  - `Runde 3`: Der Budget-Scope-Umschaltpfad hielt beim Wechsel von `instance` auf `agent` bzw. `task` unguenstig den Instance-Key fest; zusaetzlich waren Frontend- und Backend-Tests an einigen Stellen zu eng bzw. auf einen alten API-Harness zugeschnitten.
- Fix-Runden: `3`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `PASS`
  - `cd frontend && npm test -- --runInBand` -> `FAIL, Vitest/CAC kennt die Option --runInBand in diesem Projekt nicht`
  - `cd frontend && npm test -- routing-page` -> `PASS`
  - `cd frontend && npm test` -> `PASS (42/42 Testdateien, 161/161 Tests)`
  - `/opt/ForgeFrame/.venv/bin/pytest backend/tests/test_routing_admin_api.py backend/tests/test_routing_service.py` -> `PASS (10 Tests)`

## Finale Freigabe

- Audit-Ergebnis: `APPROVED`
- Begruendung:
  - Die Seite zeigt oben aktive Instanz, Policy-Posture, sichtbare Blocker und eine Primäraktion fuer Edit oder Simulation.
  - Der Policy-Editor trennt Klassifikation, erlaubte Target-Pools, Fallback/Eskalation sowie Budget-/Circuit-Verhalten explizit und real.
  - Der Dry-Run erfasst Request-Class, Capabilities, Budget-Scope, Provider/Model, Request-Path und Expected Lane; die Simulation wirkt bis in die Routing-Domain ueber `allowed_providers` und `route_context`.
  - Das Simulationsergebnis ist dreistufig aufgebaut: Kurzentscheidung, menschenlesbare Faktoren und kollabierte Rohdetails.
  - Recent Decisions zeigen gewaehltes Target, verworfene Kandidaten, Gruende und echte Handoffs zu Logs, Execution Review und Provider Targets.
  - Admin-Simulationen liefern jetzt denselben persistierten Decision-Datensatz wie das Routing-Ledger, wodurch Frontend, Ledger und API-Vertrag konsistent sind.
