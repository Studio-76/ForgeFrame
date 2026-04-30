# Codex-CLI-Auftrag: Workspaces

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Workspaces sollen Auftrag/Issue/Conversation -> Workspace -> Preview -> Review -> Handoff/PR/Außenaktion ermöglichen. Aktuell ist es eher Inventar plus CRUD.

## Ziel der Seite

Workspaces wird zur Arbeits- und Handoff-Fläche: Workspace-Liste, Issue/Conversation-Link, Preview, Review-Status, Runs, Artifacts, Handoff-Ziel.

## Betroffene Frontend-Dateien

- frontend/src/pages/WorkspacesPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/workspaces.py

## Konkreter Umbauauftrag

1. Liste mit Workspace, Status, Owner, linked Issue/Conversation, Preview/Review/Handoff-Status, letzte Aktivität.
2. Detailpanel mit Kontext, Runs, Tasks, Approvals, Artifacts und Handoff-Verlauf.
3. Create/Edit in Drawer, Hauptaktion abhängig vom Status: Preview starten, Review anfordern, Handoff vorbereiten.
4. Wenn Preview/Handoff-APIs fehlen, zeige explicit not-ready und verlinke Artifacts/Execution.
5. Workspace nicht als GitHub-Ersatz darstellen, sondern als Übergabe- und Betriebsobjekt.

## Akzeptanzkriterien

- Ein Workspace zeigt seinen Arbeitsstand und nächste Aktion.
- Artefakte/Runs/Approvals sind verknüpft.
- Handoff-Status ist sichtbar oder ehrlich blockiert.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
