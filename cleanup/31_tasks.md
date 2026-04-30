# Codex-CLI-Auftrag: Tasks

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Tasks muss explizite Arbeitsgegenstände mit Zuständigkeit, Status, Kontext und Verknüpfungen darstellen. Aktuell wirkt die Seite wie generisches CRUD.

## Ziel der Seite

Tasks wird zur Aufgabensteuerung: Task-Liste, Status, Owner/Agent, Fälligkeit, Links zu Conversations, Runs, Approvals, Reminders, Workspaces und Artifacts.

## Betroffene Frontend-Dateien

- frontend/src/pages/TasksPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/tasks.py

## Konkreter Umbauauftrag

1. Tabellarische Task-Liste mit Status, Owner, Due, Priority, Linked Conversation/Run/Workspace.
2. Detailpanel mit Kontext, Checkpoints, verknüpften Objekten und erlaubten Statusaktionen.
3. Create/Edit in Drawer, nicht als dauerhafte Formularwand.
4. Filter nach Status `neu/relevant/delegiert/blockiert/wartend/erledigt/archiviert` oder tatsächlicher Backend-State-Map.
5. Reminder-Erzeugung oder Verlinkung direkt aus Task anbieten, falls API vorhanden.

## Akzeptanzkriterien

- Tasks sind als Arbeitsobjekte und nicht nur Datensätze sichtbar.
- Status/Fälligkeit/Owner sind schnell erfassbar.
- Verknüpfte Produktobjekte sind direkt erreichbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
