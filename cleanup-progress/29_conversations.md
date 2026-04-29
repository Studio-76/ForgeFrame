# Promptdatei

`cleanup/29_conversations.md`

# Developer-Zusammenfassung

Die Conversations-Seite wurde von einer CRUD-dominierten Detailmaske zu einer primären Work-Interaction-Fläche umgestellt. Oben bleibt die Instanz-/Status-/Triage-Steuerung, jetzt ergänzt um einen echten Link-Lens. Der Hauptbereich arbeitet in drei Spalten: links Conversation- und Thread-Inventar, in der Mitte ein nutzbarer Verlauf mit chronologischer Timeline aus Messages und Systemereignissen sowie einem strukturierten Message-Composer, rechts Conversation-Lenses, Thread-/Session-Kontext und verknüpfte Objekte. Strukturierte Agentenadressierung ist real über Mention-/Handoff-/Review-/Blocker-/Roundtable-Felder nutzbar. Zusätzlich werden verknüpfte Tasks über die vorhandene Tasks-API geladen und sichtbar verlinkt. Create/Edit bleiben erhalten, wurden aber klar in den sekundären Bereich verschoben.

# Geänderte Dateien

- `frontend/src/pages/ConversationsPage.tsx`
- `frontend/tests/conversation-inbox-pages.test.tsx`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Mängel

- Keine.

# Fix-Runden

- Keine.

# Finale Freigabe

Senior Audit/Review Sub-Agent: `APPROVED`

Begründung: Die Seite erfüllt Prompt 29 inhaltlich. Conversations ist als echte Work-Interaction-Fläche mit Verlauf, strukturiertem Composer, Lenses, Thread-/Session-Kontext und sichtbaren Objektverknüpfungen umgesetzt; Create/Edit sind nachgeordnet.

# Ausgeführte Prüfkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- conversation-inbox-pages`
  - PASS (`5` Tests)
- `cd /opt/ForgeFrame/frontend && npm run build`
  - PASS
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - FAIL
  - Objektiver Blocker: Das Projekt verwendet Vitest; die CLI meldet `CACError: Unknown option --runInBand`.
- `cd /opt/ForgeFrame/frontend && npm test`
  - PASS (`49` Testdateien, `197` Tests)
