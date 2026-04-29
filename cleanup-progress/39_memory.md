# Promptdatei

`cleanup/39_memory.md`

# Developer-Zusammenfassung

Memory wurde von einer grossen Sammelseite zu einer Governance-Flaeche fuer Langzeitwahrheit umgebaut. Die Inventarsicht trennt jetzt konsequent zwischen `Durable Memory`, `Boot Memory Candidates`, `Working Context References` und `Revoked/Superseded`, damit Working Context nicht mehr als dauerhaftes Wissen erscheint. Die Tabellen zeigen pro Eintrag Inhalt-Kurzfassung, Scope, Quelle, Trust, Status, Expires/Review und Last Used direkt in der Uebersicht.

Die Detailansicht fuehrt Quelle, Governance, Nutzungsevidenz, Revisionen, Korrekturhistorie und Verwendungen in Runs, Conversations und Skills zusammen. Korrigieren, widerrufen und loeschen sind getrennte echte Aktionen mit unterschiedlicher Persistenzwirkung. Create/Edit wurde auf Review-, Trust- und Scope-Governance umgestellt; ungueltige Kombinationen wie Durable Memory ohne Review bei unsicherem Trust, Boot Memory ohne Learning Event oder Working Context ohne echte Arbeitsverknuepfung werden im Frontend und im Backend blockiert.

Backend-seitig wurden Memory-Vertraege und Service-Logik um Layer-Klassifikation, Review-Posture, Usage-Summaries, Last-Used-Berechnung, Revisionshistorie und Linkage-Nachweise erweitert. Die Tests decken jetzt die neue Governance-Semantik, echte Usage-Verknuepfungen mit Runs/Conversations/Skills und die getrennten Correct/Revoke/Delete-Wege ab.

# Geaenderte Dateien

- `frontend/src/pages/MemoryPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/knowledge-memory-pages.test.tsx`
- `backend/app/knowledge/models.py`
- `backend/app/knowledge/service.py`
- `backend/tests/test_knowledge_memory_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine. Der Auditor hat die gepruefte Fassung freigegeben.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED`

`APPROVED: cleanup/39_memory.md is satisfied by the current implementation. frontend/src/pages/MemoryPage.tsx cleanly separates Durable Memory, Boot Memory Candidates, Working Context References, and Revoked/Superseded; keeps scope and trust visible in inventory and detail; and exposes distinct real actions for save, correct, revoke, and delete. frontend/src/api/admin.ts, backend/app/api/admin/memory.py, backend/app/knowledge/models.py, and backend/app/knowledge/service.py back those actions with separate endpoints, persistence semantics, revision history, usage evidence, and front/back governance validation so working context does not masquerade as durable truth. Verified against frontend/tests/knowledge-memory-pages.test.tsx and backend/tests/test_knowledge_memory_admin_api.py, with npm run build, npm test -- knowledge-memory-pages, project-wide npm test, and the targeted backend pytest all passing; npm test -- --runInBand fails only because this Vitest setup does not support that option.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- knowledge-memory-pages` -> erfolgreich, `3` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_knowledge_memory_admin_api.py` -> erfolgreich, `8` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `50` Testdateien und `204` Tests bestanden
