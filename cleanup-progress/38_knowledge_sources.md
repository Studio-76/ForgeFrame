# Promptdatei

`cleanup/38_knowledge_sources.md`

# Developer-Zusammenfassung

Knowledge Sources wurde von einfachem Source-CRUD zu einer echten Connector- und Kontextquellenflaeche umgebaut. Die Inventarliste zeigt jetzt Source Type, Scope, Sync-Posture, letzte Synchronisation, Visibility und konkrete Fehler-/Next-Step-Informationen direkt in der Tabelle statt hinter irrelevanten Detailklicks zu verstecken.

Die Detailansicht fuehrt Connector-Konfiguration, indizierte Objekte, verknuepfte Contacts, Conversations, Skills und Durable Memory sowie die Trennung zwischen Recall und Memory zusammen. Create/Edit wurde nach Quellentyp strukturiert, mit typabhaengigen Connector-Feldern und freiem JSON nur noch im Advanced-Bereich. Wenn keine Sync-API existiert, wird kein Fake-Button angeboten; der Zustand wird explizit als `missing-runtime-state` dargestellt.

Backend-seitig wurden die Source-Vertraege um Sync-Posture, Scope-Label, Connector-Felder, Indexed-Counts, verknuepfte Skills/Conversations und eine klare Recall-vs-Memory-Erklaerung erweitert. Optionalfelder wie `last_synced_at`, `last_error`, `description` und `metadata` koennen beim Update jetzt auch wirklich geleert werden.

# Geaenderte Dateien

- `frontend/src/pages/KnowledgeSourcesPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/knowledge-memory-pages.test.tsx`
- `backend/app/knowledge/models.py`
- `backend/app/knowledge/service.py`
- `backend/tests/test_knowledge_memory_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine. Der Auditor hat die erste gepruefte Fassung freigegeben.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED`

`Geprüft gegen cleanup/38_knowledge_sources.md und direkt gelesen in frontend/src/pages/KnowledgeSourcesPage.tsx, frontend/src/api/admin.ts, backend/app/knowledge/models.py, backend/app/knowledge/service.py, frontend/tests/knowledge-memory-pages.test.tsx und backend/tests/test_knowledge_memory_admin_api.py. Die Seite erfüllt die Prompt-Ziele als echte Connector-/Kontextquellenfläche: Inventar mit Source type / Scope / Sync status / Last sync / Visibility / Error, Detail mit Connector-Konfiguration, Indexed-Counts, Fehler- und Next-Step-Wahrheit, klare missing-runtime-state-Kennzeichnung statt Fake-Sync-Aktion, deutliche Trennung Knowledge recall vs durable memory, strukturierte Create/Edit-Flows mit JSON nur in Advanced, sowie reale Links zu Contacts, Conversations, Skills und Memory. Verifiziert mit cd frontend && npm run build PASS, cd frontend && npm test -- knowledge-memory-pages PASS, ./.venv/bin/python -m pytest backend/tests/test_knowledge_memory_admin_api.py PASS; npm test -- --runInBand scheitert projektweit erwartbar an Vitest (CACError: Unknown option --runInBand), daher npm test als valider Fallback ebenfalls PASS.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- knowledge-memory-pages` -> erfolgreich, `3` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_knowledge_memory_admin_api.py` -> erfolgreich, `7` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `50` Testdateien und `204` Tests bestanden
