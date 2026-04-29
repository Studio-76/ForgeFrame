# Promptdatei

`cleanup/35_agents.md`

# Developer-Zusammenfassung

Agents wurde zu einer echten instanzbezogenen Registry mit separater Coordinator-Wahrheit ausgebaut. Die Seite zeigt jetzt eine Agententabelle mit Name, Role Kind, Status, Participation Mode, Profile-Link und letzter Aktivitaet; Create/Edit laeuft ueber einen Drawer, Participation Modes bleiben auf die real vom Backend getragenen Werte begrenzt, und die fehlenden Sollmodi `silent` sowie `subscribed` werden explizit als nicht unterstuetzte Backend-Luecke markiert statt gefaelscht editierbar gemacht.

Zusaetzlich trennt die Seite die verpflichtende Operator-Wahrheit von der gefilterten Tabellenansicht: der Required Operator wird immer ueber eine unfiltrierte Registry-Abfrage ermittelt, bleibt auch bei `status=paused` ehrlich sichtbar und kann aus einem Filterkontext wieder in die Tabelle geholt werden. Die Conversations-Seite respektiert Participation Modes jetzt bei Participant-, Mention-, Roundtable- und Handoff-/Review-/Blocker-Pickern, so dass Routing-Kontrollen nur Agenten anbieten, die fuer die jeweilige Aktion wirklich addressierbar sind.

Backend-seitig wurden Agent-Summaries um echte Conversation-/Mention-Zaehlungen, Last-Activity und Addressability-Erklaerungen erweitert. Das ist durch End-to-End-Tests gegen persistierte Conversations, Mentions und Events abgesichert.

# Geaenderte Dateien

- `frontend/src/pages/AgentsPage.tsx`
- `frontend/src/pages/ConversationsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/instances-page-agents-truth.test.tsx`
- `frontend/tests/conversation-inbox-pages.test.tsx`
- `frontend/tests/admin-api-agents.test.ts`
- `backend/app/agents/models.py`
- `backend/app/agents/service.py`
- `backend/tests/test_agents_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Erste Audit-Runde: Die Seite leitete `Operator missing` aus der aktuell gefilterten Tabelle ab. Bei `status=paused` oder `status=archived` verschwand dadurch ein real vorhandener aktiver Operator aus der Ansicht und wurde faelschlich als fehlend gemeldet.
- Erste Audit-Runde: Der Repair-Pfad pruefte den Erfolg ebenfalls gegen die gefilterte Liste und konnte deshalb `Operator repair request completed, but no Operator record was returned.` anzeigen, obwohl die unfiltrierte Registry bereits einen gueltigen Operator enthielt.
- Erste Audit-Runde: Der Regressionstest fuer genau diesen Filterfall fehlte.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED: frontend/src/pages/AgentsPage.tsx now separates required-Operator truth from the filtered registry, so the page no longer fabricates an Operator missing defect when status=paused or another filter hides a valid coordinator. The prompt’s core requirements are met: mandatory Operator visibility/warning, real table columns, backend-aligned role/participation modes with explicit unsupported gaps, real conversation addressability links, and no fantasy roles or dead placeholder controls; frontend/tests/instances-page-agents-truth.test.tsx now explicitly covers the paused-filter regression.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- admin-api-agents instances-page-agents-truth conversation-inbox-pages` -> erfolgreich, `10` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_agents_admin_api.py` -> erfolgreich, `3` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `50` Testdateien und `203` Tests bestanden
