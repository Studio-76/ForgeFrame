# Promptdatei

`cleanup/31_tasks.md`

# Developer-Zusammenfassung

Tasks wurde von einer generischen CRUD-Seite zu einer echten Aufgabensteuerung umgebaut. Die Seite zeigt jetzt eine tabellarische Task-Liste mit Status, Owner, Due, Priority und Linked Context, ein Detailpanel mit Checkpoints und direkten Statusaktionen, Drawer-basierte Create/Edit-Flows statt permanenter Formularwaende sowie einen echten Reminder-Handoff direkt aus dem Task. Fehlende direkte Task-Felder fuer Run und Approval werden sichtbar und ehrlich als `bridge-only` markiert; Artifact-Kontext ist bei verknuepftem Workspace direkt erreichbar.

# Geaenderte Dateien

- `frontend/src/pages/TasksPage.tsx`
- `frontend/tests/tasking-delivery-pages.test.tsx`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine. Aquinas hat fuer Prompt 31 keine offenen Maengel festgestellt.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED: Der aktuelle Stand von frontend/src/pages/TasksPage.tsx erfuellt cleanup/31_tasks.md sauber: tabellarische Task-Liste mit den geforderten Arbeitsfeldern, echtes Detailpanel mit wirksamen Statusaktionen, Drawer-basierte Create/Edit-Flows, direkter Reminder-Pfad und ehrliche bridge-only-/not-ready-Kennzeichnung statt Scheinfunktionen. Die zuletzt geaenderten Kontext- und Linkpfade bleiben dabei bedienbar und hinterlassen keine toten Aktionen.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- tasking-delivery-pages` -> erfolgreich, `11` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `49` Testdateien und `199` Tests bestanden
