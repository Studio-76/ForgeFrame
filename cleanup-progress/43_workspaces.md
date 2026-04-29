# Promptdatei

`cleanup/43_workspaces.md`

# Developer-Zusammenfassung

Workspaces wurde von einer Inventar-plus-CRUD-Seite zu einer echten Arbeits- und Handoff-Flaeche umgebaut. Die Inventartabelle zeigt jetzt Workspace, Owner, verlinktes Issue oder letzte Conversation, Preview-/Review-/Handoff-Posture, naechste Aktion und letzte Aktivitaet. Damit ist sofort sichtbar, wo ein Workspace im Arbeitsfluss steht und ob der naechste Schritt wirklich ausfuehrbar oder ehrlich `not_ready` ist.

Die Detailansicht verbindet Kontext, Conversations, Tasks, Runs, Approvals, Artifacts und dedizierte Handoff-History. Die primaere Aktion ist statusabhaengig und laeuft real ueber `updateWorkspace`, aber nur dann, wenn echte Evidenz vorhanden ist. Fehlen Preview- oder Handoff-APIs bzw. die benoetigten Nachweise, zeigt die Seite explizit `not_ready` samt Links zu Artifacts, Execution und Approvals statt Fake-Buttons oder stillen Lebenszyklus-Spruengen.

Create/Edit wurde in einen Drawer verlegt und gleichzeitig von Lifecycle-Fabrikation bereinigt: der Drawer bearbeitet Kernkontext und Referenzen, aber keine frei setzbaren Preview-/Review-/Handoff-Status mehr. Backend-seitig liefert Workspace-Truth jetzt Conversation-/Task-Zusammenfassungen, `next_action`, `last_activity_at` und harte Lifecycle-Validierung. Unmoegliche manuelle Spruenge wie `review approved` oder `handoff delivered` ohne Evidenz werden mit Konflikt abgewiesen und erzeugen keine falschen Workspace-Events.

# Geaenderte Dateien

- `frontend/src/pages/WorkspacesPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/work-interaction-pages.test.tsx`
- `backend/app/workspaces/models.py`
- `backend/app/workspaces/service.py`
- `backend/tests/test_workspaces_artifacts_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Die erste Umsetzung erlaubte noch direkte Lifecycle-Manipulation im Drawer (`preview`, `review`, `handoff`) und konnte damit Preview-/Review-/Handoff-Wahrheit ohne Evidenz faken.
- `backend/app/workspaces/service.py` akzeptierte zunaechst ungueltige Statuskombinationen und haette dadurch falsche Lifecycle-Events persistieren koennen.
- Die ersten Tests deckten den Missbrauchspfad fuer unmoegliche manuelle Lifecycle-Spruenge noch nicht explizit ab.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED`

`APPROVED: \`cleanup/43_workspaces.md\` is now satisfied. \`frontend/src/pages/WorkspacesPage.tsx\` keeps create/edit in a drawer but no longer exposes lifecycle fabrication controls; preview/review/handoff move from the detail-panel primary action or evidence links, and \`not_ready\` states stay explicit with artifact/execution/approval links. \`backend/app/workspaces/service.py\` now enforces lifecycle validation for preview, review, handoff-ready, and handoff-delivered transitions, and the new frontend/backend regression tests in \`frontend/tests/work-interaction-pages.test.tsx\` and \`backend/tests/test_workspaces_artifacts_admin_api.py\` explicitly cover blocked manual jumps and honest blocker rendering.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- work-interaction-pages` -> erfolgreich, `6` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_workspaces_artifacts_admin_api.py` -> erfolgreich, `4` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `52` Testdateien und `210` Tests bestanden
