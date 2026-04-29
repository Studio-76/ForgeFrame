# Promptdatei

`cleanup/32_reminders.md`

# Developer-Zusammenfassung

Reminders wurde von einer einfachen Verwaltungsseite zu einer echten Wiedervorlageflaeche umgebaut. Die Inventarliste gruppiert Reminder jetzt in `overdue`, `due now`, `upcoming` und `completed / cancelled`, das Detailpanel zeigt Ursprung und Linkage zu Task, Conversation, Automation und Notification, und die direkten Aktionen `snooze`, `complete` und `cancel` wirken ueber den realen Reminder-PATCH-Pfad. Create/Edit wurden in einen sekundären Drawer verschoben, waehrend due-Zeitpunkt und Viewer-Zeitzone transparent angezeigt werden.

# Geaenderte Dateien

- `frontend/src/pages/RemindersPage.tsx`
- `frontend/tests/tasking-delivery-pages.test.tsx`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine. Aquinas hat fuer Prompt 32 keine offenen Maengel festgestellt.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED: frontend/src/pages/RemindersPage.tsx erfuellt cleanup/32_reminders.md sauber als echte Wiedervorlagenflaeche: sichtbare Gruppierung nach overdue / due now / upcoming / completed / cancelled, Detailpanel mit Task-/Conversation-/Automation-/Notification-Ursprung, transparente due_at- und Zeitzonenanzeige sowie reale snooze-/complete-/cancel-Wirkung ueber die vorhandene Reminder-PATCH-API. Create/Edit bleiben sekundaer im Drawer, tote Aktionen sind vermieden, und frontend/tests/tasking-delivery-pages.test.tsx deckt Gruppierung, Direktaktionen sowie Drawer-basierte Create/Edit-Pfade gegen die echten API-Mocks ab.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- tasking-delivery-pages` -> erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `49` Testdateien und `200` Tests bestanden
