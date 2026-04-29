Promptdatei: `cleanup/44_artifacts.md`

Developer-Zusammenfassung:
- Artefakte von einfachem Attachment-CRUD auf echte Artefaktverwaltung umgestellt.
- Backend-Vertrag um `scope`, `workspace_role`, `version`, `checksum_sha256`, `retention_policy`, `retained_until` und `archive_reason` erweitert; Persistenz läuft sauber über strukturierte Metadaten.
- Artefakt-Updates können optionale Access-/Retention-Felder jetzt explizit löschen, statt alte Werte still stehen zu lassen.
- Frontend-Inventar auf Tabelle mit Artefakt, Typ, Scope, Größe/Checksumme, Version, Kernverknüpfungen und Zeitstempel umgebaut.
- Detailansicht zeigt echte Preview-/Download-Links nur bei browser-erreichbaren URLs; sonst klar `metadata-only` / bridge-only statt Fake-Download.
- Create/Edit auf strukturierte Metadatenflüsse umgebaut; rohes JSON nur noch in `Advanced metadata`.
- Link-Truth für `Workspace`, `Run` und `Approval` im Inventar priorisiert; zusätzliche Links werden erst danach gekürzt.

Geänderte Dateien:
- `backend/app/artifacts/models.py`
- `backend/app/workspaces/service.py`
- `backend/tests/test_workspaces_artifacts_admin_api.py`
- `frontend/src/api/admin.ts`
- `frontend/src/pages/ArtifactsPage.tsx`
- `frontend/tests/work-interaction-pages.test.tsx`

Audit-Ergebnis:
- Erstprüfung: `REJECTED`
- Nach Fix-Runde: `APPROVED`

Konkrete Audit-Mängel:
- Kernverknüpfungen `Workspace / Run / Approval` konnten im Inventar hinter Nebenlinks verschwinden.
- Sichtbarkeit war wegen nicht priorisierter Attachment-Reihenfolge faktisch tie-order-abhängig.
- Regression war nicht per Test gegen Mehrfachverknüpfungen abgesichert.

Fix-Runden:
- Runde 1:
  - Frontend-Linkliste auf feste Priorität `workspace -> run -> approval -> instance -> decision` umgestellt.
  - Backend-Attachment-Reihenfolge zusätzlich stabilisiert.
  - Regressionstest ergänzt: Inventarzeile mit `workspace + run + approval + instance + decision` muss die drei Kernlinks sichtbar halten.

Finale Freigabe:
- `APPROVED` durch Sub-Agent `Aquinas`

Ausgeführte Prüfkommandos:
- `cd frontend && npm test -- work-interaction-pages`
  - PASS
- `./.venv/bin/python -m pytest backend/tests/test_workspaces_artifacts_admin_api.py`
  - PASS (`5 passed`)
- `cd frontend && npm run build`
  - PASS
- `cd frontend && npm test -- --runInBand`
  - FAIL, objektiver Tool-Blocker: dieses Projekt nutzt `vitest`, und `vitest run` kennt die Option `--runInBand` nicht (`CACError: Unknown option --runInBand`).
- `cd frontend && npm test`
  - PASS (`52` Testdateien, `211` Tests)
